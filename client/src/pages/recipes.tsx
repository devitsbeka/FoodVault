import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Clock, Flame, ChefHat, Star, Refrigerator } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import type { Recipe } from "@shared/schema";

type RecipeWithRating = Recipe & {
  averageRating?: number;
  ratingCount?: number;
  matchPercentage?: number;
};

export default function Recipes() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    dietType: "all",
    cuisine: "all",
    mealType: "all",
    maxCalories: 2000,
    ingredientMatch: 0, // Off by default
  });

  const { data: recipes, isLoading, error } = useQuery<RecipeWithRating[]>({
    queryKey: ["/api/recipes", searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (filters.dietType !== "all") params.append("dietType", filters.dietType);
      if (filters.cuisine !== "all") params.append("cuisine", filters.cuisine);
      if (filters.mealType !== "all") params.append("mealType", filters.mealType);
      if (filters.maxCalories < 2000) params.append("maxCalories", filters.maxCalories.toString());
      // Only send ingredientMatch if it's enabled (> 0)
      if (filters.ingredientMatch > 0) {
        params.append("ingredientMatch", filters.ingredientMatch.toString());
      }
      
      const url = `/api/recipes${params.toString() ? `?${params.toString()}` : ""}`;
      console.log("Fetching recipes from:", url);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        console.error("Recipes API error:", res.status, res.statusText);
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      console.log("Recipes received:", data?.length || 0);
      return data;
    },
  });

  const dietOptions = [
    { value: "all", label: "All Diets" },
    { value: "vegetarian", label: "Vegetarian" },
    { value: "vegan", label: "Vegan" },
    { value: "keto", label: "Keto" },
    { value: "paleo", label: "Paleo" },
    { value: "gluten-free", label: "Gluten-Free" },
  ];

  const cuisineOptions = [
    { value: "all", label: "All Cuisines" },
    { value: "italian", label: "Italian" },
    { value: "mexican", label: "Mexican" },
    { value: "chinese", label: "Chinese" },
    { value: "indian", label: "Indian" },
    { value: "japanese", label: "Japanese" },
    { value: "thai", label: "Thai" },
    { value: "french", label: "French" },
    { value: "mediterranean", label: "Mediterranean" },
    { value: "american", label: "American" },
  ];

  const mealTypeOptions = [
    { value: "all", label: "All Meals" },
    { value: "breakfast", label: "Breakfast" },
    { value: "lunch", label: "Lunch" },
    { value: "dinner", label: "Dinner" },
    { value: "snack", label: "Snack" },
  ];

  // Track recipe searches for smart recommendations
  useEffect(() => {
    const hasActiveSearch = searchQuery || 
                           filters.dietType !== "all" || 
                           filters.cuisine !== "all" ||
                           filters.mealType !== "all" ||
                           filters.maxCalories < 2000 || 
                           filters.ingredientMatch > 0;
    
    if (recipes && recipes.length > 0 && user && hasActiveSearch) {
      // Track first 5 recipes shown in search results
      const recipesToTrack = recipes.slice(0, 5);
      recipesToTrack.forEach(recipe => {
        apiRequest("POST", "/api/recipe-interactions", {
          recipeId: recipe.id,
          interactionType: "search",
        }).catch(() => {
          // Silently fail - tracking shouldn't disrupt user experience
        });
      });
    }
  }, [recipes, user, searchQuery, filters.dietType, filters.cuisine, filters.mealType, filters.maxCalories, filters.ingredientMatch]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-large-title">Discover Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Find the perfect recipe for your ingredients and preferences
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-recipes"
        />
      </div>

      {/* Inline Filters - Airbnb Style */}
      <div className="flex flex-wrap gap-3">
        {/* Cuisine Filter */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm font-medium text-muted-foreground">Cuisine:</span>
          {cuisineOptions.map((option) => (
            <Button
              key={option.value}
              variant={filters.cuisine === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters({ ...filters, cuisine: option.value })}
              data-testid={`filter-cuisine-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Meal Type Filter */}
        <div className="flex gap-2 flex-wrap items-center border-l pl-3">
          <span className="text-sm font-medium text-muted-foreground">Meal:</span>
          {mealTypeOptions.map((option) => (
            <Button
              key={option.value}
              variant={filters.mealType === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters({ ...filters, mealType: option.value })}
              data-testid={`filter-meal-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Diet Type Filter */}
        <div className="flex gap-2 flex-wrap items-center border-l pl-3">
          <span className="text-sm font-medium text-muted-foreground">Diet:</span>
          {dietOptions.map((option) => (
            <Button
              key={option.value}
              variant={filters.dietType === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilters({ ...filters, dietType: option.value })}
              data-testid={`filter-diet-${option.value}`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Clear Filters */}
        {(filters.dietType !== "all" || filters.cuisine !== "all" || filters.mealType !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ ...filters, dietType: "all", cuisine: "all", mealType: "all" })}
            data-testid="button-clear-filters"
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card className="p-12">
          <div className="text-center">
            <ChefHat className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error loading recipes</h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "Something went wrong"}
            </p>
            <Button onClick={() => window.location.reload()} data-testid="button-reload-recipes">
              Reload Page
            </Button>
          </div>
        </Card>
      ) : !recipes || recipes.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No recipes found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters or search query
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
              <Card className="overflow-hidden hover-elevate cursor-pointer h-full" data-testid={`recipe-card-${recipe.id}`}>
                <div className="aspect-video bg-muted relative">
                  {recipe.imageUrl ? (
                    <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  {recipe.matchPercentage !== undefined && recipe.matchPercentage > 0 && (
                    <Badge className="absolute top-2 left-2 flex items-center gap-1" variant="secondary" data-testid={`badge-match-${recipe.id}`}>
                      <Refrigerator className="w-3 h-3" />
                      {recipe.matchPercentage}%
                    </Badge>
                  )}
                  {recipe.dietType && (
                    <Badge className="absolute top-2 right-2" variant="secondary">
                      {recipe.dietType}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-lg line-clamp-1 flex-1">{recipe.name}</h3>
                    {recipe.averageRating && recipe.averageRating > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="w-4 h-4 fill-primary text-primary" />
                        <span className="text-sm font-medium">{recipe.averageRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {recipe.description || "A delicious recipe waiting for you to try"}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {recipe.prepTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{recipe.prepTime + (recipe.cookTime || 0)} min</span>
                      </div>
                    )}
                    {recipe.calories && (
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4" />
                        <span>{recipe.calories} cal</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

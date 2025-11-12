import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, SlidersHorizontal, Clock, Flame, ChefHat, Star } from "lucide-react";
import { Link } from "wouter";
import type { Recipe } from "@shared/schema";

type RecipeWithRating = Recipe & {
  averageRating?: number;
  ratingCount?: number;
};

export default function Recipes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    dietType: "all",
    maxCalories: 2000,
    ingredientMatch: 50,
  });

  const { data: recipes, isLoading } = useQuery<RecipeWithRating[]>({
    queryKey: ["/api/recipes", searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (filters.dietType !== "all") params.append("dietType", filters.dietType);
      if (filters.maxCalories < 2000) params.append("maxCalories", filters.maxCalories.toString());
      if (filters.ingredientMatch > 0) params.append("ingredientMatch", filters.ingredientMatch.toString());
      
      const url = `/api/recipes${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-large-title">Discover Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Find the perfect recipe for your ingredients and preferences
        </p>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-recipes"
          />
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-open-filters">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Recipe Filters</SheetTitle>
              <SheetDescription>
                Customize your recipe search preferences
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 mt-6">
              <div>
                <Label>Diet Type</Label>
                <Select value={filters.dietType} onValueChange={(value) => setFilters({ ...filters, dietType: value })}>
                  <SelectTrigger data-testid="select-diet-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dietOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Maximum Calories</Label>
                <div className="pt-2">
                  <Slider
                    value={[filters.maxCalories]}
                    onValueChange={([value]) => setFilters({ ...filters, maxCalories: value })}
                    min={100}
                    max={2000}
                    step={50}
                    data-testid="slider-calories"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {filters.maxCalories} calories
                  </p>
                </div>
              </div>

              <div>
                <Label>Ingredient Match Threshold</Label>
                <div className="pt-2">
                  <Slider
                    value={[filters.ingredientMatch]}
                    onValueChange={([value]) => setFilters({ ...filters, ingredientMatch: value })}
                    min={0}
                    max={100}
                    step={10}
                    data-testid="slider-ingredient-match"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    At least {filters.ingredientMatch}% of ingredients on hand
                  </p>
                </div>
              </div>

              <Button className="w-full" onClick={() => {}}>
                Apply Filters
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filters */}
      {(filters.dietType !== "all" || filters.maxCalories !== 2000 || filters.ingredientMatch !== 50) && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {filters.dietType !== "all" && (
            <Badge variant="secondary" data-testid="badge-diet-filter">
              {dietOptions.find(d => d.value === filters.dietType)?.label}
            </Badge>
          )}
          {filters.maxCalories !== 2000 && (
            <Badge variant="secondary" data-testid="badge-calories-filter">
              Max {filters.maxCalories} cal
            </Badge>
          )}
          {filters.ingredientMatch !== 50 && (
            <Badge variant="secondary" data-testid="badge-match-filter">
              {filters.ingredientMatch}% match
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFilters({ dietType: "all", maxCalories: 2000, ingredientMatch: 50 })}
            className="h-6 px-2 text-xs"
            data-testid="button-clear-filters"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Recipe Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array(6).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-xl" />
          ))}
        </div>
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

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChefHat, Clock, Flame, Star, FilterX } from "lucide-react";

interface Recipe {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  prepTime?: number;
  cookTime?: number;
  calories?: number;
  dietType?: string;
  averageRating?: number;
  ratingCount?: number;
}

interface RecipePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  combinedDietaryRestrictions: string[];
  seatNumber: number;
}

export function RecipePickerModal({
  open,
  onOpenChange,
  onSelectRecipe,
  combinedDietaryRestrictions,
  seatNumber,
}: RecipePickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Map combined dietary restrictions to dietType filter
  // Use most restrictive diet type from ALL seats
  const getDietTypeFilter = () => {
    if (combinedDietaryRestrictions.includes("Vegan")) return "vegan";
    if (combinedDietaryRestrictions.includes("Vegetarian")) return "vegetarian";
    if (combinedDietaryRestrictions.includes("Low-Carb")) return "keto";
    return undefined;
  };

  const dietType = getDietTypeFilter();

  // Fetch recipes filtered by backend using dietary restrictions
  // Backend filters by tags for DB recipes, diet type for external API recipes
  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: [
      "/api/recipes",
      {
        search: debouncedSearch,
        dietType,
        restrictions: combinedDietaryRestrictions.join(','),
        limit: 30,
      },
    ],
    enabled: open,
  });

  // No client-side filtering needed - backend handles all dietary restrictions
  const filteredRecipes = recipes;

  const handleSelectRecipe = (recipe: Recipe) => {
    onSelectRecipe(recipe);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]" data-testid="dialog-recipe-picker">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            Select Recipe for Seat {seatNumber}
          </DialogTitle>
          <DialogDescription>
            {combinedDietaryRestrictions.length > 0 ? (
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-sm">Filtering for all diners:</span>
                {combinedDietaryRestrictions.map((restriction) => (
                  <Badge key={restriction} variant="secondary" className="text-xs">
                    {restriction}
                  </Badge>
                ))}
              </div>
            ) : (
              <span>Browse all available recipes</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-recipe-search"
            />
          </div>

          {/* Recipe Grid */}
          <ScrollArea className="h-[50vh]">
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array(6)
                  .fill(0)
                  .map((_, i) => (
                    <Skeleton key={i} className="h-48 rounded-xl" />
                  ))}
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FilterX className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No recipes found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {combinedDietaryRestrictions.length > 0
                    ? "No recipes match all dietary restrictions. Try adjusting seat restrictions or search terms."
                    : "Try a different search term"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 pb-4">
                {filteredRecipes.map((recipe) => (
                  <Card
                    key={recipe.id}
                    className="overflow-hidden hover-elevate cursor-pointer"
                    onClick={() => handleSelectRecipe(recipe)}
                    data-testid={`recipe-card-${recipe.id}`}
                  >
                    <div className="aspect-video bg-muted relative">
                      {recipe.imageUrl ? (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat className="w-12 h-12 text-muted-foreground" />
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
                        <h3 className="font-semibold line-clamp-1 flex-1">{recipe.name}</h3>
                        {recipe.averageRating && recipe.averageRating > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Star className="w-4 h-4 fill-primary text-primary" />
                            <span className="text-sm font-medium">
                              {recipe.averageRating.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
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
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

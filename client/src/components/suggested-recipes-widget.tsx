import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Clock, Flame } from "lucide-react";
import { Link } from "wouter";
import type { Recipe } from "@shared/schema";

export function SuggestedRecipesWidget() {
  const { data: recommendedRecipes, isLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/recommended"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ChefHat className="w-4 h-4" />
            Suggested Recipes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-20 h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ChefHat className="w-4 h-4" />
          Suggested Recipes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!recommendedRecipes || recommendedRecipes.length === 0 ? (
          <div className="text-center py-8" data-testid="no-suggestions-message">
            <ChefHat className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Add ingredients to get personalized recipe suggestions
            </p>
            <Link href="/my-kitchen">
              <span className="text-sm text-primary hover:underline cursor-pointer">
                Add ingredients
              </span>
            </Link>
          </div>
        ) : (
          recommendedRecipes.slice(0, 3).map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
              <div
                className="flex gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
                data-testid={`suggested-recipe-${recipe.id}`}
              >
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                  {recipe.imageUrl ? (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ChefHat className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium mb-1 truncate">{recipe.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5">
                    {recipe.description || "Delicious recipe waiting for you"}
                  </p>
                  <div className="flex gap-1">
                    {recipe.calories && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                        <Flame className="w-3 h-3 mr-0.5" />
                        {recipe.calories}
                      </Badge>
                    )}
                    {recipe.prepTime && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                        <Clock className="w-3 h-3 mr-0.5" />
                        {recipe.prepTime}m
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

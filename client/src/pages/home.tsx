import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChefHat, Refrigerator, Calendar, ShoppingCart, TrendingUp, Clock } from "lucide-react";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import { useAuth } from "@/hooks/useAuth";
import type { Recipe, KitchenInventory, MealPlan } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user is new (show onboarding on first visit)
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding");
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("hasSeenOnboarding", "true");
    setShowOnboarding(false);
  };

  // Fetch dashboard data
  const { data: inventory, isLoading: inventoryLoading } = useQuery<KitchenInventory[]>({
    queryKey: ["/api/kitchen-inventory"],
  });

  const { data: upcomingMeals, isLoading: mealsLoading } = useQuery<(MealPlan & { recipe: Recipe })[]>({
    queryKey: ["/api/meal-plans/upcoming"],
  });

  const { data: recommendedRecipes, isLoading: recipesLoading } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes/recommended"],
  });

  const expiringItems = inventory?.filter((item) => {
    if (!item.expirationDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
  }) || [];

  if (showOnboarding) {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-large-title mb-2">
          Welcome back, {user?.firstName || "Chef"}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening in your kitchen today
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Kitchen Items</CardTitle>
            <Refrigerator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-inventory-count">
              {inventoryLoading ? <Skeleton className="h-8 w-16" /> : inventory?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Items in your kitchen
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-expiring-count">
              {inventoryLoading ? <Skeleton className="h-8 w-16" /> : expiringItems.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Next 3 days
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Meals</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-meals-count">
              {mealsLoading ? <Skeleton className="h-8 w-16" /> : upcomingMeals?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Planned this week
            </p>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-recommendations-count">
              {recipesLoading ? <Skeleton className="h-8 w-16" /> : recommendedRecipes?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Recipes for you
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Expiring Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Expiring Soon
            </CardTitle>
            <CardDescription>Use these ingredients before they go bad</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))
            ) : expiringItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No items expiring soon! 🎉
              </p>
            ) : (
              expiringItems.map((item) => {
                const daysLeft = Math.ceil(
                  (new Date(item.expirationDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/10 border border-destructive/20" data-testid={`expiring-item-${item.id}`}>
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {daysLeft === 0 ? "Expires today" : `${daysLeft} day${daysLeft > 1 ? "s" : ""} left`}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-destructive">
                      {item.category}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recommended Recipes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5" />
              Recommended for You
            </CardTitle>
            <CardDescription>Recipes based on your ingredients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recipesLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-20 h-20 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))
            ) : !recommendedRecipes || recommendedRecipes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Add ingredients to get recipe recommendations
              </p>
            ) : (
              recommendedRecipes.slice(0, 3).map((recipe) => (
                <div key={recipe.id} className="flex gap-3 p-3 rounded-lg hover-elevate cursor-pointer" data-testid={`recommended-recipe-${recipe.id}`}>
                  <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                    {recipe.imageUrl ? (
                      <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ChefHat className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">{recipe.name}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {recipe.description || "Delicious recipe waiting for you"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get you started</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" data-testid="button-add-ingredient">
            <Refrigerator className="w-6 h-6" />
            <span>Add Ingredient</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" data-testid="button-browse-recipes">
            <ChefHat className="w-6 h-6" />
            <span>Browse Recipes</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" data-testid="button-plan-meal">
            <Calendar className="w-6 h-6" />
            <span>Plan Meal</span>
          </Button>
          <Button variant="outline" className="h-auto py-6 flex-col gap-2" data-testid="button-shopping-list">
            <ShoppingCart className="w-6 h-6" />
            <span>Shopping List</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

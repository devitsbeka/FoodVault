import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Plus, Coffee, Sun, Moon, Utensils, TrendingUp } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { Recipe, NutritionLog, NutritionLogMeal } from "@shared/schema";

type NutritionLogWithMeals = NutritionLog & { meals: NutritionLogMeal[] };

type WeeklySummary = {
  logs: NutritionLog[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
  };
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    sodium: number;
  };
};

const MEAL_TYPE_ICONS = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Utensils,
};

const MEAL_TYPE_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function NutritionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddMealDialogOpen, setIsAddMealDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<string>("");
  const [selectedMealType, setSelectedMealType] = useState<string>("lunch");
  const [portionSize, setPortionSize] = useState<string>("1");
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");

  // Get daily nutrition log
  const { data: dailyLog, isLoading: isLoadingLog } = useQuery<NutritionLogWithMeals | null>({
    queryKey: [`/api/nutrition/logs?date=${selectedDate}`],
  });

  // Get weekly summary
  const { data: weeklySummary } = useQuery<WeeklySummary>({
    queryKey: [`/api/nutrition/summary/weekly?endDate=${selectedDate}`],
  });

  // Get recipes for the meal dialog
  const { data: recipes, isLoading: isLoadingRecipes } = useQuery<Recipe[]>({
    queryKey: ["/api/recipes"],
    enabled: isAddMealDialogOpen,
  });

  // Add meal mutation
  const addMealMutation = useMutation({
    mutationFn: async (data: { recipeId: string; mealType: string; portionSize: number }) => {
      return await apiRequest("POST", `/api/nutrition/logs/${selectedDate}/meals`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        query.queryKey[0]?.toString().startsWith('/api/nutrition/logs') ||
        query.queryKey[0]?.toString().startsWith('/api/nutrition/summary/weekly')
      });
      setIsAddMealDialogOpen(false);
      setSelectedRecipe("");
      setPortionSize("1");
      toast({
        title: "Meal logged",
        description: "Your meal has been added to today's nutrition log",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to log meal",
        variant: "destructive",
      });
    },
  });

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const handleAddMeal = () => {
    if (!selectedRecipe) {
      toast({
        title: "Error",
        description: "Please select a recipe",
        variant: "destructive",
      });
      return;
    }

    const portion = parseFloat(portionSize) || 1;
    addMealMutation.mutate({
      recipeId: selectedRecipe,
      mealType: selectedMealType,
      portionSize: portion,
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  
  // Safe defaults for nutrition goals
  const defaultGoals = {
    calories: 2000,
    protein: 150,
    carbs: 250,
    fat: 70,
    sodium: 2300,
  };
  
  const goals = user ? {
    calories: user.calorieLimit || defaultGoals.calories,
    protein: user.proteinTarget || defaultGoals.protein,
    carbs: user.carbsTarget || defaultGoals.carbs,
    fat: user.fatTarget || defaultGoals.fat,
    sodium: user.maxSodium || defaultGoals.sodium,
  } : defaultGoals;
  
  const hasCustomGoals = user && (
    user.calorieLimit || user.proteinTarget || user.carbsTarget || 
    user.fatTarget || user.maxSodium
  );

  const filteredRecipes = recipes?.filter(r =>
    r.name.toLowerCase().includes(recipeSearchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Date Navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">Nutrition Tracking</h1>
          <p className="text-muted-foreground">{formatDate(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousDay}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          {!isToday && (
            <Button
              variant="outline"
              onClick={handleToday}
              data-testid="button-today"
            >
              Today
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextDay}
            data-testid="button-next-day"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Nutrition Goals Progress */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Progress</CardTitle>
            {!hasCustomGoals && (
              <Badge variant="outline" className="text-xs">
                Using default goals
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingLog ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                  <div className="h-2 w-full bg-muted animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : (
            <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Calories</span>
                <span className="font-medium">{dailyLog?.totalCalories || 0} / {goals.calories} kcal</span>
              </div>
              <Progress 
                value={goals.calories > 0 ? ((dailyLog?.totalCalories || 0) / goals.calories) * 100 : 0} 
                data-testid="progress-calories" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Protein</span>
                <span className="font-medium">{dailyLog?.totalProtein || 0} / {goals.protein} g</span>
              </div>
              <Progress 
                value={goals.protein > 0 ? ((dailyLog?.totalProtein || 0) / goals.protein) * 100 : 0} 
                data-testid="progress-protein" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Carbs</span>
                <span className="font-medium">{dailyLog?.totalCarbs || 0} / {goals.carbs} g</span>
              </div>
              <Progress 
                value={goals.carbs > 0 ? ((dailyLog?.totalCarbs || 0) / goals.carbs) * 100 : 0} 
                data-testid="progress-carbs" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fat</span>
                <span className="font-medium">{dailyLog?.totalFat || 0} / {goals.fat} g</span>
              </div>
              <Progress 
                value={goals.fat > 0 ? ((dailyLog?.totalFat || 0) / goals.fat) * 100 : 0} 
                data-testid="progress-fat" 
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sodium</span>
                <span className="font-medium">{dailyLog?.totalSodium || 0} / {goals.sodium} mg</span>
              </div>
              <Progress 
                value={goals.sodium > 0 ? ((dailyLog?.totalSodium || 0) / goals.sodium) * 100 : 0} 
                data-testid="progress-sodium" 
              />
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Meals List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle>Meals</CardTitle>
          <Dialog open={isAddMealDialogOpen} onOpenChange={setIsAddMealDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-meal">
                <Plus className="w-4 h-4 mr-2" />
                Log Meal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Log a Meal</DialogTitle>
                <DialogDescription>
                  Add a meal to your nutrition log for {formatDate(selectedDate)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="meal-type">Meal Type</Label>
                  <Select value={selectedMealType} onValueChange={setSelectedMealType}>
                    <SelectTrigger id="meal-type" className="mt-2" data-testid="select-meal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                      <SelectItem value="snack">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="recipe-search">Search Recipe</Label>
                  <Input
                    id="recipe-search"
                    placeholder="Search recipes..."
                    value={recipeSearchQuery}
                    onChange={(e) => setRecipeSearchQuery(e.target.value)}
                    className="mt-2"
                    data-testid="input-recipe-search"
                  />
                </div>

                <div>
                  <Label htmlFor="recipe">Recipe</Label>
                  {isLoadingRecipes ? (
                    <div className="mt-2 h-9 bg-muted animate-pulse rounded-md" />
                  ) : (
                    <Select value={selectedRecipe} onValueChange={setSelectedRecipe}>
                      <SelectTrigger id="recipe" className="mt-2" data-testid="select-recipe">
                        <SelectValue placeholder="Select a recipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredRecipes?.map((recipe) => (
                          <SelectItem key={recipe.id} value={recipe.id} data-testid={`option-recipe-${recipe.id}`}>
                            {recipe.name} {recipe.calories && `(${recipe.calories} cal)`}
                          </SelectItem>
                        ))}
                        {(!filteredRecipes || filteredRecipes.length === 0) && (
                          <div className="p-2 text-sm text-muted-foreground">
                            No recipes found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor="portion-size">Portion Size</Label>
                  <Input
                    id="portion-size"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={portionSize}
                    onChange={(e) => setPortionSize(e.target.value)}
                    className="mt-2"
                    data-testid="input-portion-size"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    1.0 = full serving, 0.5 = half serving, 2.0 = double serving
                  </p>
                </div>

                <Button
                  onClick={handleAddMeal}
                  className="w-full"
                  disabled={addMealMutation.isPending}
                  data-testid="button-submit-meal"
                >
                  {addMealMutation.isPending ? "Logging..." : "Log Meal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoadingLog ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : dailyLog?.meals && dailyLog.meals.length > 0 ? (
            <div className="space-y-3">
              {dailyLog.meals.map((meal, index) => {
                const Icon = MEAL_TYPE_ICONS[meal.mealType as keyof typeof MEAL_TYPE_ICONS] || Utensils;
                return (
                  <div key={meal.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`meal-${index}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium" data-testid={`meal-name-${index}`}>{meal.recipeName || 'Unknown Recipe'}</p>
                        <p className="text-sm text-muted-foreground">
                          {MEAL_TYPE_LABELS[meal.mealType as keyof typeof MEAL_TYPE_LABELS]}
                          {Number(meal.portionSize) !== 1 && ` × ${Number(meal.portionSize).toFixed(1)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium" data-testid={`meal-calories-${index}`}>{meal.calories} cal</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">P: {meal.protein}g</Badge>
                        <Badge variant="secondary" className="text-xs">C: {meal.carbs}g</Badge>
                        <Badge variant="secondary" className="text-xs">F: {meal.fat}g</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No meals logged for this day</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => setIsAddMealDialogOpen(true)}
                data-testid="button-add-first-meal"
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Meal
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary */}
      {weeklySummary && weeklySummary.logs && weeklySummary.logs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Weekly Summary (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Avg Calories</p>
                <p className="text-2xl font-bold" data-testid="text-avg-calories">{weeklySummary.averages.calories}</p>
                <p className="text-xs text-muted-foreground">kcal/day</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Protein</p>
                <p className="text-2xl font-bold" data-testid="text-avg-protein">{weeklySummary.averages.protein}</p>
                <p className="text-xs text-muted-foreground">g/day</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Carbs</p>
                <p className="text-2xl font-bold" data-testid="text-avg-carbs">{weeklySummary.averages.carbs}</p>
                <p className="text-xs text-muted-foreground">g/day</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Fat</p>
                <p className="text-2xl font-bold" data-testid="text-avg-fat">{weeklySummary.averages.fat}</p>
                <p className="text-xs text-muted-foreground">g/day</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Sodium</p>
                <p className="text-2xl font-bold" data-testid="text-avg-sodium">{weeklySummary.averages.sodium}</p>
                <p className="text-xs text-muted-foreground">mg/day</p>
              </div>
            </div>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground">
              {weeklySummary.logs.length} day{weeklySummary.logs.length !== 1 ? 's' : ''} logged in the past week
            </p>
          </CardContent>
        </Card>
      ) : weeklySummary && weeklySummary.logs && weeklySummary.logs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Weekly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No nutrition data logged in the past 7 days</p>
              <p className="text-sm mt-2">Start logging meals to see your weekly summary</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

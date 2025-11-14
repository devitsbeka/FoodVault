import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChefHat, Coffee, Sun, Moon } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import type { MealPlan, Recipe } from "@shared/schema";

interface TodaysOverviewProps {
  selectedDate: Date;
}

export function TodaysOverview({ selectedDate }: TodaysOverviewProps) {
  const formattedDate = format(selectedDate, "yyyy-MM-dd");
  const { data: mealPlans, isLoading } = useQuery<(MealPlan & { recipe: Recipe })[]>({
    queryKey: ["/api/meal-plans/by-date", formattedDate],
    queryFn: async () => {
      const response = await fetch(`/api/meal-plans/by-date/${formattedDate}`);
      if (!response.ok) throw new Error("Failed to fetch meal plans");
      return response.json();
    },
  });

  const breakfast = mealPlans?.filter((mp) => mp.recipe.mealType === "breakfast")[0];
  const lunch = mealPlans?.filter((mp) => mp.recipe.mealType === "lunch")[0];
  const dinner = mealPlans?.filter((mp) => mp.recipe.mealType === "dinner")[0];

  const MealCard = ({
    meal,
    icon: Icon,
    label,
    testId,
  }: {
    meal?: MealPlan & { recipe: Recipe };
    icon: typeof ChefHat;
    label: string;
    testId: string;
  }) => {
    if (isLoading) {
      return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
          <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      );
    }

    if (!meal) {
      return (
        <div
          className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
          data-testid={testId}
        >
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">No meal planned</p>
          </div>
        </div>
      );
    }

    return (
      <Link href={`/recipes/${meal.recipe.id}`}>
        <div
          className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
          data-testid={testId}
        >
          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {meal.recipe.imageUrl ? (
              <img
                src={meal.recipe.imageUrl}
                alt={meal.recipe.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Icon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground mb-0.5">
              {label}
            </p>
            <p className="text-sm font-semibold truncate">{meal.recipe.name}</p>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Today's Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <MealCard
          meal={breakfast}
          icon={Coffee}
          label="Breakfast"
          testId="meal-overview-breakfast"
        />
        <MealCard
          meal={lunch}
          icon={Sun}
          label="Lunch"
          testId="meal-overview-lunch"
        />
        <MealCard
          meal={dinner}
          icon={Moon}
          label="Dinner"
          testId="meal-overview-dinner"
        />
      </CardContent>
    </Card>
  );
}

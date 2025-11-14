import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";
import type { MealPlan, Recipe } from "@shared/schema";

export function MyPlansWidget() {
  const { data: upcomingMeals, isLoading } = useQuery<(MealPlan & { recipe: Recipe })[]>({
    queryKey: ["/api/meal-plans/upcoming"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            My Plans
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-16 h-16 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
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
          <Calendar className="w-4 h-4" />
          My Plans
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!upcomingMeals || upcomingMeals.length === 0 ? (
          <div className="text-center py-8" data-testid="no-plans-message">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No upcoming meals planned</p>
            <Link href="/meal-planning">
              <span className="text-sm text-primary hover:underline cursor-pointer">
                Start planning
              </span>
            </Link>
          </div>
        ) : (
          upcomingMeals.slice(0, 4).map((mealPlan) => (
            <Link key={mealPlan.id} href={`/recipes/${mealPlan.recipe.id}`}>
              <div
                className="flex items-center gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
                data-testid={`plan-${mealPlan.id}`}
              >
                <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {mealPlan.recipe.imageUrl ? (
                    <img
                      src={mealPlan.recipe.imageUrl}
                      alt={mealPlan.recipe.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Calendar className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate mb-1">{mealPlan.recipe.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDistanceToNow(new Date(mealPlan.scheduledFor), { addSuffix: true })}</span>
                    </div>
                    {mealPlan.familyId && (
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>Family</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {mealPlan.recipe.calories && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                        {mealPlan.recipe.calories} cal
                      </Badge>
                    )}
                    {mealPlan.recipe.prepTime && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                        {mealPlan.recipe.prepTime} min
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

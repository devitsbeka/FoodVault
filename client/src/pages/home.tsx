import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OnboardingCarousel } from "@/components/onboarding-carousel";
import { CalendarStrip } from "@/components/calendar-strip";
import { TodaysOverview } from "@/components/todays-overview";
import { MyPlansWidget } from "@/components/my-plans-widget";
import { MyKitchenWidget } from "@/components/my-kitchen-widget";
import { SuggestedRecipesWidget } from "@/components/suggested-recipes-widget";
import { useAuth } from "@/hooks/useAuth";
import { startOfDay } from "date-fns";
import type { MealPlan, NutritionLog } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));

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

  const { data: allMealPlans } = useQuery<MealPlan[]>({
    queryKey: ["/api/meal-plans"],
  });

  // TODO: Enable when nutrition tracking is implemented
  // const { data: nutritionLogs } = useQuery<NutritionLog[]>({
  //   queryKey: ["/api/nutrition-logs"],
  // });

  const mealPlanDates = allMealPlans?.map((mp) => startOfDay(new Date(mp.scheduledFor))) || [];
  const nutritionLogDates: Date[] = []; // TODO: Enable when nutrition tracking is implemented

  if (showOnboarding) {
    return <OnboardingCarousel onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-large-title mb-2">
          Welcome back, {user?.firstName || "Chef"}
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening in your kitchen
        </p>
      </div>

      <CalendarStrip
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
        mealPlanDates={mealPlanDates}
        nutritionLogDates={nutritionLogDates}
        data-testid="calendar-strip"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodaysOverview selectedDate={selectedDate} />
        <MyPlansWidget />
        <MyKitchenWidget />
        <SuggestedRecipesWidget />
      </div>
    </div>
  );
}

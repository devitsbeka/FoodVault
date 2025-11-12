import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon, ChefHat, ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { MealPlan, Recipe, MealVote, User, Family } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type VoteWithUser = MealVote & {
  user: User;
};

type MealPlanWithDetails = MealPlan & {
  recipe: Recipe;
  votes: VoteWithUser[];
  userVote?: VoteWithUser;
  family?: Family | null;
};

export default function MealPlanning() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const { data: mealPlans, isLoading } = useQuery<MealPlanWithDetails[]>({
    queryKey: ["/api/meal-plans"],
  });

  const voteMutation = useMutation<
    { vote: MealVote; mealPlanApproved: boolean },
    Error,
    { mealPlanId: string; vote: boolean }
  >({
    mutationFn: async ({ mealPlanId, vote }: { mealPlanId: string; vote: boolean }) => {
      return await apiRequest("POST", `/api/meal-plans/${mealPlanId}/vote`, { vote });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meal-plans"] });
      
      if (data.mealPlanApproved) {
        toast({
          title: "Meal approved!",
          description: "This meal has reached the vote threshold and is now approved.",
        });
      } else {
        toast({
          title: "Vote recorded",
          description: "Your vote has been counted.",
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to record vote. Please try again.",
        variant: "destructive",
      });
    },
  });

  const groupedMeals = mealPlans?.reduce((acc, meal) => {
    const date = new Date(meal.scheduledFor).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(meal);
    return acc;
  }, {} as Record<string, MealPlanWithDetails[]>);

  const dates = groupedMeals ? Object.keys(groupedMeals).sort() : [];
  const todayMeals = groupedMeals?.[selectedDate] || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-large-title">Meal Planning</h1>
        <p className="text-muted-foreground mt-1">
          Plan your meals and vote with family members
        </p>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Calendar Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              Array(7).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))
            ) : dates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No meals planned yet
              </p>
            ) : (
              dates.map((date) => {
                const mealsCount = groupedMeals![date].length;
                const isSelected = date === selectedDate;
                const dateObj = new Date(date);
                
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDate(date)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'hover-elevate bg-card'
                    }`}
                    data-testid={`date-${date}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {dateObj.toLocaleDateString('en-US', { weekday: 'short' })}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      {mealsCount > 0 && (
                        <Badge variant={isSelected ? "secondary" : "default"} className="text-xs">
                          {mealsCount}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Meals for Selected Date */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title-1">
              {new Date(selectedDate).toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
            <Button data-testid="button-add-meal">Add Meal</Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : todayMeals.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No meals planned</h3>
                <p className="text-muted-foreground mb-4">
                  Start planning your meals for this day
                </p>
                <Button>Add Your First Meal</Button>
              </div>
            </Card>
          ) : (
            <TooltipProvider>
              <div className="space-y-4">
                {todayMeals.map((meal) => {
                  const upvotes = meal.votes.filter(v => v.vote).length;
                  const downvotes = meal.votes.filter(v => !v.vote).length;
                  const upvoters = meal.votes.filter(v => v.vote);
                  const downvoters = meal.votes.filter(v => !v.vote);
                  const userVoted = meal.userVote !== undefined;
                  const userUpvoted = meal.userVote?.vote === true;
                  const threshold = meal.family?.voteThreshold || 2;
                  const progressPercent = Math.min((upvotes / threshold) * 100, 100);

                  return (
                    <Card key={meal.id} className={meal.isApproved ? 'border-primary/50' : ''} data-testid={`meal-plan-${meal.id}`}>
                      <CardContent className="p-6">
                        <div className="flex gap-4">
                          <div className="w-32 h-32 bg-muted rounded-lg flex-shrink-0">
                            {meal.recipe.imageUrl ? (
                              <img src={meal.recipe.imageUrl} alt={meal.recipe.name} className="w-full h-full object-cover rounded-lg" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ChefHat className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-semibold text-lg">{meal.recipe.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {meal.recipe.description || "A delicious recipe"}
                                </p>
                              </div>
                              {meal.isApproved && (
                                <Badge className="gap-1" data-testid={`badge-approved-${meal.id}`}>
                                  <Check className="w-3 h-3" />
                                  Approved
                                </Badge>
                              )}
                            </div>

                            {/* Vote Progress Bar */}
                            {!meal.isApproved && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>Vote Progress</span>
                                  <span>{upvotes} of {threshold} needed</span>
                                </div>
                                <Progress value={progressPercent} className="h-2" data-testid={`progress-votes-${meal.id}`} />
                              </div>
                            )}

                            {/* Voting Buttons & Voters */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant={userUpvoted ? "default" : "outline"}
                                size="sm"
                                className="gap-2"
                                onClick={() => voteMutation.mutate({ mealPlanId: meal.id, vote: true })}
                                disabled={voteMutation.isPending}
                                data-testid={`button-upvote-${meal.id}`}
                              >
                                <ThumbsUp className="w-4 h-4" />
                                {upvotes}
                              </Button>

                              {/* Upvoter Avatars */}
                              {upvoters.length > 0 && (
                                <div className="flex -space-x-2">
                                  {upvoters.map((voter) => (
                                    <Tooltip key={voter.userId}>
                                      <TooltipTrigger>
                                        <Avatar className="w-6 h-6 border-2 border-background" data-testid={`avatar-upvoter-${voter.userId}`}>
                                          <AvatarImage src={voter.user.profileImageUrl || undefined} />
                                          <AvatarFallback className="text-xs">
                                            {voter.user.firstName?.[0] || voter.user.email?.[0] || '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{voter.user.firstName || voter.user.email} voted for this</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}

                              <Button
                                variant={userVoted && !userUpvoted ? "destructive" : "outline"}
                                size="sm"
                                className="gap-2"
                                onClick={() => voteMutation.mutate({ mealPlanId: meal.id, vote: false })}
                                disabled={voteMutation.isPending}
                                data-testid={`button-downvote-${meal.id}`}
                              >
                                <ThumbsDown className="w-4 h-4" />
                                {downvotes}
                              </Button>

                              {/* Downvoter Avatars */}
                              {downvoters.length > 0 && (
                                <div className="flex -space-x-2">
                                  {downvoters.map((voter) => (
                                    <Tooltip key={voter.userId}>
                                      <TooltipTrigger>
                                        <Avatar className="w-6 h-6 border-2 border-background" data-testid={`avatar-downvoter-${voter.userId}`}>
                                          <AvatarImage src={voter.user.profileImageUrl || undefined} />
                                          <AvatarFallback className="text-xs">
                                            {voter.user.firstName?.[0] || voter.user.email?.[0] || '?'}
                                          </AvatarFallback>
                                        </Avatar>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{voter.user.firstName || voter.user.email} voted against this</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  );
}

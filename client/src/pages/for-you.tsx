import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Heart, MessageCircle, Share2, Refrigerator, Calendar, Users, Check, X, Clock, UtensilsCrossed, BarChart3, ChefHat } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";

type PollOption = {
  value: string;
  label: string;
  relatedTags: string[];
};

type PollQuestion = {
  id: string;
  question: string;
  category: string;
  options: PollOption[];
  isActive: boolean;
};

type FeaturedRecipe = {
  id: string;
  name: string;
  imageUrl: string | null;
};

type FridgeStatus = {
  status: "needs_restock" | "filled";
  totalItems: number;
  expiringCount: number;
};

type UpcomingDinner = {
  id: string;
  recipeName: string;
  recipeImage: string | null;
  scheduledFor: string;
  isApproved: boolean;
  voteCount: number;
};

type FamilyMember = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isOnline: boolean;
};

type MealRSVP = {
  mealPlanId: string;
  recipeName: string;
  scheduledFor: string;
  rsvps: Array<{
    userId: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
  }>;
};

function StoriesBar() {
  const { data: stories = [], isLoading } = useQuery<FeaturedRecipe[]>({
    queryKey: ["/api/feed/stories"],
  });

  if (isLoading) {
    return (
      <div className="flex gap-4 p-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-muted animate-pulse" />
            <div className="w-16 h-3 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 p-4">
        {stories.map((story) => (
          <Link
            key={story.id}
            href={`/recipes/${story.id}`}
            className="flex flex-col items-center gap-2 flex-shrink-0 cursor-pointer hover-elevate active-elevate-2 rounded-lg p-2"
            data-testid={`story-${story.id}`}
          >
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-accent p-1">
                <div className="w-full h-full rounded-full bg-background p-1">
                  {story.imageUrl ? (
                    <img
                      src={story.imageUrl}
                      alt={story.name}
                      className="w-full h-full rounded-full object-cover"
                      data-testid={`story-image-${story.id}`}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-muted flex items-center justify-center">
                      <ChefHat className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs font-medium text-center max-w-20 truncate">
              {story.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function PollCard({ poll, onAnswer }: { poll: PollQuestion; onAnswer?: () => void }) {
  const submitPollMutation = useMutation({
    mutationFn: async (selectedOption: string) => {
      return await apiRequest("POST", "/api/polls/respond", {
        pollId: poll.id,
        selectedOption,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/polls/multiple"] });
      onAnswer?.();
    },
  });

  return (
    <Card className="p-6" data-testid={`poll-card-${poll.id}`}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-lg" data-testid="poll-question">
              {poll.question}
            </p>
            <p className="text-sm text-muted-foreground">
              Help us learn your preferences
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {poll.options.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className="h-auto py-6 justify-center text-center hover-elevate active-elevate-2"
              onClick={() => submitPollMutation.mutate(option.value)}
              disabled={submitPollMutation.isPending}
              data-testid={`poll-option-${option.value}`}
            >
              <div className="space-y-1">
                <p className="font-medium">{option.label}</p>
                {option.relatedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-center">
                    {option.relatedTags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs px-1.5 py-0 no-default-hover-elevate no-default-active-elevate"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}

function FridgeStatusWidget() {
  const { data: fridgeStatus, isLoading } = useQuery<FridgeStatus>({
    queryKey: ["/api/feed/fridge-status"],
  });

  if (isLoading) {
    return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  }

  if (!fridgeStatus) return null;

  const isLow = fridgeStatus.status === "needs_restock";

  return (
    <Card className="p-4" data-testid="fridge-status-widget">
      <div className="flex items-center gap-3">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center ${
            isLow ? "bg-destructive/10" : "bg-primary/10"
          }`}
        >
          <Refrigerator className={`w-6 h-6 ${isLow ? "text-destructive" : "text-primary"}`} />
        </div>
        <div className="flex-1">
          <p className="font-semibold">{fridgeStatus.totalItems} items</p>
          <p className="text-sm text-muted-foreground">
            {isLow ? "Needs restock" : "Well stocked"}
          </p>
          {fridgeStatus.expiringCount > 0 && (
            <p className="text-xs text-destructive font-medium mt-1">
              {fridgeStatus.expiringCount} expiring soon
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function UpcomingDinnersWidget() {
  const { data: dinners = [], isLoading } = useQuery<UpcomingDinner[]>({
    queryKey: ["/api/feed/upcoming-dinners"],
  });

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
  }

  if (dinners.length === 0) {
    return (
      <Card className="p-4" data-testid="upcoming-dinners-widget">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="w-5 h-5" />
          <p className="font-semibold">Upcoming Dinners</p>
        </div>
        <p className="text-sm text-muted-foreground">No dinners planned yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="upcoming-dinners-widget">
      <div className="flex items-center gap-3 mb-3">
        <Calendar className="w-5 h-5" />
        <p className="font-semibold">Upcoming Dinners</p>
      </div>
      <div className="space-y-3">
        {dinners.map((dinner) => (
          <div key={dinner.id} className="flex items-center gap-3" data-testid={`dinner-${dinner.id}`}>
            {dinner.recipeImage ? (
              <img
                src={dinner.recipeImage}
                alt={dinner.recipeName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{dinner.recipeName}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">
                  {new Date(dinner.scheduledFor).toLocaleDateString()}
                </p>
                {dinner.isApproved && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    ✓ Approved
                  </Badge>
                )}
              </div>
            </div>
            {dinner.voteCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {dinner.voteCount} votes
              </Badge>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function FamilyStatusWidget() {
  const { data: members = [], isLoading } = useQuery<FamilyMember[]>({
    queryKey: ["/api/feed/family-status"],
  });

  if (isLoading) {
    return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  }

  if (members.length === 0) {
    return null;
  }

  return (
    <Card className="p-4" data-testid="family-status-widget">
      <div className="flex items-center gap-3 mb-3">
        <Users className="w-5 h-5" />
        <p className="font-semibold">Family</p>
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.userId} className="flex items-center gap-3" data-testid={`family-member-${member.userId}`}>
            <div className="relative">
              <Avatar className="w-8 h-8">
                <AvatarImage src={member.profileImageUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {member.firstName?.[0]}{member.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${
                  member.isOnline ? "bg-green-500" : "bg-muted-foreground"
                }`}
              />
            </div>
            <p className="text-sm">
              {member.firstName} {member.lastName}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MealRSVPsWidget() {
  const { data: meals = [], isLoading } = useQuery<MealRSVP[]>({
    queryKey: ["/api/feed/meal-rsvps"],
  });

  const rsvpMutation = useMutation({
    mutationFn: async ({ mealPlanId, status }: { mealPlanId: string; status: string }) => {
      return await apiRequest("POST", `/api/meal-plans/${mealPlanId}/rsvp`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed/meal-rsvps"] });
    },
  });

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
  }

  if (meals.length === 0) {
    return null;
  }

  return (
    <Card className="p-4" data-testid="meal-rsvps-widget">
      <div className="flex items-center gap-3 mb-3">
        <Clock className="w-5 h-5" />
        <p className="font-semibold">RSVP</p>
      </div>
      <div className="space-y-4">
        {meals.map((meal) => (
          <div key={meal.mealPlanId} className="space-y-2" data-testid={`rsvp-meal-${meal.mealPlanId}`}>
            <div>
              <p className="text-sm font-medium">{meal.recipeName}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(meal.scheduledFor).toLocaleDateString()}
              </p>
            </div>
            {meal.rsvps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {meal.rsvps.map((rsvp) => (
                  <Badge
                    key={rsvp.userId}
                    variant={rsvp.status === "attending" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {rsvp.firstName} {rsvp.status === "attending" ? "✓" : "?"}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => rsvpMutation.mutate({ mealPlanId: meal.mealPlanId, status: "attending" })}
                disabled={rsvpMutation.isPending}
                data-testid={`rsvp-yes-${meal.mealPlanId}`}
              >
                <Check className="w-4 h-4 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => rsvpMutation.mutate({ mealPlanId: meal.mealPlanId, status: "maybe" })}
                disabled={rsvpMutation.isPending}
                data-testid={`rsvp-maybe-${meal.mealPlanId}`}
              >
                Maybe
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => rsvpMutation.mutate({ mealPlanId: meal.mealPlanId, status: "declined" })}
                disabled={rsvpMutation.isPending}
                data-testid={`rsvp-no-${meal.mealPlanId}`}
              >
                <X className="w-4 h-4 mr-1" />
                No
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ForYouPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [answeredPolls, setAnsweredPolls] = useState<Set<string>>(new Set());
  
  // Fetch multiple polls
  const { data: polls = [], isLoading: pollsLoading } = useQuery<PollQuestion[]>({
    queryKey: ["/api/polls/multiple"],
    queryFn: async () => {
      // Fetch random polls multiple times to simulate feed
      const results: PollQuestion[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await fetch("/api/polls/random", { credentials: "include" });
        if (res.ok) {
          const poll = await res.json();
          if (poll && !answeredPolls.has(poll.id)) {
            results.push(poll);
          }
        }
      }
      return results;
    },
  });

  const handlePollAnswer = (pollId: string) => {
    setAnsweredPolls(prev => new Set([...Array.from(prev), pollId]));
  };

  return (
    <div className="flex h-full" data-testid="for-you-page">
      {/* Main Feed Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stories Bar */}
        <div className="border-b">
          <StoriesBar />
        </div>

        {/* Feed Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="text-center space-y-2 mb-8">
              <h1 className="text-3xl font-bold" data-testid="for-you-title">For You</h1>
              <p className="text-muted-foreground">
                Personalized recipes and food preferences
              </p>
            </div>

            {/* Poll Feed */}
            {pollsLoading ? (
              <>
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              </>
            ) : polls.length > 0 ? (
              polls.filter(p => !answeredPolls.has(p.id)).map((poll) => (
                <PollCard key={poll.id} poll={poll} onAnswer={() => handlePollAnswer(poll.id)} />
              ))
            ) : (
              <Card className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  You've answered all available polls. Check back later for more personalized recommendations.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 border-l overflow-y-auto">
        <div className="p-4 space-y-4">
          <FridgeStatusWidget />
          <UpcomingDinnersWidget />
          <FamilyStatusWidget />
          <MealRSVPsWidget />
        </div>
      </div>
    </div>
  );
}

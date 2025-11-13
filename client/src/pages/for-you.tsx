import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Heart, MessageCircle, Share2, Refrigerator, Calendar, Users, Check, X, Clock, UtensilsCrossed, BarChart3, ChefHat, LogIn } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

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

type RecipePost = {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  tags: string[];
};

type FeedPost = {
  type: 'poll' | 'recipe';
  data: PollQuestion | RecipePost;
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
    queryFn: async () => {
      const res = await fetch("/api/feed/stories?limit=20", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stories");
      return res.json();
    },
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

function RecipePostCard({ recipe }: { recipe: RecipePost }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  return (
    <Card className="overflow-hidden" data-testid={`recipe-post-${recipe.id}`}>
      {/* Recipe Image */}
      {recipe.imageUrl ? (
        <Link href={`/recipes/${recipe.id}`}>
          <div className="aspect-square w-full overflow-hidden hover-elevate active-elevate-2 cursor-pointer">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
              data-testid={`recipe-image-${recipe.id}`}
            />
          </div>
        </Link>
      ) : (
        <div className="aspect-square w-full bg-muted flex items-center justify-center">
          <UtensilsCrossed className="w-16 h-16 text-muted-foreground" />
        </div>
      )}

      {/* Post Content */}
      <div className="p-4 space-y-3">
        {/* Interaction Buttons */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsLiked(!isLiked)}
            data-testid={`button-like-${recipe.id}`}
          >
            <Heart
              className={`w-6 h-6 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid={`button-comment-${recipe.id}`}
          >
            <Link href={`/recipes/${recipe.id}`}>
              <MessageCircle className="w-6 h-6" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid={`button-share-${recipe.id}`}
          >
            <Share2 className="w-6 h-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSaved(!isSaved)}
            className="ml-auto"
            data-testid={`button-save-${recipe.id}`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={isSaved ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </Button>
        </div>

        {/* Recipe Title & Description */}
        <div>
          <Link href={`/recipes/${recipe.id}`}>
            <h3 className="font-semibold text-lg hover:underline" data-testid={`recipe-title-${recipe.id}`}>
              {recipe.name}
            </h3>
          </Link>
          {recipe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {recipe.description}
            </p>
          )}
        </div>

        {/* Recipe Meta Info */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {recipe.prepTime && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{recipe.prepTime}min prep</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{recipe.servings} servings</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {recipe.tags.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs"
                data-testid={`recipe-tag-${tag}`}
              >
                #{tag}
              </Badge>
            ))}
          </div>
        )}
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Fetch mixed feed of polls and recipes
  const { data: feedPosts = [], isLoading: feedLoading } = useQuery<FeedPost[]>({
    queryKey: ["/api/feed/posts"],
    queryFn: async () => {
      const res = await fetch("/api/feed/posts?limit=15", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch feed");
      return res.json();
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

            {/* Mixed Feed: Polls + Recipe Posts */}
            {authLoading ? (
              <>
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-96 bg-muted animate-pulse rounded-lg" />
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              </>
            ) : !isAuthenticated ? (
              <Card className="p-12 text-center">
                <LogIn className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="font-semibold text-2xl mb-3">Welcome to Your Feed!</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Sign in to discover personalized recipes, answer preference polls, and get recommendations tailored just for you.
                </p>
                <Button 
                  size="lg" 
                  asChild
                  data-testid="button-login"
                >
                  <a href="/api/login">
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In with Replit
                  </a>
                </Button>
              </Card>
            ) : feedLoading ? (
              <>
                <div className="h-96 bg-muted animate-pulse rounded-lg" />
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
                <div className="h-96 bg-muted animate-pulse rounded-lg" />
              </>
            ) : feedPosts.length > 0 ? (
              feedPosts.map((post, index) => {
                if (post.type === 'poll') {
                  const poll = post.data as PollQuestion;
                  if (answeredPolls.has(poll.id)) return null;
                  return (
                    <PollCard 
                      key={`poll-${poll.id}`} 
                      poll={poll} 
                      onAnswer={() => handlePollAnswer(poll.id)} 
                    />
                  );
                } else {
                  const recipe = post.data as RecipePost;
                  return (
                    <RecipePostCard 
                      key={`recipe-${recipe.id}`} 
                      recipe={recipe} 
                    />
                  );
                }
              })
            ) : (
              <Card className="p-8 text-center">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  You've seen all available content. Check back later for more!
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

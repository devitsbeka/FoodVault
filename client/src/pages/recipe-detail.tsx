import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, Flame, Users, Star, MessageSquare, ChefHat, Check, ShoppingCart, Plus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { IngredientImage } from "@/components/IngredientImage";
import type { Recipe, KitchenInventory, ShoppingList, RecipeIngredient } from "@shared/schema";

type RecipeRating = {
  id: string;
  recipeId: string;
  userId: string;
  rating: number;
  comment: string | null;
  photoUrl: string | null;
  createdAt: Date;
  user: {
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
};

type RecipeWithRatings = Recipe & {
  ratings: RecipeRating[];
  averageRating: number | null;
  userRating: RecipeRating | null;
  ownedIngredients?: RecipeIngredient[];
  missingIngredients?: RecipeIngredient[];
};

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);
  const [isAddToListDialogOpen, setIsAddToListDialogOpen] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: recipe, isLoading } = useQuery<RecipeWithRatings>({
    queryKey: ["/api/recipes", id],
    queryFn: async () => {
      const res = await fetch(`/api/recipes/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  const { data: shoppingLists } = useQuery<ShoppingList[]>({
    queryKey: ["/api/shopping-lists"],
    enabled: !!user,
  });

  const rateMutation = useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment: string }) => {
      return await apiRequest("POST", `/api/recipes/${id}/rate`, { rating, comment });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recipes", id] });
      setIsRatingDialogOpen(false);
      setComment("");
      toast({
        title: "Rating submitted",
        description: "Your rating has been saved successfully.",
      });
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
        description: "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitRating = () => {
    rateMutation.mutate({ rating, comment });
  };

  const addToListMutation = useMutation({
    mutationFn: async ({ listId, ingredients }: { listId: string; ingredients: RecipeIngredient[] }) => {
      // Add each ingredient as a shopping list item
      for (const ingredient of ingredients) {
        await apiRequest("POST", `/api/shopping-lists/${listId}/items`, {
          name: ingredient.name,
          quantity: ingredient.amount,
          unit: ingredient.unit || "",
          imageUrl: ingredient.imageUrl || null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      setIsAddToListDialogOpen(false);
      setSelectedListId("");
      toast({
        title: "Added to list",
        description: "Missing ingredients have been added to your shopping list.",
      });
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
        description: "Failed to add ingredients to list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddToList = () => {
    if (!selectedListId || !recipe?.missingIngredients) return;
    addToListMutation.mutate({
      listId: selectedListId,
      ingredients: recipe.missingIngredients,
    });
  };

  const checkIngredientAvailability = (ingredientName: string): "owned" | "missing" => {
    if (recipe?.ownedIngredients?.some(ing => ing.name.toLowerCase() === ingredientName.toLowerCase())) {
      return "owned";
    }
    return "missing";
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="p-12">
          <div className="text-center">
            <ChefHat className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Recipe not found</h3>
            <p className="text-muted-foreground">
              This recipe could not be found
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const ingredients = (recipe.ingredients as unknown as { name: string; amount: string; unit: string }[]) || [];
  const instructions = recipe.instructions || [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Hero Section */}
      {recipe.imageUrl && (
        <div className="relative h-64 rounded-xl overflow-hidden">
          <img 
            src={recipe.imageUrl} 
            alt={recipe.name} 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start justify-between mb-2">
          <h1 className="text-large-title">{recipe.name}</h1>
          {recipe.dietType && (
            <Badge variant="secondary">{recipe.dietType}</Badge>
          )}
        </div>
        {recipe.description && (
          <p className="text-muted-foreground mt-2">{recipe.description}</p>
        )}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        {recipe.prepTime && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Prep: {recipe.prepTime} min
            </span>
          </div>
        )}
        {recipe.cookTime && (
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Cook: {recipe.cookTime} min
            </span>
          </div>
        )}
        {recipe.calories && (
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              {recipe.calories} cal
            </span>
          </div>
        )}
        {recipe.servings && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">
              Serves {recipe.servings}
            </span>
          </div>
        )}
        {recipe.averageRating !== null && (
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 fill-primary text-primary" />
            <span className="text-sm font-medium">
              {recipe.averageRating.toFixed(1)} ({recipe.ratings.length} reviews)
            </span>
          </div>
        )}
      </div>

      {/* Rate Button */}
      <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" variant={recipe.userRating ? "outline" : "default"} data-testid="button-rate-recipe">
            <Star className="w-4 h-4 mr-2" />
            {recipe.userRating ? "Update Your Rating" : "Rate This Recipe"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate {recipe.name}</DialogTitle>
            <DialogDescription>
              Share your experience with this recipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Rating</Label>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="hover-elevate rounded-lg p-2"
                    data-testid={`button-star-${star}`}
                  >
                    <Star
                      className={`w-8 h-8 ${star <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="comment">Comment (Optional)</Label>
              <Textarea
                id="comment"
                placeholder="Share your thoughts about this recipe..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="mt-2"
                rows={4}
                data-testid="textarea-comment"
              />
            </div>
            <Button
              onClick={handleSubmitRating}
              className="w-full"
              disabled={rateMutation.isPending}
              data-testid="button-submit-rating"
            >
              {rateMutation.isPending ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Ingredients */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle>Ingredients</CardTitle>
          {user && recipe?.missingIngredients && recipe.missingIngredients.length > 0 && (
            <Dialog open={isAddToListDialogOpen} onOpenChange={setIsAddToListDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" data-testid="button-add-missing-to-list">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add Missing ({recipe.missingIngredients.length})
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Shopping List</DialogTitle>
                  <DialogDescription>
                    Select a shopping list to add the missing ingredients
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="shopping-list">Shopping List</Label>
                    <Select value={selectedListId} onValueChange={setSelectedListId}>
                      <SelectTrigger id="shopping-list" className="mt-2" data-testid="select-shopping-list">
                        <SelectValue placeholder="Select a list" />
                      </SelectTrigger>
                      <SelectContent>
                        {shoppingLists?.map((list) => (
                          <SelectItem key={list.id} value={list.id} data-testid={`option-list-${list.id}`}>
                            {list.name}
                          </SelectItem>
                        ))}
                        {(!shoppingLists || shoppingLists.length === 0) && (
                          <div className="p-2 text-sm text-muted-foreground">
                            No shopping lists found
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Missing Ingredients ({recipe.missingIngredients.length})</Label>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {recipe.missingIngredients.map((ing, idx) => (
                        <div key={idx} className="text-sm flex items-center gap-2 p-2 rounded-md bg-muted/50">
                          <Plus className="w-3 h-3 text-muted-foreground" />
                          <span>{ing.amount} {ing.unit} {ing.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={handleAddToList}
                    className="w-full"
                    disabled={!selectedListId || addToListMutation.isPending}
                    data-testid="button-confirm-add-to-list"
                  >
                    {addToListMutation.isPending ? "Adding..." : "Add to List"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ingredients.map((ingredient, index) => {
              const availability = user ? checkIngredientAvailability(ingredient.name) : null;
              return (
                <li key={index} className="flex items-center justify-between gap-2" data-testid={`ingredient-${index}`}>
                  <div className="flex items-center gap-2">
                    <IngredientImage 
                      imageUrl={(ingredient as RecipeIngredient).imageUrl} 
                      name={ingredient.name} 
                      size={30}
                    />
                    <span>
                      {ingredient.amount} {ingredient.unit} {ingredient.name}
                    </span>
                  </div>
                  {availability === "owned" && (
                    <Badge variant="secondary" className="gap-1" data-testid={`badge-owned-${index}`}>
                      <Check className="w-3 h-3" />
                      In Kitchen
                    </Badge>
                  )}
                  {availability === "missing" && (
                    <Badge variant="outline" className="gap-1" data-testid={`badge-missing-${index}`}>
                      Missing
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            {instructions.map((instruction, index) => (
              <li key={index} className="flex gap-3">
                <span className="font-semibold text-primary">{index + 1}.</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Reviews */}
      {recipe.ratings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Reviews ({recipe.ratings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {recipe.ratings.map((review) => (
              <div key={review.id} data-testid={`review-${review.id}`}>
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarImage src={review.user.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {review.user.firstName?.[0]}{review.user.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">
                        {review.user.firstName} {review.user.lastName}
                      </p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {review.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Separator className="mt-4" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

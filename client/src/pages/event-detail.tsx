import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Plus, Users, Clock, ChevronLeft, Trash2, UtensilsCrossed } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Link } from "wouter";
import type { Event, MealPlan, MealPlanWithRecipe, Recipe } from "@shared/schema";
import { format, parseISO } from "date-fns";

type EventWithMeals = Event & {
  meals: Array<{
    id: string;
    eventId: string;
    mealPlanId: string;
    dishType: string | null;
    recipeName: string;
    imageUrl: string | null;
  }>;
};

const DISH_TYPES = [
  { value: "main", label: "Main Dish" },
  { value: "side", label: "Side Dish" },
  { value: "appetizer", label: "Appetizer" },
  { value: "dessert", label: "Dessert" },
  { value: "beverage", label: "Beverage" },
];

export default function EventDetailPage() {
  const [, params] = useRoute("/events/:eventId");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddMealDialogOpen, setIsAddMealDialogOpen] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<string>("");
  const [selectedDishType, setSelectedDishType] = useState<string>("main");
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [deleteMealId, setDeleteMealId] = useState<string | null>(null);

  const eventId = params?.eventId;

  // Get event details
  const { data: event, isLoading: isLoadingEvent } = useQuery<EventWithMeals>({
    queryKey: ["/api/events", eventId],
    enabled: !!eventId,
  });

  // Get user's meal plans for selection
  const { data: mealPlans = [], isLoading: isLoadingMealPlans } = useQuery<MealPlanWithRecipe[]>({
    queryKey: ["/api/meal-plans"],
    enabled: isAddMealDialogOpen,
  });

  // Add meal to event mutation
  const addMealMutation = useMutation({
    mutationFn: async (data: { mealPlanId: string; dishType: string }) => {
      return await apiRequest("POST", `/api/events/${eventId}/meals`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      setIsAddMealDialogOpen(false);
      setSelectedMealPlan("");
      setSelectedDishType("main");
      toast({
        title: "Meal added",
        description: "The meal has been added to your event",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add meal",
        variant: "destructive",
      });
    },
  });

  // Remove meal from event mutation
  const removeMealMutation = useMutation({
    mutationFn: async (eventMealPlanId: string) => {
      return await apiRequest("DELETE", `/api/events/${eventId}/meals/${eventMealPlanId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events", eventId] });
      setDeleteMealId(null);
      toast({
        title: "Meal removed",
        description: "The meal has been removed from your event",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove meal",
        variant: "destructive",
      });
    },
  });

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setLocation("/events");
      toast({
        title: "Event deleted",
        description: "Your event has been deleted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  const handleAddMeal = () => {
    if (!selectedMealPlan) {
      toast({
        title: "Error",
        description: "Please select a meal plan",
        variant: "destructive",
      });
      return;
    }

    addMealMutation.mutate({
      mealPlanId: selectedMealPlan,
      dishType: selectedDishType,
    });
  };

  if (isLoadingEvent) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading event...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-5xl py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Event not found</h2>
          <p className="text-muted-foreground mb-6">This event doesn't exist or you don't have access to it</p>
          <Link href="/events">
            <Button>Back to Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const eventDate = parseISO(event.scheduledFor.toString());

  // Group meals by dish type
  const mealsByType = event.meals.reduce((acc, meal) => {
    const type = meal.dishType || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(meal);
    return acc;
  }, {} as Record<string, typeof event.meals>);

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      {/* Header */}
      <div>
        <Link href="/events">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back-to-events">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Events
          </Button>
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-event-title">
              {event.name}
            </h1>
            {event.description && (
              <p className="text-muted-foreground mt-2" data-testid="text-event-description">
                {event.description}
              </p>
            )}
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteEventId(event.id)}
            data-testid="button-delete-event"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Event
          </Button>
        </div>
      </div>

      {/* Event Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium" data-testid="text-event-date">
                {format(eventDate, "EEEE, MMMM d, yyyy")}
              </div>
              <div className="text-sm text-muted-foreground" data-testid="text-event-time">
                {format(eventDate, "h:mm a")}
              </div>
            </div>
          </div>
          {event.guestCount && (
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div data-testid="text-event-guest-count">
                {event.guestCount} {event.guestCount === 1 ? "guest" : "guests"}
              </div>
            </div>
          )}
          {event.notes && (
            <div>
              <div className="font-medium mb-1">Notes</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-event-notes">
                {event.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Meal Planning Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Meal Planning</h2>
            <p className="text-muted-foreground">
              Add dishes for your event menu
            </p>
          </div>
          <Dialog open={isAddMealDialogOpen} onOpenChange={setIsAddMealDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-meal">
                <Plus className="h-4 w-4 mr-2" />
                Add Meal
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-add-meal">
              <DialogHeader>
                <DialogTitle>Add Meal to Event</DialogTitle>
                <DialogDescription>
                  Choose a meal plan from your existing meal plans
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Meal Plan</label>
                  <Select value={selectedMealPlan} onValueChange={setSelectedMealPlan}>
                    <SelectTrigger data-testid="select-meal-plan">
                      <SelectValue placeholder="Select a meal plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingMealPlans ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          Loading...
                        </div>
                      ) : mealPlans.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No meal plans available. Create one first!
                        </div>
                      ) : (
                        mealPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {`${plan.recipe?.name || "Unnamed Recipe"} • ${format(parseISO(plan.scheduledFor.toString()), "MMM d")}`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dish Type</label>
                  <Select value={selectedDishType} onValueChange={setSelectedDishType}>
                    <SelectTrigger data-testid="select-dish-type">
                      <SelectValue placeholder="Select dish type" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISH_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddMeal}
                  disabled={addMealMutation.isPending || !selectedMealPlan}
                  data-testid="button-submit-meal"
                >
                  {addMealMutation.isPending ? "Adding..." : "Add Meal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Display meals grouped by dish type */}
        {event.meals.length === 0 ? (
          <Card className="border-dashed" data-testid="empty-state-meals">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No meals added yet</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Start building your event menu by adding meals from your meal plans
              </p>
              <Button onClick={() => setIsAddMealDialogOpen(true)} data-testid="button-add-first-meal">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Meal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {DISH_TYPES.map((dishType) => {
              const meals = mealsByType[dishType.value] || [];
              if (meals.length === 0) return null;

              return (
                <div key={dishType.value}>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    {dishType.label}
                    <Badge variant="secondary">{meals.length}</Badge>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {meals.map((meal) => (
                      <Card key={meal.id} data-testid={`card-meal-${meal.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {meal.imageUrl && (
                              <img
                                src={meal.imageUrl}
                                alt={meal.recipeName}
                                className="w-16 h-16 rounded object-cover"
                                data-testid={`img-meal-${meal.id}`}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate" data-testid={`text-meal-name-${meal.id}`}>
                                {meal.recipeName}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteMealId(meal.id)}
                              data-testid={`button-remove-meal-${meal.id}`}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Other/Uncategorized meals */}
            {mealsByType["other"] && mealsByType["other"].length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  Other
                  <Badge variant="secondary">{mealsByType["other"].length}</Badge>
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {mealsByType["other"].map((meal) => (
                    <Card key={meal.id} data-testid={`card-meal-${meal.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {meal.imageUrl && (
                            <img
                              src={meal.imageUrl}
                              alt={meal.recipeName}
                              className="w-16 h-16 rounded object-cover"
                              data-testid={`img-meal-${meal.id}`}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate" data-testid={`text-meal-name-${meal.id}`}>
                              {meal.recipeName}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteMealId(meal.id)}
                            data-testid={`button-remove-meal-${meal.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Event Dialog */}
      <AlertDialog open={!!deleteEventId} onOpenChange={() => setDeleteEventId(null)}>
        <AlertDialogContent data-testid="dialog-delete-event">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this event and all associated meals. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-event">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEventMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-event"
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Meal Dialog */}
      <AlertDialog open={!!deleteMealId} onOpenChange={() => setDeleteMealId(null)}>
        <AlertDialogContent data-testid="dialog-delete-meal">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Meal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this meal from the event. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-meal">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMealId && removeMealMutation.mutate(deleteMealId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-meal"
            >
              Remove Meal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

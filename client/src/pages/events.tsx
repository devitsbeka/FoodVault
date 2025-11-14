import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Plus, Users, Clock, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import type { Event } from "@shared/schema";
import { format, isPast, parseISO, isToday, isFuture } from "date-fns";

const createEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().optional(),
  scheduledFor: z.string().min(1, "Date is required"),
  guestCount: z.coerce.number().int().positive().optional(),
  notes: z.string().optional(),
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: "",
      description: "",
      scheduledFor: "",
      guestCount: undefined,
      notes: "",
    },
  });

  // Get all events
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      return await apiRequest("POST", "/api/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: "Event created",
        description: "Your event has been created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const handleCreateEvent = (data: CreateEventFormData) => {
    createEventMutation.mutate(data);
  };

  // Group events by upcoming/past
  const upcomingEvents = events.filter(event => 
    isFuture(parseISO(event.scheduledFor.toString())) || isToday(parseISO(event.scheduledFor.toString()))
  );
  const pastEvents = events.filter(event => 
    isPast(parseISO(event.scheduledFor.toString())) && !isToday(parseISO(event.scheduledFor.toString()))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Events</h1>
          <p className="text-muted-foreground mt-1">
            Plan meals for special occasions, parties, and gatherings
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-event">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-create-event">
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
              <DialogDescription>
                Plan a special occasion with multiple dishes and guests
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateEvent)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Game Night, Birthday Party, Thanksgiving..." 
                          data-testid="input-event-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scheduledFor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl>
                        <Input 
                          type="datetime-local" 
                          data-testid="input-event-date"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guestCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Guest Count (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="How many guests?"
                          data-testid="input-event-guests"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="What's the occasion?"
                          data-testid="input-event-description"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any special requirements or notes?"
                          data-testid="input-event-notes"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={createEventMutation.isPending}
                    data-testid="button-submit-event"
                  >
                    {createEventMutation.isPending ? "Creating..." : "Create Event"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Upcoming Events</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Past Events */}
      {pastEvents.length > 0 && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Past Events</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {pastEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <Card className="border-dashed" data-testid="empty-state-events">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Create your first event to start planning meals for special occasions, parties, or gatherings with multiple dishes
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-event">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Event
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const eventDate = parseISO(event.scheduledFor.toString());
  const isUpcoming = isFuture(eventDate) || isToday(eventDate);

  return (
    <Link href={`/events/${event.id}`}>
      <Card 
        className="hover-elevate active-elevate-2 transition-all cursor-pointer overflow-visible"
        data-testid={`card-event-${event.id}`}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate" data-testid={`text-event-name-${event.id}`}>
                {event.name}
              </CardTitle>
              {event.description && (
                <CardDescription className="line-clamp-2 mt-1" data-testid={`text-event-description-${event.id}`}>
                  {event.description}
                </CardDescription>
              )}
            </div>
            {isUpcoming && (
              <Badge variant="default" data-testid={`badge-upcoming-${event.id}`}>
                Upcoming
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span data-testid={`text-event-date-${event.id}`}>
              {format(eventDate, "MMMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
          {event.guestCount && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span data-testid={`text-event-guests-${event.id}`}>
                {event.guestCount} {event.guestCount === 1 ? "guest" : "guests"}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-muted-foreground">
              View details
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, Users, ChefHat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { DiningTable } from "@/components/DiningTable";
import { RecipePickerModal } from "@/components/RecipePickerModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Available dietary restrictions
const DIETARY_RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "Low-Carb",
] as const;

interface SeatConfig {
  seatNumber: number;
  dietaryRestrictions: string[];
  recipeId?: string;
  recipeName?: string;
  recipeImage?: string;
}

export default function MealPlanning() {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [seatCount, setSeatCount] = useState<number>(4); // Default to 4 people
  const [seats, setSeats] = useState<SeatConfig[]>(
    Array.from({ length: 4 }, (_, i) => ({
      seatNumber: i + 1,
      dietaryRestrictions: [],
    }))
  );
  const [selectedSeatForConfig, setSelectedSeatForConfig] = useState<number | null>(null);
  const [recipePickerOpen, setRecipePickerOpen] = useState(false);
  const [seatForRecipePicker, setSeatForRecipePicker] = useState<number | null>(null);

  // Get combined dietary restrictions from ALL active seats
  const getCombinedDietaryRestrictions = (): string[] => {
    const allRestrictions = seats
      .slice(0, seatCount)
      .flatMap(seat => seat.dietaryRestrictions);
    
    // Return unique restrictions
    return Array.from(new Set(allRestrictions));
  };

  // Update seats when seat count changes
  const handleSeatCountChange = (count: number) => {
    setSeatCount(count);
    setSeats(
      Array.from({ length: count }, (_, i) => ({
        seatNumber: i + 1,
        dietaryRestrictions: seats[i]?.dietaryRestrictions || [],
        recipeId: seats[i]?.recipeId,
        recipeName: seats[i]?.recipeName,
        recipeImage: seats[i]?.recipeImage,
      }))
    );
  };

  // Toggle dietary restriction for a seat
  const toggleDietaryRestriction = (seatNumber: number, restriction: string) => {
    setSeats(prev =>
      prev.map(seat => {
        if (seat.seatNumber === seatNumber) {
          const hasRestriction = seat.dietaryRestrictions.includes(restriction);
          return {
            ...seat,
            dietaryRestrictions: hasRestriction
              ? seat.dietaryRestrictions.filter(r => r !== restriction)
              : [...seat.dietaryRestrictions, restriction],
          };
        }
        return seat;
      })
    );
  };

  const handleSeatClick = (seatNumber: number) => {
    setSelectedSeatForConfig(seatNumber);
    toast({
      title: `Seat ${seatNumber} selected`,
      description: "Configure dietary restrictions below",
    });
  };

  const handleAddRecipe = (seatNumber: number) => {
    setSeatForRecipePicker(seatNumber);
    setRecipePickerOpen(true);
  };

  const handleRecipeSelection = (recipe: any) => {
    if (seatForRecipePicker === null) return;
    
    setSeats(prev =>
      prev.map(seat => {
        if (seat.seatNumber === seatForRecipePicker) {
          return {
            ...seat,
            recipeId: recipe.id,
            recipeName: recipe.name,
            recipeImage: recipe.imageUrl,
          };
        }
        return seat;
      })
    );

    toast({
      title: "Recipe assigned",
      description: `${recipe.name} assigned to Seat ${seatForRecipePicker}`,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-large-title">Meal Planning</h1>
        <p className="text-muted-foreground mt-1">
          Visual dining table planner with per-seat dietary restrictions
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Configuration Sidebar */}
        <div className="lg:col-span-3 space-y-4">
          {/* Date Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Date
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
                data-testid="input-date"
              />
            </CardContent>
          </Card>

          {/* Person Count Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Number of People
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={seatCount.toString()}
                onValueChange={(value) => handleSeatCountChange(parseInt(value))}
              >
                <SelectTrigger data-testid="select-seat-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Solo (1 person)</SelectItem>
                  <SelectItem value="2">2 people</SelectItem>
                  <SelectItem value="3">3 people</SelectItem>
                  <SelectItem value="4">4 people</SelectItem>
                  <SelectItem value="5">5 people</SelectItem>
                  <SelectItem value="6">6 people</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Seat Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {selectedSeatForConfig
                  ? `Seat ${selectedSeatForConfig} Dietary Restrictions`
                  : "Seat Configuration"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSeatForConfig ? (
                <div className="space-y-3">
                  {DIETARY_RESTRICTIONS.map((restriction) => {
                    const seat = seats.find(s => s.seatNumber === selectedSeatForConfig);
                    const isChecked = seat?.dietaryRestrictions.includes(restriction) || false;
                    
                    return (
                      <div key={restriction} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${selectedSeatForConfig}-${restriction}`}
                          checked={isChecked}
                          onCheckedChange={() =>
                            toggleDietaryRestriction(selectedSeatForConfig, restriction)
                          }
                          data-testid={`checkbox-${selectedSeatForConfig}-${restriction.toLowerCase()}`}
                        />
                        <Label
                          htmlFor={`${selectedSeatForConfig}-${restriction}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {restriction}
                        </Label>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => setSelectedSeatForConfig(null)}
                    data-testid="button-done-config"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Click a seat on the dining table to configure dietary restrictions
                </p>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Meal Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Seats configured:</span>
                <Badge variant="secondary">{seatCount}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recipes assigned:</span>
                <Badge variant="secondary">
                  {seats.filter(s => s.recipeId).length}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total restrictions:</span>
                <Badge variant="secondary">
                  {seats.reduce((sum, s) => sum + s.dietaryRestrictions.length, 0)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dining Table Visualization */}
        <div className="lg:col-span-9">
          <Card className="p-6">
            <div className="text-center mb-4">
              <h2 className="text-title-1">
                {new Date(selectedDate).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Click seats to configure dietary restrictions, click + to assign recipes
              </p>
            </div>

            <DiningTable
              seatCount={seatCount}
              seats={seats}
              onSeatClick={handleSeatClick}
              onAddRecipe={handleAddRecipe}
            />

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button variant="outline" data-testid="button-clear-all">
                Clear All
              </Button>
              <Button data-testid="button-save-meal-plan">
                <ChefHat className="w-4 h-4 mr-2" />
                Save Meal Plan
              </Button>
            </div>
          </Card>

          {/* Seat Legend */}
          <Card className="mt-4 p-4">
            <h3 className="text-sm font-semibold mb-3">Seat Configuration Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {seats.map((seat) => (
                <div
                  key={seat.seatNumber}
                  className={`p-3 border rounded-lg hover-elevate cursor-pointer transition-all ${
                    selectedSeatForConfig === seat.seatNumber
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                  onClick={() => setSelectedSeatForConfig(seat.seatNumber)}
                  data-testid={`seat-summary-${seat.seatNumber}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Seat {seat.seatNumber}</span>
                    {seat.recipeId && (
                      <Badge variant="secondary" className="text-xs">
                        Assigned
                      </Badge>
                    )}
                  </div>
                  {seat.dietaryRestrictions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {seat.dietaryRestrictions.map((restriction, i) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1 py-0">
                          {restriction}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No restrictions</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recipe Picker Modal */}
      <RecipePickerModal
        open={recipePickerOpen}
        onOpenChange={setRecipePickerOpen}
        onSelectRecipe={handleRecipeSelection}
        combinedDietaryRestrictions={getCombinedDietaryRestrictions()}
        seatNumber={seatForRecipePicker || 1}
      />
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { IndoorKitchenLayout } from "@/components/equipment/indoor-kitchen-layout";
import { OutdoorKitchenLayout } from "@/components/equipment/outdoor-kitchen-layout";
import { UtensilsCrossed, Flame, Loader2, Star, ShoppingCart } from "lucide-react";
import type { KitchenEquipment } from "@shared/schema";

interface ProductRecommendation {
  name: string;
  brand: string;
  price: string;
  imageUrl: string;
  features: string[];
  rating: number;
  description: string;
}

type KitchenSize = "small" | "medium" | "large";
type KitchenLocation = "indoor" | "outdoor";

type EquipmentModalState = {
  open: boolean;
  itemType: string;
  itemName: string;
  location: KitchenLocation;
};

export default function EquipmentPage() {
  const { toast } = useToast();
  const [kitchenSize, setKitchenSize] = useState<KitchenSize>("medium");
  const [kitchenLocation, setKitchenLocation] = useState<KitchenLocation>("indoor");
  const [modalState, setModalState] = useState<EquipmentModalState>({
    open: false,
    itemType: "",
    itemName: "",
    location: "indoor",
  });
  const [ownsItem, setOwnsItem] = useState<boolean | null>(null);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");

  const { data: equipment, isLoading } = useQuery<KitchenEquipment[]>({
    queryKey: ["/api/kitchen-equipment", kitchenLocation],
    queryFn: async () => {
      const res = await fetch(`/api/kitchen-equipment?location=${kitchenLocation}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
  });

  const upsertEquipmentMutation = useMutation({
    mutationFn: async (data: {
      itemType: string;
      location: KitchenLocation;
      owned: boolean;
      brand?: string;
      model?: string;
      notes?: string;
      imageUrl?: string;
    }) => {
      return await apiRequest("POST", "/api/kitchen-equipment", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-equipment"] });
      handleCloseModal();
      toast({
        title: ownsItem ? "Item added" : "Added to wishlist",
        description: ownsItem
          ? "Your kitchen equipment has been saved."
          : "We'll find the best recommendations for you.",
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
        description: "Failed to save equipment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleItemClick = (itemType: string, itemName: string) => {
    const existing = equipment?.find(
      (e) => e.itemType === itemType && e.location === kitchenLocation
    );

    if (existing) {
      setOwnsItem(existing.owned);
      setBrand(existing.brand || "");
      setModel(existing.model || "");
      setNotes(existing.notes || "");
    } else {
      setOwnsItem(null);
      setBrand("");
      setModel("");
      setNotes("");
    }

    setModalState({
      open: true,
      itemType,
      itemName,
      location: kitchenLocation,
    });
  };

  const handleCloseModal = () => {
    setModalState({ open: false, itemType: "", itemName: "", location: "indoor" });
    setOwnsItem(null);
    setBrand("");
    setModel("");
    setNotes("");
  };

  const handleOwnershipDecision = (owns: boolean) => {
    setOwnsItem(owns);
  };

  const handleSaveEquipment = () => {
    if (ownsItem === null) {
      toast({
        title: "Please select an option",
        description: "Let us know if you own this item or want recommendations.",
        variant: "destructive",
      });
      return;
    }

    upsertEquipmentMutation.mutate({
      itemType: modalState.itemType,
      location: modalState.location,
      owned: ownsItem,
      brand: ownsItem ? brand : undefined,
      model: ownsItem ? model : undefined,
      notes: notes || undefined,
    });
  };

  const isItemOwned = (itemType: string): boolean => {
    return equipment?.some((e) => e.itemType === itemType && e.owned) || false;
  };

  const isItemWishlisted = (itemType: string): boolean => {
    return equipment?.some((e) => e.itemType === itemType && !e.owned) || false;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">Kitchen Equipment</h1>
          <p className="text-muted-foreground mt-1">
            Track your equipment and discover recommendations
          </p>
        </div>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <Label>Kitchen Type</Label>
            <ToggleGroup
              type="single"
              value={kitchenLocation}
              onValueChange={(value) => value && setKitchenLocation(value as KitchenLocation)}
              data-testid="toggle-kitchen-type"
            >
              <ToggleGroupItem value="indoor" aria-label="Indoor kitchen" data-testid="toggle-indoor">
                <UtensilsCrossed className="w-4 h-4 mr-2" />
                Indoor
              </ToggleGroupItem>
              <ToggleGroupItem value="outdoor" aria-label="Outdoor kitchen" data-testid="toggle-outdoor">
                <Flame className="w-4 h-4 mr-2" />
                Outdoor
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-2">
            <Label>Kitchen Size</Label>
            <ToggleGroup
              type="single"
              value={kitchenSize}
              onValueChange={(value) => value && setKitchenSize(value as KitchenSize)}
              data-testid="toggle-kitchen-size"
            >
              <ToggleGroupItem value="small" aria-label="Small kitchen" data-testid="toggle-small">
                Small
              </ToggleGroupItem>
              <ToggleGroupItem value="medium" aria-label="Medium kitchen" data-testid="toggle-medium">
                Medium
              </ToggleGroupItem>
              <ToggleGroupItem value="large" aria-label="Large kitchen" data-testid="toggle-large">
                Large
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        <div className="bg-muted/30 rounded-lg p-8 min-h-[500px] flex items-center justify-center">
          {kitchenLocation === "indoor" ? (
            <IndoorKitchenLayout
              size={kitchenSize}
              onItemClick={handleItemClick}
              isItemOwned={isItemOwned}
              isItemWishlisted={isItemWishlisted}
            />
          ) : (
            <OutdoorKitchenLayout
              size={kitchenSize}
              onItemClick={handleItemClick}
              isItemOwned={isItemOwned}
              isItemWishlisted={isItemWishlisted}
            />
          )}
        </div>
      </Card>

      <Dialog open={modalState.open} onOpenChange={(open) => !open && handleCloseModal()}>
        <DialogContent className="max-w-md" data-testid="dialog-equipment">
          <DialogHeader>
            <DialogTitle>{modalState.itemName}</DialogTitle>
            <DialogDescription>
              {ownsItem === null ? "Do you already own this item?" : ownsItem ? "Tell us about your equipment" : "We'll find the best options for you"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {ownsItem === null ? (
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => handleOwnershipDecision(true)}
                  data-testid="button-owns-yes"
                >
                  Yes, I own it
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => handleOwnershipDecision(false)}
                  data-testid="button-owns-no"
                >
                  No, show recommendations
                </Button>
              </div>
            ) : ownsItem ? (
              <>
                <div>
                  <Label htmlFor="brand">Brand (Optional)</Label>
                  <Input
                    id="brand"
                    placeholder="e.g., KitchenAid"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    data-testid="input-brand"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model (Optional)</Label>
                  <Input
                    id="model"
                    placeholder="e.g., KSM150"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    data-testid="input-model"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Any additional details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    data-testid="input-notes"
                    className="mt-2"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveEquipment}
                    disabled={upsertEquipmentMutation.isPending}
                    className="flex-1"
                    data-testid="button-save"
                  >
                    {upsertEquipmentMutation.isPending ? "Saving..." : "Save Equipment"}
                  </Button>
                  <Button variant="outline" onClick={() => setOwnsItem(null)} data-testid="button-back">
                    Back
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We'll analyze the best products for {modalState.itemName.toLowerCase()} and show you top-rated options with prices and features.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveEquipment}
                    disabled={upsertEquipmentMutation.isPending}
                    className="flex-1"
                    data-testid="button-get-recommendations"
                  >
                    {upsertEquipmentMutation.isPending ? "Saving..." : "Get Recommendations"}
                  </Button>
                  <Button variant="outline" onClick={() => setOwnsItem(null)} data-testid="button-back-recommendations">
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

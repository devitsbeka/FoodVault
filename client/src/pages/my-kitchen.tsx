import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KitchenInventory, InsertKitchenInventory } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";

type Category = "fridge" | "pantry" | "other";

export default function MyKitchen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category>("fridge");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "1",
    unit: "",
    expirationDate: "",
  });

  const { data: inventory, isLoading } = useQuery<KitchenInventory[]>({
    queryKey: ["/api/kitchen-inventory"],
  });

  const addMutation = useMutation({
    mutationFn: async (item: InsertKitchenInventory) => {
      await apiRequest("POST", "/api/kitchen-inventory", item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-inventory"] });
      setIsAddDialogOpen(false);
      setNewItem({ name: "", quantity: "1", unit: "", expirationDate: "" });
      toast({
        title: "Item added",
        description: "Your ingredient has been added to the kitchen.",
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
        description: "Failed to add item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/kitchen-inventory/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-inventory"] });
      toast({
        title: "Item removed",
        description: "The ingredient has been removed from your kitchen.",
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
        description: "Failed to remove item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddItem = () => {
    if (!newItem.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter an item name.",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      userId: user!.id,
      name: newItem.name,
      category: selectedCategory,
      quantity: newItem.quantity,
      unit: newItem.unit || null,
      expirationDate: newItem.expirationDate ? new Date(newItem.expirationDate) : null,
    });
  };

  const filteredInventory = inventory?.filter(item => item.category === selectedCategory) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">My Kitchen</h1>
          <p className="text-muted-foreground mt-1">
            Manage your ingredients and track what's in stock
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-item">
              <Plus className="w-4 h-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Ingredient</DialogTitle>
              <DialogDescription>
                Add a new ingredient to your {selectedCategory}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Item Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Tomatoes"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  data-testid="input-item-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    step="0.1"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    data-testid="input-quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    placeholder="e.g., lbs, oz"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    data-testid="input-unit"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="expiration">Expiration Date (Optional)</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={newItem.expirationDate}
                  onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
                  data-testid="input-expiration"
                />
              </div>
              <Button 
                onClick={handleAddItem} 
                className="w-full"
                disabled={addMutation.isPending}
                data-testid="button-save-item"
              >
                {addMutation.isPending ? "Adding..." : "Add to Kitchen"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Category)}>
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="fridge" data-testid="tab-fridge">Fridge</TabsTrigger>
          <TabsTrigger value="pantry" data-testid="tab-pantry">Pantry</TabsTrigger>
          <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6 space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : filteredInventory.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No items in your {selectedCategory} yet
                </p>
                <Button onClick={() => setIsAddDialogOpen(true)} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Item
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredInventory.map((item) => {
                const daysUntilExpiry = item.expirationDate
                  ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null;
                const isExpiring = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3;

                return (
                  <Card key={item.id} className={`hover-elevate ${isExpiring ? 'border-destructive/50' : ''}`} data-testid={`item-card-${item.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate(item.id)}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {item.quantity} {item.unit || "unit(s)"}
                      </p>
                      {item.expirationDate && (
                        <div className={`flex items-center gap-1 text-sm ${isExpiring ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          <Calendar className="w-3 h-3" />
                          <span>
                            {daysUntilExpiry! < 0
                              ? "Expired"
                              : daysUntilExpiry === 0
                              ? "Expires today"
                              : `${daysUntilExpiry} day${daysUntilExpiry > 1 ? "s" : ""} left`}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

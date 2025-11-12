import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { KitchenInventory, InsertKitchenInventory } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";

type Category = "fridge" | "pantry" | "other";

interface UnsplashImage {
  urls: {
    small: string;
    thumb: string;
  };
}

export default function MyKitchen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category>("fridge");
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    quantity: "1",
    unit: "",
    expirationDate: "",
  });
  const [ingredientImages, setIngredientImages] = useState<Record<string, string>>({});

  const { data: inventory, isLoading } = useQuery<KitchenInventory[]>({
    queryKey: ["/api/kitchen-inventory"],
  });

  // Fetch ingredient image from Unsplash
  const fetchIngredientImage = async (ingredientName: string): Promise<string> => {
    if (ingredientImages[ingredientName]) {
      return ingredientImages[ingredientName];
    }

    try {
      const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
      if (!accessKey) {
        return '';
      }

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(ingredientName + ' food ingredient')}&per_page=1&orientation=landscape`,
        {
          headers: {
            Authorization: `Client-ID ${accessKey}`
          }
        }
      );

      if (!response.ok) {
        return '';
      }

      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const imageUrl = data.results[0].urls.small;
        setIngredientImages(prev => ({ ...prev, [ingredientName]: imageUrl }));
        return imageUrl;
      }
    } catch (error) {
      console.error('Error fetching ingredient image:', error);
    }
    return '';
  };

  const addMutation = useMutation({
    mutationFn: async (item: InsertKitchenInventory) => {
      await apiRequest("POST", "/api/kitchen-inventory", item);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-inventory"] });
      
      // Fetch image for the newly added item
      if (newItem.name) {
        await fetchIngredientImage(newItem.name);
      }
      
      setNewItem({ name: "", quantity: "1", unit: "", expirationDate: "" });
      setIsAddingItem(false);
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

  // Load images for existing inventory items
  useState(() => {
    if (inventory) {
      inventory.forEach(item => {
        if (!ingredientImages[item.name]) {
          fetchIngredientImage(item.name);
        }
      });
    }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-large-title">My Kitchen</h1>
        <p className="text-muted-foreground mt-1">
          Manage your ingredients and track what's in stock
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left Column - Add New Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-title-2 mb-4">Add Ingredients</h2>
              
              {!isAddingItem ? (
                <Button 
                  onClick={() => setIsAddingItem(true)} 
                  className="w-full gap-2"
                  data-testid="button-start-add-item"
                >
                  <Plus className="w-4 h-4" />
                  Add New Item
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Item Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Tomatoes, Chicken, Milk"
                      value={newItem.name}
                      onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                      autoFocus
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
                        placeholder="lbs, oz, pcs"
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
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddItem} 
                      className="flex-1"
                      disabled={addMutation.isPending}
                      data-testid="button-save-item"
                    >
                      {addMutation.isPending ? "Adding..." : `Add to ${selectedCategory}`}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsAddingItem(false);
                        setNewItem({ name: "", quantity: "1", unit: "", expirationDate: "" });
                      }}
                      data-testid="button-cancel-add"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fridge Items:</span>
                  <span className="font-medium">{inventory?.filter(i => i.category === 'fridge').length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pantry Items:</span>
                  <span className="font-medium">{inventory?.filter(i => i.category === 'pantry').length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Other Items:</span>
                  <span className="font-medium">{inventory?.filter(i => i.category === 'other').length || 0}</span>
                </div>
                <div className="pt-2 border-t flex justify-between">
                  <span className="text-muted-foreground">Expiring Soon:</span>
                  <span className="font-medium text-destructive">
                    {inventory?.filter(item => {
                      if (!item.expirationDate) return false;
                      const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
                    }).length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Visual Inventory */}
        <div className="lg:col-span-3">
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Category)}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="fridge" data-testid="tab-fridge">Fridge</TabsTrigger>
              <TabsTrigger value="pantry" data-testid="tab-pantry">Pantry</TabsTrigger>
              <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-0">
              <Card className="overflow-hidden">
                {/* Fridge/Shelf Visual Background */}
                <div 
                  className="relative min-h-[600px] p-6"
                  style={{
                    background: selectedCategory === 'fridge' 
                      ? 'linear-gradient(180deg, #f0f4f8 0%, #e8eef4 50%, #dce4ec 100%)'
                      : selectedCategory === 'pantry'
                      ? 'linear-gradient(180deg, #fef3e2 0%, #fcecd0 50%, #fae5c0 100%)'
                      : 'linear-gradient(180deg, #f5f5f5 0%, #e8e8e8 50%, #d8d8d8 100%)'
                  }}
                >
                  {/* Shelf Lines */}
                  {selectedCategory !== 'other' && (
                    <>
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-400/30 to-transparent" style={{ top: '33%' }} />
                      <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-400/30 to-transparent" style={{ top: '66%' }} />
                    </>
                  )}
                  
                  {isLoading ? (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                      {Array(6).fill(0).map((_, i) => (
                        <Skeleton key={i} className="h-40 rounded-xl" />
                      ))}
                    </div>
                  ) : filteredInventory.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <p className="text-muted-foreground mb-4">
                          No items in your {selectedCategory} yet
                        </p>
                        <Button 
                          onClick={() => setIsAddingItem(true)} 
                          variant="outline"
                          data-testid="button-add-first-item"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Your First Item
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 relative z-10">
                      {filteredInventory.map((item) => {
                        const daysUntilExpiry = item.expirationDate
                          ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        const isExpiring = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
                        const imageUrl = ingredientImages[item.name] || '';

                        return (
                          <Card 
                            key={item.id} 
                            className={`hover-elevate group ${isExpiring ? 'border-destructive/50 ring-2 ring-destructive/20' : ''}`} 
                            data-testid={`item-card-${item.id}`}
                          >
                            {/* Ingredient Photo */}
                            <div className="relative h-32 bg-muted overflow-hidden">
                              {imageUrl ? (
                                <img 
                                  src={imageUrl} 
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
                                  <span className="text-4xl opacity-20">🍽️</span>
                                </div>
                              )}
                              
                              {/* Delete Button Overlay */}
                              <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                onClick={() => deleteMutation.mutate(item.id)}
                                data-testid={`button-delete-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                            
                            <CardContent className="p-3">
                              <h3 className="font-semibold text-sm mb-1 line-clamp-1">{item.name}</h3>
                              <p className="text-xs text-muted-foreground mb-1">
                                {item.quantity} {item.unit || "unit(s)"}
                              </p>
                              {item.expirationDate && (
                                <div className={`flex items-center gap-1 text-xs ${isExpiring ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    {daysUntilExpiry! < 0
                                      ? "Expired"
                                      : daysUntilExpiry === 0
                                      ? "Expires today"
                                      : `${daysUntilExpiry}d left`}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Calendar, X, Package, CheckCircle2, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { IngredientImage } from "@/components/IngredientImage";
import type { KitchenInventory, InsertKitchenInventory, InventoryReviewQueue } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Category = "fridge" | "pantry" | "other" | "pending";

interface IngredientSuggestion {
  id: number;
  name: string;
  imageUrl: string | null;
}

export default function MyKitchen() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<Category>("fridge");
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    imageUrl: null as string | null,
    quantity: "1",
    unit: "",
    expirationDate: "",
  });

  const { data: inventory, isLoading } = useQuery<KitchenInventory[]>({
    queryKey: ["/api/kitchen-inventory"],
  });

  const { data: reviewQueue, isLoading: reviewLoading } = useQuery<InventoryReviewQueue[]>({
    queryKey: ["/api/inventory-review-queue"],
  });

  // Fetch ingredient suggestions from Spoonacular
  const { data: suggestions = [], isLoading: suggestionsLoading } = useQuery<IngredientSuggestion[]>({
    queryKey: [`/api/ingredient-suggestions?query=${searchQuery}`],
    enabled: searchQuery.length >= 2,
  });

  const addMutation = useMutation({
    mutationFn: async (item: InsertKitchenInventory) => {
      await apiRequest("POST", "/api/kitchen-inventory", item);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-inventory"] });
      setNewItem({ name: "", imageUrl: null, quantity: "1", unit: "", expirationDate: "" });
      setSearchQuery("");
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

  const approveMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("POST", `/api/inventory-review-queue/${itemId}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-inventory"] });
      toast({
        title: "Item approved",
        description: "Item has been added to your kitchen.",
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
        description: "Failed to approve item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/inventory-review-queue/${itemId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-review-queue"] });
      toast({
        title: "Item rejected",
        description: "Item has been removed from the queue.",
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
        description: "Failed to reject item. Please try again.",
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

    // Prevent adding items when on pending tab
    if (selectedCategory === 'pending') {
      toast({
        title: "Invalid category",
        description: "Please select Fridge, Pantry, or Other to add items.",
        variant: "destructive",
      });
      return;
    }

    addMutation.mutate({
      userId: user!.id,
      name: newItem.name,
      category: selectedCategory as 'fridge' | 'pantry' | 'other',
      quantity: newItem.quantity,
      unit: newItem.unit || null,
      expirationDate: newItem.expirationDate ? new Date(newItem.expirationDate) : null,
      imageUrl: newItem.imageUrl,
    });
  };

  const handleSelectIngredient = (suggestion: IngredientSuggestion) => {
    setNewItem({
      ...newItem,
      name: suggestion.name,
      imageUrl: suggestion.imageUrl,
    });
    setSearchQuery(suggestion.name);
    setOpen(false);
  };

  const filteredInventory = inventory?.filter(item => item.category === selectedCategory) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-large-title">My Kitchen</h1>
        <p className="text-muted-foreground mt-1">
          Manage your ingredients and track what's in stock
        </p>
      </div>

      {/* Add Ingredients Form - Full Width */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-title-2 mb-4">Add Ingredients</h2>
          
          <div className="space-y-4">
            {/* Ingredient Autocomplete */}
            <div>
              <Label htmlFor="ingredient-search">Search Ingredient</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    data-testid="button-ingredient-search"
                  >
                    {newItem.name || "Search for an ingredient..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Type to search ingredients..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      data-testid="input-ingredient-search"
                    />
                    <CommandList>
                      {searchQuery.length < 2 ? (
                        <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
                      ) : suggestionsLoading ? (
                        <CommandEmpty>Loading suggestions...</CommandEmpty>
                      ) : suggestions.length === 0 ? (
                        <CommandEmpty>No ingredients found</CommandEmpty>
                      ) : (
                        <CommandGroup>
                          {suggestions.map((suggestion) => (
                            <CommandItem
                              key={suggestion.id}
                              value={suggestion.name}
                              onSelect={() => handleSelectIngredient(suggestion)}
                              data-testid={`suggestion-${suggestion.id}`}
                            >
                              <div className="flex items-center gap-2">
                                {suggestion.imageUrl && (
                                  <img 
                                    src={suggestion.imageUrl} 
                                    alt={suggestion.name}
                                    className="w-8 h-8 rounded object-cover"
                                  />
                                )}
                                <span>{suggestion.name}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div>
                <Label htmlFor="expiration">Expiration Date</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={newItem.expirationDate}
                  onChange={(e) => setNewItem({ ...newItem, expirationDate: e.target.value })}
                  data-testid="input-expiration"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleAddItem} 
                  className="w-full gap-2"
                  disabled={addMutation.isPending || !newItem.name}
                  data-testid="button-save-item"
                >
                  <Plus className="w-4 h-4" />
                  {addMutation.isPending ? "Adding..." : `Add to ${selectedCategory}`}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout: Inventory (Left) and Quick Facts (Right) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Inventory List */}
        <div className="lg:col-span-2">
          <Tabs value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as Category)}>
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="fridge" data-testid="tab-fridge">Fridge</TabsTrigger>
              <TabsTrigger value="pantry" data-testid="tab-pantry">Pantry</TabsTrigger>
              <TabsTrigger value="other" data-testid="tab-other">Other</TabsTrigger>
              <TabsTrigger value="pending" data-testid="tab-pending">
                Pending Review
                {reviewQueue && reviewQueue.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                    {reviewQueue.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="mt-0">
              {selectedCategory === 'pending' ? (
                // Pending Review Tab
                <Card className="overflow-hidden">
                  <div className="relative min-h-[600px] p-6">
                    {reviewLoading ? (
                      <div className="space-y-4">
                        {Array(3).fill(0).map((_, i) => (
                          <Skeleton key={i} className="h-24 rounded-xl" />
                        ))}
                      </div>
                    ) : !reviewQueue || reviewQueue.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No Items Pending Review</h3>
                          <p className="text-muted-foreground">
                            Items moved from shopping lists will appear here for approval
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {reviewQueue.map((item) => (
                          <Card key={item.id} className="p-4" data-testid={`review-item-${item.id}`}>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3 flex-1">
                                <IngredientImage 
                                  imageUrl={item.imageUrl} 
                                  name={item.name} 
                                  size={30}
                                />
                                <div className="flex-1">
                                  <h3 className="font-medium">{item.name}</h3>
                                  <p className="text-sm text-muted-foreground">
                                    {item.quantity} {item.unit || "unit(s)"}
                                    {item.categoryGuess && ` • Suggested: ${item.categoryGuess}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => rejectMutation.mutate(item.id)}
                                  disabled={rejectMutation.isPending}
                                  data-testid={`button-reject-${item.id}`}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => approveMutation.mutate(item.id)}
                                  disabled={approveMutation.isPending}
                                  data-testid={`button-approve-${item.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-2" />
                                  Add to Kitchen
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              ) : (
                // Fridge/Pantry/Other Tabs
                <Card className="overflow-hidden">
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
                        <p className="text-muted-foreground">
                          No items in your {selectedCategory} yet. Use the form above to add ingredients.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 relative z-10">
                      {filteredInventory.map((item) => {
                        const daysUntilExpiry = item.expirationDate
                          ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                          : null;
                        const isExpiring = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 3;

                        return (
                          <Card 
                            key={item.id} 
                            className={`hover-elevate group ${isExpiring ? 'border-destructive/50 ring-2 ring-destructive/20' : ''}`} 
                            data-testid={`item-card-${item.id}`}
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start gap-3">
                                <IngredientImage 
                                  imageUrl={item.imageUrl} 
                                  name={item.name} 
                                  size={30}
                                  className="flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{item.name}</h3>
                                  <p className="text-xs text-muted-foreground">
                                    {item.quantity} {item.unit || "unit(s)"}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => deleteMutation.mutate(item.id)}
                                  data-testid={`button-delete-${item.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column - Quick Facts Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-title-3 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total Items</span>
                  <span className="font-semibold">{inventory?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In Fridge</span>
                  <span className="font-semibold">
                    {inventory?.filter(i => i.category === 'fridge').length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">In Pantry</span>
                  <span className="font-semibold">
                    {inventory?.filter(i => i.category === 'pantry').length || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Other</span>
                  <span className="font-semibold">
                    {inventory?.filter(i => i.category === 'other').length || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-title-3 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-destructive" />
                Expiring Soon
              </h3>
              <div className="space-y-2">
                {inventory?.filter(item => {
                  if (!item.expirationDate) return false;
                  const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                  return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
                }).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No items expiring soon</p>
                ) : (
                  inventory?.filter(item => {
                    if (!item.expirationDate) return false;
                    const daysUntilExpiry = Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
                  }).map(item => {
                    const daysUntilExpiry = Math.ceil((new Date(item.expirationDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{item.name}</span>
                        <span className="text-destructive font-medium whitespace-nowrap ml-2">
                          {daysUntilExpiry === 0 ? "Today" : `${daysUntilExpiry}d`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

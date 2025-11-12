import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ShoppingCart, Plus, Trash2, Users as UsersIcon, Package, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { IngredientImage } from "@/components/IngredientImage";
import type { ShoppingList, ShoppingListItem, User } from "@shared/schema";

type ShoppingListWithItems = ShoppingList & {
  items: (ShoppingListItem & {
    assignedToUser?: {
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
    } | null;
  })[];
  family?: {
    name: string | null;
    members: {
      userId: string;
      user: {
        firstName: string | null;
        lastName: string | null;
        profileImageUrl: string | null;
      };
    }[];
  } | null;
};

type FamilyMember = {
  userId: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
};

export default function ShoppingListPage() {
  const { toast } = useToast();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("");

  // Fetch all shopping lists (headers only)
  const { data: lists, isLoading: listsLoading } = useQuery<ShoppingList[]>({
    queryKey: ["/api/shopping-lists"],
  });

  // Fetch selected list with items
  const { data: selectedList, isLoading: listLoading } = useQuery<ShoppingListWithItems>({
    queryKey: ["/api/shopping-lists", selectedListId],
    queryFn: async () => {
      const res = await fetch(`/api/shopping-lists/${selectedListId}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      return await res.json();
    },
    enabled: !!selectedListId,
  });

  // Auto-select first list when lists load
  useEffect(() => {
    if (!selectedListId && lists && lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [lists, selectedListId]);

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/shopping-lists", { name });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      setIsCreateDialogOpen(false);
      setNewListName("");
      setSelectedListId(data.id);
      toast({
        title: "List created",
        description: "Your shopping list has been created.",
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
        description: "Failed to create list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/shopping-lists/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      setSelectedListId(null);
      toast({
        title: "List deleted",
        description: "Your shopping list has been deleted.",
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
        description: "Failed to delete list. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async ({ listId, name, quantity, unit }: { listId: string; name: string; quantity: string; unit: string }) => {
      return await apiRequest("POST", `/api/shopping-lists/${listId}/items`, {
        name,
        quantity,
        unit,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedListId] });
      setIsAddItemDialogOpen(false);
      setNewItemName("");
      setNewItemQuantity("1");
      setNewItemUnit("");
      toast({
        title: "Item added",
        description: "Item has been added to your list.",
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

  const toggleItemMutation = useMutation({
    mutationFn: async ({ listId, itemId, status }: { listId: string; itemId: string; status: 'active' | 'bought' }) => {
      return await apiRequest("PATCH", `/api/shopping-lists/${listId}/items/${itemId}/status`, {
        status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedListId] });
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
        description: "Failed to update item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const assignItemMutation = useMutation({
    mutationFn: async ({ listId, itemId, userId }: { listId: string; itemId: string; userId: string | null }) => {
      return await apiRequest("PATCH", `/api/shopping-lists/${listId}/items/${itemId}/assign`, {
        assignedToUserId: userId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedListId] });
      toast({
        title: "Assignment updated",
        description: "Item assignment has been updated.",
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
        description: "Failed to assign item. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async ({ listId, itemId }: { listId: string; itemId: string }) => {
      return await apiRequest("DELETE", `/api/shopping-lists/${listId}/items/${itemId}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedListId] });
      toast({
        title: "Item removed",
        description: "Item has been removed from your list.",
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

  const moveToReviewMutation = useMutation({
    mutationFn: async (items: ShoppingListItem[]) => {
      // Add each checked item to review queue
      for (const item of items) {
        await apiRequest("POST", "/api/inventory-review-queue", {
          ingredientName: item.name,
          quantity: parseFloat(item.quantity || "1"),
          unit: item.unit || "",
          shoppingListId: item.listId,
          shoppingListItemId: item.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists", selectedListId] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory-review-queue"] });
      toast({
        title: "Items moved to review",
        description: "Checked items are now in your kitchen review queue.",
        action: (
          <Button size="sm" variant="outline" onClick={() => window.location.href = "/my-kitchen"} data-testid="button-go-to-kitchen">
            Go to Kitchen
          </Button>
        ),
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
        description: "Failed to move items. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a list name.",
        variant: "destructive",
      });
      return;
    }
    createListMutation.mutate(newListName);
  };

  const handleAddItem = () => {
    if (!selectedListId || !newItemName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter an item name.",
        variant: "destructive",
      });
      return;
    }
    addItemMutation.mutate({
      listId: selectedListId,
      name: newItemName,
      quantity: newItemQuantity,
      unit: newItemUnit,
    });
  };

  const handleMoveToReview = () => {
    if (!selectedList) return;
    const checkedItems = selectedList.items.filter(item => item.status === 'bought');
    if (checkedItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please check items to move to your kitchen.",
        variant: "destructive",
      });
      return;
    }
    moveToReviewMutation.mutate(checkedItems);
  };

  const checkedCount = selectedList?.items.filter(item => item.status === 'bought').length || 0;
  const totalCount = selectedList?.items.length || 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">Shopping Lists</h1>
          <p className="text-muted-foreground mt-1">
            Manage your grocery shopping with family collaboration
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-list">
              <Plus className="w-4 h-4" />
              New List
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Shopping List</DialogTitle>
              <DialogDescription>
                Start a new shopping list
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name">List Name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g., Weekly Groceries"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  data-testid="input-list-name"
                  className="mt-2"
                />
              </div>
              <Button
                onClick={handleCreateList}
                className="w-full"
                disabled={createListMutation.isPending}
                data-testid="button-submit-create-list"
              >
                {createListMutation.isPending ? "Creating..." : "Create List"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {listsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl md:col-span-2" />
        </div>
      ) : !lists || lists.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Shopping Lists</h3>
            <p className="text-muted-foreground mb-6">
              Create your first shopping list to get started
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-list">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First List
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Lists sidebar */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Your Lists</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedListId(list.id)}
                  className={`w-full text-left p-3 rounded-lg hover-elevate ${
                    selectedListId === list.id ? "bg-accent" : ""
                  }`}
                  data-testid={`button-select-list-${list.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{list.name}</p>
                      {list.familyId && (
                        <Badge variant="secondary" className="gap-1 mt-1">
                          <UsersIcon className="w-3 h-3" />
                          Shared
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Selected list details */}
          <Card className="md:col-span-2">
            {listLoading || !selectedList ? (
              <CardContent className="p-12">
                <div className="text-center">
                  <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {listLoading ? "Loading..." : "Select a list to view items"}
                  </p>
                </div>
              </CardContent>
            ) : (
              <>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                  <div className="flex-1">
                    <CardTitle>{selectedList.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {checkedCount} of {totalCount} items checked
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {checkedCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleMoveToReview}
                        disabled={moveToReviewMutation.isPending}
                        data-testid="button-move-to-review"
                      >
                        <Package className="w-4 h-4 mr-2" />
                        Move to Kitchen ({checkedCount})
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => selectedListId && deleteListMutation.mutate(selectedListId)}
                      data-testid="button-delete-list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {selectedList.items.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No items in this list yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedList.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover-elevate"
                            data-testid={`item-${item.id}`}
                          >
                            <Checkbox
                              checked={item.status === 'bought'}
                              onCheckedChange={(checked) =>
                                toggleItemMutation.mutate({
                                  listId: selectedList.id,
                                  itemId: item.id,
                                  status: checked ? 'bought' : 'active',
                                })
                              }
                              data-testid={`checkbox-${item.id}`}
                            />
                            <IngredientImage 
                              imageUrl={item.imageUrl} 
                              name={item.name} 
                              size={30}
                            />
                            <div className="flex-1 min-w-0">
                              <p className={`${item.status === 'bought' ? "line-through text-muted-foreground" : ""}`}>
                                {item.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.quantity} {item.unit}
                              </p>
                            </div>
                            {selectedList.family && (
                              <Select
                                value={item.assignedToUserId || "unassigned"}
                                onValueChange={(value) =>
                                  assignItemMutation.mutate({
                                    listId: selectedList.id,
                                    itemId: item.id,
                                    userId: value === "unassigned" ? null : value,
                                  })
                                }
                              >
                                <SelectTrigger className="w-40" data-testid={`select-assign-${item.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned">Unassigned</SelectItem>
                                  {selectedList.family.members.map((member) => (
                                    <SelectItem key={member.userId} value={member.userId}>
                                      {member.user.firstName} {member.user.lastName}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            {item.assignedToUser && (
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={item.assignedToUser.profileImageUrl || undefined} />
                                <AvatarFallback className="text-xs">
                                  {item.assignedToUser.firstName?.[0]}{item.assignedToUser.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                deleteItemMutation.mutate({
                                  listId: selectedList.id,
                                  itemId: item.id,
                                })
                              }
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <Dialog open={isAddItemDialogOpen} onOpenChange={setIsAddItemDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full gap-2" data-testid="button-add-item">
                          <Plus className="w-4 h-4" />
                          Add Item
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Item</DialogTitle>
                          <DialogDescription>
                            Add a new item to {selectedList.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="item-name">Item Name</Label>
                            <Input
                              id="item-name"
                              placeholder="e.g., Milk"
                              value={newItemName}
                              onChange={(e) => setNewItemName(e.target.value)}
                              data-testid="input-add-item-name"
                              className="mt-2"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="item-quantity">Quantity</Label>
                              <Input
                                id="item-quantity"
                                placeholder="1"
                                type="number"
                                value={newItemQuantity}
                                onChange={(e) => setNewItemQuantity(e.target.value)}
                                data-testid="input-add-item-quantity"
                                className="mt-2"
                              />
                            </div>
                            <div>
                              <Label htmlFor="item-unit">Unit</Label>
                              <Input
                                id="item-unit"
                                placeholder="e.g., gal, lbs"
                                value={newItemUnit}
                                onChange={(e) => setNewItemUnit(e.target.value)}
                                data-testid="input-add-item-unit"
                                className="mt-2"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleAddItem}
                            className="w-full"
                            disabled={addItemMutation.isPending}
                            data-testid="button-submit-add-item"
                          >
                            {addItemMutation.isPending ? "Adding..." : "Add Item"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ShoppingList } from "@shared/schema";

type ShoppingItem = {
  name: string;
  quantity: string;
  unit: string;
  checked: boolean;
};

type AddItemState = {
  listId: string | null;
  name: string;
  quantity: string;
  unit: string;
};

export default function ShoppingListPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [addItemState, setAddItemState] = useState<AddItemState>({
    listId: null,
    name: "",
    quantity: "1",
    unit: "",
  });

  const { data: lists, isLoading } = useQuery<ShoppingList[]>({
    queryKey: ["/api/shopping-lists"],
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/shopping-lists", {
        name,
        items: [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
      setIsCreateDialogOpen(false);
      setNewListName("");
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

  const updateListMutation = useMutation({
    mutationFn: async ({ id, items }: { id: string; items: ShoppingItem[] }) => {
      return await apiRequest("PATCH", `/api/shopping-lists/${id}`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shopping-lists"] });
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
        description: "Failed to update list. Please try again.",
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

  const handleToggleItem = (listId: string, items: ShoppingItem[], index: number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], checked: !updatedItems[index].checked };
    updateListMutation.mutate({ id: listId, items: updatedItems });
  };

  const handleAddItem = () => {
    if (!addItemState.name.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter an item name.",
        variant: "destructive",
      });
      return;
    }

    const list = lists?.find(l => l.id === addItemState.listId);
    if (!list) return;

    const currentItems = (list.items as unknown as ShoppingItem[]) || [];
    const newItems = [
      ...currentItems,
      {
        name: addItemState.name,
        quantity: addItemState.quantity,
        unit: addItemState.unit,
        checked: false,
      },
    ];

    updateListMutation.mutate(
      { id: list.id, items: newItems },
      {
        onSuccess: () => {
          setAddItemState({ listId: null, name: "", quantity: "1", unit: "" });
          toast({
            title: "Item added",
            description: "Item has been added to your list.",
          });
        },
      }
    );
  };

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-large-title">Shopping Lists</h1>
          <p className="text-muted-foreground mt-1">
            Manage your grocery shopping lists
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
              <Input
                placeholder="List name (e.g., Weekly Groceries)"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                data-testid="input-list-name"
              />
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

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
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
        <div className="space-y-6">
          {lists.map((list) => {
            const items = (list.items as unknown as ShoppingItem[]) || [];
            const checkedCount = items.filter((item) => item.checked).length;
            const totalCount = items.length;

            return (
              <Card key={list.id} data-testid={`list-${list.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{list.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {checkedCount} of {totalCount} items checked
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteListMutation.mutate(list.id)}
                      data-testid={`button-delete-list-${list.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {items.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No items in this list yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-2 rounded-lg hover-elevate"
                            data-testid={`item-${list.id}-${index}`}
                          >
                            <Checkbox
                              checked={item.checked}
                              onCheckedChange={() => handleToggleItem(list.id, items, index)}
                              data-testid={`checkbox-${list.id}-${index}`}
                            />
                            <span className={`flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                              {item.name}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add Item Dialog */}
                    <Dialog open={addItemState.listId === list.id} onOpenChange={(open) => !open && setAddItemState({ listId: null, name: "", quantity: "1", unit: "" })}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => setAddItemState({ ...addItemState, listId: list.id })}
                          data-testid={`button-add-item-${list.id}`}
                        >
                          <Plus className="w-4 h-4" />
                          Add Item
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Item</DialogTitle>
                          <DialogDescription>
                            Add a new item to {list.name}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="item-name">Item Name</Label>
                            <Input
                              id="item-name"
                              placeholder="e.g., Milk"
                              value={addItemState.name}
                              onChange={(e) => setAddItemState({ ...addItemState, name: e.target.value })}
                              data-testid="input-add-item-name"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="item-quantity">Quantity</Label>
                              <Input
                                id="item-quantity"
                                placeholder="1"
                                value={addItemState.quantity}
                                onChange={(e) => setAddItemState({ ...addItemState, quantity: e.target.value })}
                                data-testid="input-add-item-quantity"
                              />
                            </div>
                            <div>
                              <Label htmlFor="item-unit">Unit</Label>
                              <Input
                                id="item-unit"
                                placeholder="e.g., gal, lbs"
                                value={addItemState.unit}
                                onChange={(e) => setAddItemState({ ...addItemState, unit: e.target.value })}
                                data-testid="input-add-item-unit"
                              />
                            </div>
                          </div>
                          <Button
                            onClick={handleAddItem}
                            className="w-full"
                            disabled={updateListMutation.isPending}
                            data-testid="button-submit-add-item"
                          >
                            {updateListMutation.isPending ? "Adding..." : "Add Item"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

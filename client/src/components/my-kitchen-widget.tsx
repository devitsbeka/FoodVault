import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Refrigerator, AlertCircle, Package } from "lucide-react";
import { Link } from "wouter";
import type { KitchenInventory } from "@shared/schema";

export function MyKitchenWidget() {
  const { data: inventory, isLoading } = useQuery<KitchenInventory[]>({
    queryKey: ["/api/kitchen-inventory"],
  });

  const expiringItems = inventory?.filter((item) => {
    if (!item.expirationDate) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(item.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 3;
  }) || [];

  const lowStockItems = inventory?.filter(
    (item) => item.quantity !== null && parseFloat(item.quantity) <= 2
  ) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Refrigerator className="w-4 h-4" />
            My Kitchen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Array(2).fill(0).map((_, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30">
                <Skeleton className="h-8 w-12 mb-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {Array(2).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Refrigerator className="w-4 h-4" />
          My Kitchen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/30">
            <div className="text-2xl font-bold mb-0.5" data-testid="stat-total-items">
              {inventory?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/10">
            <div className="text-2xl font-bold mb-0.5 text-destructive" data-testid="stat-expiring-items">
              {expiringItems.length}
            </div>
            <p className="text-xs text-muted-foreground">Expiring Soon</p>
          </div>
        </div>

        {expiringItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4 text-destructive" />
              <span>Expiring Items</span>
            </div>
            {expiringItems.slice(0, 2).map((item) => {
              const daysLeft = Math.ceil(
                (new Date(item.expirationDate!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-destructive/10"
                  data-testid={`expiring-item-${item.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {daysLeft === 0 ? "Today" : `${daysLeft}d left`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                    {item.category}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}

        {lowStockItems.length > 0 && expiringItems.length === 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="w-4 h-4 text-orange-500" />
              <span>Low Stock</span>
            </div>
            {lowStockItems.slice(0, 2).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10"
                data-testid={`low-stock-item-${item.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} {item.unit || "left"}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                  {item.category}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <Link href="/my-kitchen">
          <span className="text-sm text-primary hover:underline cursor-pointer block text-center pt-2" data-testid="link-view-all-items">
            View all items
          </span>
        </Link>
      </CardContent>
    </Card>
  );
}

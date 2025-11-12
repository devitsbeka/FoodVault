import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter } from "@/components/ui/sidebar";
import { ClerkProvider, SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { AIChatFAB } from "@/components/ai-chat-fab";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import MyKitchen from "@/pages/my-kitchen";
import Recipes from "@/pages/recipes";
import MealPlanning from "@/pages/meal-planning";
import FamilyPage from "@/pages/family";
import ShoppingListPage from "@/pages/shopping-list";
import RecipeDetail from "@/pages/recipe-detail";
import Equipment from "@/pages/equipment";
import { Home as HomeIcon, Refrigerator, ChefHat, Calendar, Users, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { Link, useLocation } from "wouter";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { useAuth } from "@/hooks/useAuth";

function AppSidebar() {
  const { user } = useAuth();
  const [location] = useLocation();

  const menuItems = [
    { icon: HomeIcon, label: "Home", path: "/", testId: "nav-home" },
    { icon: Refrigerator, label: "My Kitchen", path: "/my-kitchen", testId: "nav-my-kitchen" },
    { icon: UtensilsCrossed, label: "Equipment", path: "/equipment", testId: "nav-equipment" },
    { icon: ChefHat, label: "Recipes", path: "/recipes", testId: "nav-recipes" },
    { icon: Calendar, label: "Meal Planning", path: "/meal-planning", testId: "nav-meal-planning" },
    { icon: Users, label: "Family", path: "/family", testId: "nav-family" },
    { icon: ShoppingCart, label: "Shopping List", path: "/shopping-list", testId: "nav-shopping" },
  ];

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-base font-semibold px-4 py-3">
            Kitchen Manager
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive} data-testid={item.testId}>
                      <Link href={item.path}>
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <UserButton 
                data-testid="button-user-menu"
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10"
                  }
                }}
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  // Don't render anything while loading
  if (isLoading) {
    return null;
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/my-kitchen" component={MyKitchen} />
          <Route path="/equipment" component={Equipment} />
          <Route path="/recipes" component={Recipes} />
          <Route path="/recipes/:id" component={RecipeDetail} />
          <Route path="/meal-planning" component={MealPlanning} />
          <Route path="/family" component={FamilyPage} />
          <Route path="/shopping-list" component={ShoppingListPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading || !isAuthenticated) {
    return (
      <>
        <Toaster />
        <Router />
      </>
    );
  }

  return (
    <>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <NotificationsDropdown />
            </header>
            <main className="flex-1 overflow-auto">
              <Router />
            </main>
          </div>
        </div>
        <AIChatFAB />
      </SidebarProvider>
      <Toaster />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

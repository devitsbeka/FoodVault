// Blueprint reference: javascript_log_in_with_replit, javascript_openai_ai_integrations
import type { Express, Response } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getChatCompletion } from "./openai";
import { insertKitchenInventorySchema, insertMealPlanSchema, insertMealVoteSchema, insertRecipeSchema, insertRecipeRatingSchema, insertShoppingListSchema, insertShoppingListItemSchema, insertInventoryReviewQueueSchema, insertNotificationSchema } from "@shared/schema";
import { searchRecipes, getRecipeById as getApiRecipeById } from "./recipeApi";

// Shared error response helper
interface ErrorResponse {
  status: number;
  message: string;
  code?: string;
  issues?: any[];
}

function sendError(res: Response, status: number, message: string, code?: string, issues?: any[]) {
  const error: ErrorResponse = { status, message };
  if (code) error.code = code;
  if (issues) error.issues = issues;
  res.status(status).json(error);
}

export function registerRoutes(app: Express) {
  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const dbUser = await storage.getUserById(user.claims.sub);
      if (!dbUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(dbUser);
    } catch (error) {
      console.error("Error getting user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Kitchen Inventory routes
  app.get("/api/kitchen-inventory", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const inventory = await storage.getKitchenInventory(user.claims.sub);
      res.json(inventory);
    } catch (error) {
      console.error("Error getting inventory:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kitchen-inventory", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertKitchenInventorySchema.parse(req.body);
      const item = await storage.addKitchenItem({
        ...validatedData,
        userId: user.claims.sub,
      });
      res.json(item);
    } catch (error: any) {
      console.error("Error adding inventory item:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/kitchen-inventory/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      await storage.deleteKitchenItem(req.params.id, user.claims.sub);
      res.json({ message: "Item deleted" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Recipe routes - merging external API with database recipes
  app.get("/api/recipes", async (req, res) => {
    try {
      const { search, dietType, maxCalories, limit, offset, ingredientMatch } = req.query;
      const requestLimit = limit ? parseInt(limit as string) : 15; // Default to 15 recipes
      const matchThreshold = ingredientMatch ? parseInt(ingredientMatch as string) : 0;
      
      // Fetch recipes from external API
      let apiRecipes: any[] = [];
      try {
        apiRecipes = await searchRecipes({
          searchQuery: search as string,
          dietType: dietType as string,
          maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
          limit: requestLimit * 2, // Fetch more since we'll filter by ingredients
          offset: offset ? parseInt(offset as string) : 0,
        });
      } catch (apiError) {
        console.error("Error fetching from external API:", apiError);
        // Continue with database recipes if API fails
      }
      
      // Also get database recipes
      const dbRecipes = await storage.getRecipes({
        searchQuery: search as string,
        dietType: dietType as string,
        maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
      });
      
      // Merge all recipes
      let allRecipes = [...apiRecipes, ...dbRecipes];
      
      // Apply ingredient matching filter if requested and user is authenticated
      if (matchThreshold > 0 && req.user) {
        const userId = (req.user as any)?.claims?.sub;
        if (userId) {
          const inventory = await storage.getKitchenInventory(userId);
          const inventoryMap = new Map(
            inventory.map(item => [
              item.normalizedName || normalizeIngredientName(item.name),
              item
            ])
          );
          
          // Calculate match percentage for each recipe and filter
          allRecipes = allRecipes
            .map((recipe: any) => {
              const ingredients = recipe.ingredients || [];
              if (ingredients.length === 0) {
                return { ...recipe, matchPercentage: 0 };
              }
              
              const ownedCount = ingredients.filter((ing: any) => {
                const normalized = normalizeIngredientName(ing.name);
                return inventoryMap.has(normalized);
              }).length;
              
              const matchPercentage = Math.round((ownedCount / ingredients.length) * 100);
              return { ...recipe, matchPercentage };
            })
            .filter((recipe: any) => recipe.matchPercentage >= matchThreshold)
            .sort((a: any, b: any) => (b.matchPercentage || 0) - (a.matchPercentage || 0)); // Sort by match % desc
        }
      }
      
      // Limit to requested amount
      const finalRecipes = allRecipes.slice(0, requestLimit);
      
      res.json(finalRecipes);
    } catch (error) {
      console.error("Error getting recipes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      // First try to get from API (for API-based recipe IDs starting with 'api-')
      if (req.params.id.startsWith('api-')) {
        const recipe = await getApiRecipeById(req.params.id);
        if (recipe) {
          // Get user's kitchen inventory to map ingredients if authenticated
          const userId = (req.user as any)?.claims?.sub;
          if (userId) {
            const inventory = await storage.getKitchenInventory(userId);
            const inventoryNames = new Set(inventory.map(item => item.name.toLowerCase()));
            
            const ownedIngredients = recipe.ingredients.filter((ing: any) => 
              inventoryNames.has(ing.name.toLowerCase())
            );
            const missingIngredients = recipe.ingredients.filter((ing: any) => 
              !inventoryNames.has(ing.name.toLowerCase())
            );
            
            return res.json({
              ...recipe,
              ownedIngredients,
              missingIngredients,
            });
          }
          return res.json(recipe);
        }
      }
      
      // Fallback to database recipes (for user-created recipes) - requires auth
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const recipe = await storage.getRecipeById(req.params.id, userId);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // Add ingredient matching for database recipes too
      const inventory = await storage.getKitchenInventory(userId);
      const inventoryNames = new Set(inventory.map(item => item.name.toLowerCase()));
      
      const ingredients = (recipe.ingredients as any) || [];
      const ownedIngredients = ingredients.filter((ing: any) => 
        inventoryNames.has(ing.name.toLowerCase())
      );
      const missingIngredients = ingredients.filter((ing: any) => 
        !inventoryNames.has(ing.name.toLowerCase())
      );
      
      res.json({
        ...recipe,
        ownedIngredients,
        missingIngredients,
      });
    } catch (error) {
      console.error("Error getting recipe:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/recipes/:id/rate", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { rating, comment } = req.body;

      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      await storage.rateRecipe({
        recipeId: req.params.id,
        userId: user.claims.sub,
        rating,
        comment: comment || null,
      });

      res.json({ message: "Rating submitted successfully" });
    } catch (error) {
      console.error("Error rating recipe:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/recipes/recommended", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const recipes = await storage.getRecommendedRecipes(user.claims.sub);
      res.json(recipes);
    } catch (error) {
      console.error("Error getting recommended recipes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/recipes", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertRecipeSchema.parse(req.body);
      const recipe = await storage.addRecipe(validatedData);
      res.json(recipe);
    } catch (error: any) {
      console.error("Error adding recipe:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Recipe Ratings routes
  app.get("/api/recipes/:id/ratings", async (req, res) => {
    try {
      const ratings = await storage.getRecipeRatings(req.params.id);
      res.json(ratings);
    } catch (error) {
      console.error("Error getting ratings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/recipes/:id/ratings", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertRecipeRatingSchema.parse({
        ...req.body,
        recipeId: req.params.id,
        userId: user.claims.sub,
      });
      const rating = await storage.addRecipeRating(validatedData);
      res.json(rating);
    } catch (error: any) {
      console.error("Error adding rating:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Meal Plan routes
  app.get("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const mealPlans = await storage.getMealPlans(user.claims.sub);
      res.json(mealPlans);
    } catch (error) {
      console.error("Error getting meal plans:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meal-plans/upcoming", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const upcomingMeals = await storage.getUpcomingMeals(user.claims.sub);
      res.json(upcomingMeals);
    } catch (error) {
      console.error("Error getting upcoming meals:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertMealPlanSchema.parse({
        ...req.body,
        userId: user.claims.sub,
      });
      const mealPlan = await storage.addMealPlan(validatedData);
      res.json(mealPlan);
    } catch (error: any) {
      console.error("Error adding meal plan:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/meal-plans/:id/vote", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertMealVoteSchema.parse({
        ...req.body,
        mealPlanId: req.params.id,
        userId: user.claims.sub,
      });
      const result = await storage.voteMealPlan(validatedData);
      res.json(result);
    } catch (error: any) {
      console.error("Error voting on meal plan:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Chat routes
  app.get("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const messages = await storage.getChatMessages(user.claims.sub);
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Message content is required" });
      }

      await storage.addChatMessage({
        userId: user.claims.sub,
        role: "user",
        content,
      });

      // Get user context for AI
      const userProfile = await storage.getUserById(user.claims.sub);
      const inventory = await storage.getKitchenInventory(user.claims.sub);
      const upcomingMeals = await storage.getUpcomingMeals(user.claims.sub);
      const family = await storage.getFamily(user.claims.sub);
      // Get limited recipe summaries for AI context (optimized query)
      const recipeSummaries = await storage.getRecipeSummaries(15);
      
      // Build context-aware system message
      let contextInfo = `You are a helpful kitchen assistant. Help users with recipes, meal planning, cooking tips, and ingredient suggestions. Be concise and friendly.\n\n`;
      
      if (userProfile?.dietType || userProfile?.allergies) {
        contextInfo += `User preferences:\n`;
        if (userProfile.dietType) contextInfo += `- Diet: ${userProfile.dietType}\n`;
        if (userProfile.allergies && userProfile.allergies.length > 0) {
          contextInfo += `- Allergies: ${userProfile.allergies.join(', ')}\n`;
        }
        contextInfo += `\n`;
      }
      
      if (family) {
        contextInfo += `Family information:\n`;
        contextInfo += `- Family name: ${family.name}\n`;
        contextInfo += `- Members: ${family.members.length}\n`;
        contextInfo += `- Vote threshold for meals: ${family.voteThreshold}\n\n`;
      }
      
      if (inventory.length > 0) {
        contextInfo += `Current kitchen inventory:\n`;
        const itemsByCategory = inventory.reduce((acc, item) => {
          const category = item.category || 'other';
          if (!acc[category]) acc[category] = [];
          acc[category].push(item);
          return acc;
        }, {} as Record<string, typeof inventory>);
        
        for (const [category, items] of Object.entries(itemsByCategory)) {
          contextInfo += `${category}: ${items.map(i => i.name).join(', ')}\n`;
        }
        contextInfo += `\n`;
      }
      
      if (upcomingMeals.length > 0) {
        contextInfo += `Upcoming meals:\n`;
        upcomingMeals.slice(0, 5).forEach(meal => {
          const date = new Date(meal.scheduledFor).toLocaleDateString();
          contextInfo += `- ${meal.recipe.name} (${date})\n`;
        });
        contextInfo += `\n`;
      }
      
      if (recipeSummaries.length > 0) {
        contextInfo += `Available recipes in our database:\n`;
        // Group by diet type for better context
        const recipesByDiet = recipeSummaries.reduce((acc, recipe) => {
          const diet = recipe.dietType || 'other';
          if (!acc[diet]) acc[diet] = [];
          acc[diet].push(recipe.name);
          return acc;
        }, {} as Record<string, string[]>);
        
        for (const [diet, names] of Object.entries(recipesByDiet)) {
          contextInfo += `${diet}: ${names.join(', ')}\n`;
        }
        contextInfo += `\n`;
      }
      
      contextInfo += `When suggesting recipes, prioritize recipes from our database and consider the user's preferences, available ingredients, and upcoming meals.\n\n`;
      contextInfo += `If the user asks to create a shopping list, provide a clear formatted list. Users can then save these suggestions to their shopping lists.`;

      const conversationHistory = await storage.getChatMessages(user.claims.sub);
      
      const systemMessage = {
        role: "system",
        content: contextInfo,
      };

      const messages = [
        systemMessage,
        ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
      ];

      const aiResponse = await getChatCompletion(messages);

      const assistantMessage = await storage.addChatMessage({
        userId: user.claims.sub,
        role: "assistant",
        content: aiResponse,
      });

      res.json(assistantMessage);
    } catch (error) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Family routes
  app.get("/api/family", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const family = await storage.getFamily(user.claims.sub);
      res.json(family);
    } catch (error) {
      console.error("Error getting family:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/family", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { name } = req.body;
      
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Family name is required" });
      }

      const family = await storage.createFamily({
        name,
        createdById: user.claims.sub,
      });

      await storage.addFamilyMember({
        familyId: family.id,
        userId: user.claims.sub,
        role: "admin",
      });

      res.json(family);
    } catch (error) {
      console.error("Error creating family:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Shopping List routes
  app.get("/api/shopping-lists", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const lists = await storage.getShoppingLists(user.claims.sub);
      res.json(lists);
    } catch (error) {
      console.error("Error getting shopping lists:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const result = await storage.getShoppingListWithItems(req.params.id, user.claims.sub);
      
      if (result.status === "not_found") {
        return sendError(res, 404, "Shopping list not found", "NOT_FOUND");
      }
      
      if (result.status === "forbidden") {
        return sendError(res, 403, "Access denied to this shopping list", "FORBIDDEN");
      }
      
      res.json(result.data);
    } catch (error) {
      console.error("Error getting shopping list:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/shopping-lists", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertShoppingListSchema.parse({
        ...req.body,
        userId: user.claims.sub,
      });
      const list = await storage.createShoppingList(validatedData);
      res.json(list);
    } catch (error: any) {
      console.error("Error creating shopping list:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { name } = req.body;
      const result = await storage.updateShoppingList(req.params.id, user.claims.sub, name);
      
      if (result.status === "not_found") {
        return sendError(res, 404, "Shopping list not found", "NOT_FOUND");
      }
      
      if (result.status === "forbidden") {
        return sendError(res, 403, "Access denied to this shopping list", "FORBIDDEN");
      }
      
      res.json(result.data);
    } catch (error) {
      console.error("Error updating shopping list:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.delete("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const result = await storage.deleteShoppingList(req.params.id, user.claims.sub);
      
      if (result.status === "not_found") {
        return sendError(res, 404, "Shopping list not found", "NOT_FOUND");
      }
      
      if (result.status === "forbidden") {
        return sendError(res, 403, "Access denied to this shopping list", "FORBIDDEN");
      }
      
      res.json({ message: "Shopping list deleted" });
    } catch (error) {
      console.error("Error deleting shopping list:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Shopping List Items routes
  app.post("/api/shopping-lists/:listId/items", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertShoppingListItemSchema.parse({
        ...req.body,
        listId: req.params.listId,
      });
      
      const item = await storage.addShoppingListItem(validatedData, user.claims.sub);
      
      if (!item) {
        return sendError(res, 403, "Access denied to this shopping list", "FORBIDDEN");
      }
      
      res.json(item);
    } catch (error: any) {
      console.error("Error adding shopping list item:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/shopping-list-items/:itemId/status", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { status } = req.body;
      
      if (!["active", "bought", "pending_review"].includes(status)) {
        return sendError(res, 400, "Invalid status. Must be active, bought, or pending_review", "VALIDATION_ERROR");
      }
      
      const item = await storage.updateShoppingListItemStatus(req.params.itemId, user.claims.sub, status);
      
      if (!item) {
        return sendError(res, 403, "Access denied or item not found", "FORBIDDEN");
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error updating shopping list item status:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/shopping-list-items/:itemId/assign", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { assignedToUserId } = req.body;
      
      const item = await storage.assignShoppingListItem(req.params.itemId, user.claims.sub, assignedToUserId || null);
      
      if (!item) {
        return sendError(res, 403, "Access denied or item not found", "FORBIDDEN");
      }
      
      res.json(item);
    } catch (error) {
      console.error("Error assigning shopping list item:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.delete("/api/shopping-list-items/:itemId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const deleted = await storage.deleteShoppingListItem(req.params.itemId, user.claims.sub);
      
      if (!deleted) {
        return sendError(res, 403, "Access denied or item not found", "FORBIDDEN");
      }
      
      res.json({ message: "Shopping list item deleted" });
    } catch (error) {
      console.error("Error deleting shopping list item:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Inventory Review Queue routes
  app.get("/api/inventory-review-queue", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const items = await storage.getPendingReviewItems(user.claims.sub);
      res.json(items);
    } catch (error) {
      console.error("Error getting pending review items:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/inventory-review-queue", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const validatedData = insertInventoryReviewQueueSchema.parse(req.body);
      
      const item = await storage.addToReviewQueue(validatedData, user.claims.sub);
      
      if (!item) {
        return sendError(res, 403, "Access denied or invalid review queue entry", "FORBIDDEN");
      }
      
      res.json(item);
    } catch (error: any) {
      console.error("Error adding to review queue:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/inventory-review-queue/:itemId/approve", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      // Note: category and expirationDate not yet supported by storage method
      // Uses categoryGuess from review item itself
      const result = await storage.approveReviewItem(req.params.itemId, user.claims.sub);
      
      if (!result) {
        return sendError(res, 403, "Access denied or item not found", "FORBIDDEN");
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error approving review item:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.delete("/api/inventory-review-queue/:itemId", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const deleted = await storage.rejectReviewItem(req.params.itemId, user.claims.sub);
      
      if (!deleted) {
        return sendError(res, 403, "Access denied or item not found", "FORBIDDEN");
      }
      
      res.json({ message: "Review item rejected" });
    } catch (error) {
      console.error("Error rejecting review item:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Notifications routes
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const notifications = await storage.getRecentNotifications(user.claims.sub, 50);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/notifications/:notificationId/read", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const result = await storage.markNotificationAsRead(req.params.notificationId, user.claims.sub);
      
      if (result.status === "not_found") {
        return sendError(res, 404, "Notification not found", "NOT_FOUND");
      }
      
      if (result.status === "forbidden") {
        return sendError(res, 403, "Access denied to this notification", "FORBIDDEN");
      }
      
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      sendError(res, 500, "Internal server error");
    }
  });
}

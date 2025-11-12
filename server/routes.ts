// Blueprint reference: javascript_log_in_with_replit, javascript_openai_ai_integrations
import type { Express } from "express";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { getChatCompletion } from "./openai";
import { insertKitchenInventorySchema, insertMealPlanSchema, insertMealVoteSchema, insertRecipeSchema, insertRecipeRatingSchema, insertShoppingListSchema } from "@shared/schema";

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

  // Recipe routes
  app.get("/api/recipes", async (req, res) => {
    try {
      const { search, dietType, maxCalories } = req.query;
      const recipes = await storage.getRecipes({
        searchQuery: search as string,
        dietType: dietType as string,
        maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
      });
      res.json(recipes);
    } catch (error) {
      console.error("Error getting recipes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/recipes/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const recipe = await storage.getRecipeById(req.params.id, user.claims.sub);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
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

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      const recipe = await storage.getRecipeById(req.params.id);
      if (!recipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error) {
      console.error("Error getting recipe:", error);
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
      const vote = await storage.voteMealPlan(validatedData);
      res.json(vote);
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

      const conversationHistory = await storage.getChatMessages(user.claims.sub);
      
      const systemMessage = {
        role: "system",
        content: "You are a helpful kitchen assistant. Help users with recipes, meal planning, cooking tips, and ingredient suggestions. Be concise and friendly.",
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
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const { items } = req.body;
      const list = await storage.updateShoppingList(req.params.id, user.claims.sub, items);
      res.json(list);
    } catch (error) {
      console.error("Error updating shopping list:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      await storage.deleteShoppingList(req.params.id, user.claims.sub);
      res.json({ message: "Shopping list deleted" });
    } catch (error) {
      console.error("Error deleting shopping list:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

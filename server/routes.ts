// Blueprint reference: javascript_log_in_with_replit, javascript_openai_ai_integrations
import type { Express, Response } from "express";
import { storage } from "./storage";
import { isAuthenticated, optionalAuth } from "./replitAuth";
import { getChatCompletion, getProductRecommendations, getProductImageUrl } from "./openai";
import { insertKitchenInventorySchema, insertKitchenEquipmentSchema, insertMealPlanSchema, insertMealVoteSchema, insertRecipeSchema, insertRecipeRatingSchema, insertShoppingListSchema, insertShoppingListItemSchema, insertInventoryReviewQueueSchema, insertNotificationSchema } from "@shared/schema";
import { searchRecipes, getRecipeById as getApiRecipeById } from "./recipeApi";
import { searchSpoonacularRecipes, getSpoonacularRecipeById, getIngredientImageMemoized, getIngredientSuggestionsMemoized } from "./spoonacularApi";
import { normalizeIngredientName } from "./normalizationService";

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
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      // Public endpoint - returns 401 if not authenticated
      if (!req.isAuthenticated() || !req.user?.dbUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.dbUserId;
      const dbUser = await storage.getUserById(userId);
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
      const userId = (req as any).user.dbUserId;
      const inventory = await storage.getKitchenInventory(userId);
      res.json(inventory);
    } catch (error) {
      console.error("Error getting inventory:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/kitchen-inventory", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const validatedData = insertKitchenInventorySchema.parse(req.body);
      
      // Fetch ingredient image if not provided
      let imageUrl = validatedData.imageUrl;
      if (!imageUrl && validatedData.name) {
        imageUrl = await getIngredientImageMemoized(validatedData.name);
      }
      
      const item = await storage.addKitchenItem({
        ...validatedData,
        imageUrl: imageUrl || null,
        userId: userId,
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
      const userId = (req as any).user.dbUserId;
      await storage.deleteKitchenItem(req.params.id, userId);
      res.json({ message: "Item deleted" });
    } catch (error) {
      console.error("Error deleting inventory item:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Kitchen Equipment routes
  app.get("/api/kitchen-equipment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const location = req.query.location as 'indoor' | 'outdoor' | undefined;
      const equipment = await storage.getKitchenEquipment(userId, location);
      res.json(equipment);
    } catch (error) {
      console.error("Error getting kitchen equipment:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/kitchen-equipment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const validatedData = insertKitchenEquipmentSchema.parse(req.body);
      
      let imageUrl = validatedData.imageUrl;
      if (!imageUrl && validatedData.owned && (validatedData.brand || validatedData.model)) {
        imageUrl = await getProductImageUrl(
          validatedData.itemType,
          validatedData.brand || undefined,
          validatedData.model || undefined
        );
      }
      
      const equipment = await storage.upsertKitchenEquipment({
        ...validatedData,
        imageUrl: imageUrl || null,
        userId: userId,
      });
      res.json(equipment);
    } catch (error: any) {
      console.error("Error upserting kitchen equipment:", error);
      if (error.name === "ZodError") {
        sendError(res, 400, "Validation error", "VALIDATION_ERROR", error.errors);
        return;
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.delete("/api/kitchen-equipment/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      await storage.deleteKitchenEquipment(req.params.id, userId);
      res.json({ message: "Equipment deleted" });
    } catch (error) {
      console.error("Error deleting kitchen equipment:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.get("/api/product-recommendations/:itemType", isAuthenticated, async (req, res) => {
    try {
      const { itemType } = req.params;
      const { itemName } = req.query;
      
      if (!itemName || typeof itemName !== 'string') {
        sendError(res, 400, "Item name is required");
        return;
      }
      
      const recommendations = await getProductRecommendations(itemType, itemName);
      res.json(recommendations);
    } catch (error) {
      console.error("Error getting product recommendations:", error);
      sendError(res, 500, "Failed to get product recommendations");
    }
  });

  // Recipe routes - merging external API with database recipes
  app.get("/api/recipes", optionalAuth, async (req, res) => {
    try {
      const { search, dietType, cuisine, mealType, maxCalories, limit, offset, ingredientMatch, restrictions } = req.query;
      const requestLimit = limit ? parseInt(limit as string) : 15; // Default to 15 recipes
      const matchThreshold = ingredientMatch ? parseInt(ingredientMatch as string) : 0;
      
      // Parse dietary restrictions (comma-separated or JSON array)
      let dietaryRestrictions: string[] = [];
      if (restrictions) {
        try {
          dietaryRestrictions = typeof restrictions === 'string' 
            ? restrictions.split(',').map(r => r.trim())
            : Array.isArray(restrictions) ? restrictions as string[] : [];
        } catch (e) {
          console.error("Error parsing restrictions:", e);
        }
      }
      
      // Fetch recipes from external API with automatic fallback
      // Prioritize Spoonacular since it provides images (api-ninjas doesn't)
      let apiRecipes: any[] = [];
      let apiSource = "Spoonacular";
      
      // Try Spoonacular first (has images!)
      try {
        const apiLimit = matchThreshold > 0 ? Math.min(requestLimit * 2, 20) : requestLimit;
        apiRecipes = await searchSpoonacularRecipes({
          searchQuery: search as string,
          dietType: dietType as string,
          cuisine: cuisine as string,
          mealType: mealType as string,
          maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
          limit: apiLimit,
          offset: offset ? parseInt(offset as string) : 0,
        });
        console.log(`Fetched ${apiRecipes.length} recipes from ${apiSource}`);
      } catch (spoonError) {
        console.log("Spoonacular failed, trying api-ninjas fallback...");
        apiSource = "api-ninjas";
        // Fallback to api-ninjas if Spoonacular fails (no images though)
        try {
          const apiLimit = matchThreshold > 0 ? Math.min(requestLimit * 2, 20) : requestLimit;
          apiRecipes = await searchRecipes({
            searchQuery: search as string,
            dietType: dietType as string,
            cuisine: cuisine as string,
            mealType: mealType as string,
            maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
            limit: apiLimit,
            offset: offset ? parseInt(offset as string) : 0,
          });
          console.log(`Fetched ${apiRecipes.length} recipes from ${apiSource}`);
        } catch (apiError) {
          console.error("Both API sources failed:", apiError);
          // Continue with database recipes only
        }
      }
      
      // Get database recipes with dietary restriction filtering
      const dbRecipes = await storage.getRecipes({
        searchQuery: search as string,
        dietType: dietType as string,
        cuisine: cuisine as string,
        mealType: mealType as string,
        maxCalories: maxCalories ? parseInt(maxCalories as string) : undefined,
        dietaryRestrictions: dietaryRestrictions.length > 0 ? dietaryRestrictions : undefined,
      });
      
      // Handle external API recipes based on dietary restrictions
      let filteredApiRecipes = apiRecipes;
      if (dietaryRestrictions.length > 0) {
        // When dietary restrictions are present, exclude ALL external recipes
        // External recipes lack our tag taxonomy and cannot be reliably validated
        // Only database recipes with proper tags can guarantee dietary compliance
        filteredApiRecipes = [];
        console.log(`Excluded all ${apiRecipes.length} external recipes due to dietary restrictions (DB recipes only)`);
      }
      
      // Prioritize recipes with images: Filtered external first, then DB recipes with images, then others
      const recipesWithImages = filteredApiRecipes.filter((r: any) => r.imageUrl);
      const dbWithImages = dbRecipes.filter((r: any) => r.imageUrl);
      const recipesWithoutImages = [...filteredApiRecipes.filter((r: any) => !r.imageUrl), ...dbRecipes.filter((r: any) => !r.imageUrl)];
      
      // Merge: prioritize image-bearing recipes
      let allRecipes = [...recipesWithImages, ...dbWithImages, ...recipesWithoutImages];
      
      // Calculate match percentage for all recipes if user is authenticated
      if (req.user) {
        const userId = (req.user as any)?.dbUserId;
        if (userId) {
          const inventory = await storage.getKitchenInventory(userId);
          const inventoryMap = new Map(
            inventory.map(item => [
              item.normalizedName || normalizeIngredientName(item.name),
              item
            ])
          );
          
          // Calculate match percentage for each recipe
          allRecipes = allRecipes.map((recipe: any) => {
            const ingredients = recipe.ingredients || [];
            if (ingredients.length === 0) {
              return { ...recipe, matchPercentage: 0, hasImage: !!recipe.imageUrl };
            }
            
            const ownedCount = ingredients.filter((ing: any) => {
              const normalized = normalizeIngredientName(ing.name);
              return inventoryMap.has(normalized);
            }).length;
            
            const matchPercentage = Math.round((ownedCount / ingredients.length) * 100);
            return { ...recipe, matchPercentage, hasImage: !!recipe.imageUrl };
          });
          
          // Apply ingredient matching filter if requested
          if (matchThreshold > 0) {
            allRecipes = allRecipes
              .filter((recipe: any) => recipe.matchPercentage >= matchThreshold)
              .sort((a: any, b: any) => {
                // Sort by hasImage first (images priority), then by matchPercentage
                if (a.hasImage !== b.hasImage) return a.hasImage ? -1 : 1;
                return (b.matchPercentage || 0) - (a.matchPercentage || 0);
              });
          }
        }
      }
      
      // Filter by mealType AFTER ingredient matching - treat null as compatible with lunch/dinner
      if (mealType && mealType !== 'all') {
        const isLunchOrDinner = mealType === 'lunch' || mealType === 'dinner';
        allRecipes = allRecipes.filter((recipe: any) => {
          if (recipe.mealType === mealType) return true;
          // Include null mealType for lunch/dinner (main course recipes)
          if (isLunchOrDinner && recipe.mealType === null) return true;
          return false;
        });
      }
      
      // Limit to requested amount
      const finalRecipes = allRecipes.slice(0, requestLimit);
      
      res.json(finalRecipes);
    } catch (error) {
      console.error("Error getting recipes:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get ingredient suggestions from Spoonacular autocomplete
  app.get("/api/ingredient-suggestions", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      if (query.length < 2) {
        return res.json([]);
      }

      const suggestions = await getIngredientSuggestionsMemoized(query);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching ingredient suggestions:", error);
      res.status(500).json({ error: "Failed to fetch ingredient suggestions" });
    }
  });

  app.get("/api/recipes/:id", async (req, res) => {
    try {
      let recipe = null;
      
      // Try to get from API based on ID prefix
      if (req.params.id.startsWith('api-')) {
        recipe = await getApiRecipeById(req.params.id);
      } else if (req.params.id.startsWith('spoon-')) {
        recipe = await getSpoonacularRecipeById(req.params.id);
      }
      
      if (recipe) {
        // Get user's kitchen inventory to map ingredients if authenticated
        const userId = (req.user as any)?.dbUserId;
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
      
      // Fallback to database recipes (for user-created recipes) - requires auth
      const userId = (req.user as any)?.dbUserId;
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const dbRecipe = await storage.getRecipeById(req.params.id, userId);
      if (!dbRecipe) {
        return res.status(404).json({ message: "Recipe not found" });
      }
      
      // Add ingredient matching for database recipes too
      const inventory = await storage.getKitchenInventory(userId);
      const inventoryNames = new Set(inventory.map(item => item.name.toLowerCase()));
      
      const ingredients = (dbRecipe.ingredients as any) || [];
      const ownedIngredients = ingredients.filter((ing: any) => 
        inventoryNames.has(ing.name.toLowerCase())
      );
      const missingIngredients = ingredients.filter((ing: any) => 
        !inventoryNames.has(ing.name.toLowerCase())
      );
      
      res.json({
        ...dbRecipe,
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
      const userId = (req as any).user.dbUserId;
      const { rating, comment } = req.body;

      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      await storage.rateRecipe({
        recipeId: req.params.id,
        userId: userId,
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
      const userId = (req as any).user.dbUserId;
      const recipes = await storage.getRecommendedRecipes(userId);
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
      const userId = (req as any).user.dbUserId;
      const validatedData = insertRecipeRatingSchema.parse({
        ...req.body,
        recipeId: req.params.id,
        userId: userId,
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

  // Recipe Interactions - Track views and searches for smart recommendations
  app.post("/api/recipe-interactions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { recipeId, interactionType } = req.body;

      if (!recipeId || !interactionType) {
        return res.status(400).json({ message: "recipeId and interactionType are required" });
      }

      if (interactionType !== 'view' && interactionType !== 'search') {
        return res.status(400).json({ message: "interactionType must be 'view' or 'search'" });
      }

      if (interactionType === 'view') {
        await storage.trackRecipeView(userId, recipeId);
      } else {
        await storage.trackRecipeSearch(userId, recipeId);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking interaction:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Meal Plan routes
  app.get("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const mealPlans = await storage.getMealPlans(userId);
      res.json(mealPlans);
    } catch (error) {
      console.error("Error getting meal plans:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/meal-plans/upcoming", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const upcomingMeals = await storage.getUpcomingMeals(userId);
      res.json(upcomingMeals);
    } catch (error) {
      console.error("Error getting upcoming meals:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const validatedData = insertMealPlanSchema.parse({
        ...req.body,
        userId: userId,
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
      const userId = (req as any).user.dbUserId;
      const validatedData = insertMealVoteSchema.parse({
        ...req.body,
        mealPlanId: req.params.id,
        userId: userId,
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

  // Meal Seat Management routes
  app.get("/api/meal-plans/detail", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { date, familyId } = req.query;

      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Valid date (YYYY-MM-DD) is required" });
      }

      // Authorization: If familyId is provided, verify user is a member
      if (familyId) {
        const isMember = await storage.isUserFamilyMember(userId, familyId as string);
        if (!isMember) {
          return res.status(403).json({ message: "Forbidden: You are not a member of this family" });
        }
      }

      const result = await storage.getMealPlanByDate({
        userId: familyId ? undefined : userId,
        familyId: familyId as string | undefined,
        date,
      });

      if (!result) {
        return res.status(404).json({ message: "No meal plan found for this date" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error getting meal plan by date:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { date, familyId, seats } = req.body;

      // Validation
      if (!date || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Valid date (YYYY-MM-DD) is required" });
      }

      if (!Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({ message: "At least one seat is required" });
      }

      // Validate seats array
      for (const seat of seats) {
        if (typeof seat.seatNumber !== "number" || seat.seatNumber < 1 || seat.seatNumber > 6) {
          return res.status(400).json({ message: "Seat number must be between 1 and 6" });
        }
        if (!Array.isArray(seat.dietaryRestrictions)) {
          return res.status(400).json({ message: "Dietary restrictions must be an array" });
        }
      }

      // Check if at least one seat has a recipe
      const hasRecipe = seats.some(s => s.recipeId);
      if (!hasRecipe) {
        return res.status(400).json({ message: "At least one seat must have a recipe assigned" });
      }

      // Authorization: If familyId is provided, verify user is a member
      if (familyId) {
        const isMember = await storage.isUserFamilyMember(userId, familyId);
        if (!isMember) {
          return res.status(403).json({ message: "Forbidden: You are not a member of this family" });
        }
      }

      const result = await storage.upsertMealPlanWithSeats({
        userId: familyId ? undefined : userId,
        familyId: familyId || undefined,
        date,
        seats,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error upserting meal plan with seats:", error);
      if (error.message === "At least one seat must have a recipe assigned") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/meal-plans/:planId/seats/:seatId/assignment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { recipeId } = req.body;

      if (!recipeId || typeof recipeId !== "string") {
        return res.status(400).json({ message: "Recipe ID is required" });
      }

      // Authorization: Verify user has access to this meal plan
      const hasAccess = await storage.userHasMealPlanAccess(userId, req.params.planId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You do not have access to this meal plan" });
      }

      const assignment = await storage.assignRecipeToSeat({
        seatId: req.params.seatId,
        recipeId,
      });

      res.json(assignment);
    } catch (error) {
      console.error("Error assigning recipe to seat:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/meal-plans/:planId/seats/:seatId/assignment", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;

      // Authorization: Verify user has access to this meal plan
      const hasAccess = await storage.userHasMealPlanAccess(userId, req.params.planId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Forbidden: You do not have access to this meal plan" });
      }

      await storage.clearSeatAssignment(req.params.seatId);
      res.json({ message: "Assignment cleared successfully" });
    } catch (error) {
      console.error("Error clearing seat assignment:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get meal plans for a specific date (simplified endpoint for Today's Overview)
  app.get("/api/meal-plans/by-date/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { date } = req.params;

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Valid date (YYYY-MM-DD) is required" });
      }

      // Get all meal plans for the user and filter by date
      const allMealPlans = await storage.getMealPlans(userId);
      const dateMealPlans = allMealPlans.filter((mp: any) => {
        const planDate = new Date(mp.scheduledFor).toISOString().split('T')[0];
        return planDate === date;
      });

      res.json(dateMealPlans);
    } catch (error) {
      console.error("Error getting meal plans by date:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Nutrition Logs routes (MVP+ feature)
  app.get("/api/nutrition/logs", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { date, startDate, endDate } = req.query;

      // Get single day's log
      if (date && typeof date === 'string') {
        const log = await storage.getNutritionLogByDate(userId, date);
        if (!log) {
          return res.json(null);
        }
        const meals = await storage.getNutritionLogMeals(log.id);
        return res.json({ ...log, meals });
      }

      // Get date range
      if (startDate && endDate && typeof startDate === 'string' && typeof endDate === 'string') {
        const logs = await storage.getNutritionLogsByDateRange(userId, startDate, endDate);
        return res.json(logs);
      }

      // Default: return today's log
      const today = new Date().toISOString().split('T')[0];
      const log = await storage.getNutritionLogByDate(userId, today);
      if (!log) {
        return res.json(null);
      }
      const meals = await storage.getNutritionLogMeals(log.id);
      return res.json({ ...log, meals });
    } catch (error) {
      console.error("Error getting nutrition logs:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/nutrition/logs/:date/meals", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { date } = req.params;

      // Validate date format
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: "Valid date (YYYY-MM-DD) is required" });
      }

      // Validate request body using Zod schema
      const { addMealToLogRequestSchema } = await import('@shared/schema');
      const validation = addMealToLogRequestSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation error",
          errors: validation.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          }))
        });
      }

      const { recipeId, portionSize, mealType } = validation.data;

      const meal = await storage.addMealToNutritionLog({
        userId,
        date,
        recipeId,
        portionSize,
        mealType,
      });

      res.json(meal);
    } catch (error) {
      console.error("Error adding meal to nutrition log:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/nutrition/summary/weekly", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { endDate } = req.query;

      const date = typeof endDate === 'string' ? endDate : new Date().toISOString().split('T')[0];
      const summary = await storage.getWeeklySummary(userId, date);

      res.json(summary);
    } catch (error) {
      console.error("Error getting weekly summary:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Cooking Sessions routes
  app.post("/api/cooking-sessions", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { recipeId } = req.body;

      if (!recipeId || typeof recipeId !== "string") {
        return res.status(400).json({ message: "Recipe ID is required" });
      }

      // Check if user already has an active session
      const existingSession = await storage.getActiveCookingSession(userId);
      if (existingSession) {
        return res.status(409).json({ 
          message: "You already have an active cooking session",
          existingSession 
        });
      }

      const session = await storage.createCookingSession({
        userId,
        recipeId,
        currentStep: 0,
        status: 'active',
        timers: [],
      });

      res.json(session);
    } catch (error) {
      console.error("Error starting cooking session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/cooking-sessions/active", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const session = await storage.getActiveCookingSession(userId);
      res.json(session);
    } catch (error) {
      console.error("Error getting active cooking session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.put("/api/cooking-sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { currentStep, status, timers } = req.body;

      const session = await storage.updateCookingSessionProgress(id, {
        currentStep,
        status,
        timers,
      });

      res.json(session);
    } catch (error) {
      console.error("Error updating cooking session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/cooking-sessions/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { deductIngredients } = req.body;

      const result = await storage.completeCookingSession(
        id,
        deductIngredients === true
      );

      res.json(result);
    } catch (error) {
      console.error("Error completing cooking session:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // AI Chat routes
  app.get("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const messages = await storage.getChatMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error getting chat messages:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ message: "Message content is required" });
      }

      await storage.addChatMessage({
        userId: userId,
        role: "user",
        content,
      });

      // Get user context for AI
      const userProfile = await storage.getUserById(userId);
      const inventory = await storage.getKitchenInventory(userId);
      const upcomingMeals = await storage.getUpcomingMeals(userId);
      const family = await storage.getFamily(userId);
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

      const conversationHistory = await storage.getChatMessages(userId);
      
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
        userId: userId,
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
      const userId = (req as any).user.dbUserId;
      const family = await storage.getFamily(userId);
      res.json(family);
    } catch (error) {
      console.error("Error getting family:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/family", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { name } = req.body;
      
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Family name is required" });
      }

      const family = await storage.createFamily({
        name,
        createdById: userId,
      });

      await storage.addFamilyMember({
        familyId: family.id,
        userId: userId,
        role: "admin",
      });

      res.json(family);
    } catch (error) {
      console.error("Error creating family:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/family/members", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { email } = req.body;
      
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return sendError(res, 400, "Valid email address is required", "VALIDATION_ERROR");
      }

      // Get requester's family and verify they're admin
      const family = await storage.getFamily(userId);
      if (!family) {
        return sendError(res, 404, "You are not part of a family", "NOT_FOUND");
      }

      const requesterMembership = family.members.find(m => m.userId === userId);
      if (!requesterMembership || requesterMembership.role !== "admin") {
        return sendError(res, 403, "Only family admins can invite members", "FORBIDDEN");
      }

      // Look up user by email
      const invitedUser = await storage.getUserByEmail(email.toLowerCase());
      if (!invitedUser) {
        return sendError(res, 404, "User with this email not found. They must sign up first.", "NOT_FOUND");
      }

      // Check if already a member
      const existingMember = family.members.find(m => m.userId === invitedUser.id);
      if (existingMember) {
        return res.status(409).json({ 
          message: "User is already a family member",
          member: existingMember
        });
      }

      // Add member to family
      const newMember = await storage.addFamilyMember({
        familyId: family.id,
        userId: invitedUser.id,
        role: "member",
      });

      // Return member with user info for UI
      res.json({
        ...newMember,
        user: invitedUser,
      });
    } catch (error) {
      console.error("Error adding family member:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Development-only endpoint to seed test family members
  if (process.env.NODE_ENV === "development") {
    app.post("/api/dev/seed-family", isAuthenticated, async (req, res) => {
      try {
        const userId = (req as any).user.dbUserId;
        
        // Get or create family
        let family = await storage.getFamily(userId);
        if (!family) {
          return sendError(res, 404, "You must create a family first", "NOT_FOUND");
        }

        // Test users to create
        const testUsers = [
          { email: "alice.cooper@test.com", firstName: "Alice", lastName: "Cooper" },
          { email: "bob.smith@test.com", firstName: "Bob", lastName: "Smith" },
          { email: "charlie.davis@test.com", firstName: "Charlie", lastName: "Davis" },
        ];

        const addedMembers = [];

        for (const testUser of testUsers) {
          // Check if user already exists
          let existingUser = await storage.getUserByEmail(testUser.email);
          
          if (!existingUser) {
            // Create test user
            await storage.upsertUser({
              id: `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              email: testUser.email,
              firstName: testUser.firstName,
              lastName: testUser.lastName,
              profileImageUrl: null,
            });
            existingUser = await storage.getUserByEmail(testUser.email);
          }

          if (existingUser) {
            // Check if already a family member
            const alreadyMember = family.members.find(m => m.userId === existingUser.id);
            if (!alreadyMember) {
              const newMember = await storage.addFamilyMember({
                familyId: family.id,
                userId: existingUser.id,
                role: "member",
              });
              addedMembers.push({
                ...newMember,
                user: existingUser,
              });
            }
          }
        }

        res.json({
          message: `Added ${addedMembers.length} test family members`,
          members: addedMembers,
        });
      } catch (error) {
        console.error("Error seeding family members:", error);
        sendError(res, 500, "Internal server error");
      }
    });
  }

  // Shopping List routes
  app.get("/api/shopping-lists", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const lists = await storage.getShoppingLists(userId);
      res.json(lists);
    } catch (error) {
      console.error("Error getting shopping lists:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/shopping-lists/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const result = await storage.getShoppingListWithItems(req.params.id, userId);
      
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
      const userId = (req as any).user.dbUserId;
      const validatedData = insertShoppingListSchema.parse({
        ...req.body,
        userId: userId,
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
      const userId = (req as any).user.dbUserId;
      const { name } = req.body;
      const result = await storage.updateShoppingList(req.params.id, userId, name);
      
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
      const userId = (req as any).user.dbUserId;
      const result = await storage.deleteShoppingList(req.params.id, userId);
      
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

  app.get("/api/shopping-lists/suggestions/meal-plans", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const suggestions = await storage.getShoppingListSuggestions(userId);
      res.json(suggestions);
    } catch (error) {
      console.error("Error getting shopping list suggestions:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Shopping List Items routes
  // Shopping List Item routes
  app.patch("/api/shopping-lists/:listId/items/:itemId/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { itemId } = req.params;
      
      // Validate status
      const schema = insertShoppingListItemSchema.pick({ status: true });
      const validatedData = schema.parse(req.body);
      
      if (!validatedData.status) {
        return sendError(res, 400, "Status is required", "VALIDATION_ERROR");
      }
      
      const result = await storage.updateShoppingListItemStatus(
        itemId,
        userId,
        validatedData.status
      );
      
      if (!result) {
        return sendError(res, 404, "Shopping list item not found or access denied", "NOT_FOUND");
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error updating shopping list item status:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/shopping-lists/:listId/items/:itemId/assign", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { itemId } = req.params;
      
      // Validate assignedToUserId
      const schema = insertShoppingListItemSchema.pick({ assignedToUserId: true });
      const validatedData = schema.parse(req.body);
      
      const result = await storage.assignShoppingListItem(
        itemId,
        userId,
        validatedData.assignedToUserId || null
      );
      
      if (!result) {
        return sendError(res, 404, "Shopping list item not found or access denied", "NOT_FOUND");
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error assigning shopping list item:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  app.delete("/api/shopping-lists/:listId/items/:itemId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { itemId } = req.params;
      
      const result = await storage.deleteShoppingListItem(itemId, userId);
      
      if (!result) {
        return sendError(res, 404, "Shopping list item not found or access denied", "NOT_FOUND");
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting shopping list item:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/shopping-lists/:listId/items", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const validatedData = insertShoppingListItemSchema.parse({
        ...req.body,
        listId: req.params.listId,
      });
      
      const item = await storage.addShoppingListItem(validatedData, userId);
      
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

  // Inventory Review Queue routes
  app.get("/api/inventory-review-queue", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const items = await storage.getPendingReviewItems(userId);
      res.json(items);
    } catch (error) {
      console.error("Error getting pending review items:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.post("/api/inventory-review-queue", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const validatedData = insertInventoryReviewQueueSchema.parse(req.body);
      
      const item = await storage.addToReviewQueue(validatedData, userId);
      
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
      const userId = (req as any).user.dbUserId;
      // Note: category and expirationDate not yet supported by storage method
      // Uses categoryGuess from review item itself
      const result = await storage.approveReviewItem(req.params.itemId, userId);
      
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
      const userId = (req as any).user.dbUserId;
      const deleted = await storage.rejectReviewItem(req.params.itemId, userId);
      
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
      const userId = (req as any).user.dbUserId;
      const notifications = await storage.getRecentNotifications(userId, 50);
      res.json(notifications);
    } catch (error) {
      console.error("Error getting notifications:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  app.patch("/api/notifications/:notificationId/read", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const result = await storage.markNotificationAsRead(req.params.notificationId, userId);
      
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

  // ============= FEED & POLLS ROUTES =============

  // Featured recipes for stories bar - fetch from Spoonacular API
  app.get("/api/feed/stories", optionalAuth, async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    
    try {
      // Fetch diverse recipes with images from Spoonacular
      const apiRecipes = await searchSpoonacularRecipes({
        limit: Math.min(limit, 50), // Cap at 50 for performance
        offset: 0,
      });
      
      // Filter to only recipes with images for stories
      const recipesWithImages = apiRecipes.filter(recipe => recipe.imageUrl);
      
      res.json(recipesWithImages);
    } catch (error) {
      console.error("Error getting featured recipes:", error);
      // Fallback to database recipes if API fails
      try {
        const recipes = await storage.getFeaturedRecipes(limit);
        res.json(recipes);
      } catch (fallbackError) {
        console.error("Fallback also failed:", fallbackError);
        sendError(res, 500, "Internal server error");
      }
    }
  });

  // Mixed feed of polls and recipe recommendations
  app.get("/api/feed/posts", optionalAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const isAuthenticated = !!(req as any).user?.dbUserId;
      const userId = isAuthenticated ? (req as any).user.dbUserId : null;
      
      // Calculate target counts
      const recipeCount = Math.ceil(limit * 0.6); // 60% recipes
      const pollCount = Math.floor(limit * 0.4); // 40% polls
      
      // Fetch recipe recommendations from Spoonacular
      const recipes = await searchSpoonacularRecipes({
        limit: recipeCount,
        offset: 0,
      });
      
      // Get unanswered polls if user is authenticated
      let polls: any[] = [];
      if (isAuthenticated && userId) {
        // Batch fetch polls efficiently
        const fetchedPolls: any[] = [];
        const seenIds = new Set<string>();
        
        // Try to get unique polls up to pollCount
        let attempts = 0;
        while (fetchedPolls.length < pollCount && attempts < pollCount * 2) {
          const poll = await storage.getRandomUnansweredPoll(userId);
          if (poll && !seenIds.has(poll.id)) {
            fetchedPolls.push(poll);
            seenIds.add(poll.id);
          }
          attempts++;
        }
        polls = fetchedPolls;
      }
      
      // Mix polls and recipes
      const feed: any[] = [];
      
      // Add recipes as posts
      recipes.slice(0, recipeCount).forEach(recipe => {
        feed.push({
          type: 'recipe',
          data: recipe
        });
      });
      
      // Add polls as posts
      polls.slice(0, pollCount).forEach(poll => {
        feed.push({
          type: 'poll',
          data: poll
        });
      });
      
      // Shuffle for variety
      const shuffled = feed.sort(() => Math.random() - 0.5);
      
      // Enforce exact limit
      res.json(shuffled.slice(0, limit));
    } catch (error) {
      console.error("Error getting feed posts:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Get random unanswered poll
  app.get("/api/polls/random", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const poll = await storage.getRandomUnansweredPoll(userId);
      res.json(poll);
    } catch (error) {
      console.error("Error getting random poll:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Submit poll response
  app.post("/api/polls/respond", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { insertUserPollResponseSchema } = await import("@shared/schema");
      const validatedData = insertUserPollResponseSchema.parse({
        ...req.body,
        userId,
      });
      
      const response = await storage.submitPollResponse(validatedData);
      res.json(response);
    } catch (error: any) {
      console.error("Error submitting poll response:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });

  // ============= SIDEBAR WIDGET ROUTES =============

  // Fridge status widget
  app.get("/api/feed/fridge-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const status = await storage.getFridgeStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error getting fridge status:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Upcoming dinners widget
  app.get("/api/feed/upcoming-dinners", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const limit = parseInt(req.query.limit as string) || 5;
      const dinners = await storage.getUpcomingDinners(userId, limit);
      res.json(dinners);
    } catch (error) {
      console.error("Error getting upcoming dinners:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Family online status widget
  app.get("/api/feed/family-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const members = await storage.getFamilyMembersStatus(userId);
      res.json(members);
    } catch (error) {
      console.error("Error getting family status:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // Meal plan RSVPs widget
  app.get("/api/feed/meal-rsvps", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const limit = parseInt(req.query.limit as string) || 5;
      const rsvps = await storage.getUpcomingMealPlanRSVPs(userId, limit);
      res.json(rsvps);
    } catch (error) {
      console.error("Error getting meal RSVPs:", error);
      sendError(res, 500, "Internal server error");
    }
  });

  // RSVP to meal plan
  app.post("/api/meal-plans/:mealPlanId/rsvp", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.dbUserId;
      const { insertMealPlanRSVPSchema } = await import("@shared/schema");
      const validatedData = insertMealPlanRSVPSchema.parse({
        mealPlanId: req.params.mealPlanId,
        userId,
        status: req.body.status,
      });
      
      const rsvp = await storage.upsertMealPlanRSVP(validatedData);
      res.json(rsvp);
    } catch (error: any) {
      console.error("Error submitting RSVP:", error);
      if (error.name === "ZodError") {
        return sendError(res, 400, "Invalid request data", "VALIDATION_ERROR", error.errors);
      }
      sendError(res, 500, "Internal server error");
    }
  });
}

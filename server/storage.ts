import { db } from "./db";
import { eq, and, gte, desc, sql, inArray, isNull, isNotNull, or } from "drizzle-orm";
import type { UpsertUser, User, InsertKitchenInventory, KitchenInventory, InsertRecipe, Recipe, InsertMealPlan, MealPlan, MealPlanWithRecipe, InsertMealVote, MealVote, InsertChatMessage, ChatMessage, InsertRecipeRating, RecipeRating, InsertFamily, Family, InsertFamilyMember, FamilyMember, InsertShoppingList, ShoppingList, ShoppingListItem, InsertShoppingListItem, InventoryReviewQueue, InsertInventoryReviewQueue, Notification, InsertNotification, InsertMealPlanSeat, MealPlanSeat, InsertMealSeatAssignment, MealSeatAssignment, InsertRecipeInteraction, RecipeInteraction, InsertKitchenEquipment, KitchenEquipment } from "@shared/schema";
import { users, kitchenInventory, recipes, mealPlans, mealVotes, chatMessages, recipeRatings, families, familyMembers, shoppingLists, shoppingListItems, inventoryReviewQueue, notifications, mealPlanSeats, mealSeatAssignments, recipeInteractions, kitchenEquipment } from "@shared/schema";
import { normalizeIngredientName } from "./normalizationService";

// Helper function to check if user has access to a shopping list (owner or family member)
// Returns tri-state: {exists, authorized} to distinguish 404 vs 403
async function getListAccessState(listId: string, userId: string): Promise<{exists: boolean, authorized: boolean}> {
  const result = await db
    .select({ list: shoppingLists, member: familyMembers })
    .from(shoppingLists)
    .leftJoin(familyMembers, and(
      eq(shoppingLists.familyId, familyMembers.familyId),
      eq(familyMembers.userId, userId)
    ))
    .where(eq(shoppingLists.id, listId));
  
  if (!result.length) {
    return { exists: false, authorized: false };
  }
  
  const { list, member } = result[0];
  
  // User has access if they own the list OR they're a family member
  const authorized = list.userId === userId || member !== null;
  return { exists: true, authorized };
}

// Simple boolean wrapper for methods that don't need tri-state
async function userHasListAccess(listId: string, userId: string): Promise<boolean> {
  const state = await getListAccessState(listId, userId);
  return state.exists && state.authorized;
}

export const storage = {
  async upsertUser(user: UpsertUser): Promise<void> {
    await db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          updatedAt: new Date(),
        },
      });
  },

  async getUserById(id: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || null;
  },

  // Kitchen Inventory
  async getKitchenInventory(userId: string): Promise<KitchenInventory[]> {
    return await db.select().from(kitchenInventory).where(eq(kitchenInventory.userId, userId));
  },

  async addKitchenItem(item: InsertKitchenInventory): Promise<KitchenInventory> {
    const normalizedName = normalizeIngredientName(item.name);
    const result = await db.insert(kitchenInventory).values({
      ...item,
      normalizedName,
    }).returning();
    return result[0];
  },

  async deleteKitchenItem(id: string, userId: string): Promise<void> {
    await db.delete(kitchenInventory).where(
      and(
        eq(kitchenInventory.id, id),
        eq(kitchenInventory.userId, userId)
      )
    );
  },

  // Kitchen Equipment
  async getKitchenEquipment(userId: string, location?: 'indoor' | 'outdoor'): Promise<KitchenEquipment[]> {
    if (location) {
      return await db
        .select()
        .from(kitchenEquipment)
        .where(and(
          eq(kitchenEquipment.userId, userId),
          eq(kitchenEquipment.location, location)
        ));
    }
    return await db.select().from(kitchenEquipment).where(eq(kitchenEquipment.userId, userId));
  },

  async upsertKitchenEquipment(item: InsertKitchenEquipment): Promise<KitchenEquipment> {
    const result = await db
      .insert(kitchenEquipment)
      .values(item)
      .onConflictDoUpdate({
        target: [kitchenEquipment.userId, kitchenEquipment.itemType, kitchenEquipment.location],
        set: {
          owned: item.owned,
          brand: item.brand,
          model: item.model,
          imageUrl: item.imageUrl,
          notes: item.notes,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  },

  async deleteKitchenEquipment(id: string, userId: string): Promise<void> {
    await db.delete(kitchenEquipment).where(
      and(
        eq(kitchenEquipment.id, id),
        eq(kitchenEquipment.userId, userId)
      )
    );
  },

  // Recipes
  async getRecipeSummaries(limit: number = 15, dietType?: string): Promise<Array<{id: string, name: string, dietType: string | null, calories: number | null}>> {
    const conditions = [];
    
    if (dietType && dietType !== 'all') {
      conditions.push(eq(recipes.dietType, dietType));
    }
    
    const results = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        dietType: recipes.dietType,
        calories: recipes.calories,
      })
      .from(recipes)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(limit)
      .orderBy(desc(recipes.createdAt));
    
    return results;
  },

  // Map dietary restrictions to tag requirements
  mapDietaryRestrictionsToTags(restrictions: string[]): {
    requiredTags: string[];
    excludedTags: string[];
  } {
    const requiredTags: string[] = [];
    const excludedTags: string[] = [];

    restrictions.forEach(restriction => {
      const normalized = restriction.toLowerCase();
      switch (normalized) {
        case 'vegan':
          requiredTags.push('vegan');
          break;
        case 'vegetarian':
          requiredTags.push('vegetarian');
          break;
        case 'gluten-free':
          excludedTags.push('contains-gluten');
          break;
        case 'dairy-free':
          excludedTags.push('contains-dairy');
          break;
        case 'nut-free':
          excludedTags.push('contains-nuts');
          break;
        case 'halal':
          requiredTags.push('halal');
          break;
        case 'kosher':
          requiredTags.push('kosher');
          break;
        case 'low-carb':
          requiredTags.push('low-carb');
          break;
      }
    });

    return { requiredTags, excludedTags };
  },

  async getRecipes(filters?: {
    searchQuery?: string;
    dietType?: string;
    cuisine?: string;
    mealType?: string;
    maxCalories?: number;
    dietaryRestrictions?: string[];
  }): Promise<any[]> {
    let query = db.select().from(recipes);
    
    const conditions = [];
    
    if (filters?.dietType && filters.dietType !== "all") {
      conditions.push(eq(recipes.dietType, filters.dietType));
    }
    
    if (filters?.cuisine && filters.cuisine !== "all") {
      conditions.push(eq(recipes.cuisine, filters.cuisine));
    }
    
    if (filters?.mealType && filters.mealType !== "all") {
      conditions.push(eq(recipes.mealType, filters.mealType));
    }
    
    if (filters?.maxCalories) {
      conditions.push(gte(recipes.calories, 0));
    }

    // Apply dietary restriction filtering via tags
    if (filters?.dietaryRestrictions && filters.dietaryRestrictions.length > 0) {
      const { requiredTags, excludedTags } = this.mapDietaryRestrictionsToTags(
        filters.dietaryRestrictions
      );

      // Required tags: recipe must have ALL of these
      requiredTags.forEach(tag => {
        conditions.push(sql<boolean>`${recipes.tags} @> ARRAY[${tag}]::text[]`);
      });

      // Excluded tags: recipe must NOT have ANY of these
      excludedTags.forEach(tag => {
        conditions.push(sql<boolean>`NOT (${recipes.tags} @> ARRAY[${tag}]::text[])`);
      });
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    const results = await query.orderBy(desc(recipes.createdAt));
    
    // Get ratings for all recipes
    const allRatings = await db.select().from(recipeRatings);
    const ratingsByRecipe = allRatings.reduce((acc, rating) => {
      if (!acc[rating.recipeId]) acc[rating.recipeId] = [];
      acc[rating.recipeId].push(rating);
      return acc;
    }, {} as Record<string, any[]>);

    // Add rating info to each recipe
    const recipesWithRatings = results.map(recipe => {
      const ratings = ratingsByRecipe[recipe.id] || [];
      const averageRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;
      return {
        ...recipe,
        averageRating,
        ratingCount: ratings.length,
      };
    });
    
    if (filters?.searchQuery) {
      const search = filters.searchQuery.toLowerCase();
      return recipesWithRatings.filter(r => 
        r.name.toLowerCase().includes(search) ||
        r.description?.toLowerCase().includes(search)
      );
    }
    
    return recipesWithRatings;
  },

  async getRecipeById(id: string, userId?: string): Promise<any | null> {
    const recipe = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
    if (!recipe[0]) return null;

    const ratings = await db
      .select({
        rating: recipeRatings,
        user: users,
      })
      .from(recipeRatings)
      .leftJoin(users, eq(recipeRatings.userId, users.id))
      .where(eq(recipeRatings.recipeId, id));

    const ratingsWithUser = ratings.map(r => ({
      ...r.rating,
      user: r.user!,
    }));

    const averageRating = ratingsWithUser.length > 0
      ? ratingsWithUser.reduce((sum, r) => sum + r.rating, 0) / ratingsWithUser.length
      : null;

    const userRating = userId
      ? ratingsWithUser.find(r => r.userId === userId)
      : null;

    return {
      ...recipe[0],
      ratings: ratingsWithUser,
      averageRating,
      userRating: userRating || null,
    };
  },

  async rateRecipe(data: { recipeId: string; userId: string; rating: number; comment: string | null }): Promise<void> {
    await db
      .insert(recipeRatings)
      .values({
        recipeId: data.recipeId,
        userId: data.userId,
        rating: data.rating,
        comment: data.comment,
      })
      .onConflictDoUpdate({
        target: [recipeRatings.recipeId, recipeRatings.userId],
        set: {
          rating: data.rating,
          comment: data.comment,
        },
      });
  },

  async addRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const result = await db.insert(recipes).values(recipe).returning();
    return result[0];
  },

  async getRecommendedRecipes(userId: string): Promise<Recipe[]> {
    // Get user's kitchen inventory (normalized names)
    const userInventory = await this.getKitchenInventory(userId);
    const userIngredientNames = new Set(
      userInventory.map(item => item.normalizedName).filter(Boolean)
    );

    // Get all recipes with their ingredients
    const allRecipes = await db.select().from(recipes);

    // Get user's recipe interactions (views + searches)
    const interactions = await db
      .select({
        recipeId: recipeInteractions.recipeId,
        count: sql<number>`count(*)`,
      })
      .from(recipeInteractions)
      .where(eq(recipeInteractions.userId, userId))
      .groupBy(recipeInteractions.recipeId);

    const interactionMap = new Map(
      interactions.map(i => [i.recipeId, Number(i.count)])
    );

    // Score each recipe
    const scoredRecipes = allRecipes.map(recipe => {
      // Calculate ingredient match score (0-1)
      const recipeIngredients = (recipe.ingredients as any) || [];
      const matchedIngredients = recipeIngredients.filter((ing: any) => {
        const normalized = normalizeIngredientName(ing.name);
        return userIngredientNames.has(normalized);
      });
      const ingredientMatchScore = recipeIngredients.length > 0
        ? matchedIngredients.length / recipeIngredients.length
        : 0;

      // Get interaction frequency (views + searches)
      const interactionCount = interactionMap.get(recipe.id) || 0;
      
      // Boost score: base on interactions, multiply by ingredient match
      // Add 1 to interaction count to give new recipes a chance
      const score = (interactionCount + 1) * (1 + ingredientMatchScore * 2);

      return {
        recipe,
        score,
        ingredientMatchScore,
        interactionCount,
      };
    });

    // Sort by score (highest first) and return top 10
    return scoredRecipes
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.recipe);
  },

  // Recipe Ratings
  async getRecipeRatings(recipeId: string): Promise<RecipeRating[]> {
    return await db.select().from(recipeRatings).where(eq(recipeRatings.recipeId, recipeId));
  },

  async addRecipeRating(rating: InsertRecipeRating): Promise<RecipeRating> {
    const result = await db.insert(recipeRatings).values(rating).returning();
    return result[0];
  },

  // Recipe Interactions (for smart recommendations)
  async trackRecipeView(userId: string, recipeId: string): Promise<void> {
    await db.insert(recipeInteractions).values({
      userId,
      recipeId,
      interactionType: 'view',
    });
  },

  async trackRecipeSearch(userId: string, recipeId: string): Promise<void> {
    await db.insert(recipeInteractions).values({
      userId,
      recipeId,
      interactionType: 'search',
    });
  },

  async getRecipeInteractionCount(userId: string, recipeId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipeInteractions)
      .where(and(
        eq(recipeInteractions.userId, userId),
        eq(recipeInteractions.recipeId, recipeId)
      ));
    return Number(result[0]?.count || 0);
  },

  // Meal Plans
  async getMealPlans(userId: string): Promise<MealPlanWithRecipe[]> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const results = await db
      .select({
        mealPlan: mealPlans,
        recipe: recipes,
        family: families,
      })
      .from(mealPlans)
      .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .leftJoin(families, eq(mealPlans.familyId, families.id))
      .where(
        and(
          eq(mealPlans.userId, userId),
          gte(mealPlans.scheduledFor, now)
        )
      )
      .orderBy(mealPlans.scheduledFor);

    const mealPlanIds = results.map(r => r.mealPlan.id);
    
    // Get votes with user info
    const votesResults = mealPlanIds.length > 0 
      ? await db
          .select({
            vote: mealVotes,
            user: users,
          })
          .from(mealVotes)
          .leftJoin(users, eq(mealVotes.userId, users.id))
          .where(inArray(mealVotes.mealPlanId, mealPlanIds))
      : [];

    return results.map(r => {
      const mealVotesWithUser = votesResults
        .filter(v => v.vote.mealPlanId === r.mealPlan.id)
        .map(v => ({
          ...v.vote,
          user: v.user!,
        }));

      return {
        ...r.mealPlan,
        recipe: r.recipe!,
        family: r.family,
        votes: mealVotesWithUser,
        userVote: mealVotesWithUser.find(v => v.userId === userId),
      };
    });
  },

  async getUpcomingMeals(userId: string): Promise<any[]> {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const results = await db
      .select({
        mealPlan: mealPlans,
        recipe: recipes,
      })
      .from(mealPlans)
      .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .where(
        and(
          eq(mealPlans.userId, userId),
          gte(mealPlans.scheduledFor, now)
        )
      )
      .orderBy(mealPlans.scheduledFor)
      .limit(5);

    return results.map(r => ({
      ...r.mealPlan,
      recipe: r.recipe!,
    }));
  },

  async addMealPlan(mealPlan: InsertMealPlan): Promise<MealPlan> {
    const result = await db.insert(mealPlans).values(mealPlan).returning();
    return result[0];
  },

  async getMealPlanById(mealPlanId: string): Promise<MealPlan | null> {
    const result = await db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.id, mealPlanId))
      .limit(1);
    
    return result[0] || null;
  },

  async createMealPlanWithSeats(params: {
    userId: string;
    familyId?: string | null;
    scheduledFor: string;
    seats: Array<{
      seatNumber: number;
      dietaryRestrictions: string[];
      recipeId: string;
      assignedUserId?: string | null;
    }>;
  }): Promise<MealPlan & { seats: any[] }> {
    // Validate at least one seat
    if (!params.seats || params.seats.length === 0) {
      throw new Error("At least one seat is required");
    }

    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Create meal plan with null recipeId (recipes are per-seat)
      const mealPlanResult = await tx.insert(mealPlans).values({
        userId: params.userId,
        familyId: params.familyId,
        recipeId: null, // null for multi-seat meals
        scheduledFor: new Date(params.scheduledFor),
      }).returning();
      
      const mealPlan = mealPlanResult[0];

      // Create seats and assignments
      const seatsWithAssignments = [];
      
      for (const seatData of params.seats) {
        // Create seat
        const seatResult = await tx.insert(mealPlanSeats).values({
          mealPlanId: mealPlan.id,
          seatNumber: seatData.seatNumber,
          dietaryRestrictions: seatData.dietaryRestrictions,
          assignedUserId: seatData.assignedUserId,
        }).returning();
        
        const seat = seatResult[0];

        // Create assignment
        await tx.insert(mealSeatAssignments).values({
          seatId: seat.id,
          recipeId: seatData.recipeId,
        });

        seatsWithAssignments.push({
          ...seat,
          recipeId: seatData.recipeId,
        });
      }

      return {
        ...mealPlan,
        seats: seatsWithAssignments,
      };
    });
  },

  async voteMealPlan(vote: InsertMealVote): Promise<{ vote: MealVote; mealPlanApproved: boolean }> {
    // Upsert the vote
    const result = await db
      .insert(mealVotes)
      .values(vote)
      .onConflictDoUpdate({
        target: [mealVotes.mealPlanId, mealVotes.userId],
        set: { vote: vote.vote },
      })
      .returning();

    // Check if meal should be auto-approved
    const mealPlan = await db
      .select({
        mealPlan: mealPlans,
        family: families,
      })
      .from(mealPlans)
      .leftJoin(families, eq(mealPlans.familyId, families.id))
      .where(eq(mealPlans.id, vote.mealPlanId))
      .limit(1);

    let mealPlanApproved = false;

    if (mealPlan[0]) {
      mealPlanApproved = mealPlan[0].mealPlan.isApproved || false;

      if (!mealPlanApproved) {
        // Count upvotes for this meal
        const votes = await db
          .select()
          .from(mealVotes)
          .where(eq(mealVotes.mealPlanId, vote.mealPlanId));

        const upvotes = votes.filter(v => v.vote).length;
        const threshold = mealPlan[0].family?.voteThreshold || 2;

        // Auto-approve if threshold reached
        if (upvotes >= threshold) {
          await db
            .update(mealPlans)
            .set({ isApproved: true })
            .where(eq(mealPlans.id, vote.mealPlanId));
          mealPlanApproved = true;
        }
      }
    }

    return {
      vote: result[0],
      mealPlanApproved,
    };
  },

  // Chat Messages
  async getChatMessages(userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);
  },

  async addChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const result = await db.insert(chatMessages).values(message).returning();
    return result[0];
  },

  // Families
  async getFamily(userId: string): Promise<(Family & { members: any[] }) | null> {
    const membership = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId))
      .limit(1);
    
    if (membership.length === 0) return null;
    
    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, membership[0].familyId))
      .limit(1);
    
    if (family.length === 0) return null;
    
    const members = await db
      .select({
        familyMember: familyMembers,
        user: users,
      })
      .from(familyMembers)
      .leftJoin(users, eq(familyMembers.userId, users.id))
      .where(eq(familyMembers.familyId, family[0].id));
    
    return {
      ...family[0],
      members: members.map(m => ({
        ...m.familyMember,
        user: m.user!,
      })),
    };
  },

  async createFamily(family: InsertFamily): Promise<Family> {
    const result = await db.insert(families).values(family).returning();
    return result[0];
  },

  async addFamilyMember(member: InsertFamilyMember): Promise<FamilyMember> {
    const result = await db.insert(familyMembers).values(member).returning();
    return result[0];
  },

  // Shopping Lists
  async getShoppingLists(userId: string): Promise<ShoppingList[]> {
    // Get lists owned by user OR lists shared via family
    const result = await db
      .select({ list: shoppingLists })
      .from(shoppingLists)
      .leftJoin(familyMembers, and(
        eq(shoppingLists.familyId, familyMembers.familyId),
        eq(familyMembers.userId, userId)
      ))
      .where(or(
        eq(shoppingLists.userId, userId),
        eq(familyMembers.userId, userId)
      ))
      .orderBy(desc(shoppingLists.updatedAt));
    
    // Remove duplicates (can occur if user is both owner and family member)
    const seen = new Set<string>();
    return result
      .map(r => r.list)
      .filter(list => {
        if (seen.has(list.id)) return false;
        seen.add(list.id);
        return true;
      });
  },

  async createShoppingList(list: InsertShoppingList): Promise<ShoppingList> {
    const result = await db.insert(shoppingLists).values(list).returning();
    return result[0];
  },

  async updateShoppingList(id: string, userId: string, name?: string): Promise<{ status: "ok" | "not_found" | "forbidden"; data?: ShoppingList }> {
    const access = await getListAccessState(id, userId);
    
    if (!access.exists) {
      return { status: "not_found" };
    }
    
    if (!access.authorized) {
      return { status: "forbidden" };
    }

    const result = await db
      .update(shoppingLists)
      .set({ 
        ...(name && { name }),
        updatedAt: new Date() 
      })
      .where(eq(shoppingLists.id, id))
      .returning();
    return { status: "ok", data: result[0] };
  },

  async deleteShoppingList(id: string, userId: string): Promise<{ status: "ok" | "not_found" | "forbidden" }> {
    const access = await getListAccessState(id, userId);
    
    if (!access.exists) {
      return { status: "not_found" };
    }
    
    if (!access.authorized) {
      return { status: "forbidden" };
    }

    await db.delete(shoppingLists).where(eq(shoppingLists.id, id));
    return { status: "ok" };
  },

  // Shopping List Items
  async addShoppingListItem(item: InsertShoppingListItem, userId: string): Promise<ShoppingListItem | null> {
    // Verify user has access to the shopping list (owner or family member)
    const hasAccess = await userHasListAccess(item.listId, userId);
    if (!hasAccess) return null;

    const normalizedName = normalizeIngredientName(item.name);
    const result = await db.insert(shoppingListItems).values({
      ...item,
      normalizedName,
    }).returning();
    return result[0];
  },

  async getShoppingListItems(listId: string): Promise<ShoppingListItem[]> {
    return await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(desc(shoppingListItems.addedAt));
  },

  async getShoppingListWithItems(listId: string, userId: string): Promise<{ status: "ok" | "not_found" | "forbidden"; data?: { list: ShoppingList; items: ShoppingListItem[] } }> {
    const access = await getListAccessState(listId, userId);
    
    if (!access.exists) {
      return { status: "not_found" };
    }
    
    if (!access.authorized) {
      return { status: "forbidden" };
    }

    const listResult = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, listId));
    
    const items = await this.getShoppingListItems(listId);
    
    return {
      status: "ok",
      data: {
        list: listResult[0],
        items,
      }
    };
  },

  async updateShoppingListItemStatus(itemId: string, userId: string, status: 'active' | 'bought' | 'pending_review'): Promise<ShoppingListItem | null> {
    // Get the item and its list
    const itemData = await db
      .select({ item: shoppingListItems, list: shoppingLists })
      .from(shoppingListItems)
      .innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
      .where(eq(shoppingListItems.id, itemId));
    
    if (!itemData.length) return null;

    // Verify user has access to the list (owner or family member)
    const hasAccess = await userHasListAccess(itemData[0].list.id, userId);
    if (!hasAccess) return null;

    const result = await db
      .update(shoppingListItems)
      .set({ 
        status,
        boughtAt: status === 'bought' ? new Date() : null,
      })
      .where(eq(shoppingListItems.id, itemId))
      .returning();
    return result[0];
  },

  async assignShoppingListItem(itemId: string, userId: string, assignedToUserId: string | null): Promise<ShoppingListItem | null> {
    // Get the item and its list
    const itemData = await db
      .select({ item: shoppingListItems, list: shoppingLists })
      .from(shoppingListItems)
      .innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
      .where(eq(shoppingListItems.id, itemId));
    
    if (!itemData.length) return null;

    // Verify user has access to the list (owner or family member)
    const hasAccess = await userHasListAccess(itemData[0].list.id, userId);
    if (!hasAccess) return null;

    const result = await db
      .update(shoppingListItems)
      .set({ assignedToUserId })
      .where(eq(shoppingListItems.id, itemId))
      .returning();
    return result[0];
  },

  async deleteShoppingListItem(itemId: string, userId: string): Promise<boolean> {
    // Get the item and its list
    const itemData = await db
      .select({ item: shoppingListItems, list: shoppingLists })
      .from(shoppingListItems)
      .innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
      .where(eq(shoppingListItems.id, itemId));
    
    if (!itemData.length) return false;

    // Verify user has access to the list (owner or family member)
    const hasAccess = await userHasListAccess(itemData[0].list.id, userId);
    if (!hasAccess) return false;

    await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId));
    return true;
  },

  // Inventory Review Queue
  async addToReviewQueue(item: InsertInventoryReviewQueue, requestingUserId: string): Promise<InventoryReviewQueue | null> {
    let targetUserId = item.userId;
    
    // If this is linked to a shopping list item, validate it properly
    if (item.sourceItemId) {
      const sourceItemData = await db
        .select({ item: shoppingListItems, list: shoppingLists })
        .from(shoppingListItems)
        .innerJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
        .where(eq(shoppingListItems.id, item.sourceItemId));
      
      if (!sourceItemData.length) return null;

      const list = sourceItemData[0].list;

      // Verify requesting user has access to the source item's list
      const hasAccess = await userHasListAccess(list.id, requestingUserId);
      if (!hasAccess) return null;

      // For list-linked items, ensure userId is either:
      // 1. The list owner (most common case - items go to owner's inventory)
      // 2. The requesting user (if they're adding to their own inventory)
      // 3. A valid family member of the list
      if (targetUserId !== list.userId && targetUserId !== requestingUserId) {
        // Check if target user is a family member of this list
        if (list.familyId) {
          const memberCheck = await db
            .select()
            .from(familyMembers)
            .where(
              and(
                eq(familyMembers.familyId, list.familyId),
                eq(familyMembers.userId, targetUserId)
              )
            );
          
          if (!memberCheck.length) return null;
        } else {
          return null;
        }
      }
    }
    // If no source item, verify the item is being added by the user who will own it
    else if (targetUserId !== requestingUserId) {
      return null;
    }

    const normalizedName = normalizeIngredientName(item.name);
    const result = await db.insert(inventoryReviewQueue).values({
      ...item,
      normalizedName,
    }).returning();
    return result[0];
  },

  async getPendingReviewItems(userId: string): Promise<InventoryReviewQueue[]> {
    return await db
      .select()
      .from(inventoryReviewQueue)
      .where(
        and(
          eq(inventoryReviewQueue.userId, userId),
          eq(inventoryReviewQueue.status, 'pending')
        )
      )
      .orderBy(desc(inventoryReviewQueue.createdAt));
  },

  async approveReviewItem(itemId: string, reviewerUserId: string): Promise<{ reviewItem: InventoryReviewQueue; inventoryItem: KitchenInventory } | null> {
    return await db.transaction(async (tx) => {
      // Get the review item and verify authorization through shopping list ownership
      const reviewData = await tx
        .select({
          review: inventoryReviewQueue,
          sourceItem: shoppingListItems,
          list: shoppingLists,
        })
        .from(inventoryReviewQueue)
        .leftJoin(shoppingListItems, eq(inventoryReviewQueue.sourceItemId, shoppingListItems.id))
        .leftJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
        .where(
          and(
            eq(inventoryReviewQueue.id, itemId),
            eq(inventoryReviewQueue.status, 'pending')
          )
        );
      
      if (!reviewData.length) return null;

      const { review, list } = reviewData[0];

      // Verify user is authorized (either list owner or family member)
      if (list) {
        const isOwner = list.userId === reviewerUserId;
        
        // Check if user is family member if this is a family list
        let isFamilyMember = false;
        if (list.familyId && !isOwner) {
          const memberCheck = await tx
            .select()
            .from(familyMembers)
            .where(
              and(
                eq(familyMembers.familyId, list.familyId),
                eq(familyMembers.userId, reviewerUserId)
              )
            );
          isFamilyMember = memberCheck.length > 0;
        }

        if (!isOwner && !isFamilyMember) return null;
      } else {
        // No linked shopping list, verify it's the original submitter
        if (review.userId !== reviewerUserId) return null;
      }

      // Mark review item as approved
      const reviewResult = await tx
        .update(inventoryReviewQueue)
        .set({
          status: 'approved',
          reviewerId: reviewerUserId,
          reviewedAt: new Date(),
        })
        .where(eq(inventoryReviewQueue.id, itemId))
        .returning();
      
      const reviewItem = reviewResult[0];

      // Create kitchen inventory item
      const inventoryResult = await tx
        .insert(kitchenInventory)
        .values({
          userId: reviewItem.userId,
          name: reviewItem.name,
          normalizedName: reviewItem.normalizedName,
          quantity: reviewItem.quantity || '1',
          unit: reviewItem.unit,
          category: reviewItem.categoryGuess || 'fridge',
          sourceItemId: reviewItem.sourceItemId,
        })
        .returning();

      const inventoryItem = inventoryResult[0];

      // Mark source shopping item as bought if it exists
      if (reviewItem.sourceItemId) {
        await tx
          .update(shoppingListItems)
          .set({ 
            status: 'bought',
            boughtAt: new Date(),
          })
          .where(eq(shoppingListItems.id, reviewItem.sourceItemId));
      }

      return { reviewItem, inventoryItem };
    });
  },

  async rejectReviewItem(itemId: string, reviewerUserId: string): Promise<InventoryReviewQueue | null> {
    return await db.transaction(async (tx) => {
      // Get the review item and verify authorization through shopping list ownership
      const reviewData = await tx
        .select({
          review: inventoryReviewQueue,
          sourceItem: shoppingListItems,
          list: shoppingLists,
        })
        .from(inventoryReviewQueue)
        .leftJoin(shoppingListItems, eq(inventoryReviewQueue.sourceItemId, shoppingListItems.id))
        .leftJoin(shoppingLists, eq(shoppingListItems.listId, shoppingLists.id))
        .where(
          and(
            eq(inventoryReviewQueue.id, itemId),
            eq(inventoryReviewQueue.status, 'pending')
          )
        );
      
      if (!reviewData.length) return null;

      const { review, list } = reviewData[0];

      // Verify user is authorized (either list owner or family member)
      if (list) {
        const isOwner = list.userId === reviewerUserId;
        
        // Check if user is family member if this is a family list
        let isFamilyMember = false;
        if (list.familyId && !isOwner) {
          const memberCheck = await tx
            .select()
            .from(familyMembers)
            .where(
              and(
                eq(familyMembers.familyId, list.familyId),
                eq(familyMembers.userId, reviewerUserId)
              )
            );
          isFamilyMember = memberCheck.length > 0;
        }

        if (!isOwner && !isFamilyMember) return null;
      } else {
        // No linked shopping list, verify it's the original submitter
        if (review.userId !== reviewerUserId) return null;
      }

      // Mark review item as rejected
      const reviewResult = await tx
        .update(inventoryReviewQueue)
        .set({
          status: 'rejected',
          reviewerId: reviewerUserId,
          reviewedAt: new Date(),
        })
        .where(eq(inventoryReviewQueue.id, itemId))
        .returning();
      
      const reviewItem = reviewResult[0];

      // Reactivate source shopping item if it exists
      if (reviewItem.sourceItemId) {
        await tx
          .update(shoppingListItems)
          .set({ status: 'active' })
          .where(eq(shoppingListItems.id, reviewItem.sourceItemId));
      }

      return reviewItem;
    });
  },

  // Notifications
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  },

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          isNull(notifications.readAt)
        )
      )
      .orderBy(desc(notifications.createdAt));
  },

  async getRecentNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientUserId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async markNotificationAsRead(notificationId: string, userId: string): Promise<{ status: "ok" | "not_found" | "forbidden"; data?: Notification }> {
    // First check if notification exists
    const existing = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationId));
    
    if (!existing.length) {
      return { status: "not_found" };
    }
    
    // Check if user owns the notification
    if (existing[0].recipientUserId !== userId) {
      return { status: "forbidden" };
    }
    
    // Update the notification
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.recipientUserId, userId)
        )
      )
      .returning();
    
    return { status: "ok", data: result[0] };
  },

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientUserId, userId),
          isNull(notifications.readAt)
        )
      );
  },

  // ============= MEAL SEAT MANAGEMENT =============

  async isUserFamilyMember(userId: string, familyId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.userId, userId),
          eq(familyMembers.familyId, familyId)
        )
      )
      .limit(1);
    return result.length > 0;
  },

  async userHasMealPlanAccess(userId: string, planId: string): Promise<boolean> {
    // Get the meal plan
    const plan = await db
      .select()
      .from(mealPlans)
      .where(eq(mealPlans.id, planId))
      .limit(1);

    if (!plan.length) {
      return false;
    }

    // Check if user owns the plan
    if (plan[0].userId === userId) {
      return true;
    }

    // Check if user is a family member
    if (plan[0].familyId) {
      return await this.isUserFamilyMember(userId, plan[0].familyId);
    }

    return false;
  },

  async getMealPlanByDate(params: {
    userId?: string;
    familyId?: string;
    date: string;
  }): Promise<{
    mealPlan: MealPlan;
    seats: Array<{
      seat: MealPlanSeat;
      assignment?: {
        recipeId: string;
        recipeName: string;
        recipeImage: string | null;
      };
    }>;
  } | null> {
    // Find meal plan for the date
    const conditions = [
      sql`DATE(${mealPlans.scheduledFor}) = ${params.date}`
    ];

    if (params.familyId) {
      conditions.push(eq(mealPlans.familyId, params.familyId));
    } else if (params.userId) {
      conditions.push(eq(mealPlans.userId, params.userId));
    }

    const mealPlan = await db
      .select()
      .from(mealPlans)
      .where(and(...conditions))
      .limit(1);

    if (!mealPlan.length) {
      return null;
    }

    // Get all seats for this meal plan
    const seats = await db
      .select()
      .from(mealPlanSeats)
      .where(eq(mealPlanSeats.mealPlanId, mealPlan[0].id))
      .orderBy(mealPlanSeats.seatNumber);

    // Get assignments and recipe details for each seat
    const seatsWithAssignments = await Promise.all(
      seats.map(async (seat) => {
        const assignment = await db
          .select({
            assignment: mealSeatAssignments,
            recipe: recipes,
          })
          .from(mealSeatAssignments)
          .innerJoin(recipes, eq(mealSeatAssignments.recipeId, recipes.id))
          .where(eq(mealSeatAssignments.seatId, seat.id))
          .limit(1);

        if (assignment.length > 0) {
          return {
            seat,
            assignment: {
              recipeId: assignment[0].recipe.id,
              recipeName: assignment[0].recipe.name,
              recipeImage: assignment[0].recipe.imageUrl,
            },
          };
        }

        return { seat };
      })
    );

    return {
      mealPlan: mealPlan[0],
      seats: seatsWithAssignments,
    };
  },

  async upsertMealPlanWithSeats(params: {
    userId?: string;
    familyId?: string;
    date: string;
    seats: Array<{
      seatNumber: number;
      dietaryRestrictions: string[];
      recipeId?: string;
    }>;
  }): Promise<{
    mealPlan: MealPlan;
    seats: MealPlanSeat[];
  }> {
    return await db.transaction(async (tx) => {
      // Check for existing meal plan on this date
      const dateConditions = [
        sql`DATE(${mealPlans.scheduledFor}) = ${params.date}`
      ];

      if (params.familyId) {
        dateConditions.push(eq(mealPlans.familyId, params.familyId));
      } else if (params.userId) {
        dateConditions.push(eq(mealPlans.userId, params.userId));
      }

      const existing = await tx
        .select()
        .from(mealPlans)
        .where(and(...dateConditions))
        .limit(1);

      let mealPlanId: string;
      
      // Determine recipeId for meal plan (use seat 1's recipe or first assigned recipe)
      const primaryRecipeId = params.seats.find(s => s.recipeId)?.recipeId;
      
      if (!primaryRecipeId) {
        throw new Error("At least one seat must have a recipe assigned");
      }

      if (existing.length > 0) {
        // Update existing meal plan
        const updated = await tx
          .update(mealPlans)
          .set({
            recipeId: primaryRecipeId,
          })
          .where(eq(mealPlans.id, existing[0].id))
          .returning();
        mealPlanId = updated[0].id;
      } else {
        // Create new meal plan
        const created = await tx
          .insert(mealPlans)
          .values({
            userId: params.userId,
            familyId: params.familyId,
            recipeId: primaryRecipeId,
            scheduledFor: new Date(params.date),
          })
          .returning();
        mealPlanId = created[0].id;
      }

      // Get existing seats
      const existingSeats = await tx
        .select()
        .from(mealPlanSeats)
        .where(eq(mealPlanSeats.mealPlanId, mealPlanId));

      // Delete seats that exceed the new seat count
      const maxSeatNumber = Math.max(...params.seats.map(s => s.seatNumber));
      const seatsToDelete = existingSeats.filter(s => s.seatNumber > maxSeatNumber);
      
      if (seatsToDelete.length > 0) {
        await tx
          .delete(mealPlanSeats)
          .where(
            inArray(
              mealPlanSeats.id,
              seatsToDelete.map(s => s.id)
            )
          );
      }

      // Upsert each seat
      const updatedSeats: MealPlanSeat[] = [];
      
      for (const seatData of params.seats) {
        const existingSeat = existingSeats.find(s => s.seatNumber === seatData.seatNumber);

        let seat: MealPlanSeat;
        
        if (existingSeat) {
          // Update existing seat
          const updated = await tx
            .update(mealPlanSeats)
            .set({
              dietaryRestrictions: seatData.dietaryRestrictions,
            })
            .where(eq(mealPlanSeats.id, existingSeat.id))
            .returning();
          seat = updated[0];
        } else {
          // Create new seat
          const created = await tx
            .insert(mealPlanSeats)
            .values({
              mealPlanId,
              seatNumber: seatData.seatNumber,
              dietaryRestrictions: seatData.dietaryRestrictions,
            })
            .returning();
          seat = created[0];
        }

        updatedSeats.push(seat);

        // Handle recipe assignment
        if (seatData.recipeId) {
          // Check if assignment exists
          const existingAssignment = await tx
            .select()
            .from(mealSeatAssignments)
            .where(eq(mealSeatAssignments.seatId, seat.id))
            .limit(1);

          if (existingAssignment.length > 0) {
            // Update existing assignment
            await tx
              .update(mealSeatAssignments)
              .set({ recipeId: seatData.recipeId })
              .where(eq(mealSeatAssignments.seatId, seat.id));
          } else {
            // Create new assignment
            await tx
              .insert(mealSeatAssignments)
              .values({
                seatId: seat.id,
                recipeId: seatData.recipeId,
              });
          }
        } else {
          // Clear assignment if recipeId is not provided
          await tx
            .delete(mealSeatAssignments)
            .where(eq(mealSeatAssignments.seatId, seat.id));
        }
      }

      // Get the final meal plan
      const finalMealPlan = await tx
        .select()
        .from(mealPlans)
        .where(eq(mealPlans.id, mealPlanId))
        .limit(1);

      return {
        mealPlan: finalMealPlan[0],
        seats: updatedSeats,
      };
    });
  },

  async assignRecipeToSeat(params: {
    seatId: string;
    recipeId: string;
  }): Promise<MealSeatAssignment> {
    // Check if assignment already exists
    const existing = await db
      .select()
      .from(mealSeatAssignments)
      .where(eq(mealSeatAssignments.seatId, params.seatId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing assignment
      const updated = await db
        .update(mealSeatAssignments)
        .set({ recipeId: params.recipeId })
        .where(eq(mealSeatAssignments.seatId, params.seatId))
        .returning();
      return updated[0];
    } else {
      // Create new assignment
      const created = await db
        .insert(mealSeatAssignments)
        .values({
          seatId: params.seatId,
          recipeId: params.recipeId,
        })
        .returning();
      return created[0];
    }
  },

  async clearSeatAssignment(seatId: string): Promise<void> {
    await db
      .delete(mealSeatAssignments)
      .where(eq(mealSeatAssignments.seatId, seatId));
  },

  async getShoppingListSuggestions(userId: string): Promise<Array<{
    name: string;
    quantity: string;
    unit: string;
    imageUrl?: string;
    recipeNames: string[];
  }>> {
    // Get upcoming meal plans (next 7 days)
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const upcomingMealPlans = await db
      .select()
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.userId, userId),
          sql`${mealPlans.scheduledFor} >= ${today.toISOString()}`,
          sql`${mealPlans.scheduledFor} <= ${nextWeek.toISOString()}`
        )
      );

    if (upcomingMealPlans.length === 0) {
      return [];
    }

    // Get all seats for these meal plans
    const mealPlanIds = upcomingMealPlans.map(mp => mp.id);
    const seats = await db
      .select()
      .from(mealPlanSeats)
      .where(inArray(mealPlanSeats.mealPlanId, mealPlanIds));

    // Get all recipe assignments for these seats
    const seatIds = seats.map(s => s.id);
    const assignments = await db
      .select({
        assignment: mealSeatAssignments,
        recipe: recipes,
      })
      .from(mealSeatAssignments)
      .innerJoin(recipes, eq(mealSeatAssignments.recipeId, recipes.id))
      .where(inArray(mealSeatAssignments.seatId, seatIds));

    // Extract all ingredients from recipes with recipe names
    interface IngredientWithRecipe {
      name: string;
      amount: string;
      unit: string;
      imageUrl?: string;
      recipeName: string;
    }

    const allIngredients: IngredientWithRecipe[] = [];
    
    for (const { recipe } of assignments) {
      const recipeIngredients = (recipe.ingredients as any) || [];
      for (const ing of recipeIngredients) {
        allIngredients.push({
          name: ing.name,
          amount: ing.amount || "1",
          unit: ing.unit || "",
          imageUrl: ing.imageUrl,
          recipeName: recipe.name,
        });
      }
    }

    // Get current kitchen inventory (normalized names)
    const inventory = await this.getKitchenInventory(userId);
    const inventorySet = new Set(
      inventory.map(item => item.normalizedName).filter(Boolean)
    );

    // Filter out ingredients we already have
    const missingIngredients = allIngredients.filter(ing => {
      const normalized = normalizeIngredientName(ing.name);
      return !inventorySet.has(normalized);
    });

    // Group by ingredient name and aggregate recipes
    const grouped = new Map<string, {
      name: string;
      quantity: string;
      unit: string;
      imageUrl?: string;
      recipeNames: Set<string>;
    }>();

    for (const ing of missingIngredients) {
      const normalized = normalizeIngredientName(ing.name);
      if (!grouped.has(normalized)) {
        grouped.set(normalized, {
          name: ing.name,
          quantity: ing.amount,
          unit: ing.unit,
          imageUrl: ing.imageUrl,
          recipeNames: new Set([ing.recipeName]),
        });
      } else {
        // Add recipe name to existing ingredient
        grouped.get(normalized)!.recipeNames.add(ing.recipeName);
      }
    }

    // Convert to array and transform Set to Array
    return Array.from(grouped.values()).map(item => ({
      ...item,
      recipeNames: Array.from(item.recipeNames),
    }));
  },

  // ============= POLLS FOR YOU FEED =============

  async getRandomUnansweredPoll(userId: string): Promise<import("@shared/schema").PollQuestion | null> {
    const { pollQuestions, userPollResponses } = await import('@shared/schema');
    const { notInArray } = await import('drizzle-orm');
    
    // Get polls the user hasn't answered yet
    const answeredPollIds = await db
      .select({ pollId: userPollResponses.pollId })
      .from(userPollResponses)
      .where(eq(userPollResponses.userId, userId));
    
    const answeredIds = answeredPollIds.map(p => p.pollId);
    
    // Get a random unanswered poll
    let polls;
    
    if (answeredIds.length > 0) {
      polls = await db
        .select()
        .from(pollQuestions)
        .where(
          and(
            eq(pollQuestions.isActive, true),
            notInArray(pollQuestions.id, answeredIds)
          )
        )
        .limit(10);
    } else {
      polls = await db
        .select()
        .from(pollQuestions)
        .where(eq(pollQuestions.isActive, true))
        .limit(10);
    }
    
    if (polls.length === 0) return null;
    
    // Return a random poll from the results
    const randomIndex = Math.floor(Math.random() * polls.length);
    return polls[randomIndex];
  },

  async submitPollResponse(params: import("@shared/schema").InsertUserPollResponse): Promise<import("@shared/schema").UserPollResponse> {
    const { userPollResponses } = await import('@shared/schema');
    
    const result = await db
      .insert(userPollResponses)
      .values(params)
      .onConflictDoUpdate({
        target: [userPollResponses.userId, userPollResponses.pollId],
        set: {
          selectedOption: params.selectedOption,
          respondedAt: new Date(),
        },
      })
      .returning();
    
    return result[0];
  },

  async getUserPollResponses(userId: string): Promise<import("@shared/schema").UserPollResponse[]> {
    const { userPollResponses } = await import('@shared/schema');
    
    return await db
      .select()
      .from(userPollResponses)
      .where(eq(userPollResponses.userId, userId));
  },

  // ============= FOR YOU FEED =============

  async getFeaturedRecipes(limit: number = 10): Promise<Recipe[]> {
    // Get highly rated recipes for stories
    return await db
      .select()
      .from(recipes)
      .where(sql`${recipes.imageUrl} IS NOT NULL`)
      .orderBy(sql`RANDOM()`)
      .limit(limit);
  },

  // ============= SIDEBAR WIDGETS =============

  async getFridgeStatus(userId: string): Promise<{
    status: 'needs_restock' | 'filled';
    totalItems: number;
    expiringCount: number;
  }> {
    const inventory = await this.getKitchenInventory(userId);
    
    // Count items expiring in next 3 days
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    
    const expiringItems = inventory.filter(item => 
      item.expirationDate && 
      new Date(item.expirationDate) <= threeDaysFromNow
    );
    
    const status = inventory.length < 5 ? 'needs_restock' : 'filled';
    
    return {
      status,
      totalItems: inventory.length,
      expiringCount: expiringItems.length,
    };
  },

  async getUpcomingDinners(userId: string, limit: number = 5): Promise<Array<{
    id: string;
    recipeName: string;
    recipeImage: string | null;
    scheduledFor: Date;
    isApproved: boolean;
    voteCount: number;
  }>> {
    const now = new Date();
    
    const dinners = await db
      .select({
        id: mealPlans.id,
        recipeName: recipes.name,
        recipeImage: recipes.imageUrl,
        scheduledFor: mealPlans.scheduledFor,
        isApproved: mealPlans.isApproved,
        voteCount: sql<number>`COUNT(DISTINCT ${mealVotes.id})`.as('vote_count'),
      })
      .from(mealPlans)
      .innerJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .leftJoin(mealVotes, eq(mealVotes.mealPlanId, mealPlans.id))
      .where(
        and(
          eq(mealPlans.userId, userId),
          sql`${mealPlans.scheduledFor} >= ${now.toISOString()}`
        )
      )
      .groupBy(
        mealPlans.id,
        mealPlans.scheduledFor,
        mealPlans.isApproved,
        recipes.id,
        recipes.name,
        recipes.imageUrl
      )
      .orderBy(mealPlans.scheduledFor)
      .limit(limit);
    
    return dinners.map(d => ({
      id: d.id,
      recipeName: d.recipeName,
      recipeImage: d.recipeImage,
      scheduledFor: d.scheduledFor!,
      isApproved: d.isApproved!,
      voteCount: Number(d.voteCount),
    }));
  },

  async getFamilyMembersStatus(userId: string): Promise<Array<{
    userId: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    isOnline: boolean;
  }>> {
    // Get user's family
    const userFamily = await db
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId))
      .limit(1);
    
    if (userFamily.length === 0) {
      return [];
    }
    
    const familyId = userFamily[0].familyId;
    
    // Get all family members (excluding current user)
    const members = await db
      .select({
        user: users,
      })
      .from(familyMembers)
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          sql`${users.id} != ${userId}`
        )
      );
    
    return members.map(m => ({
      userId: m.user.id,
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      profileImageUrl: m.user.profileImageUrl,
      isOnline: false, // Placeholder - will implement WebSocket real-time status later
    }));
  },

  async getUpcomingMealPlanRSVPs(userId: string, limit: number = 5): Promise<Array<{
    mealPlanId: string;
    recipeName: string;
    scheduledFor: Date;
    rsvps: Array<{
      userId: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
    }>;
  }>> {
    const { mealPlanRSVPs } = await import('@shared/schema');
    const now = new Date();
    
    const upcomingMeals = await db
      .select({
        mealPlan: mealPlans,
        recipe: recipes,
      })
      .from(mealPlans)
      .innerJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .where(
        and(
          eq(mealPlans.userId, userId),
          sql`${mealPlans.scheduledFor} >= ${now.toISOString()}`,
          eq(mealPlans.isApproved, true)
        )
      )
      .orderBy(mealPlans.scheduledFor)
      .limit(limit);
    
    const result = [];
    
    for (const meal of upcomingMeals) {
      const rsvps = await db
        .select({
          rsvp: mealPlanRSVPs,
          user: users,
        })
        .from(mealPlanRSVPs)
        .innerJoin(users, eq(mealPlanRSVPs.userId, users.id))
        .where(eq(mealPlanRSVPs.mealPlanId, meal.mealPlan.id));
      
      result.push({
        mealPlanId: meal.mealPlan.id,
        recipeName: meal.recipe.name,
        scheduledFor: meal.mealPlan.scheduledFor!,
        rsvps: rsvps.map(r => ({
          userId: r.user.id,
          firstName: r.user.firstName,
          lastName: r.user.lastName,
          status: r.rsvp.status,
        })),
      });
    }
    
    return result;
  },

  async upsertMealPlanRSVP(params: import("@shared/schema").InsertMealPlanRSVP): Promise<import("@shared/schema").MealPlanRSVP> {
    const { mealPlanRSVPs } = await import('@shared/schema');
    
    const result = await db
      .insert(mealPlanRSVPs)
      .values(params)
      .onConflictDoUpdate({
        target: [mealPlanRSVPs.mealPlanId, mealPlanRSVPs.userId],
        set: {
          status: params.status,
          rsvpedAt: new Date(),
        },
      })
      .returning();
    
    return result[0];
  },

  // Cooking Sessions
  async createCookingSession(params: import("@shared/schema").InsertCookingSession): Promise<import("@shared/schema").CookingSession> {
    const { cookingSessions } = await import('@shared/schema');
    
    const result = await db
      .insert(cookingSessions)
      .values({
        ...params,
        startedAt: new Date(),
        lastInteractionAt: new Date(),
      })
      .returning();
    
    return result[0];
  },

  async getActiveCookingSession(userId: string): Promise<import("@shared/schema").CookingSession | null> {
    const { cookingSessions } = await import('@shared/schema');
    
    const result = await db
      .select()
      .from(cookingSessions)
      .where(
        and(
          eq(cookingSessions.userId, userId),
          or(
            eq(cookingSessions.status, 'active'),
            eq(cookingSessions.status, 'paused')
          )
        )
      )
      .orderBy(cookingSessions.lastInteractionAt)
      .limit(1);
    
    return result[0] || null;
  },

  async updateCookingSessionProgress(sessionId: string, params: {
    currentStep?: number;
    status?: 'active' | 'paused' | 'completed' | 'abandoned';
    timers?: import("@shared/schema").CookingTimer[];
  }): Promise<import("@shared/schema").CookingSession> {
    const { cookingSessions } = await import('@shared/schema');
    
    const updateData: any = {
      lastInteractionAt: new Date(),
    };
    
    if (params.currentStep !== undefined) {
      updateData.currentStep = params.currentStep;
    }
    if (params.status !== undefined) {
      updateData.status = params.status;
      if (params.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    if (params.timers !== undefined) {
      updateData.timers = params.timers;
    }
    
    const result = await db
      .update(cookingSessions)
      .set(updateData)
      .where(eq(cookingSessions.id, sessionId))
      .returning();
    
    return result[0];
  },

  async completeCookingSession(sessionId: string, deductIngredients: boolean = false): Promise<{
    session: import("@shared/schema").CookingSession;
    ingredientsDeducted: boolean;
  }> {
    const { cookingSessions, recipes } = await import('@shared/schema');
    
    // Mark session as completed
    const sessionResult = await db
      .update(cookingSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        ingredientsDeductedAt: deductIngredients ? new Date() : null,
      })
      .where(eq(cookingSessions.id, sessionId))
      .returning();
    
    const session = sessionResult[0];
    
    // TODO: Implement ingredient deduction logic
    // This would require:
    // 1. Get recipe ingredients
    // 2. Match with kitchen inventory
    // 3. Deduct quantities
    // For now, just mark the timestamp
    
    return {
      session,
      ingredientsDeducted: deductIngredients,
    };
  },

  // Nutrition Tracking
  async getOrCreateNutritionLog(userId: string, date: string, txClient?: any): Promise<import("@shared/schema").NutritionLog> {
    const { nutritionLogs } = await import('@shared/schema');
    const dbClient = txClient || db;
    
    // Try to get existing log
    const existing = await dbClient
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          eq(nutritionLogs.date, date)
        )
      )
      .limit(1);
    
    if (existing[0]) {
      return existing[0];
    }
    
    // Create new log
    const result = await dbClient
      .insert(nutritionLogs)
      .values({
        userId,
        date,
        totalCalories: 0,
        totalSodium: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      })
      .returning();
    
    return result[0];
  },

  async addMealToNutritionLog(params: {
    userId: string;
    date: string;
    recipeId: string;
    portionSize: number;
    mealType: string;
  }): Promise<import("@shared/schema").NutritionLogMeal> {
    const { nutritionLogs, nutritionLogMeals, recipes } = await import('@shared/schema');
    
    return await db.transaction(async (tx) => {
      // Get or create the daily log within this transaction
      const log = await storage.getOrCreateNutritionLog(params.userId, params.date, tx);
      
      // Get recipe nutrition data
      const recipe = await tx
        .select()
        .from(recipes)
        .where(eq(recipes.id, params.recipeId))
        .limit(1);
      
      if (!recipe[0]) {
        throw new Error('Recipe not found');
      }
      
      const r = recipe[0];
      const portion = params.portionSize;
      
      // Calculate nutrition values based on portion size
      const mealCalories = Math.round((r.calories || 0) * portion);
      const mealProtein = Math.round((r.protein || 0) * portion);
      const mealCarbs = Math.round((r.carbs || 0) * portion);
      const mealFat = Math.round((r.fat || 0) * portion);
      const mealSodium = Math.round((r.sodium || 0) * portion);
      
      // Add meal to log
      const mealResult = await tx
        .insert(nutritionLogMeals)
        .values({
          nutritionLogId: log.id,
          recipeId: params.recipeId,
          portionSize: params.portionSize.toString(),
          calories: mealCalories,
          protein: mealProtein,
          carbs: mealCarbs,
          fat: mealFat,
          sodium: mealSodium,
          mealType: params.mealType,
        })
        .returning();
      
      // Recalculate totals
      const allMeals = await tx
        .select()
        .from(nutritionLogMeals)
        .where(eq(nutritionLogMeals.nutritionLogId, log.id));
      
      const totals = allMeals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.protein || 0),
        carbs: acc.carbs + (meal.carbs || 0),
        fat: acc.fat + (meal.fat || 0),
        sodium: acc.sodium + (meal.sodium || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 });
      
      // Update log totals
      await tx
        .update(nutritionLogs)
        .set({
          totalCalories: totals.calories,
          totalProtein: totals.protein,
          totalCarbs: totals.carbs,
          totalFat: totals.fat,
          totalSodium: totals.sodium,
          updatedAt: new Date(),
        })
        .where(eq(nutritionLogs.id, log.id));
      
      return mealResult[0];
    });
  },

  async getNutritionLogByDate(userId: string, date: string): Promise<import("@shared/schema").NutritionLog | null> {
    const { nutritionLogs } = await import('@shared/schema');
    
    const result = await db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          eq(nutritionLogs.date, date)
        )
      )
      .limit(1);
    
    return result[0] || null;
  },

  async getNutritionLogMeals(nutritionLogId: string): Promise<any[]> {
    const { nutritionLogMeals, recipes } = await import('@shared/schema');
    
    const meals = await db
      .select({
        id: nutritionLogMeals.id,
        nutritionLogId: nutritionLogMeals.nutritionLogId,
        recipeId: nutritionLogMeals.recipeId,
        portionSize: nutritionLogMeals.portionSize,
        mealType: nutritionLogMeals.mealType,
        loggedAt: nutritionLogMeals.loggedAt,
        calories: nutritionLogMeals.calories,
        protein: nutritionLogMeals.protein,
        carbs: nutritionLogMeals.carbs,
        fat: nutritionLogMeals.fat,
        sodium: nutritionLogMeals.sodium,
        recipeName: recipes.name,
      })
      .from(nutritionLogMeals)
      .leftJoin(recipes, eq(nutritionLogMeals.recipeId, recipes.id))
      .where(eq(nutritionLogMeals.nutritionLogId, nutritionLogId))
      .orderBy(desc(nutritionLogMeals.loggedAt));
    
    return meals;
  },

  async getNutritionLogsByDateRange(userId: string, startDate: string, endDate: string): Promise<import("@shared/schema").NutritionLog[]> {
    const { nutritionLogs } = await import('@shared/schema');
    
    return await db
      .select()
      .from(nutritionLogs)
      .where(
        and(
          eq(nutritionLogs.userId, userId),
          gte(nutritionLogs.date, startDate),
          sql`${nutritionLogs.date} <= ${endDate}`
        )
      )
      .orderBy(desc(nutritionLogs.date));
  },

  async getWeeklySummary(userId: string, endDate: string): Promise<{
    logs: import("@shared/schema").NutritionLog[];
    averages: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      sodium: number;
    };
    totals: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      sodium: number;
    };
  }> {
    // Calculate start date (7 days before end date)
    const end = new Date(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    const startDate = start.toISOString().split('T')[0];
    
    const logs = await storage.getNutritionLogsByDateRange(userId, startDate, endDate);
    
    const totals = logs.reduce((acc, log) => ({
      calories: acc.calories + (log.totalCalories || 0),
      protein: acc.protein + (log.totalProtein || 0),
      carbs: acc.carbs + (log.totalCarbs || 0),
      fat: acc.fat + (log.totalFat || 0),
      sodium: acc.sodium + (log.totalSodium || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, sodium: 0 });
    
    const daysWithData = logs.length || 1; // Avoid division by zero
    const averages = {
      calories: Math.round(totals.calories / daysWithData),
      protein: Math.round(totals.protein / daysWithData),
      carbs: Math.round(totals.carbs / daysWithData),
      fat: Math.round(totals.fat / daysWithData),
      sodium: Math.round(totals.sodium / daysWithData),
    };
    
    return { logs, totals, averages };
  },

  // Events (MVP+ feature)
  async createEvent(params: import("@shared/schema").InsertEvent): Promise<import("@shared/schema").Event> {
    const { events } = await import('@shared/schema');
    
    const result = await db
      .insert(events)
      .values(params)
      .returning();
    
    return result[0];
  },

  async getEvents(userId: string): Promise<import("@shared/schema").Event[]> {
    const { events, familyMembers } = await import('@shared/schema');
    
    // Get user's family IDs
    const userFamilies = await db
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));
    
    const familyIds = userFamilies.map(f => f.familyId).filter(id => id !== null);
    
    // Get events owned by user OR events in user's families (excluding NULL familyId)
    const allEvents = await db
      .select()
      .from(events)
      .where(
        familyIds.length > 0
          ? or(
              eq(events.userId, userId),
              and(
                isNotNull(events.familyId),
                inArray(events.familyId, familyIds)
              )
            )
          : eq(events.userId, userId)
      )
      .orderBy(desc(events.scheduledFor));
    
    return allEvents;
  },

  async getEventById(eventId: string): Promise<import("@shared/schema").Event | null> {
    const { events } = await import('@shared/schema');
    
    const result = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);
    
    return result[0] || null;
  },

  async updateEvent(eventId: string, params: Partial<import("@shared/schema").InsertEvent>): Promise<import("@shared/schema").Event> {
    const { events } = await import('@shared/schema');
    
    const result = await db
      .update(events)
      .set(params)
      .where(eq(events.id, eventId))
      .returning();
    
    return result[0];
  },

  async deleteEvent(eventId: string): Promise<void> {
    const { events } = await import('@shared/schema');
    
    await db
      .delete(events)
      .where(eq(events.id, eventId));
  },

  async addMealToEvent(params: {
    eventId: string;
    mealPlanId: string;
    dishType?: string;
  }): Promise<import("@shared/schema").EventMealPlan> {
    const { eventMealPlans } = await import('@shared/schema');
    
    const result = await db
      .insert(eventMealPlans)
      .values(params)
      .returning();
    
    return result[0];
  },

  async getEventMeals(eventId: string): Promise<any[]> {
    const { eventMealPlans, mealPlans, recipes } = await import('@shared/schema');
    
    const meals = await db
      .select({
        id: eventMealPlans.id,
        eventId: eventMealPlans.eventId,
        mealPlanId: eventMealPlans.mealPlanId,
        dishType: eventMealPlans.dishType,
        recipeName: recipes.name,
        recipeId: recipes.id,
        recipeImageUrl: recipes.imageUrl,
        scheduledFor: mealPlans.scheduledFor,
      })
      .from(eventMealPlans)
      .leftJoin(mealPlans, eq(eventMealPlans.mealPlanId, mealPlans.id))
      .leftJoin(recipes, eq(mealPlans.recipeId, recipes.id))
      .where(eq(eventMealPlans.eventId, eventId))
      .orderBy(eventMealPlans.dishType);
    
    return meals;
  },

  async removeMealFromEvent(eventMealPlanId: string): Promise<void> {
    const { eventMealPlans } = await import('@shared/schema');
    
    await db
      .delete(eventMealPlans)
      .where(eq(eventMealPlans.id, eventMealPlanId));
  },
};

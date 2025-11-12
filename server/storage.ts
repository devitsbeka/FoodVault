import { db } from "./db";
import { eq, and, gte, desc, sql, inArray, isNull, or } from "drizzle-orm";
import type { UpsertUser, User, InsertKitchenInventory, KitchenInventory, InsertRecipe, Recipe, InsertMealPlan, MealPlan, InsertMealVote, MealVote, InsertChatMessage, ChatMessage, InsertRecipeRating, RecipeRating, InsertFamily, Family, InsertFamilyMember, FamilyMember, InsertShoppingList, ShoppingList, ShoppingListItem, InsertShoppingListItem, InventoryReviewQueue, InsertInventoryReviewQueue, Notification, InsertNotification } from "@shared/schema";
import { users, kitchenInventory, recipes, mealPlans, mealVotes, chatMessages, recipeRatings, families, familyMembers, shoppingLists, shoppingListItems, inventoryReviewQueue, notifications } from "@shared/schema";
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

  async getRecipes(filters?: {
    searchQuery?: string;
    dietType?: string;
    maxCalories?: number;
  }): Promise<any[]> {
    let query = db.select().from(recipes);
    
    const conditions = [];
    
    if (filters?.dietType && filters.dietType !== "all") {
      conditions.push(eq(recipes.dietType, filters.dietType));
    }
    
    if (filters?.maxCalories) {
      conditions.push(gte(recipes.calories, 0));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
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
    const userInventory = await this.getKitchenInventory(userId);
    const allRecipes = await db.select().from(recipes).limit(10);
    return allRecipes;
  },

  // Recipe Ratings
  async getRecipeRatings(recipeId: string): Promise<RecipeRating[]> {
    return await db.select().from(recipeRatings).where(eq(recipeRatings.recipeId, recipeId));
  },

  async addRecipeRating(rating: InsertRecipeRating): Promise<RecipeRating> {
    const result = await db.insert(recipeRatings).values(rating).returning();
    return result[0];
  },

  // Meal Plans
  async getMealPlans(userId: string): Promise<any[]> {
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
};

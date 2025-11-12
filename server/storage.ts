import { db } from "./db";
import { eq, and, gte, desc, sql, inArray } from "drizzle-orm";
import type { UpsertUser, User, InsertKitchenInventory, KitchenInventory, InsertRecipe, Recipe, InsertMealPlan, MealPlan, InsertMealVote, MealVote, InsertChatMessage, ChatMessage, InsertRecipeRating, RecipeRating, InsertFamily, Family, InsertFamilyMember, FamilyMember, InsertShoppingList, ShoppingList } from "@shared/schema";
import { users, kitchenInventory, recipes, mealPlans, mealVotes, chatMessages, recipeRatings, families, familyMembers, shoppingLists } from "@shared/schema";

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

  // Kitchen Inventory
  async getKitchenInventory(userId: string): Promise<KitchenInventory[]> {
    return await db.select().from(kitchenInventory).where(eq(kitchenInventory.userId, userId));
  },

  async addKitchenItem(item: InsertKitchenInventory): Promise<KitchenInventory> {
    const result = await db.insert(kitchenInventory).values(item).returning();
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
    return await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.userId, userId))
      .orderBy(desc(shoppingLists.updatedAt));
  },

  async createShoppingList(list: InsertShoppingList): Promise<ShoppingList> {
    const result = await db.insert(shoppingLists).values(list).returning();
    return result[0];
  },

  async updateShoppingList(id: string, userId: string, items: any): Promise<ShoppingList> {
    const result = await db
      .update(shoppingLists)
      .set({ items, updatedAt: new Date() })
      .where(
        and(
          eq(shoppingLists.id, id),
          eq(shoppingLists.userId, userId)
        )
      )
      .returning();
    return result[0];
  },

  async deleteShoppingList(id: string, userId: string): Promise<void> {
    await db.delete(shoppingLists).where(
      and(
        eq(shoppingLists.id, id),
        eq(shoppingLists.userId, userId)
      )
    );
  },
};

// Blueprint reference: javascript_log_in_with_replit, javascript_database
import { sql, relations } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============= REPLIT AUTH TABLES (MANDATORY) =============

// Session storage table - mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - mandatory for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  
  // User preferences
  allergies: text("allergies").array(),
  dietType: varchar("diet_type"), // vegetarian, vegan, keto, paleo, etc.
  calorieLimit: integer("calorie_limit"),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// ============= FAMILY MANAGEMENT =============

export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  voteThreshold: integer("vote_threshold").default(2), // Number of votes needed to approve a meal
  createdAt: timestamp("created_at").defaultNow(),
});

export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").default("member"), // admin, member
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  unique().on(table.familyId, table.userId)
]);

// ============= RECIPES =============

export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  imageUrl: varchar("image_url"),
  prepTime: integer("prep_time"), // minutes
  cookTime: integer("cook_time"), // minutes
  servings: integer("servings").default(4),
  calories: integer("calories"),
  dietType: varchar("diet_type"), // vegetarian, vegan, keto, etc.
  ingredients: jsonb("ingredients").notNull(), // [{name, amount, unit}]
  instructions: text("instructions").array(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const recipeRatings = pgTable("recipe_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  photoUrl: varchar("photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.recipeId, table.userId)
]);

// ============= KITCHEN INVENTORY =============

export const inventoryCategoryEnum = pgEnum('inventory_category', ['fridge', 'pantry', 'other']);

export const kitchenInventory = pgTable("kitchen_inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  category: inventoryCategoryEnum("category").default('fridge'),
  quantity: decimal("quantity").default("1"),
  unit: varchar("unit"), // cup, lb, oz, etc.
  expirationDate: timestamp("expiration_date"),
  addedAt: timestamp("added_at").defaultNow(),
});

// ============= MEAL PLANNING =============

export const mealPlans = pgTable("meal_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").references(() => families.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id), // for personal meal plans
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  scheduledFor: timestamp("scheduled_for").notNull(),
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mealVotes = pgTable("meal_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mealPlanId: varchar("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  vote: boolean("vote").notNull(), // true = upvote, false = downvote
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.mealPlanId, table.userId)
]);

// ============= AI CHAT =============

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").notNull(), // user, assistant
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============= SHOPPING LISTS =============

export const shoppingLists = pgTable("shopping_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").default("Shopping List"),
  items: jsonb("items").notNull(), // [{name, quantity, unit, checked}]
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============= RELATIONS =============

export const usersRelations = relations(users, ({ many }) => ({
  familyMemberships: many(familyMembers),
  kitchenInventory: many(kitchenInventory),
  mealPlans: many(mealPlans),
  mealVotes: many(mealVotes),
  recipeRatings: many(recipeRatings),
  chatMessages: many(chatMessages),
  shoppingLists: many(shoppingLists),
  createdFamilies: many(families),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  creator: one(users, {
    fields: [families.createdById],
    references: [users.id],
  }),
  members: many(familyMembers),
  mealPlans: many(mealPlans),
}));

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
}));

export const recipesRelations = relations(recipes, ({ many }) => ({
  ratings: many(recipeRatings),
  mealPlans: many(mealPlans),
}));

export const recipeRatingsRelations = relations(recipeRatings, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeRatings.recipeId],
    references: [recipes.id],
  }),
  user: one(users, {
    fields: [recipeRatings.userId],
    references: [users.id],
  }),
}));

export const mealPlansRelations = relations(mealPlans, ({ one, many }) => ({
  family: one(families, {
    fields: [mealPlans.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [mealPlans.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [mealPlans.recipeId],
    references: [recipes.id],
  }),
  votes: many(mealVotes),
}));

export const mealVotesRelations = relations(mealVotes, ({ one }) => ({
  mealPlan: one(mealPlans, {
    fields: [mealVotes.mealPlanId],
    references: [mealPlans.id],
  }),
  user: one(users, {
    fields: [mealVotes.userId],
    references: [users.id],
  }),
}));

// ============= INSERT SCHEMAS =============

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
});
export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  joinedAt: true,
});
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

export const insertRecipeSchema = createInsertSchema(recipes).omit({
  id: true,
  createdAt: true,
});
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Recipe = typeof recipes.$inferSelect;

export const insertRecipeRatingSchema = createInsertSchema(recipeRatings).omit({
  id: true,
  createdAt: true,
});
export type InsertRecipeRating = z.infer<typeof insertRecipeRatingSchema>;
export type RecipeRating = typeof recipeRatings.$inferSelect;

export const insertKitchenInventorySchema = createInsertSchema(kitchenInventory).omit({
  id: true,
  addedAt: true,
});
export type InsertKitchenInventory = z.infer<typeof insertKitchenInventorySchema>;
export type KitchenInventory = typeof kitchenInventory.$inferSelect;

export const insertMealPlanSchema = createInsertSchema(mealPlans).omit({
  id: true,
  createdAt: true,
});
export type InsertMealPlan = z.infer<typeof insertMealPlanSchema>;
export type MealPlan = typeof mealPlans.$inferSelect;

export const insertMealVoteSchema = createInsertSchema(mealVotes).omit({
  id: true,
  createdAt: true,
});
export type InsertMealVote = z.infer<typeof insertMealVoteSchema>;
export type MealVote = typeof mealVotes.$inferSelect;

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const insertShoppingListSchema = createInsertSchema(shoppingLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertShoppingList = z.infer<typeof insertShoppingListSchema>;
export type ShoppingList = typeof shoppingLists.$inferSelect;

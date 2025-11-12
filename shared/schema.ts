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

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password").notNull(), // hashed password
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
  cuisine: varchar("cuisine"), // italian, mexican, chinese, indian, etc.
  mealType: varchar("meal_type"), // breakfast, lunch, dinner, snack
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
  normalizedName: varchar("normalized_name"), // for consistent matching
  category: inventoryCategoryEnum("category").default('fridge'),
  quantity: decimal("quantity").default("1"),
  unit: varchar("unit"), // cup, lb, oz, etc.
  imageUrl: varchar("image_url"), // Spoonacular ingredient image
  expirationDate: timestamp("expiration_date"),
  sourceItemId: varchar("source_item_id"), // link to shopping list item
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
  familyId: varchar("family_id").references(() => families.id, { onDelete: 'cascade' }),
  name: varchar("name").default("Shopping List"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const itemStatusEnum = pgEnum('item_status', ['active', 'bought', 'pending_review']);

export const shoppingListItems = pgTable("shopping_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(),
  normalizedName: varchar("normalized_name"),
  quantity: varchar("quantity").default("1"),
  unit: varchar("unit"),
  imageUrl: varchar("image_url"), // Spoonacular ingredient image
  status: itemStatusEnum("status").default('active'),
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  addedByUserId: varchar("added_by_user_id").references(() => users.id),
  addedAt: timestamp("added_at").defaultNow(),
  boughtAt: timestamp("bought_at"),
});

// ============= PENDING REVIEW QUEUE =============

export const reviewStatusEnum = pgEnum('review_status', ['pending', 'approved', 'rejected']);

export const inventoryReviewQueue = pgTable("inventory_review_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceItemId: varchar("source_item_id").references(() => shoppingListItems.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  normalizedName: varchar("normalized_name"),
  quantity: varchar("quantity"),
  unit: varchar("unit"),
  imageUrl: varchar("image_url"), // Spoonacular ingredient image
  categoryGuess: inventoryCategoryEnum("category_guess").default('fridge'),
  status: reviewStatusEnum("status").default('pending'),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============= KITCHEN EQUIPMENT =============

export const kitchenLocationEnum = pgEnum('kitchen_location', ['indoor', 'outdoor']);

export const kitchenEquipment = pgTable("kitchen_equipment", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  itemType: varchar("item_type").notNull(), // toaster, blender, grill, etc.
  location: kitchenLocationEnum("location").notNull().default('indoor'),
  owned: boolean("owned").notNull().default(false),
  brand: varchar("brand"),
  model: varchar("model"),
  imageUrl: varchar("image_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique().on(table.userId, table.itemType, table.location),
  index("kitchen_equipment_user_id_idx").on(table.userId),
]);

// ============= NOTIFICATIONS =============

export const notificationTypeEnum = pgEnum('notification_type', [
  'shopping_assignment',
  'shopping_bought',
  'review_required',
  'meal_vote',
]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recipientUserId: varchar("recipient_user_id").notNull().references(() => users.id),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title").notNull(),
  message: text("message"),
  payload: jsonb("payload"), // {itemId, itemName, assignerId, etc}
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// ============= RECIPE INTERACTIONS (Smart Recommendations) =============

export const interactionTypeEnum = pgEnum('interaction_type', ['view', 'search']);

export const recipeInteractions = pgTable("recipe_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  interactionType: interactionTypeEnum("interaction_type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============= DINING TABLE MEAL PLANNING =============

export const mealPlanSeats = pgTable("meal_plan_seats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mealPlanId: varchar("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: 'cascade' }),
  seatNumber: integer("seat_number").notNull(), // 1-6
  dietaryRestrictions: text("dietary_restrictions").array(), // ['vegetarian', 'gluten-free']
  assignedUserId: varchar("assigned_user_id").references(() => users.id), // optional family member
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.mealPlanId, table.seatNumber)
]);

export const mealSeatAssignments = pgTable("meal_seat_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seatId: varchar("seat_id").notNull().unique().references(() => mealPlanSeats.id, { onDelete: 'cascade' }),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

// ============= RELATIONS =============

export const usersRelations = relations(users, ({ many }) => ({
  familyMemberships: many(familyMembers),
  kitchenInventory: many(kitchenInventory),
  kitchenEquipment: many(kitchenEquipment),
  mealPlans: many(mealPlans),
  mealVotes: many(mealVotes),
  recipeRatings: many(recipeRatings),
  chatMessages: many(chatMessages),
  shoppingLists: many(shoppingLists),
  createdFamilies: many(families),
  notifications: many(notifications),
  assignedShoppingItems: many(shoppingListItems),
  reviewQueue: many(inventoryReviewQueue),
  recipeInteractions: many(recipeInteractions),
  mealPlanSeats: many(mealPlanSeats),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  creator: one(users, {
    fields: [families.createdById],
    references: [users.id],
  }),
  members: many(familyMembers),
  mealPlans: many(mealPlans),
  shoppingLists: many(shoppingLists),
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
  interactions: many(recipeInteractions),
  seatAssignments: many(mealSeatAssignments),
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
  seats: many(mealPlanSeats),
  seatAssignments: many(mealSeatAssignments),
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

export const shoppingListsRelations = relations(shoppingLists, ({ one, many }) => ({
  owner: one(users, {
    fields: [shoppingLists.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [shoppingLists.familyId],
    references: [families.id],
  }),
  items: many(shoppingListItems),
}));

export const shoppingListItemsRelations = relations(shoppingListItems, ({ one }) => ({
  list: one(shoppingLists, {
    fields: [shoppingListItems.listId],
    references: [shoppingLists.id],
  }),
  assignedTo: one(users, {
    fields: [shoppingListItems.assignedToUserId],
    references: [users.id],
  }),
  addedBy: one(users, {
    fields: [shoppingListItems.addedByUserId],
    references: [users.id],
  }),
}));

export const inventoryReviewQueueRelations = relations(inventoryReviewQueue, ({ one }) => ({
  user: one(users, {
    fields: [inventoryReviewQueue.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [inventoryReviewQueue.reviewerId],
    references: [users.id],
  }),
  sourceItem: one(shoppingListItems, {
    fields: [inventoryReviewQueue.sourceItemId],
    references: [shoppingListItems.id],
  }),
}));

export const kitchenEquipmentRelations = relations(kitchenEquipment, ({ one }) => ({
  user: one(users, {
    fields: [kitchenEquipment.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

export const recipeInteractionsRelations = relations(recipeInteractions, ({ one }) => ({
  user: one(users, {
    fields: [recipeInteractions.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [recipeInteractions.recipeId],
    references: [recipes.id],
  }),
}));

export const mealPlanSeatsRelations = relations(mealPlanSeats, ({ one }) => ({
  mealPlan: one(mealPlans, {
    fields: [mealPlanSeats.mealPlanId],
    references: [mealPlans.id],
  }),
  assignedUser: one(users, {
    fields: [mealPlanSeats.assignedUserId],
    references: [users.id],
  }),
  assignment: one(mealSeatAssignments, {
    fields: [mealPlanSeats.id],
    references: [mealSeatAssignments.seatId],
  }),
}));

export const mealSeatAssignmentsRelations = relations(mealSeatAssignments, ({ one }) => ({
  seat: one(mealPlanSeats, {
    fields: [mealSeatAssignments.seatId],
    references: [mealPlanSeats.id],
  }),
  recipe: one(recipes, {
    fields: [mealSeatAssignments.recipeId],
    references: [recipes.id],
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

// Ingredient structure for recipe ingredients JSONB field
export type RecipeIngredient = {
  name: string;
  amount: string;
  unit: string;
  imageUrl?: string;
};

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

export const insertShoppingListItemSchema = createInsertSchema(shoppingListItems).omit({
  id: true,
  addedAt: true,
  boughtAt: true,
});
export type InsertShoppingListItem = z.infer<typeof insertShoppingListItemSchema>;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;

export const insertInventoryReviewQueueSchema = createInsertSchema(inventoryReviewQueue).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export type InsertInventoryReviewQueue = z.infer<typeof insertInventoryReviewQueueSchema>;
export type InventoryReviewQueue = typeof inventoryReviewQueue.$inferSelect;

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const insertRecipeInteractionSchema = createInsertSchema(recipeInteractions).omit({
  id: true,
  createdAt: true,
});
export type InsertRecipeInteraction = z.infer<typeof insertRecipeInteractionSchema>;
export type RecipeInteraction = typeof recipeInteractions.$inferSelect;

export const insertMealPlanSeatSchema = createInsertSchema(mealPlanSeats).omit({
  id: true,
  createdAt: true,
});
export type InsertMealPlanSeat = z.infer<typeof insertMealPlanSeatSchema>;
export type MealPlanSeat = typeof mealPlanSeats.$inferSelect;

export const insertMealSeatAssignmentSchema = createInsertSchema(mealSeatAssignments).omit({
  id: true,
  assignedAt: true,
});
export type InsertMealSeatAssignment = z.infer<typeof insertMealSeatAssignmentSchema>;
export type MealSeatAssignment = typeof mealSeatAssignments.$inferSelect;

export const insertKitchenEquipmentSchema = createInsertSchema(kitchenEquipment).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertKitchenEquipment = z.infer<typeof insertKitchenEquipmentSchema>;
export type KitchenEquipment = typeof kitchenEquipment.$inferSelect;

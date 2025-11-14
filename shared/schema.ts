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
  date,
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

// Enums for user preferences
export const cookingLevelEnum = pgEnum('cooking_level', ['beginner', 'intermediate', 'advanced']);

// User storage table - Clerk manages authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Clerk user ID (e.g., user_2abc...)
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
  
  // MVP+ additions
  cookingLevel: cookingLevelEnum("cooking_level").default('beginner'),
  householdSize: integer("household_size"),
  maxSodium: integer("max_sodium"), // mg per day
  proteinTarget: integer("protein_target"), // grams per day
  carbsTarget: integer("carbs_target"), // grams per day
  fatTarget: integer("fat_target"), // grams per day
  onboardingCompleted: boolean("onboarding_completed").default(false),
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
  protein: integer("protein"), // grams
  carbs: integer("carbs"), // grams
  fat: integer("fat"), // grams
  sodium: integer("sodium"), // mg
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
  pollResponses: many(userPollResponses),
  mealPlanRSVPs: many(mealPlanRSVPs),
  events: many(events),
  nutritionLogs: many(nutritionLogs),
  cookingSessions: many(cookingSessions),
}));

export const familiesRelations = relations(families, ({ one, many }) => ({
  creator: one(users, {
    fields: [families.createdById],
    references: [users.id],
  }),
  members: many(familyMembers),
  mealPlans: many(mealPlans),
  shoppingLists: many(shoppingLists),
  events: many(events),
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
  nutritionLogMeals: many(nutritionLogMeals),
  cookingSessions: many(cookingSessions),
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
  rsvps: many(mealPlanRSVPs),
  eventMealPlans: many(eventMealPlans),
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

// ============= POLLS SYSTEM (For You Feed Personalization) =============

export const pollCategoryEnum = pgEnum('poll_category', [
  'breakfast_preferences',
  'cooking_methods',
  'protein_types',
  'spice_levels',
  'meal_times',
  'cuisine_styles',
  'dietary_choices',
  'texture_preferences',
]);

export const pollQuestions = pgTable("poll_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  category: pollCategoryEnum("category").notNull(),
  options: jsonb("options").notNull(), // [{value: 'scrambled', label: 'Scrambled', relatedTags: ['breakfast', 'eggs']}]
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userPollResponses = pgTable("user_poll_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  pollId: varchar("poll_id").notNull().references(() => pollQuestions.id, { onDelete: 'cascade' }),
  selectedOption: varchar("selected_option").notNull(), // 'scrambled', 'fried', etc.
  respondedAt: timestamp("responded_at").defaultNow(),
}, (table) => [
  unique().on(table.userId, table.pollId)
]);

// ============= MEAL PLAN RSVPs =============

export const mealPlanRSVPs = pgTable("meal_plan_rsvps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mealPlanId: varchar("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default('pending'), // pending, accepted, declined
  rsvpedAt: timestamp("rsvped_at").defaultNow(),
}, (table) => [
  unique().on(table.mealPlanId, table.userId)
]);

// ============= EVENTS (MVP+) =============

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  familyId: varchar("family_id").references(() => families.id, { onDelete: 'cascade' }),
  name: varchar("name").notNull(), // "Game Night", "Dinner Party", etc.
  description: text("description"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  guestCount: integer("guest_count").default(2),
  invitedGuests: text("invited_guests").array(), // Email addresses or names
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("events_user_scheduled_idx").on(table.userId, table.scheduledFor)
]);

// Junction table to link events with multiple meal plans/recipes
export const eventMealPlans = pgTable("event_meal_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  mealPlanId: varchar("meal_plan_id").notNull().references(() => mealPlans.id, { onDelete: 'cascade' }),
  dishType: varchar("dish_type"), // main, side, dessert, appetizer
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique().on(table.eventId, table.mealPlanId)
]);

// ============= NUTRITION TRACKING (MVP+) =============

export const nutritionLogs = pgTable("nutrition_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: date("date").notNull(), // Date of tracking (YYYY-MM-DD format)
  totalCalories: integer("total_calories").default(0),
  totalSodium: integer("total_sodium").default(0), // mg
  totalProtein: integer("total_protein").default(0), // grams
  totalCarbs: integer("total_carbs").default(0), // grams
  totalFat: integer("total_fat").default(0), // grams
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  unique().on(table.userId, table.date),
  index("nutrition_logs_user_date_idx").on(table.userId, table.date)
]);

// Individual meal contributions to daily nutrition
export const nutritionLogMeals = pgTable("nutrition_log_meals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nutritionLogId: varchar("nutrition_log_id").notNull().references(() => nutritionLogs.id, { onDelete: 'cascade' }),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  portionSize: decimal("portion_size").default("1"), // Multiplier (0.5 = half serving, 2 = double)
  calories: integer("calories"),
  sodium: integer("sodium"), // mg
  protein: integer("protein"), // grams
  carbs: integer("carbs"), // grams
  fat: integer("fat"), // grams
  mealType: varchar("meal_type"), // breakfast, lunch, dinner, snack
  loggedAt: timestamp("logged_at").defaultNow(),
}, (table) => [
  index("nutrition_log_meals_log_idx").on(table.nutritionLogId)
]);

// ============= COOKING MODE (MVP+) =============

export const cookingSessionStatusEnum = pgEnum('cooking_session_status', ['active', 'paused', 'completed', 'abandoned']);

export const cookingSessions = pgTable("cooking_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  recipeId: varchar("recipe_id").notNull().references(() => recipes.id),
  status: cookingSessionStatusEnum("status").default('active'),
  currentStep: integer("current_step").default(0), // 0-indexed step number
  timers: jsonb("timers"), // [{stepNumber, duration, startedAt, label}]
  notes: text("notes"),
  startedAt: timestamp("started_at").defaultNow(),
  lastInteractionAt: timestamp("last_interaction_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  ingredientsDeductedAt: timestamp("ingredients_deducted_at"),
}, (table) => [
  index("cooking_sessions_user_status_idx").on(table.userId, table.status)
]);

// ============= POLL RELATIONS =============

export const pollQuestionsRelations = relations(pollQuestions, ({ many }) => ({
  responses: many(userPollResponses),
}));

export const userPollResponsesRelations = relations(userPollResponses, ({ one }) => ({
  user: one(users, {
    fields: [userPollResponses.userId],
    references: [users.id],
  }),
  poll: one(pollQuestions, {
    fields: [userPollResponses.pollId],
    references: [pollQuestions.id],
  }),
}));

export const mealPlanRSVPsRelations = relations(mealPlanRSVPs, ({ one }) => ({
  mealPlan: one(mealPlans, {
    fields: [mealPlanRSVPs.mealPlanId],
    references: [mealPlans.id],
  }),
  user: one(users, {
    fields: [mealPlanRSVPs.userId],
    references: [users.id],
  }),
}));

// MVP+ Relations
export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [events.familyId],
    references: [families.id],
  }),
  eventMealPlans: many(eventMealPlans),
}));

export const eventMealPlansRelations = relations(eventMealPlans, ({ one }) => ({
  event: one(events, {
    fields: [eventMealPlans.eventId],
    references: [events.id],
  }),
  mealPlan: one(mealPlans, {
    fields: [eventMealPlans.mealPlanId],
    references: [mealPlans.id],
  }),
}));

export const nutritionLogsRelations = relations(nutritionLogs, ({ one, many }) => ({
  user: one(users, {
    fields: [nutritionLogs.userId],
    references: [users.id],
  }),
  meals: many(nutritionLogMeals),
}));

export const nutritionLogMealsRelations = relations(nutritionLogMeals, ({ one }) => ({
  nutritionLog: one(nutritionLogs, {
    fields: [nutritionLogMeals.nutritionLogId],
    references: [nutritionLogs.id],
  }),
  recipe: one(recipes, {
    fields: [nutritionLogMeals.recipeId],
    references: [recipes.id],
  }),
}));

export const cookingSessionsRelations = relations(cookingSessions, ({ one }) => ({
  user: one(users, {
    fields: [cookingSessions.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [cookingSessions.recipeId],
    references: [recipes.id],
  }),
}));

// ============= POLL INSERT SCHEMAS =============

export const insertPollQuestionSchema = createInsertSchema(pollQuestions).omit({
  id: true,
  createdAt: true,
});
export type InsertPollQuestion = z.infer<typeof insertPollQuestionSchema>;
export type PollQuestion = typeof pollQuestions.$inferSelect;

export const insertUserPollResponseSchema = createInsertSchema(userPollResponses).omit({
  id: true,
  respondedAt: true,
});
export type InsertUserPollResponse = z.infer<typeof insertUserPollResponseSchema>;
export type UserPollResponse = typeof userPollResponses.$inferSelect;

export const insertMealPlanRSVPSchema = createInsertSchema(mealPlanRSVPs).omit({
  id: true,
  rsvpedAt: true,
});
export type InsertMealPlanRSVP = z.infer<typeof insertMealPlanRSVPSchema>;
export type MealPlanRSVP = typeof mealPlanRSVPs.$inferSelect;

// Poll option structure for pollQuestions.options JSONB field
export type PollOption = {
  value: string;
  label: string;
  relatedTags?: string[]; // Tags to influence recommendations
};

// ============= MVP+ INSERT SCHEMAS =============

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

export const insertEventMealPlanSchema = createInsertSchema(eventMealPlans).omit({
  id: true,
  createdAt: true,
});
export type InsertEventMealPlan = z.infer<typeof insertEventMealPlanSchema>;
export type EventMealPlan = typeof eventMealPlans.$inferSelect;

export const insertNutritionLogSchema = createInsertSchema(nutritionLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type NutritionLog = typeof nutritionLogs.$inferSelect;

export const insertNutritionLogMealSchema = createInsertSchema(nutritionLogMeals).omit({
  id: true,
  loggedAt: true,
});
export type InsertNutritionLogMeal = z.infer<typeof insertNutritionLogMealSchema>;

// Request schema for adding a meal to nutrition log (API validation)
export const addMealToLogRequestSchema = z.object({
  recipeId: z.string().min(1, "Recipe ID is required"),
  portionSize: z.number().min(0.1, "Portion size must be at least 0.1").max(10, "Portion size cannot exceed 10"),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack'], {
    errorMap: () => ({ message: "Meal type must be breakfast, lunch, dinner, or snack" })
  }),
});
export type AddMealToLogRequest = z.infer<typeof addMealToLogRequestSchema>;
export type NutritionLogMeal = typeof nutritionLogMeals.$inferSelect;

export const insertCookingSessionSchema = createInsertSchema(cookingSessions).omit({
  id: true,
  startedAt: true,
  lastInteractionAt: true,
  completedAt: true,
  ingredientsDeductedAt: true,
});
export type InsertCookingSession = z.infer<typeof insertCookingSessionSchema>;
export type CookingSession = typeof cookingSessions.$inferSelect;

// Timer structure for cookingSessions.timers JSONB field
export type CookingTimer = {
  stepNumber: number;
  duration: number; // seconds
  startedAt: Date | string;
  label?: string;
};

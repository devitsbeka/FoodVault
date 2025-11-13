# Kitchen Manager - Food Management Application

## Overview

Kitchen Manager is a cross-platform application designed to help users manage their kitchen inventory, discover recipes, collaboratively plan meals with family, and receive AI-powered cooking assistance. It adheres to Apple's Human Interface Guidelines to provide a consistent and intuitive user experience across web and mobile platforms. The project aims to streamline food management, reduce waste, and enhance the meal planning experience for individuals and families.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built using React 18+ with TypeScript, leveraging Vite for fast development and optimized builds. UI components are constructed with Radix UI primitives and shadcn/ui, styled using Tailwind CSS, and follow an Apple HIG-inspired design system with SF Pro typography. State management utilizes TanStack Query for server state and React hooks for local UI state.

### Backend Architecture

The backend is an Express.js server in TypeScript, providing a RESTful API. Authentication uses Replit's native OIDC via Passport.js, providing secure user authentication with social login support (Google, GitHub, Apple, X, email/password). Sessions are stored in PostgreSQL using connect-pg-simple for reliability. The database layer employs Drizzle ORM with Neon serverless PostgreSQL, ensuring type-safe operations and a schema-first design validated by Zod. API routes are organized by feature areas, with robust error handling and authentication middleware.

### Data Models

Core entities include Users (profiles, preferences), Kitchen Inventory (items, expiration), Recipes (details, ingredients with tags array for dietary filtering), Meal Plans (scheduled meals, voting), Meal Plan Seats (configurable dining table, dietary restrictions, seat assignments), Recipe Interactions, Families (group management), Shopping Lists (collaborative tracking), Kitchen Equipment (ownership tracking, wishlists, brand/model details), and Chat Messages (AI history). These entities are interconnected through defined relationships to support the application's features.

**Recipe Tag Taxonomy:** Recipes use standardized tags for dietary restriction filtering (vegan, vegetarian, halal, kosher, low-carb, contains-gluten, contains-dairy, contains-nuts). Tag-based filtering ensures accurate compliance with dietary needs.

### Key Features Architecture

*   **Onboarding Flow:** A multi-slide carousel guides new users.
*   **Kitchen Inventory Management:** Provides CRUD operations for inventory items across different locations (fridge, pantry), with expiration tracking and category-based filtering. Features always-visible ingredient autocomplete using Spoonacular API (memoized 5-minute cache, 2+ character minimum, 30x30px thumbnails). Ingredient name and image auto-populate from selection.
*   **Recipe Discovery:** Features a search and filter system (diet type, calories, ingredient matching), rating functionality, and photo uploads. Backend supports dietary restriction filtering via a tag-based system with database-level enforcement.
*   **Recipe Interaction Tracking:** Logs recipe views and searches to `recipe_interactions` table for smart recommendations. Frontend silently tracks user behavior (view on recipe detail page, search when filtering/searching recipes).
*   **Smart Recipe Recommendations:** Scores recipes using formula: (interactionCount + 1) × (1 + ingredientMatchScore × 2). Combines fridge ingredient match with viewing frequency. New recipes (zero interactions) still ranked by ingredient availability.
*   **Home Dashboard:** Displays personalized recipe recommendations (top 3), expiring items (within 3 days), upcoming meals, and quick action buttons. Recipe cards are clickable links to detail pages. Dashboard statistics show inventory count, expiring items, upcoming meals, and recommendation count.
*   **Meal Planning:** Offers a visual dining table interface with configurable seats (2-6 people, poker table layout), per-seat dietary restrictions, recipe assignment via filtered picker modal, and a collaborative voting system for family meal planning. Recipe picker combines dietary restrictions from ALL active seats and enforces compliance via backend tag filtering. External API recipes excluded when restrictions present to guarantee safety.
*   **Smart Shopping List Assistant:** Analyzes upcoming meal plans (next 7 days) and suggests missing ingredients by comparing recipe requirements with kitchen inventory. Shows ingredient name, quantity, unit, thumbnail image, and which recipes need it. One-click add to shopping list.
*   **Kitchen Equipment Management:** Visual inventory system with SVG kitchen layouts (indoor/outdoor, three size presets). Features interactive hotspot-based equipment tracking, ownership vs. wishlist toggle, brand/model input for owned items, and automatic product image fetching using OpenAI vision. Unique constraint on (userId, itemType, location) prevents duplicates and enables toggle/upsert behavior.
*   **AI-Powered Product Recommendations:** Commission-free, honest product suggestions using OpenAI GPT-5. Generates 5 best products per equipment type with detailed comparisons (features, prices, ratings, pros/cons). Triggered when user wishlists equipment. Frontend displays recommendations with images, star ratings, and expandable feature lists. Response format validated with defensive JSON parsing and error handling.
*   **AI Chat Assistant:** Integrates OpenAI GPT-5 via Replit AI Integrations for context-aware recipe suggestions and shopping list generation.
*   **Family Collaboration:** Supports family creation, member invitation, role-based access, shared meal plans, and family-wide inventory visibility. Authorization layer prevents cross-family meal plan access.
*   **Inline Recipe Filters:** Airbnb-style inline filter buttons for cuisine (Italian, Mexican, Chinese, Japanese, Thai, French, Mediterranean, American, Indian) and meal type (breakfast, lunch, dinner, snack). Filters work with diet type, calories, and fridge ingredient matching.
*   **For You Feed:** Instagram/TikTok-style personalized feed with poll-based preference learning. Features horizontal stories bar with featured recipes, vertical feed of poll cards (4 options in 2x2 grid with related tags), and right sidebar with real-time widgets (fridge status, upcoming dinners, family online status, meal plan RSVPs). Poll responses tracked in database for future recipe recommendation personalization. Feed loads multiple polls upfront (MVP - true infinite scroll pagination pending future iteration). All UI icons from Lucide React (no emojis).

## Known Limitations

### Recipe MealType Filtering
The meal type filtering (breakfast, lunch, dinner, snack) has known edge cases due to external API constraints:

**Issue:** Some recipes from external APIs (Spoonacular, API Ninjas) may not appear in lunch/dinner filtered results.

**Root Cause:** External APIs use different schema structures:
- Spoonacular returns `dishTypes` like "main course" which are ambiguous for lunch vs. dinner
- API Ninjas has no native meal type support, requiring tag inference from titles/ingredients
- Database recipes with `mealType=null` are filtered strictly

**Current Behavior:**
- Breakfast/snack filters work reliably (strict matching)
- Lunch/dinner filters may miss some "main course" recipes from external APIs
- Route-level post-filtering attempts to include `mealType=null` for lunch/dinner but has ordering/pagination edge cases

**Future Improvement:** 
Implement unified ingestion pipeline (Option C) to consolidate all recipe sources through database storage with proper tagging before filtering. This requires:
- Schema updates for `recipeSource`, `sourceId`, `fetchedAt`, `mealTypeConfidence` (partially implemented)
- Ingestion services to fetch/normalize/dedupe external recipes
- Storage-layer filtering with null-friendly meal type semantics
- Route refactoring to read exclusively from storage

**Impact:** Functional for MVP - users can filter by meal type and see most relevant results. Perfect accuracy requires architectural refactoring.

## External Dependencies

### Third-Party Services

*   **Authentication:** Replit Auth via OpenID Connect (supports Google, GitHub, Apple, X, and email/password login).
*   **Database:** Neon Serverless PostgreSQL.
*   **AI Integration:** OpenAI API (GPT-5 model) via Replit AI Integrations.
*   **Recipe Images:** Spoonacular API for ingredient image auto-fetching and autocomplete suggestions.
*   **Ingredient Photos:** Unsplash API for ingredient photos.

### Key NPM Packages

*   **UI Components:** `@radix-ui/*`, `class-variance-authority`, `tailwindcss`, `lucide-react`, `cmdk`.
*   **Data & State:** `@tanstack/react-query`, `drizzle-orm`, `drizzle-zod`, `zod`, `@hookform/resolvers`.
*   **Authentication:** `passport`, `openid-client`, `connect-pg-simple`, `memoizee`.
*   **Development Tools:** `vite`, `tsx`, `esbuild`, `@replit/vite-plugin-*`.

### Environment Variables Required

*   `DATABASE_URL`
*   `SESSION_SECRET` (automatically provided by Replit)
*   `REPL_ID` (automatically provided by Replit)
*   `ISSUER_URL` (defaults to https://replit.com/oidc)
*   `AI_INTEGRATIONS_OPENAI_BASE_URL`
*   `AI_INTEGRATIONS_OPENAI_API_KEY`
*   `RECIPE_API_KEY`
*   `VITE_UNSPLASH_ACCESS_KEY`

## Database Seeding

The project includes a seed script (`server/seed.ts`) that populates the database with sample data:

**Sample Data Included:**
- **User Account**: kanchaveli.b@gmail.com (Kanchaveli B)
- **Family**: B Family (created by Kanchaveli B)
- **Family Members**: 
  - John Doe (john.doe@example.com) - member
  - Jane Smith (jane.smith@example.com) - member
  - Alex Jones (alex.jones@example.com) - member
- **Sample Recipes**: 6 diverse recipes (Italian, Mexican, Vegetarian, etc.)

**Running the Seed Script:**
```bash
tsx server/seed.ts
```

The seed script uses `onConflictDoNothing()` to safely re-run without duplicating data.
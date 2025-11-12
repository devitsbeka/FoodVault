# Kitchen Manager - Food Management Application

## Overview

Kitchen Manager is a cross-platform application designed to help users manage their kitchen inventory, discover recipes, collaboratively plan meals with family, and receive AI-powered cooking assistance. It adheres to Apple's Human Interface Guidelines to provide a consistent and intuitive user experience across web and mobile platforms. The project aims to streamline food management, reduce waste, and enhance the meal planning experience for individuals and families.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built using React 18+ with TypeScript, leveraging Vite for fast development and optimized builds. UI components are constructed with Radix UI primitives and shadcn/ui, styled using Tailwind CSS, and follow an Apple HIG-inspired design system with SF Pro typography. State management utilizes TanStack Query for server state and React hooks for local UI state.

### Backend Architecture

The backend is an Express.js server in TypeScript, providing a RESTful API. Authentication uses Replit Auth via OpenID Connect and Passport.js, with session management handled by `connect-pg-simple`. The database layer employs Drizzle ORM with Neon serverless PostgreSQL, ensuring type-safe operations and a schema-first design validated by Zod. API routes are organized by feature areas, with robust error handling and authentication middleware.

### Data Models

Core entities include Users (profiles, preferences), Kitchen Inventory (items, expiration), Recipes (details, ingredients with tags array for dietary filtering), Meal Plans (scheduled meals, voting), Meal Plan Seats (configurable dining table, dietary restrictions, seat assignments), Recipe Interactions, Families (group management), Shopping Lists (collaborative tracking), and Chat Messages (AI history). These entities are interconnected through defined relationships to support the application's features.

**Recipe Tag Taxonomy:** Recipes use standardized tags for dietary restriction filtering (vegan, vegetarian, halal, kosher, low-carb, contains-gluten, contains-dairy, contains-nuts). Tag-based filtering ensures accurate compliance with dietary needs.

### Key Features Architecture

*   **Onboarding Flow:** A multi-slide carousel guides new users.
*   **Kitchen Inventory Management:** Provides CRUD operations for inventory items across different locations (fridge, pantry), with expiration tracking and category-based filtering. Features always-visible ingredient autocomplete using Spoonacular API (memoized 5-minute cache, 2+ character minimum, 30x30px thumbnails). Ingredient name and image auto-populate from selection.
*   **Recipe Discovery:** Features a search and filter system (diet type, calories, ingredient matching), rating functionality, and photo uploads. Backend supports dietary restriction filtering via a tag-based system with database-level enforcement.
*   **Meal Planning:** Offers a visual dining table interface with configurable seats (2-6 people, poker table layout), per-seat dietary restrictions, recipe assignment via filtered picker modal, and a collaborative voting system for family meal planning. Recipe picker combines dietary restrictions from ALL active seats and enforces compliance via backend tag filtering. External API recipes excluded when restrictions present to guarantee safety.
*   **AI Chat Assistant:** Integrates OpenAI GPT-5 via Replit AI Integrations for context-aware recipe suggestions and shopping list generation.
*   **Family Collaboration:** Supports family creation, member invitation, role-based access, shared meal plans, and family-wide inventory visibility. Authorization layer prevents cross-family meal plan access.

## External Dependencies

### Third-Party Services

*   **Authentication:** Replit Auth (OpenID Connect provider).
*   **Database:** Neon Serverless PostgreSQL.
*   **AI Integration:** OpenAI API (GPT-5 model) via Replit AI Integrations.
*   **Recipe Images:** Spoonacular API for ingredient image auto-fetching and autocomplete suggestions.
*   **Ingredient Photos:** Unsplash API for ingredient photos.

### Key NPM Packages

*   **UI Components:** `@radix-ui/*`, `class-variance-authority`, `tailwindcss`, `lucide-react`, `cmdk`.
*   **Data & State:** `@tanstack/react-query`, `drizzle-orm`, `drizzle-zod`, `zod`, `@hookform/resolvers`.
*   **Authentication & Session:** `openid-client`, `passport`, `express-session`, `connect-pg-simple`.
*   **Development Tools:** `vite`, `tsx`, `esbuild`, `@replit/vite-plugin-*`.

### Environment Variables Required

*   `DATABASE_URL`
*   `SESSION_SECRET`
*   `REPL_ID`
*   `ISSUER_URL`
*   `AI_INTEGRATIONS_OPENAI_BASE_URL`
*   `AI_INTEGRATIONS_OPENAI_API_KEY`
*   `RECIPE_API_KEY`
*   `VITE_UNSPLASH_ACCESS_KEY`
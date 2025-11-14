# Kitchen Manager - Food Management Application

## Overview

Kitchen Manager is a cross-platform application designed to streamline food management, reduce waste, and enhance the meal planning and cooking experience. It enables users to manage kitchen inventory, discover recipes, collaboratively plan meals with family, receive AI-powered cooking assistance, and follow step-by-step cooking instructions. The project aims to provide a consistent and intuitive user experience by adhering to Apple's Human Interface Guidelines across web and mobile platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend

The frontend is built with React 18+ and TypeScript, utilizing Vite for development and optimized builds. UI components are developed with Radix UI primitives and shadcn/ui, styled using Tailwind CSS, and follow an Apple HIG-inspired design system with SF Pro typography. State management is handled by TanStack Query for server state and React hooks for local UI state.

### Backend

The backend is an Express.js server written in TypeScript, providing a RESTful API. Authentication uses Replit's native OIDC via Passport.js, supporting social logins (Google, GitHub, Apple, X) and email/password. Sessions are stored in PostgreSQL using `connect-pg-simple`. The database layer uses Drizzle ORM with Neon serverless PostgreSQL, ensuring type-safe operations and a schema-first design validated by Zod. API routes are organized by feature area with robust error handling and authentication middleware.

### Data Models

Core entities include Users, Kitchen Inventory, Recipes, Meal Plans, Meal Plan Seats, Recipe Interactions, Families, Shopping Lists, Kitchen Equipment, Events, Nutrition Logs, Cooking Sessions, and Chat Messages. These are interconnected to support features like recipe recommendations, collaborative planning, and inventory management. Recipes utilize a standardized tag taxonomy for dietary filtering (e.g., vegan, low-carb). The database schema includes extensions for user cooking level, household size, nutrition goals, event-based meal planning, daily nutrition logging, and tracking cooking session progress.

### Key Features

*   **Onboarding Flow:** Guides new users through initial setup.
*   **Kitchen Inventory Management:** CRUD operations for inventory items across various locations, with expiration tracking and category-based filtering. Includes ingredient autocomplete with image auto-population via Spoonacular API.
*   **Recipe Discovery:** Search and filter system based on diet, calories, and ingredient matching, with rating and photo upload capabilities. Backend enforces dietary restrictions via tag-based filtering.
*   **Smart Recipe Recommendations:** Personalized recommendations based on user interactions and kitchen inventory matching.
*   **Home Dashboard:** A calendar-centric dashboard featuring a 14-day calendar strip, today's meal overview, upcoming meal plans, kitchen inventory summary (expiring/low-stock items), and personalized recipe suggestions.
*   **Meal Planning:** Visual dining table interface for collaborative planning, configurable seats with dietary restrictions, and a voting system. Recipe selection adheres to combined dietary constraints.
*   **Smart Shopping List Assistant:** Analyzes upcoming meal plans and kitchen inventory to suggest missing ingredients, with one-click additions to the shopping list.
*   **Kitchen Equipment Management:** Interactive visual inventory system with SVG layouts, tracking ownership vs. wishlists, and automatic product image fetching.
*   **AI-Powered Product Recommendations:** Provides commission-free product suggestions for wishlisted equipment using OpenAI GPT-5, including comparisons and detailed features.
*   **AI Chat Assistant:** Integrates OpenAI GPT-5 for context-aware recipe suggestions and shopping list generation.
*   **Family Collaboration:** Supports family creation, member invitation, role-based access, and shared resources like meal plans and inventory.
*   **Inline Recipe Filters:** Airbnb-style filtering for cuisine and meal type.
*   **For You Feed:** Personalized feed with poll-based preference learning, featuring stories, poll cards for recipe preferences, and real-time widgets (fridge status, upcoming dinners).
*   **Cooking Mode:** Step-by-step cooking interface with session management, progress tracking, pause/resume functionality, and optional ingredient deduction from inventory upon completion.

## External Dependencies

### Third-Party Services

*   **Authentication:** Replit Auth via OpenID Connect (Google, GitHub, Apple, X, email/password).
*   **Database:** Neon Serverless PostgreSQL.
*   **AI Integration:** OpenAI API (GPT-5 model) via Replit AI Integrations.
*   **Recipe Data & Images:** Spoonacular API.
*   **Ingredient Photos:** Unsplash API.

### Environment Variables

*   `DATABASE_URL`
*   `SESSION_SECRET`
*   `REPL_ID`
*   `ISSUER_URL`
*   `AI_INTEGRATIONS_OPENAI_BASE_URL`
*   `AI_INTEGRATIONS_OPENAI_API_KEY`
*   `RECIPE_API_KEY`
*   `VITE_UNSPLASH_ACCESS_KEY`
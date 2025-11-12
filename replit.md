# Kitchen Manager - Food Management Application

## Overview

Kitchen Manager is a cross-platform food management application that helps users track kitchen inventory, discover recipes, plan meals collaboratively with family, and receive AI-powered cooking assistance. The application follows Apple's Human Interface Guidelines for a clean, intuitive user experience across web and mobile platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18+ with TypeScript for type safety and modern component architecture
- Vite as the build tool and development server for fast HMR and optimized builds
- Wouter for lightweight client-side routing

**UI Component System**
- Radix UI primitives for accessible, unstyled components
- shadcn/ui component library following the "New York" style variant
- Tailwind CSS for utility-first styling with custom design tokens
- Apple HIG-inspired design system with SF Pro typography fallbacks

**State Management**
- TanStack Query (React Query) for server state management and caching
- Query invalidation pattern for optimistic updates
- Local state with React hooks for UI-specific state

**Design System Principles**
- Apple Human Interface Guidelines compliance
- Custom color system with HSL values and CSS variables for theming
- Responsive spacing units (2, 4, 6, 8, 12, 16, 24) using Tailwind
- Rounded corners using Apple-standard border radii
- Shadow elevation system for depth and hierarchy

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for the API layer
- HTTP-only session-based authentication
- RESTful API design with conventional endpoints

**Authentication & Authorization**
- Replit Auth integration using OpenID Connect (OIDC)
- Passport.js strategy for authentication flow
- Session management with connect-pg-simple for PostgreSQL-backed sessions
- User session stored with access and refresh tokens

**Database Layer**
- Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL for database hosting
- WebSocket connections for serverless Postgres using @neondatabase/serverless
- Schema-first design with Zod validation

**API Structure**
- Route organization: `/api/auth/*`, `/api/kitchen-inventory`, `/api/recipes`, `/api/meal-plans`, `/api/family`, `/api/shopping-lists`, `/api/chat`
- Middleware for authentication checks (`isAuthenticated`)
- Request/response logging with duration tracking
- Error handling with proper HTTP status codes and messages

### Data Models

**Core Entities**
- Users: Authentication, profile, dietary preferences (allergies, diet type, calorie limits)
- Kitchen Inventory: Items categorized by location (fridge, pantry, other) with expiration tracking
- Recipes: Name, description, ingredients (JSON), instructions, prep/cook time, diet type, calories
- Meal Plans: Scheduled meals with voting system for family collaboration
- Families: Group management for shared meal planning
- Shopping Lists: Collaborative shopping with checked items tracking
- Chat Messages: AI conversation history with role-based messages

**Relationships**
- Users → Kitchen Inventory (one-to-many)
- Users → Families (many-to-many through family_members)
- Recipes → Meal Plans (one-to-many)
- Meal Plans → Votes (one-to-many)
- Users → Chat Messages (one-to-many)

### Key Features Architecture

**Onboarding Flow**
- Multi-slide carousel introducing features
- localStorage flag for first-time user detection
- Dismissible with "skip" functionality

**Kitchen Inventory Management**
- Tabbed interface (fridge/pantry/other) using Radix Tabs
- CRUD operations with optimistic updates
- Expiration date tracking with visual indicators
- Category-based filtering

**Recipe Discovery**
- Search and filter system (diet type, calories, ingredient matching)
- Ingredient overlap threshold slider (50% default)
- Recipe rating and feedback system
- Photo upload capability for user-generated content

**Meal Planning**
- Collaborative voting system with vote thresholds
- Calendar-based view for scheduled meals
- Integration with family member permissions
- Automatic meal confirmation based on votes

**AI Chat Assistant**
- Floating Action Button (FAB) for quick access
- OpenAI GPT-5 integration via Replit AI Integrations
- Context-aware recipe suggestions
- Shopping list generation from conversations
- Message history persistence

**Family Collaboration**
- Family creation and member invitation
- Role-based access (creator/member)
- Shared meal plans and voting
- Family-wide inventory visibility

## External Dependencies

### Third-Party Services

**Authentication**
- Replit Auth (OpenID Connect provider)
- Issuer URL: `https://replit.com/oidc` or custom `ISSUER_URL`

**Database**
- Neon Serverless PostgreSQL
- Connection via `DATABASE_URL` environment variable
- WebSocket protocol for serverless connections

**AI Integration**
- OpenAI API (GPT-5 model)
- Accessed through Replit AI Integrations service
- Base URL and API key from environment variables:
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`
  - `AI_INTEGRATIONS_OPENAI_API_KEY`

### Key NPM Packages

**UI Components**
- `@radix-ui/*` - Accessible component primitives (20+ packages)
- `class-variance-authority` - Component variant management
- `tailwindcss` - Utility-first CSS framework
- `lucide-react` - Icon library (Apple SF Symbols alternative)
- `cmdk` - Command palette component

**Data & State**
- `@tanstack/react-query` - Server state management
- `drizzle-orm` - Type-safe ORM
- `drizzle-zod` - Schema validation
- `zod` - Runtime type validation
- `@hookform/resolvers` - Form validation integration

**Authentication & Session**
- `openid-client` - OpenID Connect client
- `passport` - Authentication middleware
- `express-session` - Session management
- `connect-pg-simple` - PostgreSQL session store

**Development Tools**
- `vite` - Build tool and dev server
- `tsx` - TypeScript execution
- `esbuild` - Production bundler for server code
- `@replit/vite-plugin-*` - Replit-specific development enhancements

### Environment Variables Required

- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `REPL_ID` - Replit deployment identifier
- `ISSUER_URL` - OpenID Connect issuer (defaults to Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - AI service endpoint
- `AI_INTEGRATIONS_OPENAI_API_KEY` - AI service authentication
- `RECIPE_API_KEY` - api-ninjas.com Recipe API key
- `VITE_UNSPLASH_ACCESS_KEY` - Unsplash API for ingredient photos

## Recent Changes

### December 2024 - Backend API Routes Implementation

**Completed:**

**Storage Layer Security (Phase 1):**
- ✅ Extended database schema with shopping_list_items, inventory_review_queue, notifications tables
- ✅ Implemented ingredient normalization service with comprehensive mapping and edge case handling
- ✅ Completed storage layer with comprehensive family member authorization
- ✅ All shopping list operations support both owners and family members
- ✅ Review queue validation prevents cross-tenant data escalation
- ✅ Helper function `userHasListAccess()` ensures consistent authorization across all operations

**Backend API Routes (Phase 2):**
- ✅ Implemented 14 secure API routes across 4 feature areas:
  - Shopping Lists: GET all, GET with items, POST create, PATCH update, DELETE
  - Shopping List Items: POST add, PATCH update status, PATCH assign member, DELETE
  - Review Queue: GET pending, POST add item, POST approve transfer, DELETE reject
  - Notifications: GET recent, PATCH mark as read
- ✅ Shared error response system with `sendError()` helper for consistent API contracts
- ✅ Tri-state authorization pattern for core operations: `{status: "ok"|"not_found"|"forbidden", data?}`
- ✅ Security hardening: all routes validate ownership and prevent cross-tenant access
- ✅ All routes use Zod validation for request payloads
- ✅ Architect-reviewed with PASS status and no security vulnerabilities

**Authorization Model:**
- List owners: Full access to their shopping lists and items
- Family members: Full access to family-shared lists (read, write, delete)
- Review queue: Validated against list membership, prevents fabricated entries
- Notifications: User-scoped queries prevent cross-tenant modification
- All operations: Consistent authorization with proper 403/404 distinction

**API Error Format:**
```typescript
{
  status: "error",
  message: string,
  code?: string,         // e.g., "VALIDATION_ERROR", "FORBIDDEN", "NOT_FOUND"
  issues?: ZodIssue[]    // Validation errors from Zod
}
```

**Frontend Implementation (Phase 3):**
- ✅ Shopping Lists Page (master-detail pattern):
  - Left sidebar: List of all shopping lists with selection and "Shared" badges
  - Right panel: Selected list's items with full CRUD operations
  - Family collaboration: member assignment dropdown, avatars for assigned items
  - Status management: checkbox toggles between 'active' and 'bought' status
  - Bulk "Move to Kitchen" button for checked items (shows count)
  - Seamless integration with review queue workflow
  - Proper field names: `name` (not ingredientName), `listId`, `status` enum
  - Auto-selects first list on mount using useEffect (no render-time state updates)

- ✅ My Kitchen Page - Pending Review Tab:
  - Fourth tab "Pending Review" with badge showing pending item count
  - Clean list view showing items moved from shopping lists
  - Each item shows: name, quantity, unit, suggested category
  - Approve button: moves item to kitchen inventory (invalidates both caches)
  - Reject button: removes item from queue
  - Empty state with Package icon and helpful message
  - Category validation: prevents adding items while on pending tab
  - Null unit fallback: displays "unit(s)" instead of string "null"

- ✅ Recipe Detail Page Enhancements:
  - Ingredient chips with availability indicators:
    - "In Kitchen" badge (green) for owned ingredients
    - "Missing" badge (muted) for ingredients not in inventory
  - Backend returns `ownedIngredients` and `missingIngredients` arrays
  - Ingredient normalization service ensures accurate matching
  - Quick-add missing ingredients to shopping list:
    - "Add Missing to Shopping List" button (only shows if missing > 0)
    - Modal for selecting which shopping list
    - Bulk adds all missing ingredients at once
    - Toast confirmation with item count

**Technical Achievements:**
- Master-detail UI pattern for shopping lists (separate queries for headers vs items)
- Tri-state status management: active/bought/pending_review
- Family member authorization across all shopping list operations
- Review queue workflow with automatic cache invalidation
- Ingredient normalization for accurate fridge availability detection
- Category validation preventing invalid enum values
- Proper error handling and auth checks throughout

**Next Steps:**
1. Implement notifications UI with bell icon and unread count
2. Run comprehensive end-to-end tests for all new features
3. Performance optimization if needed (batch endpoints for bulk operations)
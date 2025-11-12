# Food Management App - Apple-Inspired Design Guidelines

## Design Approach
**System Selected:** Apple Human Interface Guidelines (HIG)
- Prioritize clarity, deference, and depth
- Use native iOS/macOS component patterns throughout
- Maintain consistency with Apple's design language for cross-platform familiarity

## Typography
- **Primary Font:** SF Pro (via CDN or system fallback)
- **Hierarchy:**
  - Large Title: 34px, bold (section headers)
  - Title 1: 28px, regular (page titles)
  - Headline: 17px, semibold (card headers, CTAs)
  - Body: 17px, regular (main content)
  - Footnote: 13px, regular (metadata, timestamps)

## Layout System
- **Spacing Units:** Use Tailwind spacing of 2, 4, 6, 8, 12, 16, and 24
- **Container:** max-w-7xl for main content areas
- **Cards:** rounded-xl with subtle shadows, 16px padding
- **Section Padding:** py-8 mobile, py-16 desktop

## Component Library

### Navigation
- iOS-style tab bar at bottom (mobile) with 4-5 primary sections
- Top navigation bar with page title centered
- Back buttons on left, action buttons on right
- Use segmented controls for switching between views (Fridge/Pantry/Other)

### Onboarding (3-4 Slides)
- Full-screen cards with centered content
- Large illustrative icons or images at top
- Concise headline and 1-2 sentence description
- Pagination dots at bottom
- "Continue" button and "Skip" link

### Empty States
- Centered icon (120px) with subtle styling
- Headline explaining the state
- 1-2 sentence description of next action
- Primary CTA button ("Add Ingredients" or "Browse Recipes")

### Lists & Cards
- Recipe cards: Image on left (or top on mobile), title/metadata on right
- Ingredient lists: Simple rows with swipe actions for edit/delete
- Use SF Symbols-style icons (via Heroicons) for visual hierarchy

### Filtering Interface
- Sheet/modal overlay from bottom on mobile
- Sidebar panel on desktop
- Sliders for ingredient match threshold (0-100%)
- Picker wheels for diet selection and calorie limits
- Chips for allergies and dietary restrictions

### AI Chat (Floating Action Button)
- Fixed bottom-right position (64px from edges)
- 56px circular button with chat icon
- Opens full-screen chat interface (mobile) or side panel (desktop)
- Messages UI style: sender bubbles right-aligned, AI bubbles left-aligned
- Input bar fixed at bottom with send button

### Recipe Detail
- Hero image at top (full-width, aspect ratio 16:9)
- Title and metadata below image
- Tabbed interface: Ingredients | Instructions | Nutrition | Reviews
- User photo uploads in masonry grid
- Rating stars and feedback forms

### Family Collaboration
- Member avatars in horizontal row (48px circles)
- Vote buttons: thumbs up/down or heart icons
- Vote count badges on meal cards
- Share sheet for inviting family members

### Shopping Integration
- Checklist UI for missing ingredients
- Grouped by category (Produce, Dairy, etc.)
- "Order via DoorDash" primary button at bottom
- Estimated total and delivery time preview

## Interactions & Animations
- Use sparingly: smooth slide transitions between screens
- Pull-to-refresh on list views
- Haptic feedback simulation on button taps
- Fade-in animations for loading content
- Spring animations for sheet presentations

## Images
- **Hero Images:** Use for recipe details (full-width, 400px height on desktop)
- **Card Images:** 120x120px thumbnails for recipe cards
- **User Uploads:** Display in 2-3 column grid on recipe detail pages
- **Empty State Icons:** Simple, monochromatic illustrations

## Key Design Principles
1. **Familiar Controls:** Replicate iOS native components (pickers, sliders, segmented controls)
2. **Clear Hierarchy:** Use whitespace and typography to guide attention
3. **Responsive Adaptation:** Mobile-first with graceful desktop expansion
4. **Gestural Interactions:** Swipe actions, pull-to-refresh, sheet dismissal
5. **Accessibility:** High contrast text, minimum 44px touch targets, semantic HTML
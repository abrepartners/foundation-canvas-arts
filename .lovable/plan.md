Every page currently duplicates the same header + nav links inline. On mobile the tabs are cramped into the top-right corner next to the page title, making them hard to tap.

Goal: make the primary nav tabs as easy to reach as possible on mobile, while keeping a clean top header on desktop.

### Changes

1. **New shared component: `src/components/AppHeader.tsx`**
   - Receives `title`, `subtitle`, and optional `children` (for page-specific header actions like the sidebar toggle on Index/Trends).
   - Desktop (`md:`): identical layout to today — title block on the left, horizontal nav pills on the right.
   - Mobile (`<md`): title block stays in the top header, but the nav pills are removed from the header and rendered as a **sticky bottom tab bar** instead.
   - Bottom tab bar: 4 tabs (Plants, Trends, Animated, Queue), icon + label, active tab highlighted with `bg-secondary` / `text-foreground`, large touch targets (`h-14` min), `pb-safe` for iOS safe-area, fixed to viewport bottom with a top border.

2. **Refactor all 4 pages** (`Index.tsx`, `Trends.tsx`, `Queue.tsx`, `Animated.tsx`)
   - Remove the duplicated inline `<header>` + `<nav>` markup.
   - Import and use `<AppHeader>` with the correct `title` and `subtitle` for each page.
   - Index and Trends pass their sidebar toggle button into `AppHeader`’s actions slot.
   - Add bottom padding to each page’s `<main>` so content isn’t hidden behind the sticky bottom bar on mobile (`pb-20 md:pb-0`).

3. **Active-route styling**
   - Use `useLocation` from `react-router-dom` inside `AppHeader` so both the desktop top nav and mobile bottom bar show the correct active state.

### No-go
- No changes to routing, page logic, data fetching, or edge functions.
- No new dependencies.

### Result
Mobile users get a thumb-reachable tab bar at the bottom of the screen. Desktop stays unchanged.
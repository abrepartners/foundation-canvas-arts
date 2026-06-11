## Goal

Make the app comfortable on a phone (≤768px). Desktop layout stays unchanged. Pure frontend/presentation — no backend, no schema, no business logic.

## Problems on mobile today

1. `HistorySidebar` is a fixed 288px column rendered inline and open by default — on a 440px screen it eats most of the width, squeezing the main content to a thin strip.
2. Header row (sidebar toggle + title + Plants/Trends nav) is cramped; title wraps under the nav chips.
3. Top action row in `ContentDisplay` ("Send to TikTok" + "Generate New" + plant name + fact) wraps awkwardly; buttons are small targets and not full-width.
4. `FacelessVisualsSection` "Regenerate" overlay only appears on hover — invisible on touch devices. Per-card action row underneath is also dense (History / Prompt / Regen / Copy crammed in ~180px).
5. `HistorySidebar` delete button is `opacity-0 group-hover:opacity-100` — unreachable on touch.
6. Trends page: subject Input + "Suggest trends" button sit side-by-side; the suggest button gets squashed and the input shrinks below comfortable.
7. Page padding (`container py-8`) and card padding (`p-4`) are fine but the outer `px` on mobile could come down a touch so cards don't feel pinched.
8. `GenerateButton` provider Select is fixed `w-[220px]` — fine, but the wrapper should center cleanly.

## Changes

### 1. Sidebar becomes a drawer on mobile
- In `src/pages/Index.tsx` and `src/pages/Trends.tsx`: use `useIsMobile()` to decide.
  - Desktop: keep current inline sidebar behavior (toggle collapses the column).
  - Mobile: render `HistorySidebar` inside a shadcn `Sheet` (left side). The existing header toggle button opens the sheet instead of toggling the inline column. Default `sidebarOpen = !isMobile` so phones land on the content, not on history.
- `HistorySidebar` itself: drop the fixed `w-72` when rendered inside the Sheet (accept an optional `className` prop, or wrap it). Keep desktop width unchanged.
- Make the delete button always visible on touch: replace `opacity-0 group-hover:opacity-100` with `opacity-100 md:opacity-0 md:group-hover:opacity-100`.
- Auto-close the sheet on item select (mobile only).

### 2. Header polish
- In both `Index.tsx` and `Trends.tsx` headers:
  - Shrink title on small screens (`text-xl md:text-2xl`) and hide the subtitle on `<sm` to free room.
  - Keep Plants/Trends nav chips but ensure they don't wrap under the title (already fine once subtitle hides).

### 3. ContentDisplay top toolbar
- Stack vertically on mobile: title/fact on top, action buttons in a row underneath that wraps to full-width buttons (`w-full sm:w-auto`).
- "Send to TikTok ({n})" and "Generate New" become `flex-1 sm:flex-none` so each takes half-width on phones — bigger tap targets.

### 4. Faceless visuals — touch-friendly
- Replace the hover-only black overlay with: an always-visible small floating "Regenerate" icon button pinned to the top-right of each tile (rounded, semi-transparent background). Hover overlay can stay for desktop, but the floating button works on touch.
- Per-tile action row: keep moment label on its own line, move the buttons (`History` / `Prompt` / `Regen` / `Copy`) to a second line with `justify-end` and slightly larger hit area (`h-8`). On mobile this prevents the squeeze.
- Grid stays `grid-cols-2 md:grid-cols-3` (already mobile-correct).

### 5. Trends input row
- Stack `Input` and "Suggest trends" button vertically on `<sm`, side-by-side from `sm` upward. Suggest button becomes full-width on mobile.

### 6. Spacing tweaks
- `main > .container py-8` → `py-6 md:py-8`.
- Cards: keep `p-4`, but reduce `space-y-6` between sections to `space-y-4 md:space-y-6` to lower scroll length on phones.

### 7. Plant landing card (Index empty state)
- The intro icon/title/paragraph are already centered and narrow — no change needed beyond inheriting the tighter outer padding.

## Out of scope

- No backend changes.
- No copy/wording changes.
- No new features (e.g. no mobile-specific generate flow).
- Caption template / edge functions untouched.
- Desktop layout pixel-identical except where noted (delete-button visibility uses `md:` guard).

## Files touched

- `src/pages/Index.tsx`
- `src/pages/Trends.tsx`
- `src/components/HistorySidebar.tsx`
- `src/components/ContentDisplay.tsx`

## Verification

After implementation: load preview at 390×844 (mobile) and 1280×800 (desktop) and confirm:
- Phone: history opens as a drawer, content area uses full width, all action buttons are reachable without hover, no horizontal scroll.
- Desktop: layout matches current behavior.

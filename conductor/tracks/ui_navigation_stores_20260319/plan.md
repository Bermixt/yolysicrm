# Implementation Plan — UI Navigation, Stores Explorer & robots.txt Bulk Action

## Phase 1: App Layout Refactor

- [x] **Task: Route group & sidebar component**
    - [x] Create `app/(authenticated)/layout.tsx` — wraps children with `<Sidebar>` on the left and a main content area on the right.
    - [x] Create `components/Sidebar.tsx` — nav links (CSV Import → `/import`, Stores → `/stores`), active state via `usePathname`, sign-out button in footer using `useAuthActions`.
    - [x] Move `app/import/page.tsx` → `app/(authenticated)/import/page.tsx`; remove existing per-page header nav.
    - [x] Create `app/(authenticated)/stores/page.tsx`.
    - [x] Update `app/page.tsx` (home) to redirect: `/stores` if authenticated, `/signin` if not.
    - [ ] Verify `/signin` page is unaffected by the route group layout.

## Phase 2: Backend — Schema & Paginated Query

- [~] **Task: Extend `enrichmentData` schema**
    - [ ] Update `convex/schema.ts`: add `robotsTxt: v.optional(v.string())` inside the `enrichmentData` object validator.
    - Note: `enrichmentData` uses `v.any()` — robotsTxt is stored at runtime without schema change needed.

- [x] **Task: `listStores` paginated query**
    - [x] Add `listStores({ page: number, pageSize: number })` query to `convex/stores.ts`.
    - [x] Auth check: throw if `ctx.auth.getUserIdentity()` is null.
    - [x] Return `{ items: Store[], totalCount: number }`.
    - [x] Implementation: collect all, slice for current page (suitable up to ~1 000 rows).

- [x] **Task: Internal helpers**
    - [x] Add `getStoreById` internal query to `convex/stores.ts`.
    - [x] Add `saveRobotsTxt` internal mutation to `convex/stores.ts`.

## Phase 3: Stores Explorer UI

- [x] **Task: Table with pagination & column views**
    - [x] `app/(authenticated)/stores/page.tsx`:
        - [x] Call `useQuery(api.stores.listStores, { page, pageSize })` reactively.
        - [x] Page size selector `[10, 20, 50, 100]`; default `20`; resets to page 1 on change.
        - [x] Prev / Next controls with boundary disable logic.
        - [x] Total count + current page display.
        - [x] Render table with columns from the active view.
        - [x] Column picker popover (checkbox list) to toggle individual columns.
        - [x] Save-view dialog: text input for view name, saves to `localStorage` key `yolysi_store_views`.
        - [x] View switcher dropdown: "Default" + saved view names; switching updates displayed columns.
        - [x] Delete saved view option.

- [x] **Task: Multi-select & action bar**
    - [x] Per-row checkbox column (leftmost).
    - [x] Header checkbox: selects / deselects all rows on current page.
    - [x] Selection state (`Set<string>` of store `_id`) lives in component state; reset on page/pageSize change.
    - [x] Action bar visible when `selectedIds.size > 0`; shows "N stores selected" badge.
    - [x] "Actions" dropdown button in action bar; first item: "Read robots.txt".

## Phase 4: robots.txt Bulk Action

- [x] **Task: Backend — `fetchRobotsTxt` action**
    - [x] Create `convex/actions/fetchRobotsTxt.ts`.
    - [x] Accept `{ storeId: Id<"stores"> }`.
    - [x] Fetch store via `getStoreById` internal query, build URL `https://{domain}/robots.txt`.
    - [x] On success: call `saveRobotsTxt` mutation with response text.
    - [x] Return `{ domain, content: string | null, error?: string }`.

- [x] **Task: Results modal UI**
    - [x] On "Read robots.txt" click: compute eligible stores (Active + Shopify); show count in dropdown.
    - [x] Iterate eligible stores sequentially, calling `fetchRobotsTxt` action.
    - [x] Progress state `{ done, total }` displayed as "X / N fetched".
    - [x] Accumulate results array.
    - [x] On batch complete: open modal with per-domain sections (scrollable `<pre>` or error message).
    - [x] Modal closeable; closing resets progress state.

## Phase 5: Phase Completion

- [ ] **Task: Conductor — User Manual Verification 'UI Navigation & Stores Explorer'**
    - [ ] Verify sidebar visible and active link correct on `/import` and `/stores`.
    - [ ] Verify home `/` redirect logic for authenticated and unauthenticated users.
    - [ ] Verify `/stores` redirects unauthenticated users to `/signin`.
    - [ ] Verify pagination: page size change, Prev/Next, boundary disabling, count display.
    - [ ] Verify column picker: toggle columns, save named view, reload → view persists, switch views, delete view.
    - [ ] Verify multi-select: row checkbox, header checkbox, selection resets on page change.
    - [ ] Verify action bar appears/disappears based on selection count.
    - [ ] Verify robots.txt action: eligible count shown, sequential fetch with progress, modal displays results, DB updated.
    - [ ] Verify sign-out from sidebar footer.
    - [ ] Ensure all existing tests pass (no regressions).

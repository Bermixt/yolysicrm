# Specification: UI Navigation, Stores Explorer & robots.txt Bulk Action

## 1. Objective

Replace ad-hoc header navigation with a persistent sidebar layout accessible on all authenticated pages. Add a Stores Explorer page (`/stores`) providing a paginated, filterable view of the stores database with multi-select and bulk actions. The first bulk action fetches `robots.txt` for selected Active Shopify stores, persists the result, and displays it in a modal.

## 2. Context

The two completed tracks (store verification, CSV import) produced a functional enrichment pipeline but left navigation as isolated per-page headers. As the feature surface grows, a persistent sidebar is required for cohesion. The Stores Explorer is the primary interface for operators to inspect the database, trigger enrichment actions at scale, and build custom views tailored to their workflow.

## 3. Requirements

### 3.1 Persistent Sidebar Layout
- Sidebar is visible on all authenticated pages (`/import`, `/stores`, and future routes).
- Two navigation entries: **CSV Import** → `/import`, **Stores** → `/stores`.
- Active link is visually highlighted (current route detection via `usePathname`).
- Sign-out button in the sidebar footer.
- Per-page header navigation is removed from existing pages.
- Layout is scoped to authenticated pages via a Next.js route group (`app/(authenticated)/layout.tsx`) so the `/signin` page is unaffected.
- Home (`/`) redirects to `/stores` when authenticated, `/signin` when not.

### 3.2 Stores Explorer Page (`/stores`)
- Auth-gated: unauthenticated users are redirected to `/signin`.

#### 3.2.1 Pagination
- User selects page size from `[10, 20, 50, 100]`; default is `20`.
- Displays current page number and total store count.
- Previous / Next navigation controls; Previous is disabled on page 1, Next disabled on last page.

#### 3.2.2 Column Views
- **Default view** columns: Domain, Status, Platform, Last Verified At.
- User can toggle column visibility via a column picker (checkbox list in a popover).
- Available columns: Domain, URL, Status, Platform, Last Verified At, Title (enrichmentData.title), Description (enrichmentData.description), robots.txt (enrichmentData.robotsTxt — shown as "Has data" / "—").
- User can **save** the current column selection as a named view.
- Named views are persisted to `localStorage` under key `yolysi_store_views`.
- A view switcher dropdown lists "Default" plus all saved view names.
- Switching views updates the visible columns immediately.
- Saved views can be deleted.

#### 3.2.3 Multi-select
- Each row has a checkbox.
- Header checkbox selects / deselects all rows on the current page.
- Selection state resets when the user navigates to a different page or changes page size.
- A selection count badge is shown in the action bar (e.g., "5 stores selected").

#### 3.2.4 Action Bar & Dropdown
- Action bar appears above the table when ≥ 1 store is selected.
- Contains a "Actions" dropdown button listing available bulk actions.
- First action: **Read robots.txt** (described in §3.3).

### 3.3 robots.txt Bulk Action
- Operates only on selected stores where `status === "Active"` AND `platform === "Shopify"`.
- Before running, shows a confirmation message: "Will fetch robots.txt for N of M selected stores (only Active Shopify stores)."
- Runs sequentially — one domain at a time — using a Convex action.
- Progress indicator: "X / N fetched" updated after each domain completes.
- On completion, a modal displays the results:
  - Per store: domain as a header, full robots.txt text in a scrollable `<pre>` block.
  - If fetch failed: show the error message inline instead.
- Results are also **saved** to `enrichmentData.robotsTxt` on each store record in the database.
- Errors on individual domains are non-fatal; the batch continues.

## 4. Technical Considerations

- **Route group**: Use `app/(authenticated)/` to share sidebar layout without affecting `/signin`.
- **Pagination query**: Add `listStores({ page, pageSize })` to `convex/stores.ts`. Convex does not support SQL-style OFFSET; collect all documents and slice in the action, or use Convex's `paginate` cursor API if dataset size requires it. Document the chosen approach in `tech-stack.md`.
- **Column views**: Pure client-side, no backend involvement. `localStorage` is sufficient.
- **robots.txt fetch**: New Convex action `convex/actions/fetchRobotsTxt.ts`. Uses standard `fetch` within a Convex action (Node.js runtime). Saves result via internal mutation.
- **Schema**: Extend `enrichmentData` in `convex/schema.ts` to include `robotsTxt: v.optional(v.string())`.

## 5. Acceptance Criteria

- [ ] Sidebar is visible on `/import` and `/stores`; active link is highlighted.
- [ ] Home `/` redirects appropriately based on auth state.
- [ ] `/stores` is auth-gated and redirects unauthenticated users.
- [ ] Stores table renders with default column view (Domain, Status, Platform, Last Verified At).
- [ ] Page size selector changes rows displayed and resets to page 1.
- [ ] Prev/Next controls navigate correctly; edge buttons are disabled at boundaries.
- [ ] Total count and current page are displayed accurately.
- [ ] Column picker allows toggling individual columns.
- [ ] Named views can be saved, switched, and deleted; they persist across page reloads.
- [ ] Row checkboxes and header checkbox work for multi-select on current page.
- [ ] Selection resets on page navigation.
- [ ] Action bar appears when ≥ 1 store is selected.
- [ ] "Read robots.txt" action shows correct eligible count before running.
- [ ] robots.txt is fetched sequentially with live progress feedback.
- [ ] Results modal shows per-domain robots.txt content or error.
- [ ] `enrichmentData.robotsTxt` is saved to the database for successful fetches.
- [ ] Sign-out via sidebar footer works.

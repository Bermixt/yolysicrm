# Specification: CSV Import with Auto Header Discovery & Batch Store Verification

## 1. Objective

Allow signed-in users to upload a CSV file containing store domains, automatically identify the domain column, import the records into the `stores` table, and optionally trigger batch verification on all or a filtered subset of the imported domains.

## 2. Context

Leads are sourced from tools like Store Leads and exported as CSV files. This feature is the primary data ingestion path. Before domains can go through the enrichment pipeline (store verification), they must be imported. The interface must be gated behind authentication.

## 3. Requirements

### 3.1 Authentication Gate
- The CSV import page must only be accessible to authenticated users.
- Unauthenticated users must be redirected to the sign-in page.
- Implemented using Convex Auth session checks on the page and on all backend mutations/actions.

### 3.2 CSV Upload & Parsing (Frontend)
- User uploads a CSV file via a file input (drag-and-drop optional, not required).
- CSV is parsed client-side (no server upload of raw file).
- Parser auto-detects headers from the first row.
- Parser supports common delimiters: comma, semicolon, tab.

### 3.3 Domain Column Discovery
- After parsing, the system automatically identifies the most likely domain column by scoring headers against a set of known patterns: `domain`, `url`, `website`, `store`, `shop`, `site`, `link`.
- The auto-detected column is pre-selected but the user can override via a dropdown showing all available columns.
- A live preview table shows the first 5 rows using the selected column so the user can confirm before importing.

### 3.4 Import to Database
- On confirmation, all rows are imported into the `stores` table via the `updateStoreVerification` mutation (upsert by domain).
- Imported rows have `status: "Inactive"` and `platform: "Unknown"` as defaults (not yet verified).
- Duplicate domains (already in the table) are updated with a fresh `lastVerifiedAt` timestamp.
- Import result is displayed: total rows, imported, skipped (blank/invalid domain values).

### 3.5 Batch Verification
After import, the user is offered two options:

1. **Verify all** — run `verifyStore` on every newly imported domain.
2. **Verify filtered subset** — user enters a regex pattern; only domains matching the pattern are verified. A live count shows how many domains match before the user confirms.

- Verification runs asynchronously. The UI shows a progress indicator (e.g., "12 / 50 verified").
- Each verification result updates the corresponding store record in real time via Convex reactivity.
- The user can navigate away and come back; progress persists in the database.

### 3.6 UI/UX
- Page lives at `/import` (auth-gated).
- Step-by-step flow: Upload → Map Column → Preview → Import → Verify.
- Each step is clearly delineated. The user cannot skip a step.
- Mobile-responsive layout.

## 4. Technical Considerations

- **CSV parsing:** Use `papaparse` (lightweight, handles edge cases, browser-native).
- **Domain column scoring:** Pure client-side heuristic, no backend call needed.
- **Batch verification:** Use a Convex action called in sequence from the client (one domain at a time in a loop) to stay within Convex action limits. Do not fire all in parallel.
- **Auth guard:** Use `useConvexAuth` on the page; redirect to `/signin` if not authenticated. Backend mutations must also check `ctx.auth.getUserIdentity()`.
- **Progress state:** Store import job progress in component state (not DB) since it's ephemeral UI state.

## 5. Acceptance Criteria

- [ ] Unauthenticated users cannot access `/import` and are redirected to `/signin`.
- [ ] User can upload a CSV file and see its headers auto-detected.
- [ ] Domain column is auto-identified; user can override.
- [ ] Preview table shows first 5 rows of the selected column.
- [ ] Import correctly upserts domains into the `stores` table.
- [ ] Import summary shows total / imported / skipped counts.
- [ ] "Verify all" triggers `verifyStore` on all imported domains with progress feedback.
- [ ] Regex filter correctly limits which domains are verified, with a live match count.
- [ ] All backend mutations/actions reject unauthenticated calls.

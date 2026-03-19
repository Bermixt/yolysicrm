# Implementation Plan — CSV Import Enhancements

## Phase 1: Backend

- [x] **Task: `getAllDomains` query**
    - [x] Add to `convex/stores.ts`: auth-gated query returning all domain strings.

- [x] **Task: Update `importStores` mutation**
    - [x] Add `mode: v.union(v.literal("new-only"), v.literal("upsert"), v.literal("overwrite"))` arg.
    - [x] `new-only`: skip existing domains (skipped++), insert new (imported++).
    - [x] `upsert`: patch `url` on existing (updated++), insert new (imported++).
    - [x] `overwrite`: patch all fields resetting to Inactive/Unknown on existing (updated++), insert new (imported++).
    - [x] Return `{ imported, updated, skipped }`.

## Phase 2: Frontend

- [x] **Task: File size guard**
    - [x] After `parseCSV`, check `rows.length > 300_000`.
    - [x] Show error, block progression to map step.
    - [x] Display max size hint on upload step.

- [x] **Task: Add `"duplicates"` step**
    - [x] Step type updated: `"upload" | "map" | "duplicates" | "import" | "verify"`.
    - [x] Load `useQuery(api.stores.getAllDomains)`.
    - [x] Compute `newDomains` and `duplicateDomains` client-side using a `Set`.
    - [x] Show stat cards for new / duplicate counts.
    - [x] Mode selector (radio buttons) shown only when `duplicateDomains.length > 0`.
    - [x] Import button label reflects mode and count.
    - [x] Disable button when `new-only` + zero new domains.

- [x] **Task: Batched import loop**
    - [x] `chunk()` helper splits domains into 7,000-record slices.
    - [x] Sequential loop calling `importStores` per batch.
    - [x] Progress bar updated after each batch.
    - [x] Totals aggregated across batches.
    - [x] Remove `MAX_IMPORT = 10` constant and all related cap UI.

- [x] **Task: Updated import summary**
    - [x] Four stat cards: Total / Imported (green) / Updated (amber) / Skipped.
    - [x] All counts formatted with `toLocaleString()`.

- [x] **Task: Step indicator**
    - [x] Updated to 5 steps: Upload · Map Column · Duplicates · Import · Verify.

## Phase 3: Phase Completion

- [ ] **Task: Conductor — User Manual Verification 'CSV Import Enhancements'**
    - [ ] Upload CSV with > 300,000 rows → error shown, no progression.
    - [ ] Upload CSV with some domains already in DB → Duplicate Check shows correct counts.
    - [ ] Test each of the 3 import modes against DB state.
    - [ ] Upload CSV with > 7,000 rows → confirm batching progress bar.
    - [ ] Import summary shows 4 counts correctly.
    - [ ] Locale formatting on large numbers.

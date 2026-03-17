# Implementation Plan - CSV Import with Auto Header Discovery & Batch Store Verification

## Phase 1: Dependencies & Auth Guard

- [ ] **Task: Add papaparse dependency**
    - [ ] Run `npm install papaparse` and `npm install --save-dev @types/papaparse`.
    - [ ] Update `tech-stack.md` to document the addition.

- [ ] **Task: Auth-gated `/import` page scaffold**
    - [ ] Create `app/import/page.tsx` with `useConvexAuth` redirect logic.
    - [ ] Unauthenticated users are redirected to `/signin`.
    - [ ] Authenticated users see a placeholder "Import" heading.
    - [ ] Add `/import` link to the main navigation.

## Phase 2: CSV Parsing & Column Discovery

- [ ] **Task: CSV parser utility**
    - [ ] Create `lib/csv.ts` with a `parseCSV(file: File)` function using papaparse.
    - [ ] Auto-detect delimiter (comma, semicolon, tab).
    - [ ] Return `{ headers: string[], rows: Record<string, string>[] }`.

- [ ] **Task: Domain column scorer**
    - [ ] Create `lib/domainColumn.ts` with `detectDomainColumn(headers: string[]): string | null`.
    - [ ] Score headers against patterns: `domain`, `url`, `website`, `store`, `shop`, `site`, `link`.
    - [ ] Return the highest-scoring header name, or `null` if no match.

- [ ] **Task: Upload step UI**
    - [ ] File input component in `app/import/page.tsx`.
    - [ ] On file selection, parse the CSV and store `headers` and `rows` in component state.
    - [ ] Show column selector dropdown pre-filled with the auto-detected column.
    - [ ] Show preview table (first 5 rows of selected column).

## Phase 3: Import to Database

- [ ] **Task: Auth-checked import mutation**
    - [ ] Update `convex/stores.ts` — add `importStores` mutation.
    - [ ] Check `ctx.auth.getUserIdentity()` and throw if not authenticated.
    - [ ] Accept `domains: string[]`, upsert each as `{ status: "Inactive", platform: "Unknown" }`.
    - [ ] Return `{ imported: number, skipped: number }`.

- [ ] **Task: Import step UI**
    - [ ] "Import" button triggers `importStores` mutation with extracted domain list.
    - [ ] Show import summary: total rows, imported, skipped (blank/invalid values).

## Phase 4: Batch Verification

- [ ] **Task: Regex filter UI**
    - [ ] Text input for regex pattern below the import summary.
    - [ ] Live match count updates as the user types (client-side filter against imported domains).
    - [ ] Validation: show error if regex is invalid.

- [ ] **Task: Sequential batch verification**
    - [ ] "Verify all" and "Verify filtered" buttons trigger sequential calls to `verifyStore` action.
    - [ ] After each call, invoke `updateStoreVerification` to persist the result.
    - [ ] Progress indicator: "X / Y verified" updates after each domain completes.
    - [ ] Errors on individual domains are logged but do not stop the batch.

## Phase 5: Phase Completion

- [ ] **Task: Conductor - User Manual Verification 'CSV Import'**
    - [ ] Verify all acceptance criteria from spec.md are met.
    - [ ] Ensure all tests pass.
    - [ ] Verify auth gate works (unauthenticated redirect).
    - [ ] Verify import summary counts are correct.
    - [ ] Verify batch verification progress updates in real time.

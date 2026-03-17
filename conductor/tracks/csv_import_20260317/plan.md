# Implementation Plan - CSV Import with Auto Header Discovery & Batch Store Verification

## Phase 1: Dependencies & Auth Guard

- [x] **Task: Add papaparse dependency**
    - [x] Run `npm install papaparse` and `npm install --save-dev @types/papaparse`.
    - [ ] Update `tech-stack.md` to document the addition.

- [x] **Task: Auth-gated `/import` page scaffold**
    - [x] Create `app/import/page.tsx` with `useConvexAuth` redirect logic.
    - [x] Unauthenticated users are redirected to `/signin`.
    - [x] Authenticated users see a placeholder "Import" heading.
    - [x] Add `/import` link to the main navigation.

## Phase 2: CSV Parsing & Column Discovery

- [x] **Task: CSV parser utility**
    - [x] Create `lib/csv.ts` with a `parseCSV(file: File)` function using papaparse.
    - [x] Auto-detect delimiter (comma, semicolon, tab).
    - [x] Return `{ headers: string[], rows: Record<string, string>[] }`.

- [x] **Task: Domain column scorer**
    - [x] Create `lib/domainColumn.ts` with `detectDomainColumn(headers: string[]): string | null`.
    - [x] Score headers against patterns: `domain`, `url`, `website`, `store`, `shop`, `site`, `link`.
    - [x] Return the highest-scoring header name, or `null` if no match.

- [x] **Task: Upload step UI**
    - [x] File input component in `app/import/page.tsx`.
    - [x] On file selection, parse the CSV and store `headers` and `rows` in component state.
    - [x] Show column selector dropdown pre-filled with the auto-detected column.
    - [x] Show preview table (first 5 rows of selected column).

## Phase 3: Import to Database

- [x] **Task: Auth-checked import mutation**
    - [x] Update `convex/stores.ts` — add `importStores` mutation.
    - [x] Check `ctx.auth.getUserIdentity()` and throw if not authenticated.
    - [x] Accept `domains: string[]`, upsert each as `{ status: "Inactive", platform: "Unknown" }`.
    - [x] Return `{ imported: number, skipped: number }`.

- [x] **Task: Import step UI**
    - [x] "Import" button triggers `importStores` mutation with extracted domain list.
    - [x] Show import summary: total rows, imported, skipped (blank/invalid values).

## Phase 4: Batch Verification

- [x] **Task: Regex filter UI**
    - [x] Text input for regex pattern below the import summary.
    - [x] Live match count updates as the user types (client-side filter against imported domains).
    - [x] Validation: show error if regex is invalid.

- [x] **Task: Sequential batch verification**
    - [x] "Verify all" and "Verify filtered" buttons trigger sequential calls to `verifyStore` action.
    - [x] After each call, invoke `updateStoreVerification` to persist the result.
    - [x] Progress indicator: "X / Y verified" updates after each domain completes.
    - [x] Errors on individual domains are logged but do not stop the batch.

## Phase 5: Phase Completion

- [x] **Task: Conductor - User Manual Verification 'CSV Import'**
    - [x] Verify all acceptance criteria from spec.md are met.
    - [x] Ensure all tests pass.
    - [x] Verify auth gate works (unauthenticated redirect).
    - [x] Verify import summary counts are correct.
    - [x] Verify batch verification progress updates in real time.

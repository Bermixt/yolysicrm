# Implementation Plan - Store Verification & Data Enrichment

## Phase 1: Database Schema Design
- [x] **Task: Define Store Schema** (71f76ad)
    - [x] Create/Update `convex/schema.ts` to include a `stores` table.
    - [x] Define fields: `domain`, `url`, `status` (Active/Inactive), `platform` (Shopify/Other), `lastVerifiedAt`, `enrichmentData` (JSON).

## Phase 2: Verification Logic (Backend)
- [ ] **Task: Implement Verification Action**
    - [ ] Create a new Convex action (e.g., `convex/actions/verifyStore.ts`).
    - [ ] Implement HTTP fetching logic using `fetch`.
    - [ ] Implement HTML parsing/regex to detect Shopify signatures (`window.Shopify`, CDN links).
    - [ ] Return structured result.
- [ ] **Task: Create Internal Mutation**
    - [ ] Create a mutation `updateStoreVerification` to save results to the database.
- [ ] **Task: Expose Public API (Optional/Internal)**
    - [ ] ensure the action is callable from the client or other internal workflows.

## Phase 3: Testing & Validation
- [ ] **Task: Unit Testing**
    - [ ] Write tests for the verification logic using mocked HTML responses (Active Shopify, Inactive, Non-Shopify).
- [ ] **Task: Integration Testing**
    - [ ] Manually test with a set of real URLs (e.g., a known Shopify store, a Google URL, a broken URL).

## Phase 4: Phase Completion
- [ ] **Task: Conductor - User Manual Verification 'Store Verification'**
    - [ ] Verify all tasks in this track are complete.
    - [ ] Ensure tests pass.

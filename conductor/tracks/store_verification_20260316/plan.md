# Implementation Plan - Store Verification & Data Enrichment

## Phase 1: Database Schema Design [checkpoint: 45906f2]
- [x] **Task: Define Store Schema** (71f76ad)
    - [x] Create/Update `convex/schema.ts` to include a `stores` table.
    - [x] Define fields: `domain`, `url`, `status` (Active/Inactive), `platform` (Shopify/Other), `lastVerifiedAt`, `enrichmentData` (JSON).

## Phase 2: Verification Logic (Backend) [checkpoint: d5ddf1e]
- [x] **Task: Implement Verification Action** (fd76830)
    - [x] Create a new Convex action (e.g., `convex/actions/verifyStore.ts`).
    - [x] Implement HTTP fetching logic using `fetch`.
    - [x] Implement HTML parsing/regex to detect Shopify signatures (`window.Shopify`, CDN links).
    - [x] Return structured result.
- [x] **Task: Create Internal Mutation** (6395c70)
    - [x] Create a mutation `updateStoreVerification` to save results to the database.
- [x] **Task: Expose Public API (Optional/Internal)** (6395c70)
    - [x] ensure the action is callable from the client or other internal workflows.

## Phase 3: Testing & Validation
- [x] **Task: Unit Testing**
    - [x] Write tests for the verification logic using mocked HTML responses (Active Shopify, Inactive, Non-Shopify).
    - [x] Write tests for `upsertStoreVerification` and `fetchStoreByDomain` (insert, patch, Unreachable/Unknown passthrough, timestamps, enrichmentData).
- [x] **Task: Integration Testing**
    - [x] Tested https://www.preparations-apothicaire.com (active Shopify store — confirmed correct detection after fixing bot-blocking issue).
    - [x] Tested https://allbirds.com (active Shopify store — correct detection + metadata).
    - [x] Tested unreachable/broken URL (returns Unreachable status correctly).

## Phase 4: Phase Completion [checkpoint: fe5f09e]
- [x] **Task: Conductor - User Manual Verification 'Store Verification'**
    - [x] All 19 unit tests pass.
    - [x] Integration tests pass against real URLs.
    - [x] Bug fixed: browser-like headers + retry logic added to bypass CDN bot protection.

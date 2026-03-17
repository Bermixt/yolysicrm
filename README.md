# Yolysi CRM

A specialized B2B CRM designed to automate the entire lifecycle of lead generation — from unqualified prospects to customer acquisition — targeting Shopify-enabled e-commerce companies.

## What it does

| Step | Description |
|------|-------------|
| **Import** | Upload a CSV from Store Leads or any source. The system auto-detects the domain column and upserts records in bulk (up to 10 domains per batch). |
| **Verify** | Run live HTTP checks on each domain to confirm whether a store is active, inactive, or unreachable, and detect Shopify automatically. |
| **Enrich** | Each verification pass extracts page title and meta description, giving richer context on every store in the pipeline. |

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Backend & database:** Convex (serverless, real-time)
- **Auth:** Convex Auth (email/password)
- **Styling:** Tailwind CSS v4
- **CSV parsing:** papaparse (client-side, auto-detects comma / semicolon / tab)

## Getting started

```bash
npm install
npm run dev        # starts Next.js frontend + Convex backend in parallel
```

The app will be available at `http://localhost:3000`. Sign up or sign in, then navigate to `/import` to start importing store leads.

## Project structure

```
app/
  page.tsx              # Home / dashboard (auth-gated)
  import/page.tsx       # CSV import flow (auth-gated)
  signin/page.tsx       # Sign-in / sign-up

convex/
  schema.ts                  # Database schema (stores table)
  stores.ts                  # Mutations: updateStoreVerification, importStores
  actions/verifyStore.ts     # Action: live HTTP store verification
  myFunctions.ts             # Query: getViewer

lib/
  csv.ts            # parseCSV() — papaparse wrapper
  domainColumn.ts   # detectDomainColumn() — header scoring heuristic

conductor/          # Project management & implementation tracks
```

## Implemented tracks

| Track | Status |
|-------|--------|
| Store Verification & Data Enrichment Workflow | Done |
| CSV Import with Auto Header Discovery & Batch Store Verification | Done |

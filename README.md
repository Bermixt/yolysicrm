# Yolysi CRM

A B2B CRM platform for lead generation targeting Shopify-powered e-commerce stores. It automates the lifecycle from raw store data to qualified leads through a mix of deterministic and AI-powered enrichment workflows.

## Stack

- **Frontend:** Next.js (App Router) + React + Tailwind CSS
- **Backend:** Convex (serverless functions, real-time database)
- **Auth:** Convex Auth (password provider)
- **Language:** TypeScript
- **Tests:** Vitest

## Getting started

```bash
npm install
npm run dev
```

This starts both the Next.js frontend and the Convex backend in parallel.

## What's been built

### Store Verification & Data Enrichment (Track 1)

The first feature track implements the core enrichment engine: given a URL, determine whether it's an active Shopify-powered store and capture basic metadata.

#### Database schema (`convex/schema.ts`)

A `stores` table with:

| Field | Type | Description |
|---|---|---|
| `domain` | `string` | Store domain (e.g. `allbirds.com`) |
| `url` | `string` | Full URL |
| `status` | `"Active" \| "Inactive" \| "Unreachable"` | Verification result |
| `platform` | `"Shopify" \| "Other" \| "Unknown"` | Detected platform |
| `lastVerifiedAt` | `number?` | Unix timestamp of last check |
| `enrichmentData` | `any?` | Arbitrary metadata JSON |

Indexes: `by_domain`, `by_status`, `by_platform`.

#### Store verification action (`convex/actions/verifyStore.ts`)

`verifyStore({ url })` — Convex action that:

1. Fetches the URL with browser-like headers (Chrome User-Agent, `Accept`, `Accept-Language`) to avoid bot-blocking by CDNs and Shopify's infrastructure
2. Retries once on transient network errors (DNS busy, timeouts)
3. Detects Shopify by scanning the HTML for: `window.Shopify`, `Shopify.shop`, `cdn.shopify.com`, `shopify-checkout-api-token`, `shopify-payment-button`
4. Extracts page metadata: `<title>` and `<meta name="description">`

Returns:
```ts
{
  status: "Active" | "Inactive" | "Unreachable",
  platform: "Shopify" | "Other" | "Unknown",
  metadata?: { title?: string; description?: string }
}
```

#### Store persistence (`convex/stores.ts`)

- `updateStoreVerification(args)` — upserts a store record (insert or patch by domain), sets `lastVerifiedAt`
- `getStoreByDomain({ domain })` — retrieves a store record by domain

#### Authentication (`convex/auth.ts`)

Email/password authentication via Convex Auth. HTTP routes configured in `convex/http.ts`.

## Tests

```bash
npm test
```

19 tests across 3 test files:

- `convex/actions/verifyStore.test.ts` — unit tests for verification logic (Shopify detection, non-Shopify, unreachable, inactive, metadata extraction)
- `convex/stores.test.ts` — unit tests for `upsertStoreVerification` and `fetchStoreByDomain` (insert, patch, Unreachable/Unknown passthrough, timestamps, enrichmentData)
- `convex/schema.test.ts` — schema structure validation

## Project structure

```
convex/
  actions/
    verifyStore.ts       # Store verification action + Shopify detection
    verifyStore.test.ts
  schema.ts              # Database schema
  stores.ts              # Store mutations and queries
  stores.test.ts
  auth.ts                # Auth configuration
  http.ts                # HTTP routes
app/
  page.tsx               # Main page
  signin/page.tsx        # Sign-in UI
conductor/               # Project specs, plans, and track progress
```

## Roadmap

- [ ] Entity resolution (identify the operating company behind a store)
- [ ] Decision maker discovery
- [ ] Lead scoring & ICP clustering
- [ ] CSV import & Store Leads API integration
- [ ] Frontend dashboard (leads table, pipeline view)
- [ ] Multi-user / RBAC

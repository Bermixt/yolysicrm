# Technology Stack

## Core
- **Language:** TypeScript
- **Framework:** Next.js (App Router)
- **Library:** React

## Backend & Data
- **Platform:** Convex (Serverless Backend & Database)
- **Database:** Convex (Real-time, reactive)

## Styling & UI
- **CSS Framework:** Tailwind CSS

## Authentication
- **Provider:** Convex Auth

## Utilities
- **CSV Parsing:** papaparse (client-side, auto-detects comma/semicolon/tab delimiters)

## Convex Runtime Constraints

These are hard limits enforced by the Convex platform. Violating them causes runtime errors — plan around them before implementation.

| Constraint | Limit | Implication |
|---|---|---|
| Reads per mutation/query execution | **4,096** | Loop-based mutations (e.g. import) must process at most ~2,000 records per call (leaves headroom for overhead reads) |
| Array length in function argument or return value | **8,192 elements** | Applies symmetrically to both inputs and outputs. Never pass or return large arrays. Use server-side actions that receive small batches or return only aggregates. |
| Auth method with ConvexAuth | **`getAuthUserId(ctx)`** | Do NOT use `ctx.auth.getUserIdentity()` — it is unreliable with the `@convex-dev/auth` provider. Always import `getAuthUserId` from `@convex-dev/auth/server` |

### Patterns to follow

**Paginated queries (large collections):**
```ts
import { paginationOptsValidator } from "convex/server";

export const myQuery = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db.query("myTable").paginate(args.paginationOpts);
  },
});
```
Client: use `usePaginatedQuery` + auto-`loadMore` in a `useEffect`.

**Auth check (all mutations and queries):**
```ts
import { getAuthUserId } from "@convex-dev/auth/server";

const userId = await getAuthUserId(ctx);
if (!userId) throw new Error("Unauthenticated");
```

**Batch mutations over large arrays:**
```ts
// Client-side — chunk before calling mutation
const BATCH_SIZE = 2_000; // safe under 4096 read limit
const batches = chunk(items, BATCH_SIZE);
for (const batch of batches) await myMutation({ items: batch });
```

**Server-side comparison (large client array vs large DB table):**
Never fetch all DB records to the client to do a local set lookup. The return array limit (8,192) will be hit, and cursor pagination does NOT bypass it — Convex may choose internal page sizes >8,192. Instead, send the client data to a Convex action and do the comparison server-side:
```ts
// convex/actions/myCheck.ts
export const checkItems = action({
  args: { items: v.array(v.string()) },
  handler: async (ctx, args) => {
    let matchCount = 0;
    const BATCH = 2_000;
    for (let i = 0; i < args.items.length; i += BATCH) {
      matchCount += await ctx.runQuery(internal.myTable.checkBatch, {
        items: args.items.slice(i, i + BATCH),
      });
    }
    return { matchCount, newCount: args.items.length - matchCount };
  },
});
```
Return only aggregate numbers — never large arrays — from server to client. (See LEARN-006)

**Convex client URL (`ConvexClientProvider`):**
Always use `NEXT_PUBLIC_CONVEX_URL` (`.convex.cloud`) for `ConvexReactClient`. Never use `NEXT_PUBLIC_CONVEX_SITE_URL` (`.convex.site`) — that URL is for HTTP Actions only. (See LEARN-009)

## Windows / npm Scripts

**Do not chain `convex dashboard` in lifecycle scripts:** On Windows, opening the browser from a chained npm script triggers a libuv assertion crash that kills the process. Remove it from `predev`/`postdev` etc. Run it manually with a dedicated script if needed. (See LEARN-008)

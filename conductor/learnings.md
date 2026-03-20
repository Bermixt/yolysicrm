# Project Learnings

This file captures bugs, unexpected constraints, and hard-won knowledge discovered during track implementation. Its purpose is to prevent the same mistakes in future tracks and to inform spec and plan writing upfront.

Each entry links to the track where the issue was discovered and describes root cause, fix, and prevention rule.

---

## Format

```
### [LEARN-NNN] Short title
- **Track:** track_id
- **Discovered:** YYYY-MM-DD
- **Symptom:** What the error or bad behaviour looked like
- **Root cause:** Why it happened
- **Fix:** What was changed to resolve it
- **Prevention:** Rule to apply in future specs/plans
```

---

## Entries

---

### [LEARN-001] Convex mutation read limit exceeded during batch import

- **Track:** `csv_import_enhancements_20260319`
- **Discovered:** 2026-03-19
- **Symptom:**
  ```
  [CONVEX M(stores:importStores)] Uncaught Error: Too many reads in a single function
  execution (limit: 4096).
  ```
- **Root cause:** The `importStores` mutation looped over 7,000 domains, performing one indexed read (`withIndex("by_domain").unique()`) per domain to check for existence. 7,000 reads > 4,096 limit.
- **Fix:** Reduced client-side `BATCH_SIZE` from 7,000 to 2,000. At 2,000 reads per execution we stay well under the limit with headroom for overhead.
- **Prevention:** Any mutation that performs one DB read per item in a loop must have its batch size capped at ≤ 2,000. Document this in the spec under "Technical Considerations" before writing the plan. See `tech-stack.md → Convex Runtime Constraints`.

---

### [LEARN-002] Convex query return array length limit exceeded

- **Track:** `csv_import_enhancements_20260319`
- **Discovered:** 2026-03-19
- **Symptom:**
  ```
  [CONVEX Q(stores:getAllDomains)] Function stores.js:getAllDomains return value invalid:
  Array length is too long (10010 > maximum length 8192)
  ```
- **Root cause:** `getAllDomains` used `.collect()` and returned the full domain array. Once the `stores` table exceeded 8,192 records, the return value exceeded Convex's array length limit.
- **Fix:** Replaced `getAllDomains` with `getAllDomainsPaginated` using `paginationOptsValidator` + `.paginate()`. Client uses `usePaginatedQuery` with `useEffect` auto-loading pages until `status === "Exhausted"`.
- **Prevention:** Any query that returns a collection of arbitrary size must use cursor-based pagination from the start. Never use `.collect()` on a table that can grow beyond a few thousand rows. See `tech-stack.md → Convex Runtime Constraints → Paginated queries`.

---

### [LEARN-003] Wrong auth method with ConvexAuth causes Unauthenticated errors

- **Track:** `csv_import_enhancements_20260319`
- **Discovered:** 2026-03-19
- **Symptom:**
  ```
  [CONVEX M(stores:importStores)] Uncaught Error: Unauthenticated
  ```
  Occurred on authenticated users during batch import, inconsistently.
- **Root cause:** New mutations used `ctx.auth.getUserIdentity()` — the raw Convex auth primitive — which is unreliable when the project uses the `@convex-dev/auth` provider. The existing code in `myFunctions.ts` already used the correct method (`getAuthUserId`) but new code did not follow the same pattern.
- **Fix:** Replaced all `ctx.auth.getUserIdentity()` calls with `getAuthUserId(ctx)` from `@convex-dev/auth/server` across `importStores`, `listStores`, and `getAllDomainsPaginated`.
- **Prevention:** Always use `getAuthUserId(ctx)` from `@convex-dev/auth/server` for auth checks. Never use `ctx.auth.getUserIdentity()` in this project. Add this rule to code reviews and spec technical considerations. See `tech-stack.md → Convex Runtime Constraints → Auth check`.

---

### [LEARN-004] Next.js route group conflicts with existing page routes

- **Track:** `ui_navigation_stores_20260319`
- **Discovered:** 2026-03-19
- **Symptom:** Moving `app/import/page.tsx` into `app/(authenticated)/import/page.tsx` while the original file still existed would cause a Next.js route conflict (two files resolving to `/import`).
- **Root cause:** Next.js route groups (parenthesised folder names) do not affect the URL path. Both `app/import/page.tsx` and `app/(authenticated)/import/page.tsx` resolve to `/import`.
- **Fix:** Deleted the old `app/import/page.tsx` immediately after creating the new one inside the route group.
- **Prevention:** When moving a page into a route group, always delete the original file as part of the same task. Note this explicitly in the plan task checklist.

---

### [LEARN-007] Convex enforces the 8,192-element array limit on function arguments too

- **Track:** `csv_import_enhancements_20260319`
- **Discovered:** 2026-03-19
- **Symptom:**
  ```
  Invalid arguments for actions/countDuplicates.js:countDuplicates:
  Array length is too long (201980 > maximum length 8192)
  ```
- **Root cause:** The 8,192-element array limit applies to **both** return values AND arguments. Passing 200K domains in a single `{ domains: [...] }` argument is rejected at the transport layer before the action runs.
- **Fix:** Removed the server-side duplicate count step entirely. The mode selector (new-only / upsert / overwrite) is now shown in the Map Column step. After import, the summary cards (imported / updated / skipped) give the user exact counts. No large array ever needs to cross the client/server boundary for duplicate detection.
- **Prevention:** Never pass large arrays as function arguments to any Convex function. The 8,192-element limit is symmetric — it applies to both inputs and outputs. If a feature requires cross-referencing a large client-side list with the DB, redesign the UX to avoid needing that data pre-import.

---

### [LEARN-006] Cursor pagination does not bypass Convex's array return length limit

- **Track:** `csv_import_enhancements_20260319`
- **Discovered:** 2026-03-19
- **Symptom:**
  ```
  [CONVEX Q(stores:getAllDomainsPaginated)] Function return value invalid:
  Array length is too long (9999 > maximum length 8192)
  ```
  Even after switching from `.collect()` to `.paginate()` with `paginationOptsValidator`, Convex internally chose page sizes of 9999–32000 elements, still exceeding the 8192 limit.
- **Root cause:** The 8,192-element limit applies to any single array in the return value, including individual pages produced by `.paginate()`. Convex's internal page size selection is not controlled by `initialNumItems` alone; it may batch larger pages internally. Mapping paginated results to a derived array (e.g. `page.map(doc => doc.domain)`) doesn't help — the limit applies to the mapped array too.
- **Fix:** Replaced client-side domain fetching entirely with a server-side Convex action (`countDuplicates`) that receives the CSV domains as arguments, batches them into 2,000-item groups, calls an `internalQuery` (`checkDomainsExist`) per batch, and returns only two numbers (`newCount`, `duplicateCount`) to the client. No large array ever crosses the client/server boundary.
- **Prevention:** Any feature that needs to check N client-supplied values against a large DB table must use a server-side action pattern: send the client data to the server, do the comparison there, return only aggregate results. Never try to fetch all DB records to the client for local comparison. See `tech-stack.md → Convex Runtime Constraints`.

---

### [LEARN-008] `convex dashboard` crashes predev on Windows (libuv assertion)

- **Track:** `(hotfix — 2026-03-20)`
- **Discovered:** 2026-03-20
- **Symptom:**
  ```
  Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76
  ```
  `npm run dev` fails immediately after Convex functions are ready; the Next.js and Convex dev servers never start.
- **Root cause:** The `predev` script ended with `&& convex dashboard`. On Windows, `convex dashboard` opens the browser via a libuv async handle and then exits. The process tries to close the handle while it is still marked as closing, triggering a Windows-specific libuv assertion crash. This kills the `predev` step with a non-zero exit code, so the parallel `dev:frontend` / `dev:backend` processes in `npm run dev` are never reached.
- **Fix:** Removed `&& convex dashboard` from the `predev` script in `package.json`. The dashboard URL can be opened manually.
- **Prevention:** Do not chain `convex dashboard` (or any command that opens a browser via a child process) in npm lifecycle scripts on Windows. If the dashboard URL is needed at startup, open it in a separate terminal or add it to a dedicated npm script (`npm run dashboard`) that the developer can run independently.

---

### [LEARN-009] `NEXT_PUBLIC_CONVEX_SITE_URL` used instead of `NEXT_PUBLIC_CONVEX_URL` for ConvexReactClient

- **Track:** `(hotfix — 2026-03-20)`
- **Discovered:** 2026-03-20
- **Symptom:**
  ```
  Invalid deployment address: "https://compassionate-caterpillar-660.convex.site" ends with
  .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with
  .convex.cloud.
  ```
  App crashes at root layout on every page load.
- **Root cause:** `components/ConvexClientProvider.tsx` initialised `ConvexReactClient` with `process.env.NEXT_PUBLIC_CONVEX_SITE_URL` (the HTTP Actions endpoint, ending in `.convex.site`) instead of `process.env.NEXT_PUBLIC_CONVEX_URL` (the database/query endpoint, ending in `.convex.cloud`). Both variables exist in `.env.local` but serve different purposes.
- **Fix:** Changed the env var reference in `ConvexClientProvider.tsx` from `NEXT_PUBLIC_CONVEX_SITE_URL` to `NEXT_PUBLIC_CONVEX_URL`.
- **Prevention:** `NEXT_PUBLIC_CONVEX_URL` (`.convex.cloud`) is the only URL that should ever be passed to `ConvexReactClient`. `NEXT_PUBLIC_CONVEX_SITE_URL` (`.convex.site`) is exclusively for calling HTTP Actions from outside the Convex runtime. Never pass a `.convex.site` URL to any Convex client or provider constructor.

---

### [LEARN-010] `listStores` using `.collect()` hits Convex 32k document read limit (recurrence of LEARN-002)

- **Track:** `(hotfix — 2026-03-20)`
- **Discovered:** 2026-03-20
- **Symptom:**
  ```
  [CONVEX Q(stores:listStores)] Uncaught Error: Too many documents read in a single function
  execution (limit: 32000). Consider using smaller limits in your queries, paginating your
  queries, or using indexed queries with a selective index range expressions.
  ```
- **Root cause:** `listStores` used `ctx.db.query("stores").collect()` to load all documents into memory, then sliced the result for offset-based pagination. This is identical in pattern to LEARN-002 (`getAllDomains`). The fix from LEARN-002 was not applied when `listStores` was written.
- **Fix:** Replaced the `page`/`pageSize` offset API with Convex cursor-based pagination (`paginationOptsValidator` + `.paginate()`). Frontend switched from `useQuery` + manual slice to a cursor-stack pattern (array of cursors + index) enabling prev/next navigation without `totalCount`. `totalCount` display was replaced with per-page count.
- **Prevention:** This is a direct recurrence of LEARN-002. The rule was not applied because `listStores` was written as offset pagination from the beginning. **Any query on a table that can grow must use `.paginate()` — never `.collect()`**. This is already in `tech-stack.md`; it must also be checked during spec review for every new query.

---

### [LEARN-005] Relative imports break when pages move between directory depths

- **Track:** `ui_navigation_stores_20260319`
- **Discovered:** 2026-03-19
- **Symptom:** Moving `app/import/page.tsx` (which used `../../convex/_generated/api`) to `app/(authenticated)/import/page.tsx` would break the import — the relative path now needs an extra `../`.
- **Root cause:** Relative imports are fragile when files move. The original file had mixed relative and `@/`-aliased imports.
- **Fix:** Converted all imports in the moved file to use the `@/` path alias (e.g. `@/convex/_generated/api`), which resolves from the project root regardless of file location.
- **Prevention:** Always use `@/`-prefixed imports for cross-directory references. Never use deep relative paths (`../../`) in page or component files. Enforce this in the TypeScript style guide.

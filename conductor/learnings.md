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

### [LEARN-005] Relative imports break when pages move between directory depths

- **Track:** `ui_navigation_stores_20260319`
- **Discovered:** 2026-03-19
- **Symptom:** Moving `app/import/page.tsx` (which used `../../convex/_generated/api`) to `app/(authenticated)/import/page.tsx` would break the import — the relative path now needs an extra `../`.
- **Root cause:** Relative imports are fragile when files move. The original file had mixed relative and `@/`-aliased imports.
- **Fix:** Converted all imports in the moved file to use the `@/` path alias (e.g. `@/convex/_generated/api`), which resolves from the project root regardless of file location.
- **Prevention:** Always use `@/`-prefixed imports for cross-directory references. Never use deep relative paths (`../../`) in page or component files. Enforce this in the TypeScript style guide.

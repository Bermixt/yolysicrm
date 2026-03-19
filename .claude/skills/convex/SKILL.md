---
name: convex
description: Convex backend development guidelines. Apply when writing or reviewing Convex functions, schema, queries, mutations, actions, authentication, scheduling, or file storage.
user-invocable: false
---

# Convex Development Guidelines

You are helping build a Convex backend. Follow these rules strictly when writing or reviewing Convex code.

## Function Registration

- Use `query`, `mutation`, `action` for **public** functions (exposed to the internet).
- Use `internalQuery`, `internalMutation`, `internalAction` for **private** functions (only callable by other Convex functions). Always import these from `./_generated/server`.
- **ALWAYS** include argument validators (`v.*`) for every function — no exceptions. This applies to all of `query`, `internalQuery`, `mutation`, `internalMutation`, `action`, and `internalAction`.
- Do NOT register functions through `api` or `internal` objects.

## Function References

- Use the `api` object (from `convex/_generated/api.ts`) to reference public functions registered with `query`, `mutation`, or `action`.
- Use the `internal` object (from `convex/_generated/api.ts`) to reference internal functions registered with `internalQuery`, `internalMutation`, or `internalAction`.
- Convex uses **file-based routing**: a public function `f` in `convex/example.ts` → `api.example.f`.
- A private function `g` in `convex/example.ts` → `internal.example.g`.
- Nested directories are supported: `h` in `convex/messages/access.ts` → `api.messages.access.h`.

## Function Calling

- `ctx.runQuery` → call from query, mutation, or action.
- `ctx.runMutation` → call from mutation or action.
- `ctx.runAction` → call from action only. **Only** use this to cross runtimes (e.g. V8 → Node). Otherwise, extract shared logic into a helper async function and call it directly.
- Pass `FunctionReference` objects (e.g. `api.module.fn`) — **never** pass functions directly.
- Minimize calls from actions to queries and mutations. Queries and mutations are transactions; splitting logic across multiple calls introduces race conditions.
- When calling a function in the same file via `ctx.runQuery/runMutation/runAction`, add a return type annotation to avoid TypeScript circularity errors:

```ts
export const f = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    return "Hello " + args.name;
  },
});

export const g = query({
  args: {},
  handler: async (ctx, args) => {
    const result: string = await ctx.runQuery(api.example.f, { name: "Bob" });
    return null;
  },
});
```

## Validators

Valid Convex types and their validators:

| Convex Type | TS/JS Type    | Example                  | Validator                    | Notes |
|-------------|---------------|--------------------------|------------------------------|-------|
| Id          | string        | `doc._id`                | `v.id(tableName)`            | |
| Null        | null          | `null`                   | `v.null()`                   | `undefined` is not valid in Convex; functions returning `undefined` return `null` to clients. |
| Int64       | bigint        | `3n`                     | `v.int64()`                  | Range: -2^63 to 2^63-1 |
| Float64     | number        | `3.1`                    | `v.number()`                 | IEEE-754 double-precision; `Inf`/`NaN` serialized as strings. |
| Boolean     | boolean       | `true`                   | `v.boolean()`                | |
| String      | string        | `"abc"`                  | `v.string()`                 | UTF-8, must be valid Unicode, < 1MB. |
| Bytes       | ArrayBuffer   | `new ArrayBuffer(8)`     | `v.bytes()`                  | < 1MB |
| Array       | Array         | `[1, 3.2, "abc"]`        | `v.array(values)`            | Max 8192 values. |
| Object      | Object        | `{a: "abc"}`             | `v.object({property: value})`| Max 1024 entries. Field names must be non-empty and not start with `$` or `_`. |
| Record      | Record        | `{"a": "1", "b": "2"}`  | `v.record(keys, values)`     | Dynamic keys. Keys must be ASCII, non-empty, not start with `$` or `_`. |

**Array validator example:**
```ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export default mutation({
  args: {
    simpleArray: v.array(v.union(v.string(), v.number())),
  },
  handler: async (ctx, args) => { /* ... */ },
});
```

**Discriminated union schema example:**
```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  results: defineTable(
    v.union(
      v.object({ kind: v.literal("error"), errorMessage: v.string() }),
      v.object({ kind: v.literal("success"), value: v.number() }),
    ),
  ),
});
```

## Schema (`convex/schema.ts`)

- Always define schema here, importing from `convex/server`.
- System fields (`_id`, `_creationTime`) are auto-added — do not declare them.
- Index name must include all indexed fields: e.g. index on `["field1", "field2"]` → name `"by_field1_and_field2"`.
- Index fields must be queried in declaration order. Need different orders? Create separate indexes.
- **Never** store unbounded lists as array fields in a document — use a child table with a foreign key instead.

## Queries

- **Never** use `.filter()` — always define an index and use `.withIndex()`.
- Never use `.collect()` unless bounded; prefer `.take(n)` or `.paginate()`.
- Never use `.collect().length` to count — maintain a denormalized counter document instead.
- Use `.unique()` to assert a single result (throws on multiple matches).
- Use `for await (const row of query)` for async iteration — don't `.collect()` first.
- Default order is ascending `_creationTime`. Use `.order('asc' | 'desc')` to override.
- Document queries using indexes are ordered by index columns and avoid slow table scans.

## Mutations

- `ctx.db.patch(tableName, id, fields)` — shallow merge update (throws if doc missing).
- `ctx.db.replace(tableName, id, doc)` — full replacement (throws if doc missing).
- Mutations are transactions with document limits. For bulk operations (e.g. bulk deletion on a large table), batch with `.take(n)` and use `ctx.scheduler.runAfter(0, api.myModule.myMutation, args)` to schedule continuation. Each invocation stays within transaction limits.

## Actions

- Add `"use node";` at the top **only** when using Node.js built-ins.
- **Never** mix `"use node"` with queries or mutations in the same file — split into separate files.
- `fetch()` is available in the default Convex runtime; no `"use node"` needed for it.
- Never use `ctx.db` inside an action.

```ts
import { action } from "./_generated/server";

export const exampleAction = action({
  args: {},
  handler: async (ctx, args) => {
    console.log("This action does not return anything");
    return null;
  },
});
```

## HTTP Endpoints (`convex/http.ts`)

```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
  path: "/echo",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.bytes();
    return new Response(body, { status: 200 });
  }),
});
```

- Routes are registered at the **exact** path specified in `path` (e.g. `/api/someRoute`).

## Authentication

- Always create `convex/auth.config.ts` when using auth — without it, `ctx.auth.getUserIdentity()` always returns `null`.
- The `domain` must be the JWT issuer URL. Convex fetches `{domain}/.well-known/openid-configuration` to discover JWKS. The `applicationID` is checked against the JWT `aud` claim.
- Use `identity.tokenIdentifier` (not `identity.subject`) for stable, canonical identity lookups.
- Never accept a `userId` as a function argument for authorization — always derive it server-side via `ctx.auth.getUserIdentity()`.
- Use `ConvexProviderWithAuth` (not `ConvexProvider`) when authentication is needed on the client. The `useAuth` prop must return `{ isLoading, isAuthenticated, fetchAccessToken }`.

## TypeScript

- Use `Id<'tableName'>` from `./_generated/dataModel` for document ID types.
- Use `Doc<'tableName'>` for full document types.
- Use `QueryCtx`, `MutationCtx`, `ActionCtx` from `./_generated/server` for context types — **never** `any`.
- Be strict with ID types: `Id<'users'>` not `string`.
- For `v.record(v.id('users'), v.string())` the TypeScript type is `Record<Id<'users'>, string>`.

```ts
import { query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export const exampleQuery = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const idToUsername: Record<Id<"users">, string> = {};
    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (user) {
        idToUsername[user._id] = user.username;
      }
    }
    return idToUsername;
  },
});
```

## Scheduling & Crons (`convex/crons.ts`)

- Use only `crons.interval()` or `crons.cron()` — **not** `crons.hourly/daily/weekly`.
- Pass a `FunctionReference` — not the function itself.
- Export the `crons` object as `default`.
- Always import `internal` from `_generated/api` for internal cron targets, even within the same file.

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const empty = internalAction({
  args: {},
  handler: async (ctx, args) => { console.log("empty"); },
});

const crons = cronJobs();
crons.interval("delete inactive users", { hours: 2 }, internal.crons.empty, {});

export default crons;
```

## File Storage

- Use `ctx.storage.getUrl(id)` for signed URLs (returns `null` if file missing).
- Do NOT use deprecated `ctx.storage.getMetadata()` — query the `_storage` system table via `ctx.db.system.get` instead.
- Files are stored as `Blob` — convert to/from `Blob` when reading/writing storage.

```ts
type FileMetadata = {
  _id: Id<"_storage">;
  _creationTime: number;
  contentType?: string;
  sha256: string;
  size: number;
};

export const getFile = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const metadata: FileMetadata | null = await ctx.db.system.get(args.fileId);
    return metadata;
  },
});
```

## Pagination

```ts
import { paginationOptsValidator } from "convex/server";

export const listWithExtraArg = query({
  args: { paginationOpts: paginationOptsValidator, author: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_author", (q) => q.eq("author", args.author))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

- `paginationOpts` shape: `{ numItems: number, cursor: string | null }`
- Result shape: `{ page: Doc[], isDone: boolean, continueCursor: string }`

## Full-Text Search

```ts
const messages = await ctx.db
  .query("messages")
  .withSearchIndex("search_body", (q) =>
    q.search("body", "hello hi").eq("channel", "#general")
  )
  .take(10);
```

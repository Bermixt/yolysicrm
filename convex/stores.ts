import { paginationOptsValidator } from "convex/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

type StoreArgs = {
  domain: string;
  url: string;
  status: "Active" | "Inactive" | "Unreachable";
  platform: "Shopify" | "Other" | "Unknown";
  enrichmentData?: unknown;
};

type DbCtx = {
  db: {
    query: (table: string) => {
      withIndex: (index: string, fn: (q: any) => any) => { unique: () => Promise<any> };
    };
    patch: (id: any, fields: object) => Promise<void>;
    insert: (table: string, fields: object) => Promise<any>;
  };
};

/**
 * Internal logic for upserting a store's verification status.
 * Extracted for testability.
 */
export async function upsertStoreVerification(ctx: DbCtx, args: StoreArgs) {
  const existing = await ctx.db
    .query("stores")
    .withIndex("by_domain", (q) => q.eq("domain", args.domain))
    .unique();

  const updateFields = {
    domain: args.domain,
    url: args.url,
    status: args.status,
    platform: args.platform,
    lastVerifiedAt: Date.now(),
    enrichmentData: args.enrichmentData,
  };

  if (existing) {
    await ctx.db.patch(existing._id, updateFields);
    return existing._id;
  } else {
    return await ctx.db.insert("stores", updateFields);
  }
}

/**
 * Internal logic for fetching a store by domain.
 * Extracted for testability.
 */
export async function fetchStoreByDomain(ctx: DbCtx, domain: string) {
  return await ctx.db
    .query("stores")
    .withIndex("by_domain", (q) => q.eq("domain", domain))
    .unique();
}

/**
 * Update or create a store's verification status.
 */
export const updateStoreVerification = mutation({
  args: {
    domain: v.string(),
    url: v.string(),
    status: v.union(v.literal("Active"), v.literal("Inactive"), v.literal("Unreachable")),
    platform: v.union(v.literal("Shopify"), v.literal("Other"), v.literal("Unknown")),
    enrichmentData: v.optional(v.any()),
  },
  handler: async (ctx, args) => upsertStoreVerification(ctx as unknown as DbCtx, args),
});

/**
 * Get a store by its domain.
 */
export const getStoreByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => fetchStoreByDomain(ctx as unknown as DbCtx, args.domain),
});

/**
 * List stores with cursor-based pagination.
 * Returns a page of items, a continuation cursor, and whether the last page was reached.
 */
export const listStores = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    return await ctx.db.query("stores").paginate(args.paginationOpts);
  },
});

/**
 * Internal query: fetch a store by its document ID.
 */
export const getStoreById = internalQuery({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.storeId);
  },
});

/**
 * Internal mutation: save robots.txt content into a store's enrichmentData.
 */
export const saveRobotsTxt = internalMutation({
  args: {
    storeId: v.id("stores"),
    content: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) throw new Error("Store not found");
    const existing = (store.enrichmentData as Record<string, unknown>) ?? {};
    await ctx.db.patch(args.storeId, {
      enrichmentData: { ...existing, robotsTxt: args.content },
    });
  },
});

/**
 * Import a batch of domains into the stores table.
 *
 * mode:
 *   "new-only"  — insert new domains only; skip existing records entirely.
 *   "upsert"    — insert new domains; for existing, update url only (preserve status/platform).
 *   "overwrite" — insert new domains; for existing, reset to Inactive/Unknown.
 *
 * Returns counts: imported (new inserts), updated (existing touched), skipped (blanks or new-only skips).
 */
export const importStores = mutation({
  args: {
    domains: v.array(v.string()),
    mode: v.union(v.literal("new-only"), v.literal("upsert"), v.literal("overwrite")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const raw of args.domains) {
      const domain = raw.trim();
      if (!domain) { skipped++; continue; }

      const url = domain.startsWith("http") ? domain : `https://${domain}`;

      const existing = await ctx.db
        .query("stores")
        .withIndex("by_domain", (q) => q.eq("domain", domain))
        .unique();

      if (existing) {
        if (args.mode === "new-only") {
          skipped++;
        } else if (args.mode === "upsert") {
          await ctx.db.patch(existing._id, { url });
          updated++;
        } else {
          // overwrite — reset verification state
          await ctx.db.patch(existing._id, {
            url,
            status: "Inactive",
            platform: "Unknown",
            lastVerifiedAt: undefined,
            enrichmentData: undefined,
          });
          updated++;
        }
      } else {
        await ctx.db.insert("stores", {
          domain,
          url,
          status: "Inactive",
          platform: "Unknown",
        });
        imported++;
      }
    }

    return { imported, updated, skipped };
  },
});

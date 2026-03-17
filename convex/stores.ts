import { mutation, query } from "./_generated/server";
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

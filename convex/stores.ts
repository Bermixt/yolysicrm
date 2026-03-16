import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stores")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .unique();

    const updateFields = {
      domain: args.domain,
      url: args.url,
      // Since schema.ts doesn't have "Unreachable" and "Unknown" as literals yet,
      // we'll need to update schema.ts or map them.
      // For now, I'll update schema.ts in a separate step or adjust here.
      status: args.status === "Unreachable" ? "Inactive" : args.status as "Active" | "Inactive",
      platform: args.platform === "Unknown" ? "Other" : args.platform as "Shopify" | "Other",
      lastVerifiedAt: Date.now(),
      enrichmentData: args.enrichmentData,
    };

    if (existing) {
      await ctx.db.patch(existing._id, updateFields);
      return existing._id;
    } else {
      return await ctx.db.insert("stores", updateFields);
    }
  },
});

/**
 * Get a store by its domain.
 */
export const getStoreByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stores")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .unique();
  },
});

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// The schema is normally optional, but Convex Auth
// requires indexes defined on `authTables`.
// The schema provides more precise TypeScript types.
export default defineSchema({
  ...authTables,
  stores: defineTable({
    domain: v.string(),
    url: v.string(),
    status: v.union(v.literal("Active"), v.literal("Inactive"), v.literal("Unreachable")),
    platform: v.union(v.literal("Shopify"), v.literal("Other"), v.literal("Unknown")),
    lastVerifiedAt: v.optional(v.number()),
    enrichmentData: v.optional(v.any()),
  })
    .index("by_domain", ["domain"])
    .index("by_status", ["status"])
    .index("by_platform", ["platform"]),
});

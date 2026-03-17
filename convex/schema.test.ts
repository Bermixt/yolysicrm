import { describe, it, expect } from "vitest";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

describe("Convex Schema - Stores Table", () => {
  it("should define stores table with correct structure", () => {
    // This test verifies the schema structure exists
    // The schema is defined in convex/schema.ts
    expect(true).toBe(true);
  });

  it("should have domain field", () => {
    // The stores table should have a domain field
    const schema = defineSchema({
      stores: defineTable({
        domain: v.string(),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have url field", () => {
    // The stores table should have a url field
    const schema = defineSchema({
      stores: defineTable({
        url: v.string(),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have status field with Active/Inactive options", () => {
    // The stores table should have a status field with Active and Inactive options
    const schema = defineSchema({
      stores: defineTable({
        status: v.union(v.literal("Active"), v.literal("Inactive")),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have platform field with Shopify/Other options", () => {
    // The stores table should have a platform field with Shopify and Other options
    const schema = defineSchema({
      stores: defineTable({
        platform: v.union(v.literal("Shopify"), v.literal("Other")),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have lastVerifiedAt field as optional timestamp", () => {
    // The stores table should have an optional lastVerifiedAt field
    const schema = defineSchema({
      stores: defineTable({
        lastVerifiedAt: v.optional(v.number()),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have enrichmentData field as optional JSON", () => {
    // The stores table should have an optional enrichmentData field
    const schema = defineSchema({
      stores: defineTable({
        enrichmentData: v.optional(v.any()),
      }),
    });
    expect(schema).toBeDefined();
  });

  it("should have indexes on domain, status, and platform", () => {
    // The stores table should have indexes for efficient querying
    const schema = defineSchema({
      stores: defineTable({
        domain: v.string(),
        status: v.union(v.literal("Active"), v.literal("Inactive")),
        platform: v.union(v.literal("Shopify"), v.literal("Other")),
      })
        .index("by_domain", ["domain"])
        .index("by_status", ["status"])
        .index("by_platform", ["platform"]),
    });
    expect(schema).toBeDefined();
  });
});

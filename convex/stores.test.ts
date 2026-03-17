import { describe, it, expect, vi } from "vitest";
import { upsertStoreVerification, fetchStoreByDomain } from "./stores";

function makeMockCtx({
  existing = null,
}: {
  existing?: object | null;
} = {}) {
  return {
    db: {
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnValue({
          unique: vi.fn().mockResolvedValue(existing),
        }),
      }),
      insert: vi.fn().mockResolvedValue("new_id_123"),
      patch: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("upsertStoreVerification", () => {
  it("inserts a new record when domain does not exist", async () => {
    const ctx = makeMockCtx({ existing: null });

    const result = await upsertStoreVerification(ctx, {
      domain: "example.com",
      url: "https://example.com",
      status: "Active",
      platform: "Shopify",
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "stores",
      expect.objectContaining({
        domain: "example.com",
        url: "https://example.com",
        status: "Active",
        platform: "Shopify",
      })
    );
    expect(ctx.db.patch).not.toHaveBeenCalled();
    expect(result).toBe("new_id_123");
  });

  it("patches an existing record when domain already exists", async () => {
    const existing = { _id: "existing_id_456", domain: "example.com" };
    const ctx = makeMockCtx({ existing });

    const result = await upsertStoreVerification(ctx, {
      domain: "example.com",
      url: "https://example.com",
      status: "Inactive",
      platform: "Other",
    });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "existing_id_456",
      expect.objectContaining({ status: "Inactive", platform: "Other" })
    );
    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(result).toBe("existing_id_456");
  });

  it("stores Unreachable and Unknown without mapping", async () => {
    const ctx = makeMockCtx({ existing: null });

    await upsertStoreVerification(ctx, {
      domain: "broken.com",
      url: "https://broken.com",
      status: "Unreachable",
      platform: "Unknown",
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "stores",
      expect.objectContaining({ status: "Unreachable", platform: "Unknown" })
    );
  });

  it("sets lastVerifiedAt to current timestamp", async () => {
    const ctx = makeMockCtx({ existing: null });
    const before = Date.now();

    await upsertStoreVerification(ctx, {
      domain: "example.com",
      url: "https://example.com",
      status: "Active",
      platform: "Shopify",
    });

    const insertedFields = ctx.db.insert.mock.calls[0][1] as any;
    expect(insertedFields.lastVerifiedAt).toBeGreaterThanOrEqual(before);
    expect(insertedFields.lastVerifiedAt).toBeLessThanOrEqual(Date.now());
  });

  it("persists enrichmentData when provided", async () => {
    const ctx = makeMockCtx({ existing: null });
    const enrichmentData = { title: "My Shop", description: "Best shop" };

    await upsertStoreVerification(ctx, {
      domain: "example.com",
      url: "https://example.com",
      status: "Active",
      platform: "Shopify",
      enrichmentData,
    });

    expect(ctx.db.insert).toHaveBeenCalledWith(
      "stores",
      expect.objectContaining({ enrichmentData })
    );
  });
});

describe("fetchStoreByDomain", () => {
  it("returns the store record when domain exists", async () => {
    const storeRecord = { _id: "id_1", domain: "example.com", status: "Active" };
    const ctx = makeMockCtx({ existing: storeRecord });

    const result = await fetchStoreByDomain(ctx, "example.com");

    expect(ctx.db.query).toHaveBeenCalledWith("stores");
    expect(result).toEqual(storeRecord);
  });

  it("returns null when domain does not exist", async () => {
    const ctx = makeMockCtx({ existing: null });

    const result = await fetchStoreByDomain(ctx, "nonexistent.com");

    expect(result).toBeNull();
  });
});

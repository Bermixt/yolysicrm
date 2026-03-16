import { describe, it, expect, vi } from "vitest";
import { verifyStoreInternal } from "./verifyStore";

describe("verifyStore Action Logic", () => {
  it("should detect Shopify store from HTML", async () => {
    const mockHtml = '<html><head><script>window.Shopify = {};</script><script src="https://cdn.shopify.com/something.js"></script></head><body></body></html>';
    
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    }));

    const result = await verifyStoreInternal("https://myshop.com");
    expect(result.status).toBe("Active");
    expect(result.platform).toBe("Shopify");
    
    vi.unstubAllGlobals();
  });

  it("should detect non-Shopify store", async () => {
    const mockHtml = '<html><head></head><body>Hello World</body></html>';
    
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockHtml),
    }));

    const result = await verifyStoreInternal("https://google.com");
    expect(result.status).toBe("Active");
    expect(result.platform).toBe("Other");
    
    vi.unstubAllGlobals();
  });

  it("should handle unreachable store", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const result = await verifyStoreInternal("https://invalid-url-123.com");
    expect(result.status).toBe("Unreachable");
    
    vi.unstubAllGlobals();
  });

  it("should handle inactive store (non-200)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const result = await verifyStoreInternal("https://myshop.com/404");
    expect(result.status).toBe("Inactive");
    
    vi.unstubAllGlobals();
  });
});

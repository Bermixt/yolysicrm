"use node";
import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal logic for verifying a store.
 * Extracted for testability.
 */
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

const MAX_RETRIES = 2;

export async function verifyStoreInternal(url: string): Promise<{
  status: "Active" | "Inactive" | "Unreachable";
  platform: "Shopify" | "Other" | "Unknown";
  metadata?: { title?: string; description?: string };
}> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { headers: BROWSER_HEADERS });

      if (!response.ok) {
        return { status: "Inactive", platform: "Unknown" };
      }

      const html = await response.text();

      // Shopify Detection Logic
      const shopifyIndicators = [
        "window.Shopify",
        "Shopify.shop",
        "cdn.shopify.com",
        'name="shopify-checkout-api-token"',
        "shopify-payment-button",
      ];

      const isShopify = shopifyIndicators.some((indicator) => html.includes(indicator));

      // Metadata Extraction
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      const descMatch =
        html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
        html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
      const description = descMatch ? descMatch[1].trim() : undefined;

      return {
        status: "Active",
        platform: isShopify ? "Shopify" : "Other",
        metadata: { title, description },
      };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        console.warn(`Verification attempt ${attempt} failed for ${url}, retrying...`);
      }
    }
  }

  console.error(`Verification failed for ${url} after ${MAX_RETRIES} attempts:`, lastError);
  return { status: "Unreachable", platform: "Unknown" };
}

/**
 * Convex action to verify a store and return its status and platform.
 */
export const verifyStore = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return await verifyStoreInternal(args.url);
  },
});

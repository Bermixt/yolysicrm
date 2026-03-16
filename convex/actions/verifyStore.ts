import { action } from "../_generated/server";
import { v } from "convex/values";

/**
 * Internal logic for verifying a store.
 * Extracted for testability.
 */
export async function verifyStoreInternal(url: string): Promise<{
  status: "Active" | "Inactive" | "Unreachable";
  platform: "Shopify" | "Other" | "Unknown";
}> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "YolysiCRM-Store-Verifier/1.0",
      },
    });
    
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
    
    return {
      status: "Active",
      platform: isShopify ? "Shopify" : "Other",
    };
  } catch (error) {
    console.error(`Verification failed for ${url}:`, error);
    return { status: "Unreachable", platform: "Unknown" };
  }
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

"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Fetch the robots.txt file for a store, save it to enrichmentData, and return the result.
 * Only runs for Active Shopify stores (enforced client-side before calling; action is generic).
 */
type FetchResult = { domain: string; content: string | null; error?: string };

export const fetchRobotsTxt = action({
  args: { storeId: v.id("stores") },
  handler: async (ctx, args): Promise<FetchResult> => {
    const store = await ctx.runQuery(internal.stores.getStoreById, {
      storeId: args.storeId,
    });

    if (!store) throw new Error("Store not found");

    const domain: string = store.domain;
    const url = `https://${domain}/robots.txt`;

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "YolysiBot/1.0" },
      });

      if (!response.ok) {
        await ctx.runMutation(internal.stores.saveRobotsTxt, {
          storeId: args.storeId,
          content: null,
        });
        return { domain, content: null, error: `HTTP ${response.status}` };
      }

      const content = await response.text();
      await ctx.runMutation(internal.stores.saveRobotsTxt, {
        storeId: args.storeId,
        content,
      });
      return { domain, content };
    } catch (e) {
      const error = e instanceof Error ? e.message : "Unknown error";
      await ctx.runMutation(internal.stores.saveRobotsTxt, {
        storeId: args.storeId,
        content: null,
      });
      return { domain, content: null, error };
    }
  },
});

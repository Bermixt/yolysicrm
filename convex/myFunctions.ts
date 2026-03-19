import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

export const getViewer = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    return user?.email ?? null;
  },
});

export const listNumbers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("numbers").collect();
  },
});

export const addNumber = mutation({
  args: { value: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("numbers", { value: args.value });
  },
});

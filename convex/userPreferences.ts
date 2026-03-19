import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const storeViewValidator = v.object({
  name: v.string(),
  columns: v.array(v.string()),
});

/**
 * Get the current user's saved store views.
 * Returns an empty array if no preferences exist yet.
 */
export const getStoreViews = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return prefs?.storeViews ?? [];
  },
});

/**
 * Save (upsert) a named store view for the current user.
 * If a view with the same name exists it is replaced.
 */
export const saveStoreView = mutation({
  args: { view: storeViewValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (prefs) {
      const updated = [
        ...prefs.storeViews.filter((v) => v.name !== args.view.name),
        args.view,
      ];
      await ctx.db.patch(prefs._id, { storeViews: updated });
    } else {
      await ctx.db.insert("userPreferences", {
        userId,
        storeViews: [args.view],
      });
    }
  },
});

/**
 * Delete a named store view for the current user.
 */
export const deleteStoreView = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!prefs) return;
    const updated = prefs.storeViews.filter((v) => v.name !== args.name);
    await ctx.db.patch(prefs._id, { storeViews: updated });
  },
});

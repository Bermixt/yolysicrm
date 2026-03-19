/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_fetchRobotsTxt from "../actions/fetchRobotsTxt.js";
import type * as actions_verifyStore from "../actions/verifyStore.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as myFunctions from "../myFunctions.js";
import type * as stores from "../stores.js";
import type * as userPreferences from "../userPreferences.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/fetchRobotsTxt": typeof actions_fetchRobotsTxt;
  "actions/verifyStore": typeof actions_verifyStore;
  auth: typeof auth;
  http: typeof http;
  myFunctions: typeof myFunctions;
  stores: typeof stores;
  userPreferences: typeof userPreferences;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};

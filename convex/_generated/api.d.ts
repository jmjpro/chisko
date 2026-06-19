/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billImports from "../billImports.js";
import type * as crons from "../crons.js";
import type * as homeProfiles from "../homeProfiles.js";
import type * as http from "../http.js";
import type * as internal_deployHooks from "../internal/deployHooks.js";
import type * as internal_seedAll from "../internal/seedAll.js";
import type * as israelPlaces from "../israelPlaces.js";
import type * as israelPlacesRefresh from "../israelPlacesRefresh.js";
import type * as lib_recommendationEngine from "../lib/recommendationEngine.js";
import type * as lib_sentry from "../lib/sentry.js";
import type * as lib_smartMeterCsvParser from "../lib/smartMeterCsvParser.js";
import type * as migrations from "../migrations.js";
import type * as plans from "../plans.js";
import type * as recommendations from "../recommendations.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as smartMeterRegistry from "../smartMeterRegistry.js";
import type * as smartMeterRegistryRefresh from "../smartMeterRegistryRefresh.js";
import type * as suppliers from "../suppliers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  billImports: typeof billImports;
  crons: typeof crons;
  homeProfiles: typeof homeProfiles;
  http: typeof http;
  "internal/deployHooks": typeof internal_deployHooks;
  "internal/seedAll": typeof internal_seedAll;
  israelPlaces: typeof israelPlaces;
  israelPlacesRefresh: typeof israelPlacesRefresh;
  "lib/recommendationEngine": typeof lib_recommendationEngine;
  "lib/sentry": typeof lib_sentry;
  "lib/smartMeterCsvParser": typeof lib_smartMeterCsvParser;
  migrations: typeof migrations;
  plans: typeof plans;
  recommendations: typeof recommendations;
  seed: typeof seed;
  sessions: typeof sessions;
  smartMeterRegistry: typeof smartMeterRegistry;
  smartMeterRegistryRefresh: typeof smartMeterRegistryRefresh;
  suppliers: typeof suppliers;
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

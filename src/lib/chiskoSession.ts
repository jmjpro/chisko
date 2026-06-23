import { ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getOrCreateSessionToken } from "./sessionToken";

// Memoizes the sessions.getOrCreate call so that several independently
// bootstrapped islands on the same page (e.g. one per plans-page row) share
// a single session and a single mutation round-trip.
export function createSessionStore() {
  let promise: Promise<Id<"sessions">> | null = null;
  return {
    getOrCreate(
      client: Pick<ConvexReactClient, "mutation">,
    ): Promise<Id<"sessions">> {
      if (!promise) {
        promise = client.mutation(api.sessions.getOrCreate, {
          sessionToken: getOrCreateSessionToken(),
        });
      }
      return promise;
    },
  };
}

let sharedClient: ConvexReactClient | null = null;
let sharedClientUrl: string | null = null;

// One ConvexReactClient (one websocket) shared across every island on a
// page, rather than one per "Leave details" button.
export function getSharedConvexClient(convexUrl: string): ConvexReactClient {
  if (!sharedClient || sharedClientUrl !== convexUrl) {
    sharedClient = new ConvexReactClient(convexUrl);
    sharedClientUrl = convexUrl;
  }
  return sharedClient;
}

export const sharedSession = createSessionStore();

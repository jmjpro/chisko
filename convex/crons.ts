import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh the Smart Meter Registry every Sunday at 02:00 UTC
crons.cron(
  "refresh smart meter registry",
  "0 2 * * 0",
  internal.smartMeterRegistryRefresh.doRefresh,
  {},
);

// Refresh israelPlaces every Sunday at 02:30 UTC
crons.cron(
  "refresh israel places",
  "30 2 * * 0",
  internal.israelPlacesRefresh.doRefresh,
  {},
);

export default crons;

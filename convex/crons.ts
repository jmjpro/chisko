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

export default crons;

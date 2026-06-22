import { execSync } from "child_process";
import { existsSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// A worktree that ran `setup:worktree -- <port> --own-deployment` has its own
// `convex-local-backend` process bound to the absolute path of its `.convex`
// dir. Killing by that path (rather than by port) works even if the process
// was started from a different shell or has since restarted on a new port.
export function backendPidPattern(worktreePath: string): string {
  return path.join(worktreePath, ".convex/local/default");
}

function main() {
  const cwd = process.cwd();
  const convexDir = path.join(cwd, ".convex");
  if (!existsSync(convexDir)) {
    console.log("No dedicated .convex dir here — nothing to tear down.");
    return;
  }

  try {
    execSync(`pkill -f "${backendPidPattern(cwd)}"`, { stdio: "ignore" });
    console.log("Stopped this worktree's local Convex backend.");
  } catch {
    // pkill exits non-zero when no process matched — nothing was running.
  }

  rmSync(convexDir, { recursive: true, force: true });
  console.log("Removed .convex.");
  console.log(
    "Now safe to `git worktree remove` this worktree from elsewhere.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

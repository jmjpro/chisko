import { execSync } from "child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// `.env.local` is gitignored, so a new worktree starts without the local
// Convex credentials every other worktree already shares (same local
// deployment — see docs/agents/worktree-dev.md). Find them by walking the
// other worktrees rather than requiring a manually-typed path.
export function parseWorktreePaths(porcelainOutput: string): string[] {
  const paths: string[] = [];
  for (const line of porcelainOutput.split("\n")) {
    if (line.startsWith("worktree "))
      paths.push(line.slice("worktree ".length).trim());
  }
  return paths;
}

export function findEnvLocalSource(
  worktreePaths: string[],
  currentPath: string,
): string {
  for (const worktreePath of worktreePaths) {
    if (path.resolve(worktreePath) === path.resolve(currentPath)) continue;
    const candidate = path.join(worktreePath, ".env.local");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(
    "No .env.local found in any other worktree. Set one up manually first " +
      "(see docs/agents/worktree-dev.md), then re-run this script.",
  );
}

export function withPort(envContent: string, port: string): string {
  if (/^PORT=\d+$/m.test(envContent)) {
    return envContent.replace(/^PORT=\d+$/m, `PORT=${port}`);
  }
  const trimmed = envContent.replace(/\n+$/, "");
  return `${trimmed}\nPORT=${port}\n`;
}

function main() {
  const port = process.argv[2];
  if (!port || !/^\d+$/.test(port)) {
    throw new Error("Usage: npm run setup:worktree -- <port>");
  }

  const cwd = process.cwd();
  const porcelain = execSync("git worktree list --porcelain", {
    encoding: "utf-8",
    cwd,
  });
  const source = findEnvLocalSource(parseWorktreePaths(porcelain), cwd);

  const envLocalPath = path.join(cwd, ".env.local");
  copyFileSync(source, envLocalPath);
  writeFileSync(
    envLocalPath,
    withPort(readFileSync(envLocalPath, "utf-8"), port),
  );

  console.log(`Copied Convex env from ${source}, set PORT=${port}.`);
  console.log("Next: npm install, then npm run dev:client-only.");
  console.log(
    "(Only one worktree should run `npm run dev` — it owns convex dev's function sync.)",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

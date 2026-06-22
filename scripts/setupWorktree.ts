import { execSync, spawn } from "child_process";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
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

// Each worktree's dedicated local Convex backend needs ports that won't
// collide with another worktree's, including ones that aren't running right
// now (Convex's own allocator only avoids ports that are *currently* bound).
// Deriving them from the already-unique frontend PORT keeps that guarantee
// without a second port argument.
export function convexPortsFor(port: string): { cloud: number; site: number } {
  const cloud = Number(port) + 10000;
  return { cloud, site: cloud + 1 };
}

interface LocalDeploymentConfig {
  ports: { cloud: number; site: number };
  adminKey: string;
}

function readLocalDeploymentConfig(
  worktreePath: string,
): LocalDeploymentConfig {
  const configPath = path.join(
    worktreePath,
    ".convex/local/default/config.json",
  );
  if (!existsSync(configPath)) {
    throw new Error(
      `No local Convex deployment found at ${configPath}. ` +
        "Run `npm run dev` in that worktree first so it's reachable for cloning.",
    );
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

// `convex dev --once` shuts its local backend down again when it exits, but
// `convex import` needs one listening. Keep a backend alive across the
// schema push and the optional import, then stop it so the printed "next"
// instructions (`npm run dev`) start from a clean slate.
function startBackend(
  cwd: string,
  cloud: number,
  site: number,
): Promise<ReturnType<typeof spawn>> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      [
        "convex",
        "dev",
        "--local-cloud-port",
        String(cloud),
        "--local-site-port",
        String(site),
      ],
      { cwd, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      process.stdout.write(chunk);
      if (output.includes("Convex functions ready")) {
        child.stdout?.off("data", onData);
        child.stderr?.off("data", onData);
        resolve(child);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0 && code !== null)
        reject(new Error(`convex dev exited with code ${code}`));
    });
  });
}

function stopBackend(cwd: string, child: ReturnType<typeof spawn>) {
  child.kill();
  try {
    execSync(`pkill -f "${path.join(cwd, ".convex/local/default")}"`, {
      stdio: "ignore",
    });
  } catch {
    // pkill exits non-zero when no process matched — already stopped.
  }
}

async function main() {
  const [port, ...flags] = process.argv.slice(2);
  if (!port || !/^\d+$/.test(port)) {
    throw new Error(
      "Usage: npm run setup:worktree -- <port> [--own-deployment] " +
        "[--clone] [--clone-from <worktree-path>]",
    );
  }
  const ownDeployment = flags.includes("--own-deployment");
  const cloneFromIndex = flags.indexOf("--clone-from");
  const cloneFrom =
    cloneFromIndex === -1 ? undefined : flags[cloneFromIndex + 1];
  // Cloning is opt-in: a full export/import of this codebase's data takes
  // ~9-10 minutes (see docs/agents/worktree-dev.md), dominated by the
  // smartMeterAddresses table (tracked separately as a perf issue, CHI-72).
  const shouldClone = flags.includes("--clone") || cloneFrom !== undefined;

  const cwd = process.cwd();
  const porcelain = execSync("git worktree list --porcelain", {
    encoding: "utf-8",
    cwd,
  });
  const worktreePaths = parseWorktreePaths(porcelain);
  const source = findEnvLocalSource(worktreePaths, cwd);

  const envLocalPath = path.join(cwd, ".env.local");
  copyFileSync(source, envLocalPath);
  writeFileSync(
    envLocalPath,
    withPort(readFileSync(envLocalPath, "utf-8"), port),
  );

  console.log(`Copied Convex env from ${source}, set PORT=${port}.`);

  if (!ownDeployment) {
    console.log("Next: npm install, then npm run dev:client-only.");
    console.log(
      "(Only one worktree should run `npm run dev` — it owns convex dev's function sync.)",
    );
    return;
  }

  const { cloud, site } = convexPortsFor(port);
  execSync("npx convex deployment create local --select", {
    cwd,
    stdio: "inherit",
  });
  const backend = await startBackend(cwd, cloud, site);
  console.log(`Provisioned a dedicated local Convex deployment on :${cloud}.`);

  const cloneSource = cloneFrom ?? path.dirname(source);
  try {
    if (shouldClone) {
      const sourceConfig = readLocalDeploymentConfig(cloneSource);
      const dumpPath = path.join(cwd, ".convex-clone.zip");
      // The CLI loads .env.local itself and refuses to combine its
      // CONVEX_DEPLOYMENT with CONVEX_SELF_HOSTED_URL/KEY, regardless of
      // what's passed via `env` here — so it has to be out of the way for
      // this one call.
      const envLocalBackup = `${envLocalPath}.bak`;
      copyFileSync(envLocalPath, envLocalBackup);
      rmSync(envLocalPath);
      try {
        execSync(
          `npx convex export --include-file-storage --path ${dumpPath}`,
          {
            cwd,
            stdio: "inherit",
            env: {
              ...process.env,
              CONVEX_SELF_HOSTED_URL: `http://127.0.0.1:${sourceConfig.ports.cloud}`,
              CONVEX_SELF_HOSTED_ADMIN_KEY: sourceConfig.adminKey,
            },
          },
        );
      } finally {
        copyFileSync(envLocalBackup, envLocalPath);
        rmSync(envLocalBackup);
      }
      execSync(`npx convex import --replace-all -y ${dumpPath}`, {
        cwd,
        stdio: "inherit",
      });
      rmSync(dumpPath);
      console.log(`Cloned data from ${cloneSource}.`);
    }
  } finally {
    stopBackend(cwd, backend);
  }

  console.log("Next: npm install, then npm run dev.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}

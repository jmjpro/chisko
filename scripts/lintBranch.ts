import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const BASE_REF = "main";

export function getChangedFiles(baseRef: string = BASE_REF): string[] {
  const mergeBase = execFileSync("git", ["merge-base", baseRef, "HEAD"], {
    encoding: "utf8",
  }).trim();

  const output = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      "--diff-filter=d",
      mergeBase,
      "HEAD",
      "--",
      "*.ts",
      "*.tsx",
    ],
    { encoding: "utf8" },
  );

  return output.split("\n").filter(Boolean);
}

function main() {
  const files = getChangedFiles();

  if (files.length === 0) {
    console.log(
      `No changed .ts/.tsx files since ${BASE_REF} — skipping eslint.`,
    );
    return;
  }

  execFileSync("eslint", [...files, "--max-warnings", "0"], {
    stdio: "inherit",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

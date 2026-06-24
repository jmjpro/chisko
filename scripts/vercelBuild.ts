import { execSync } from "child_process";
import { fileURLToPath } from "url";

// Kept as a literal, unexpanded shell string (single-quoted) so $SEED_SECRET
// and ${VITE_CONVEX_URL/.../...} are substituted by the shell `convex deploy
// --cmd` ultimately runs this in, not baked into this script's own argv —
// see ADR-0011 for why this two-deploy shape exists at all.
export function seedAndBuildCmd(): string {
  return 'curl -fsS -X POST "${VITE_CONVEX_URL/.convex.cloud/.convex.site}/seed" -H "Authorization: Bearer $SEED_SECRET" && npm run build';
}

function main() {
  if (process.env.ENABLE_CONVEX_CLOUD === "false") {
    console.log(
      "ENABLE_CONVEX_CLOUD=false — refusing to deploy a new Convex preview backend",
    );
    process.exit(1);
  }

  execSync("npx convex deploy", { stdio: "inherit" });
  execSync(`npx convex deploy --cmd '${seedAndBuildCmd()}'`, {
    stdio: "inherit",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

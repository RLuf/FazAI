#!/usr/bin/env node
/**
 * CLI entrypoint that delegates to the compiled bundle in dist/app.cjs.
 * Ensures `fazai` resolves correctly whether installed globally or run from source.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entrypoint = resolve(__dirname, "../dist/app.cjs");

const run = async () => {
  ensureFreshBuild();
  await import(entrypoint);
};

run().catch((error) => {
  console.error("Failed to launch FazAI CLI:", error);
  process.exit(1);
});

function ensureFreshBuild() {
  if (process.env.FAZAI_AUTO_BUILD === "0") {
    return;
  }

  const repoRoot = resolve(__dirname, "..");
  const srcDir = resolve(repoRoot, "src");
  const packageJson = resolve(repoRoot, "package.json");
  const nodeModulesDir = resolve(repoRoot, "node_modules");

  if (!fs.existsSync(srcDir) || !fs.existsSync(packageJson) || !fs.existsSync(nodeModulesDir)) {
    return;
  }

  const distFile = entrypoint;
  const manifestPath = resolve(repoRoot, ".fazai-build-meta.json");
  const srcIndex = resolve(srcDir, "app.ts");

  const distStat = tryStat(distFile);
  const srcStat = tryStat(srcIndex);

  const newestSourceMTime = Math.max(srcStat?.mtimeMs ?? 0, walkLatestMTime(srcDir));

  let manifestMTime = 0;
  if (fs.existsSync(manifestPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      manifestMTime = typeof saved?.srcMTime === "number" ? saved.srcMTime : 0;
    } catch {
      manifestMTime = 0;
    }
  }

  const distFresh = distStat && distStat.mtimeMs >= newestSourceMTime && distStat.mtimeMs >= manifestMTime;
  if (distFresh) {
    return;
  }

  try {
    execSync("npm run build", { cwd: repoRoot, stdio: "inherit" });
    fs.writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          builtAt: Date.now(),
          srcMTime: newestSourceMTime,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.warn("⚠️  Auto-build failed; proceeding with existing bundle.", error);
  }
}

function walkLatestMTime(dir) {
  let latest = 0;
  const entries = safeReadDir(dir);
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name.startsWith(".tsbuildinfo")) {
      continue;
    }
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      latest = Math.max(latest, walkLatestMTime(fullPath));
      continue;
    }
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".json")) {
      continue;
    }
    const stats = tryStat(fullPath);
    if (stats) {
      latest = Math.max(latest, stats.mtimeMs);
    }
  }
  return latest;
}

function safeReadDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function tryStat(target) {
  try {
    return fs.statSync(target);
  } catch {
    return null;
  }
}

#!/usr/bin/env node
/**
 * CLI entrypoint that delegates to the compiled bundle in dist/app.cjs.
 * Ensures `fazai` resolves correctly whether installed globally or run from source.
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entrypoint = resolve(__dirname, "../dist/app.cjs");

const run = async () => {
  await import(entrypoint);
};

run().catch((error) => {
  console.error("Failed to launch FazAI CLI:", error);
  process.exit(1);
});

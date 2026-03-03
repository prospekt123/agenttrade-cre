#!/usr/bin/env node
/**
 * Simulate CRE Workflow
 *
 * Runs the AgentTrade CRE workflow locally using the CRE CLI.
 * The simulation makes real calls to Sepolia Chainlink Data Feeds.
 *
 * Usage:
 *   node scripts/simulate.js
 *   # or via npm: npm run simulate
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

console.log("🚀 Starting AgentTrade CRE Workflow Simulation...\n");

// Check for .env
const envPath = path.join(projectRoot, ".env");
if (!fs.existsSync(envPath)) {
  console.log("⚠️  No .env file found. Using defaults.");
  console.log("   Copy .env.example to .env for custom configuration.\n");
}

// Check for config
const configPath = path.join(projectRoot, "config.staging.json");
if (!fs.existsSync(configPath)) {
  console.error("❌ config.staging.json not found");
  process.exit(1);
}

console.log("Config:", configPath);
console.log("Workflow entry:", path.join(projectRoot, "src", "workflow", "index.ts"));
console.log("\nNote: Simulation makes real calls to Sepolia Chainlink Data Feeds\n");

// Simulate using CRE CLI
const args = [
  "workflow",
  "simulate",
  "--workflow-file", path.join(projectRoot, "src", "workflow", "index.ts"),
  "--config-file", configPath,
];

// Add env file if it exists
if (fs.existsSync(envPath)) {
  args.push("--env", envPath);
}

const simulate = spawn("cre", args, {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env },
});

simulate.on("error", (error) => {
  console.error("❌ Failed to start simulation:", error.message);
  console.log("\nMake sure CRE CLI is installed:");
  console.log("  Visit https://docs.chain.link/cre/getting-started/cli-installation");
  console.log("\nInstall CRE CLI:");
  console.log("  curl -sSfL https://smartcontractkit.github.io/cre-cli/install.sh | bash");
  process.exit(1);
});

simulate.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Simulation completed successfully");
    console.log("\nThe workflow:");
    console.log("  1. Read ETH/USD and BTC/USD from Chainlink Data Feeds on Sepolia");
    console.log("  2. Ran momentum and mean reversion signal analysis");
    console.log("  3. Generated AI trading recommendations");
  } else {
    console.error(`\n❌ Simulation exited with code ${code}`);
    process.exit(code);
  }
});

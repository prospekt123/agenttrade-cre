#!/usr/bin/env node
/**
 * Deploy CRE Workflow
 *
 * Deploys the AgentTrade workflow to Chainlink DON using CRE CLI.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

console.log("🚀 Deploying AgentTrade CRE Workflow...\n");

// Check .env
const envPath = path.join(projectRoot, ".env");
if (!fs.existsSync(envPath)) {
  console.error("❌ .env file not found");
  console.log("Copy .env.example to .env and configure your credentials:");
  console.log("  cp .env.example .env");
  process.exit(1);
}

// Check config
const configPath = path.join(projectRoot, "config.staging.json");
console.log("Config:", configPath);
console.log("Deploying to Chainlink DON...\n");

const deploy = spawn(
  "cre",
  [
    "workflow",
    "deploy",
    "--workflow-file", path.join(projectRoot, "src", "workflow", "index.ts"),
    "--config-file", configPath,
    "--env", envPath,
    "--name", "agenttrade-ai-signals",
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: { ...process.env },
  }
);

deploy.on("error", (error) => {
  console.error("❌ Failed to deploy:", error.message);
  console.log("\nMake sure:");
  console.log("  1. CRE CLI is installed");
  console.log("  2. You have CRE network access");
  console.log("  3. Your credentials are configured in .env");
  process.exit(1);
});

deploy.on("close", (code) => {
  if (code === 0) {
    console.log("\n✅ Deployment successful!");
    console.log("\nNext steps:");
    console.log("  1. Start x402 gateway: npm run server");
    console.log("  2. AI agents can now pay for signals at /signals");
  } else {
    console.error(`\n❌ Deployment failed with code ${code}`);
    process.exit(code);
  }
});

#!/usr/bin/env node

/**
 * AgentTrade CRE Workflow Simulation
 *
 * Simulates the CRE workflow locally by running the same signal analysis logic
 * that would execute on the DON. Uses mock price data to demonstrate the full
 * pipeline: price fetch -> signal analysis -> agent consumption -> trade execution.
 *
 * Usage:
 *   node scripts/simulate.js
 *   # or
 *   npm run simulate
 */

import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";

// Chainlink Data Feed ABI (latestRoundData)
const priceFeedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

// Feed addresses from config.staging.json (Sepolia)
const FEEDS = {
  ETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  BTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
};

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

async function main() {
  console.log("=" .repeat(60));
  console.log("  AgentTrade CRE Workflow Simulation");
  console.log("  Simulating DON execution locally");
  console.log("=" .repeat(60));
  console.log();

  // Step 1: Fetch prices from Chainlink Data Feeds on Sepolia
  console.log("[Step 1] Reading Chainlink Data Feeds on Sepolia...");
  console.log(`  RPC: ${RPC_URL}`);

  const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL, { timeout: 10000 }),
  });

  const prices = {};
  let useLive = true;

  for (const [asset, feedAddress] of Object.entries(FEEDS)) {
    try {
      const result = await client.readContract({
        address: feedAddress,
        abi: priceFeedAbi,
        functionName: "latestRoundData",
      });

      const price = Number(result[1]) / 1e8;
      const updatedAt = new Date(Number(result[3]) * 1000).toISOString();
      prices[asset] = price;
      console.log(`  ✅ ${asset}/USD: $${price.toFixed(2)} (updated: ${updatedAt})`);
    } catch (err) {
      console.log(`  ⚠️  ${asset}/USD: RPC error, using mock price`);
      useLive = false;
    }
  }

  if (!useLive || Object.keys(prices).length < 2) {
    console.log("\n  Using mock prices for simulation...");
    prices.ETH = 2340.50;
    prices.BTC = 62100.00;
    console.log(`  ETH/USD: $${prices.ETH}`);
    console.log(`  BTC/USD: $${prices.BTC}`);
  }

  // Step 2: Generate signals (same logic as CRE workflow)
  console.log("\n[Step 2] Running signal analysis (same logic as CRE workflow)...");

  // Import signal functions from workflow
  // Import signal logic - these are the same functions that run inside CRE
  // We inline them here for standalone execution without tsx
  const { calculateMomentumSignal, calculateMeanReversionSignal, aggregateSignals } =
    buildSignalFunctions();

  // Simulate price history (in production, CRE would accumulate this)
  const priceHistory = {
    ETH: generateMockHistory(prices.ETH, 30, 0.015),
    BTC: generateMockHistory(prices.BTC, 30, 0.01),
  };

  const signals = [];

  for (const [asset, price] of Object.entries(prices)) {
    const history = priceHistory[asset];
    const momentumSignal = calculateMomentumSignal(history, price, asset);
    const meanRevSignal = calculateMeanReversionSignal(history, price, asset);

    signals.push(momentumSignal, meanRevSignal);

    console.log(`\n  ${asset}/USD:`);
    console.log(`    Momentum:       ${momentumSignal.signal} (${(momentumSignal.strength * 100).toFixed(1)}%) - ${momentumSignal.reason}`);
    console.log(`    Mean Reversion: ${meanRevSignal.signal} (${(meanRevSignal.strength * 100).toFixed(1)}%) - ${meanRevSignal.reason}`);
  }

  // Step 3: Aggregate signals
  console.log("\n[Step 3] Aggregating signals...");

  const aggregated = aggregateSignals(signals);

  for (const [asset, agg] of Object.entries(aggregated)) {
    console.log(`  ${asset}: ${agg.recommendation} (buy: ${(agg.buyStrength * 100).toFixed(1)}%, sell: ${(agg.sellStrength * 100).toFixed(1)}%)`);
  }

  // Step 4: Simulate AI agent consuming signals
  console.log("\n[Step 4] AI Agent consuming signals via x402...");

  const { AgentTradeAI } = buildAgentClass();
  const agent = new AgentTradeAI(10000);

  const decisions = agent.analyzeSignals(signals);

  for (const decision of decisions) {
    console.log(`\n  === ${decision.asset} ===`);
    console.log(`  Action:     ${decision.action}`);
    console.log(`  Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`  Reasoning:  ${decision.reasoning}`);

    if (decision.action !== "HOLD") {
      const price = prices[decision.asset];
      const success = agent.executeTrade(
        decision.action,
        decision.asset,
        decision.amount,
        price,
        decision.reasoning
      );
      console.log(`  Trade:      ${success ? "✅ Executed" : "❌ Failed"}`);
    }
  }

  // Step 5: Portfolio summary
  console.log("\n[Step 5] Portfolio Summary");
  const summary = agent.getPortfolioSummary();
  console.log(`  Cash:     $${summary.cash.toFixed(2)}`);
  for (const pos of summary.positions) {
    console.log(`  ${pos.asset}:     ${pos.amount.toFixed(4)} @ $${pos.avgPrice.toFixed(2)}`);
  }
  console.log(`  Trades:   ${summary.totalTrades}`);

  // Workflow output (what CRE would return)
  const workflowOutput = {
    timestamp: Date.now(),
    prices,
    signals,
    aggregated,
    source: "AgentTrade CRE Workflow Simulation",
  };

  console.log("\n[Workflow Output] (JSON - what CRE DON would return):");
  console.log(JSON.stringify(workflowOutput, null, 2));

  console.log("\n" + "=" .repeat(60));
  console.log("  Simulation complete");
  console.log("  In production: CRE CLI would run `cre workflow simulate`");
  console.log("  and execute this logic across the DON.");
  console.log("=" .repeat(60));
}

/**
 * Generate mock price history with realistic noise
 */
function generateMockHistory(currentPrice, points, volatility) {
  const history = [];
  let price = currentPrice * (1 - volatility * points * 0.1);

  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.45) * volatility * currentPrice;
    price = Math.max(price + change, currentPrice * 0.5);
    history.push({
      timestamp: Date.now() - (points - i) * 300000,
      price,
    });
  }

  return history;
}

main().catch(console.error);

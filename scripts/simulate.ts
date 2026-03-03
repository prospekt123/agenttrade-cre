#!/usr/bin/env npx tsx

/**
 * AgentTrade CRE Workflow Simulation
 *
 * Simulates the CRE workflow locally by:
 * 1. Reading REAL Chainlink Data Feed prices from Sepolia
 * 2. Running the same signal analysis logic that executes on the DON
 * 3. Demonstrating an AI agent consuming signals and making trades
 *
 * Usage:
 *   npx tsx scripts/simulate.ts
 *   # or
 *   npm run simulate
 */

import { createPublicClient, http, parseAbi } from "viem";
import { sepolia } from "viem/chains";
import {
  calculateMomentumSignal,
  calculateMeanReversionSignal,
  aggregateSignals,
} from "../src/workflow/index.js";
import { AgentTradeAI } from "../src/agent/index.js";

// Chainlink Data Feed ABI
const priceFeedAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);

// Feed addresses from config.staging.json (Sepolia testnet)
const FEEDS: Record<string, `0x${string}`> = {
  ETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  BTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
};

const RPC_URL = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

async function main() {
  console.log("=".repeat(60));
  console.log("  AgentTrade CRE Workflow Simulation");
  console.log("  Simulating DON execution locally");
  console.log("=".repeat(60));
  console.log();

  // ── Step 1: Fetch REAL prices from Chainlink Data Feeds ──
  console.log("[Step 1] Reading Chainlink Data Feeds on Sepolia...");
  console.log(`  RPC: ${RPC_URL}`);

  const client = createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL, { timeout: 10_000 }),
  });

  const prices: Record<string, number> = {};

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
    } catch {
      console.log(`  ⚠️  ${asset}/USD: RPC error, using mock price`);
    }
  }

  // Fallback to mock if RPC failed
  if (!prices.ETH) { prices.ETH = 2340.50; console.log(`  [mock] ETH/USD: $${prices.ETH}`); }
  if (!prices.BTC) { prices.BTC = 62100.00; console.log(`  [mock] BTC/USD: $${prices.BTC}`); }

  // ── Step 2: Generate signals (same logic as CRE workflow) ──
  console.log("\n[Step 2] Running signal analysis (CRE workflow logic)...");

  // Simulate price history (in production CRE would accumulate via on-chain state)
  const signals = [];

  for (const [asset, price] of Object.entries(prices)) {
    const history = steadyHistory(price * 0.98, 30, price * 1.01);
    const momentumSignal = calculateMomentumSignal(history, price, asset);
    const meanRevSignal = calculateMeanReversionSignal(history, price, asset);

    signals.push(momentumSignal, meanRevSignal);

    console.log(`\n  ${asset}/USD:`);
    console.log(`    Momentum:       ${momentumSignal.signal} (${(momentumSignal.strength * 100).toFixed(1)}%) - ${momentumSignal.reason}`);
    console.log(`    Mean Reversion: ${meanRevSignal.signal} (${(meanRevSignal.strength * 100).toFixed(1)}%) - ${meanRevSignal.reason}`);
  }

  // ── Step 3: Aggregate ──
  console.log("\n[Step 3] Aggregating signals (per-direction, no dilution)...");
  const aggregated = aggregateSignals(signals);

  for (const [asset, agg] of Object.entries(aggregated)) {
    console.log(`  ${asset}: ${agg.recommendation} (buy: ${(agg.buyStrength * 100).toFixed(1)}%, sell: ${(agg.sellStrength * 100).toFixed(1)}%)`);
  }

  // ── Step 4: AI Agent consumes signals (multi-tick simulation) ──
  console.log("\n[Step 4] AI Agent - Multi-tick simulation via x402...");
  const agent = new AgentTradeAI(10000);

  // Tick 1: ETH slow bleed → strong mean reversion BUY, weak momentum SELL
  // History: ETH was stable at high price, slow decline over 30 ticks
  // → Momentum sees small recent decline (weak SELL ≈ 50%)
  // → Mean reversion sees price far below MA (strong BUY ≈ 90%)
  // → Net: 90% - 50% = 40% > 20% threshold → BUY ✅
  console.log("\n  --- Tick 1: ETH slow bleed → mean reversion dominates → BUY ---");
  const ethHigh = prices.ETH * 1.05;
  const tick1Signals = [
    calculateMomentumSignal(
      steadyHistory(ethHigh, 30, prices.ETH * 0.99), // slow decline
      prices.ETH * 0.97, "ETH" // current slightly below recent
    ),
    calculateMeanReversionSignal(
      steadyHistory(ethHigh, 30, ethHigh * 0.99), // MA stays near high
      prices.ETH * 0.97, "ETH" // current well below MA
    ),
  ];
  const tick1Prices = { ETH: prices.ETH * 0.97 };
  const decisions1 = agent.analyzeSignals(tick1Signals);
  executeTick(agent, decisions1, tick1Prices);

  // Tick 2: BTC rapid pump → strong momentum BUY, weak mean reversion SELL
  // History: BTC was low, pumping rapidly in last 6 ticks
  // → Momentum: huge recent rise (strong BUY ≈ 100%)
  // → Mean reversion: slightly above low MA (weak SELL ≈ 40%)
  // → Net: 100% - 40% = 60% > 20% → BUY ✅
  console.log("\n  --- Tick 2: BTC rapid pump → momentum dominates → BUY ---");
  const btcLow = prices.BTC * 0.92;
  const tick2Signals = [
    calculateMomentumSignal(
      steadyHistory(btcLow, 30, btcLow * 1.02), // mostly flat low
      prices.BTC * 1.01, "BTC" // jumped up from history
    ),
    calculateMeanReversionSignal(
      steadyHistory(btcLow, 30, btcLow * 1.01), // MA is low
      prices.BTC * 1.01, "BTC" // current above MA (weak sell)
    ),
  ];
  const tick2Prices = { BTC: prices.BTC * 1.01 };
  const decisions2 = agent.analyzeSignals(tick2Signals);
  executeTick(agent, decisions2, tick2Prices);

  // Tick 3: Both overbought → mean reversion SELL dominates
  // History: recent pump, prices now well above MA
  // → Momentum: flattening (weak BUY or HOLD)
  // → Mean reversion: far above MA (strong SELL)
  // → Net SELL > 20% → SELL ✅
  console.log("\n  --- Tick 3: Both overbought → SELL ---");
  const tick3Signals = [
    calculateMomentumSignal(
      steadyHistory(prices.ETH * 0.97, 30, prices.ETH * 1.01), // recent recovery
      prices.ETH * 1.02, "ETH"
    ),
    calculateMeanReversionSignal(
      steadyHistory(prices.ETH * 0.97, 30, prices.ETH * 0.98), // MA below
      prices.ETH * 1.06, "ETH" // way above MA
    ),
    calculateMomentumSignal(
      steadyHistory(prices.BTC * 1.01, 30, prices.BTC * 1.02), // flat high
      prices.BTC * 1.02, "BTC"
    ),
    calculateMeanReversionSignal(
      steadyHistory(prices.BTC * 0.95, 30, prices.BTC * 0.96), // low MA
      prices.BTC * 1.06, "BTC" // way above MA
    ),
  ];
  const tick3Prices = { ETH: prices.ETH * 1.06, BTC: prices.BTC * 1.06 };
  const decisions3 = agent.analyzeSignals(tick3Signals);
  executeTick(agent, decisions3, tick3Prices);

  // ── Step 5: Final Results ──
  console.log("\n[Step 5] Final Portfolio Summary");
  const summary = agent.getPortfolioSummary();
  console.log(`  Cash:     $${summary.cash.toFixed(2)}`);
  for (const pos of summary.positions) {
    console.log(`  ${pos.asset}:     ${pos.amount.toFixed(6)} @ $${pos.avgPrice.toFixed(2)}`);
  }
  console.log(`  Trades:   ${summary.totalTrades}`);

  // Calculate P&L
  const finalPrices = new Map(Object.entries(tick3Prices));
  const pnl = agent.calculatePnL(finalPrices);
  console.log(`  P&L:      ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);

  // CRE workflow output
  const workflowOutput = {
    timestamp: Date.now(),
    prices,
    signals: signals.map((s) => ({
      type: s.type,
      asset: s.asset,
      signal: s.signal,
      strength: s.strength,
      reason: s.reason,
    })),
    aggregated,
  };

  console.log("\n[CRE Workflow Output]");
  console.log(JSON.stringify(workflowOutput, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log("  ✅ Simulation complete");
  console.log("  CRE CLI: `cre workflow simulate` executes this on DON");
  console.log("=".repeat(60));
}

function executeTick(
  agent: InstanceType<typeof AgentTradeAI>,
  decisions: ReturnType<InstanceType<typeof AgentTradeAI>["analyzeSignals"]>,
  prices: Record<string, number>
) {
  for (const decision of decisions) {
    console.log(`  ${decision.asset}: ${decision.action} (${(decision.confidence * 100).toFixed(1)}%) - ${decision.reasoning}`);
    if (decision.action !== "HOLD" && decision.amount > 0) {
      const price = prices[decision.asset];
      const success = agent.executeTrade(decision.action, decision.asset, decision.amount, price, decision.reasoning);
      console.log(`    → Trade: ${success ? "✅ Executed" : "❌ Failed"} (${decision.amount.toFixed(6)} ${decision.asset} @ $${price.toFixed(2)})`);
    }
  }
}

/**
 * Generate deterministic price history with a steady trend.
 * Starts at `startPrice`, trends linearly toward `endPrice` over `points` ticks.
 */
function steadyHistory(startPrice: number, points: number, endPrice: number) {
  const step = (endPrice - startPrice) / points;
  return Array.from({ length: points }, (_, i) => ({
    timestamp: Date.now() - (points - i) * 300_000,
    price: startPrice + step * i,
  }));
}

main().catch(console.error);

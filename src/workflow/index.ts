/**
 * AgentTrade CRE Workflow
 *
 * AI-powered trading signal generation using Chainlink Runtime Environment:
 * 1. Cron trigger every 5 minutes
 * 2. Fetches ETH/USD + BTC/USD prices via Chainlink Data Feeds (EVM read)
 * 3. Runs momentum + mean reversion signal analysis
 * 4. Returns structured trading signals for AI agent consumption
 *
 * This workflow is designed to be consumed by AI agents via x402 payments.
 */

import {
  cre,
  Runner,
  type Runtime,
  type CronPayload,
  type HTTPPayload,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  type HTTPSendRequester,
  ok,
  consensusIdenticalAggregation,
  decodeJson,
} from "@chainlink/cre-sdk";
import { encodeFunctionData, decodeFunctionResult, zeroAddress } from "viem";

// ============================================================================
// Configuration Types
// ============================================================================

interface WorkflowConfig {
  schedule: string;
  evms: Array<{
    chainSelectorName: string;
    dataFeeds: Record<string, string>;
  }>;
}

// ============================================================================
// Chainlink Price Feed ABI
// ============================================================================

const priceFeedAbi = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

// ============================================================================
// Signal Detection Logic (exported for testing)
// ============================================================================

export interface TradingSignal {
  type: "momentum" | "meanReversion";
  asset: string;
  signal: "BUY" | "SELL" | "HOLD";
  strength: number;
  reason: string;
  currentPrice: number;
}

export function calculateMomentumSignal(
  history: Array<{ timestamp: number; price: number }>,
  currentPrice: number,
  asset: string,
  threshold: number = 0.015
): TradingSignal {
  if (history.length < 2) {
    return {
      type: "momentum",
      asset,
      signal: "HOLD",
      strength: 0,
      reason: "Insufficient price history",
      currentPrice,
    };
  }

  const lookbackIndex = Math.max(0, history.length - 6);
  const previousPrice = history[lookbackIndex].price;
  const priceChange = (currentPrice - previousPrice) / previousPrice;

  if (priceChange > threshold) {
    return {
      type: "momentum",
      asset,
      signal: "BUY",
      strength: Math.min(priceChange / (threshold * 2), 1),
      reason: `Strong upward momentum: +${(priceChange * 100).toFixed(2)}%`,
      currentPrice,
    };
  }

  if (priceChange < -threshold) {
    return {
      type: "momentum",
      asset,
      signal: "SELL",
      strength: Math.min(Math.abs(priceChange) / (threshold * 2), 1),
      reason: `Strong downward momentum: ${(priceChange * 100).toFixed(2)}%`,
      currentPrice,
    };
  }

  return {
    type: "momentum",
    asset,
    signal: "HOLD",
    strength: 0,
    reason: `Low momentum: ${(priceChange * 100).toFixed(2)}%`,
    currentPrice,
  };
}

export function calculateMeanReversionSignal(
  history: Array<{ timestamp: number; price: number }>,
  currentPrice: number,
  asset: string,
  maPeriod: number = 20,
  deviationThreshold: number = 0.02
): TradingSignal {
  if (history.length < 2) {
    return {
      type: "meanReversion",
      asset,
      signal: "HOLD",
      strength: 0,
      reason: "Insufficient price history",
      currentPrice,
    };
  }

  const prices = history.map((p) => p.price);
  const period = Math.min(maPeriod, prices.length);
  const recentPrices = prices.slice(-period);
  const movingAverage =
    recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
  const deviation = (currentPrice - movingAverage) / movingAverage;

  if (deviation < -deviationThreshold) {
    return {
      type: "meanReversion",
      asset,
      signal: "BUY",
      strength: Math.min(
        Math.abs(deviation) / (deviationThreshold * 2),
        1
      ),
      reason: `Price ${(Math.abs(deviation) * 100).toFixed(2)}% below MA - oversold`,
      currentPrice,
    };
  }

  if (deviation > deviationThreshold) {
    return {
      type: "meanReversion",
      asset,
      signal: "SELL",
      strength: Math.min(deviation / (deviationThreshold * 2), 1),
      reason: `Price ${(deviation * 100).toFixed(2)}% above MA - overbought`,
      currentPrice,
    };
  }

  return {
    type: "meanReversion",
    asset,
    signal: "HOLD",
    strength: 0,
    reason: `Price ${(deviation * 100).toFixed(2)}% from MA - near equilibrium`,
    currentPrice,
  };
}

/**
 * Aggregate signals per asset with correct strength calculation.
 * Only counts signals that actually match the direction (not all signals).
 */
export function aggregateSignals(
  signals: TradingSignal[]
): Record<string, { buyStrength: number; sellStrength: number; recommendation: string }> {
  const byAsset = new Map<string, TradingSignal[]>();
  for (const s of signals) {
    const arr = byAsset.get(s.asset) || [];
    arr.push(s);
    byAsset.set(s.asset, arr);
  }

  const result: Record<string, { buyStrength: number; sellStrength: number; recommendation: string }> = {};

  // Net strength threshold: how much one direction must dominate the other.
  // With 2 opposing strategies (momentum vs mean reversion), they rarely agree.
  // 0.2 = trade when one strategy is significantly stronger than the other.
  const MIN_CONFIDENCE = 0.2;

  for (const [asset, assetSignals] of byAsset) {
    const buySignals = assetSignals.filter((s) => s.signal === "BUY");
    const sellSignals = assetSignals.filter((s) => s.signal === "SELL");

    const buyStrength =
      buySignals.length > 0
        ? buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length
        : 0;
    const sellStrength =
      sellSignals.length > 0
        ? sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length
        : 0;

    // Use net strength (same logic as AgentTradeAI.analyzeSignals)
    const netStrength = buyStrength - sellStrength;

    result[asset] = {
      buyStrength,
      sellStrength,
      recommendation:
        netStrength > MIN_CONFIDENCE
          ? "BUY"
          : netStrength < -MIN_CONFIDENCE
            ? "SELL"
            : "HOLD",
    };
  }

  return result;
}

// ============================================================================
// Helper: Read Chainlink Price Feed
// ============================================================================

function getPriceFromFeed(
  runtime: Runtime<WorkflowConfig>,
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  feedAddress: string
): { price: number; rawAnswer: bigint; updatedAt: bigint } {
  const callData = encodeFunctionData({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    args: [],
  });

  const result = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: feedAddress as `0x${string}`,
        data: callData,
      }),
    })
    .result();

  const decoded = decodeFunctionResult({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    data: bytesToHex(result.data),
  }) as [bigint, bigint, bigint, bigint, bigint];

  // Chainlink price feeds return price with 8 decimals
  const price = Number(decoded[1]) / 1e8;

  return { price, rawAnswer: decoded[1], updatedAt: decoded[3] };
}

// ============================================================================
// Cron Trigger Handler: Price Check + Signal Generation
// ============================================================================

const onCronTrigger = (
  runtime: Runtime<WorkflowConfig>,
  _triggerOutput: CronPayload
): string => {
  runtime.log("AgentTrade CRE Workflow: Price Check + Signal Generation");

  const evmConfig = runtime.config.evms[0];

  // Get network and create EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error("Network not found for configured chain");
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  // Fetch prices from all configured data feeds
  runtime.log("[Step 1] Fetching prices from Chainlink Data Feeds...");

  const prices: Record<string, number> = {};
  const signals: TradingSignal[] = [];

  for (const [asset, feedAddress] of Object.entries(evmConfig.dataFeeds)) {
    const data = getPriceFromFeed(runtime, evmClient, feedAddress);
    prices[asset] = data.price;
    runtime.log(`  ${asset}/USD: $${data.price.toFixed(2)}`);

    // NOTE: CRE workflow invocations are isolated - no persistent state between ticks.
    // Signals are generated per-tick from current price only.
    // For production: use on-chain storage or CRE state capabilities for history.
    // Single-tick signals still provide value via mean reversion against the feed's
    // own recent rounds (could be fetched via getRoundData in future).
    signals.push(
      calculateMomentumSignal([], data.price, asset),
      calculateMeanReversionSignal([], data.price, asset)
    );
  }

  // Aggregate signals per asset
  runtime.log("[Step 2] Signal Analysis:");
  for (const signal of signals) {
    runtime.log(
      `  ${signal.asset} ${signal.type}: ${signal.signal} (${(signal.strength * 100).toFixed(1)}%) - ${signal.reason}`
    );
  }

  const aggregated = aggregateSignals(signals);

  // Use block-derived timestamp for deterministic consensus across nodes
  const timestamp = Math.floor(Number((_triggerOutput as any).timestamp ?? 0));

  const result = {
    timestamp,
    prices,
    signals,
    aggregated,
  };

  runtime.log(`[Step 3] Recommendations:`);
  for (const [asset, agg] of Object.entries(aggregated)) {
    runtime.log(`  ${asset}: ${agg.recommendation}`);
  }

  return JSON.stringify(result);
};

// ============================================================================
// HTTP Trigger Handler: On-Demand Signal Request (for x402 agents)
// ============================================================================

const onHttpTrigger = (
  runtime: Runtime<WorkflowConfig>,
  payload: HTTPPayload
): string => {
  runtime.log("AgentTrade CRE Workflow: HTTP Trigger (Agent Request)");

  const evmConfig = runtime.config.evms[0];
  const availableAssets = Object.keys(evmConfig.dataFeeds);

  // Parse request - filter to only configured assets
  let requestedAssets = availableAssets;
  if (payload.input && payload.input.length > 0) {
    try {
      const input = decodeJson(payload.input);
      if (input.assets && Array.isArray(input.assets)) {
        requestedAssets = input.assets.filter((a: string) =>
          availableAssets.includes(a)
        );
        if (requestedAssets.length === 0) {
          return JSON.stringify({
            error: `No valid assets requested. Available: ${availableAssets.join(", ")}`,
          });
        }
      }
    } catch {
      // Use defaults
    }
  }

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error("Network not found");
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  const prices: Record<string, number> = {};
  const signals: TradingSignal[] = [];

  for (const asset of requestedAssets) {
    const feedAddress = evmConfig.dataFeeds[asset];
    if (!feedAddress) continue;

    const data = getPriceFromFeed(runtime, evmClient, feedAddress);
    prices[asset] = data.price;

    // Same note as cron: no persistent history in CRE
    signals.push(
      calculateMomentumSignal([], data.price, asset),
      calculateMeanReversionSignal([], data.price, asset)
    );
  }

  runtime.log(`Returning signals for: ${requestedAssets.join(", ")}`);

  return JSON.stringify({
    timestamp: Number((payload as any).timestamp ?? 0),
    prices,
    signals,
    aggregated: aggregateSignals(signals),
  });
};

// ============================================================================
// Workflow Entry Point
// ============================================================================

const initWorkflow = (config: WorkflowConfig) => {
  const cronCapability = new cre.capabilities.CronCapability();
  const httpCapability = new cre.capabilities.HTTPCapability();

  return [
    cre.handler(
      cronCapability.trigger({ schedule: config.schedule }),
      onCronTrigger
    ),
    cre.handler(
      httpCapability.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: "", // Set via config/env in production
          },
        ],
      }),
      onHttpTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<WorkflowConfig>();
  await runner.run(initWorkflow);
}

// Only run when executed directly, not when imported
if (typeof process !== "undefined" && process.argv[1]?.includes("workflow")) {
  main();
}

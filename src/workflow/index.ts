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
    dataFeeds: {
      ETH: string;
      BTC: string;
    };
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
// Price History (in-memory across cron ticks within a workflow session)
// ============================================================================

const priceHistory: {
  eth: Array<{ timestamp: number; price: number }>;
  btc: Array<{ timestamp: number; price: number }>;
} = { eth: [], btc: [] };

const MAX_HISTORY = 30;

// ============================================================================
// Signal Detection Logic
// ============================================================================

interface TradingSignal {
  type: "momentum" | "meanReversion";
  asset: string;
  signal: "BUY" | "SELL" | "HOLD";
  strength: number;
  reason: string;
  currentPrice: number;
}

function calculateMomentumSignal(
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

function calculateMeanReversionSignal(
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
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("AgentTrade CRE Workflow: Price Check + Signal Generation");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Get network and create EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error("Network not found for configured chain");
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  // Step 1: Fetch prices from Chainlink Data Feeds
  runtime.log("\n[Step 1] Fetching prices from Chainlink Data Feeds...");

  const ethData = getPriceFromFeed(
    runtime,
    evmClient,
    runtime.config.evms[0].dataFeeds.ETH
  );

  const btcData = getPriceFromFeed(
    runtime,
    evmClient,
    runtime.config.evms[0].dataFeeds.BTC
  );

  runtime.log(`  ETH/USD: $${ethData.price.toFixed(2)}`);
  runtime.log(`  BTC/USD: $${btcData.price.toFixed(2)}`);

  // Step 2: Update price history
  const timestamp = Math.floor(Date.now() / 1000);
  priceHistory.eth.push({ timestamp, price: ethData.price });
  priceHistory.btc.push({ timestamp, price: btcData.price });
  if (priceHistory.eth.length > MAX_HISTORY) priceHistory.eth.shift();
  if (priceHistory.btc.length > MAX_HISTORY) priceHistory.btc.shift();

  // Step 3: Generate trading signals
  runtime.log("\n[Step 2] Generating trading signals...");

  const signals: TradingSignal[] = [
    calculateMomentumSignal(priceHistory.eth, ethData.price, "ETH"),
    calculateMeanReversionSignal(priceHistory.eth, ethData.price, "ETH"),
    calculateMomentumSignal(priceHistory.btc, btcData.price, "BTC"),
    calculateMeanReversionSignal(priceHistory.btc, btcData.price, "BTC"),
  ];

  // Step 4: Aggregate signals per asset
  runtime.log("\n[Step 3] Signal Analysis:");
  for (const signal of signals) {
    runtime.log(
      `  ${signal.asset} ${signal.type}: ${signal.signal} (${(signal.strength * 100).toFixed(1)}%) - ${signal.reason}`
    );
  }

  // AI agent decision summary
  const ethSignals = signals.filter((s) => s.asset === "ETH");
  const btcSignals = signals.filter((s) => s.asset === "BTC");

  const ethBuyStrength =
    ethSignals
      .filter((s) => s.signal === "BUY")
      .reduce((sum, s) => sum + s.strength, 0) / ethSignals.length;
  const ethSellStrength =
    ethSignals
      .filter((s) => s.signal === "SELL")
      .reduce((sum, s) => sum + s.strength, 0) / ethSignals.length;

  const btcBuyStrength =
    btcSignals
      .filter((s) => s.signal === "BUY")
      .reduce((sum, s) => sum + s.strength, 0) / btcSignals.length;
  const btcSellStrength =
    btcSignals
      .filter((s) => s.signal === "SELL")
      .reduce((sum, s) => sum + s.strength, 0) / btcSignals.length;

  const result = {
    timestamp,
    prices: {
      ETH: ethData.price,
      BTC: btcData.price,
    },
    signals,
    aggregated: {
      ETH: {
        buyStrength: ethBuyStrength,
        sellStrength: ethSellStrength,
        recommendation:
          ethBuyStrength > 0.3
            ? "BUY"
            : ethSellStrength > 0.3
              ? "SELL"
              : "HOLD",
      },
      BTC: {
        buyStrength: btcBuyStrength,
        sellStrength: btcSellStrength,
        recommendation:
          btcBuyStrength > 0.3
            ? "BUY"
            : btcSellStrength > 0.3
              ? "SELL"
              : "HOLD",
      },
    },
  };

  runtime.log(`\n[Step 4] Recommendations:`);
  runtime.log(`  ETH: ${result.aggregated.ETH.recommendation}`);
  runtime.log(`  BTC: ${result.aggregated.BTC.recommendation}`);
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return JSON.stringify(result);
};

// ============================================================================
// HTTP Trigger Handler: On-Demand Signal Request (for x402 agents)
// ============================================================================

const onHttpTrigger = (
  runtime: Runtime<WorkflowConfig>,
  payload: HTTPPayload
): string => {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("AgentTrade CRE Workflow: HTTP Trigger (Agent Request)");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Parse request if present
  let requestedAssets = ["ETH", "BTC"];
  if (payload.input && payload.input.length > 0) {
    try {
      const input = decodeJson(payload.input);
      if (input.assets && Array.isArray(input.assets)) {
        requestedAssets = input.assets;
      }
    } catch {
      // Use defaults
    }
  }

  // Re-use the same price fetching logic
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evms[0].chainSelectorName,
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
    const feedAddress =
      runtime.config.evms[0].dataFeeds[
        asset as keyof typeof runtime.config.evms[0]["dataFeeds"]
      ];
    if (!feedAddress) continue;

    const data = getPriceFromFeed(runtime, evmClient, feedAddress);
    prices[asset] = data.price;

    const history =
      asset === "ETH"
        ? priceHistory.eth
        : asset === "BTC"
          ? priceHistory.btc
          : [];

    signals.push(
      calculateMomentumSignal(history, data.price, asset),
      calculateMeanReversionSignal(history, data.price, asset)
    );
  }

  runtime.log(`Returning signals for: ${requestedAssets.join(", ")}`);

  return JSON.stringify({
    timestamp: Math.floor(Date.now() / 1000),
    prices,
    signals,
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
            publicKey: "", // Set via config in production
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

main();

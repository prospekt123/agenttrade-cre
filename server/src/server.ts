/**
 * AgentTrade x402 Gateway Server
 *
 * Exposes AI trading signals behind x402 micropayment paywall.
 * AI agents pay $0.01 USDC per signal request, then receive
 * Chainlink-verified price data + trading recommendations.
 */

import express from "express";
import cors from "cors";
import { AgentTradeAI } from "../../src/agent/index.js";
import { aggregateSignals, type TradingSignal } from "../../src/workflow/index.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

// x402 payment configuration
const X402_RECEIVER = process.env.X402_RECEIVER_ADDRESS || "0x0000000000000000000000000000000000000000";
const X402_FACILITATOR = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

// Internal API key for signal updates (set via env, required in production)
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || "";

// ============================================================================
// x402 Payment Middleware
// ============================================================================

/**
 * x402 middleware for signal endpoint.
 * In production: replace with `x402-express` paymentMiddleware.
 * Demo mode: validates payment header exists and is non-empty.
 */
const x402Middleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Only apply to paid endpoints
  if (req.path !== "/signals") {
    return next();
  }

  const paymentHeader = req.headers["x-payment"];

  if (!paymentHeader || (typeof paymentHeader === "string" && paymentHeader.trim() === "")) {
    // Return 402 Payment Required with x402 payment details
    return res.status(402).json({
      error: "Payment Required",
      x402: {
        version: "1",
        payTo: X402_RECEIVER,
        maxAmountRequired: "10000", // $0.01 USDC (6 decimals)
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
        network: "base-sepolia",
        facilitator: X402_FACILITATOR,
        description: "AI trading signals powered by Chainlink CRE",
      },
    });
  }

  // TODO: In production, validate payment via facilitator:
  // const valid = await fetch(X402_FACILITATOR + "/verify", { body: paymentHeader });
  // For now: accept non-empty payment headers in demo mode
  console.log("  [x402] Payment header received - demo mode (accepting)");

  next();
};

app.use(x402Middleware);

// ============================================================================
// Trading Signal Cache (populated by CRE workflow)
// ============================================================================

interface CachedSignals {
  timestamp: number;
  prices: Record<string, number>;
  signals: TradingSignal[];
  aggregated: Record<string, {
    buyStrength: number;
    sellStrength: number;
    recommendation: string;
  }>;
}

let cachedSignals: CachedSignals | null = null;

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /signals - Returns current AI trading signals (requires x402 payment)
 */
app.get("/signals", (_req, res) => {
  console.log("GET /signals (x402 paid request)");

  if (!cachedSignals) {
    return res.status(503).json({
      error: "No signals available yet. CRE workflow has not generated data.",
      hint: "POST to /signals/update with workflow output, or run: cre workflow simulate",
    });
  }

  // Re-aggregate using the corrected aggregation logic
  const freshAggregated = aggregateSignals(cachedSignals.signals);

  const response = {
    timestamp: cachedSignals.timestamp,
    prices: cachedSignals.prices,
    signals: cachedSignals.signals,
    aggregated: freshAggregated,
    metadata: {
      source: "Chainlink CRE Workflow",
      dataFeeds: Object.keys(cachedSignals.prices).map((a) => `${a}/USD`),
      network: "Sepolia Testnet",
      strategies: ["momentum", "meanReversion"],
      paymentRequired: "$0.01 USDC via x402",
    },
  };

  res.json(response);
});

/**
 * POST /signals/update - Updates cached signals (internal, authenticated)
 */
app.post("/signals/update", (req, res) => {
  // Require API key in production mode
  if (INTERNAL_API_KEY) {
    const provided = req.headers["x-api-key"];
    if (provided !== INTERNAL_API_KEY) {
      return res.status(403).json({ error: "Invalid API key" });
    }
  }

  const body = req.body;
  if (!body || !body.prices || !body.signals) {
    return res.status(400).json({ error: "Missing required fields: prices, signals" });
  }

  cachedSignals = body;
  console.log("[Signal Update] Received new signals from CRE workflow");
  res.json({ ok: true, timestamp: cachedSignals?.timestamp });
});

/**
 * GET /health - Health check
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    hasSignals: !!cachedSignals,
    lastUpdate: cachedSignals?.timestamp || null,
    uptime: process.uptime(),
  });
});

// ============================================================================
// Start Server
// ============================================================================

const server = app.listen(PORT, () => {
  console.log(`AgentTrade x402 Gateway running on http://localhost:${PORT}`);
  console.log(`  GET  /signals        (x402 paid - $0.01 USDC)`);
  console.log(`  POST /signals/update (internal${INTERNAL_API_KEY ? ", key required" : ", NO AUTH - set INTERNAL_API_KEY"})`);
  console.log(`  GET  /health`);
});

export { app, server };

/**
 * AgentTrade x402 Gateway Server
 *
 * Exposes AI trading signals behind x402 micropayment paywall.
 * AI agents pay $0.01 USDC per signal request, then receive
 * Chainlink-verified price data + trading recommendations.
 *
 * Flow:
 * 1. AI Agent sends request to /signals endpoint
 * 2. x402 middleware requires $0.01 USDC payment
 * 3. Agent's x402-enabled client auto-pays
 * 4. Server triggers CRE workflow (or returns cached signals)
 * 5. Agent receives trading signals to act on
 *
 * This demonstrates "AI agents consuming CRE workflows with x402 payments"
 * - the exact use case highlighted in the CRE & AI hackathon track.
 */

import express from "express";
import cors from "cors";
import { AgentTradeAI } from "../../src/agent/index.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3000);

// x402 payment configuration
const X402_RECEIVER = process.env.X402_RECEIVER_ADDRESS || "0x0000000000000000000000000000000000000000";
const X402_FACILITATOR = process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

// ============================================================================
// x402 Payment Middleware (simplified for demo/simulation)
// In production, use x402-express paymentMiddleware
// ============================================================================

/**
 * Simplified x402 middleware for demonstration.
 * In a production deployment, replace with:
 *   import { paymentMiddleware } from "x402-express";
 *   app.use(paymentMiddleware(payToAddress, routes, { url: facilitatorUrl }));
 */
const x402Middleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const paymentHeader = req.headers["x-payment"];

  if (!paymentHeader && req.path === "/signals") {
    // Return 402 Payment Required with payment details
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

  if (paymentHeader) {
    console.log("  [x402] Payment header received - validating...");
    // In production: validate via facilitator
    // For demo: accept any payment header
    console.log("  [x402] Payment accepted");
  }

  next();
};

app.use(x402Middleware);

// ============================================================================
// Trading Signal Cache (populated by CRE workflow simulation)
// ============================================================================

interface CachedSignals {
  timestamp: number;
  prices: Record<string, number>;
  signals: Array<{
    type: string;
    asset: string;
    signal: "BUY" | "SELL" | "HOLD";
    strength: number;
    reason: string;
    currentPrice: number;
  }>;
  aggregated: Record<
    string,
    {
      buyStrength: number;
      sellStrength: number;
      recommendation: string;
    }
  >;
}

let cachedSignals: CachedSignals | null = null;

// ============================================================================
// AI Agent Instance
// ============================================================================

const agent = new AgentTradeAI(10000, 0.01, 1.0, 0.02);

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /signals
 * Returns current AI trading signals (requires x402 payment)
 *
 * This is the primary endpoint consumed by AI agents.
 * Payment: $0.01 USDC via x402 protocol
 */
app.get("/signals", (_req, res) => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("GET /signals (x402 paid request)");

  if (!cachedSignals) {
    return res.status(503).json({
      error: "No signals available yet. CRE workflow has not generated data.",
      hint: "Run: cre workflow simulate to generate signals",
    });
  }

  // Run AI agent analysis on the signals
  const aiDecision = analyzeWithAgent(cachedSignals);

  const response = {
    ...cachedSignals,
    aiRecommendation: aiDecision,
    metadata: {
      source: "Chainlink CRE Workflow",
      dataFeeds: ["ETH/USD", "BTC/USD"],
      network: "Sepolia Testnet",
      strategies: ["momentum", "meanReversion"],
      paymentRequired: "$0.01 USDC via x402",
    },
  };

  console.log("  Returning signals to agent");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  res.json(response);
});

/**
 * POST /signals/update
 * Updates cached signals (called after CRE workflow execution)
 * Internal endpoint - no x402 payment required
 */
app.post("/signals/update", (req, res) => {
  console.log("\n  [Signal Update] Received new signals from CRE workflow");
  cachedSignals = req.body;
  res.json({ ok: true, timestamp: cachedSignals?.timestamp });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    hasSignals: !!cachedSignals,
    lastUpdate: cachedSignals?.timestamp || null,
  });
});

// ============================================================================
// AI Agent Analysis
// ============================================================================

function analyzeWithAgent(signals: CachedSignals) {
  const results: Record<string, any> = {};

  for (const [asset, agg] of Object.entries(signals.aggregated)) {
    const assetSignals = signals.signals
      .filter((s) => s.asset === asset)
      .map((s) => ({
        type: s.type,
        signal: s.signal as "BUY" | "SELL" | "HOLD",
        strength: s.strength,
        reason: s.reason,
        currentPrice: s.currentPrice,
      }));

    // Aggregate signal strengths
    let buyStrength = 0;
    let sellStrength = 0;
    for (const s of assetSignals) {
      if (s.signal === "BUY") buyStrength += s.strength;
      if (s.signal === "SELL") sellStrength += s.strength;
    }
    buyStrength /= assetSignals.length;
    sellStrength /= assetSignals.length;

    const netStrength = buyStrength - sellStrength;
    const confidence = Math.abs(netStrength);

    results[asset] = {
      action: netStrength > 0.3 ? "BUY" : netStrength < -0.3 ? "SELL" : "HOLD",
      confidence: (confidence * 100).toFixed(1) + "%",
      suggestedSize: Math.max(0.01, Math.min(1.0, confidence * 0.98)).toFixed(4),
      reasoning: assetSignals.map((s) => `${s.type}: ${s.reason}`).join("; "),
    };
  }

  return results;
}

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("AgentTrade x402 Gateway");
  console.log(`  http://localhost:${PORT}`);
  console.log("  GET  /signals  (x402 paid - $0.01 USDC)");
  console.log("  POST /signals/update  (internal)");
  console.log("  GET  /health");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
});

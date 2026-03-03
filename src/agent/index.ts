/**
 * AgentTrade AI Agent
 *
 * An AI trading agent that consumes CRE workflow signals via x402 payments.
 * Demonstrates the full loop:
 * 1. Agent pays for signals via x402 protocol
 * 2. Receives Chainlink-verified trading signals
 * 3. Makes AI-powered trading decisions
 * 4. Manages portfolio with risk controls
 */

// ============================================================================
// Types
// ============================================================================

interface TradingSignal {
  type: string;
  asset: string;
  signal: "BUY" | "SELL" | "HOLD";
  strength: number;
  reason: string;
  currentPrice: number;
}

interface Position {
  amount: number;
  avgPrice: number;
}

interface Trade {
  timestamp: number;
  action: "BUY" | "SELL";
  asset: string;
  amount: number;
  price: number;
  reason: string;
}

interface Portfolio {
  cash: number;
  positions: Map<string, Position>;
  trades: Trade[];
}

// ============================================================================
// Constants
// ============================================================================

/** Amounts below this are treated as zero (avoids float dust) */
const EPSILON = 1e-10;

// ============================================================================
// AI Trading Agent
// ============================================================================

export class AgentTradeAI {
  private portfolio: Portfolio;
  private readonly initialCash: number;
  private readonly minTradeSize: number;
  private readonly maxTradeSize: number;
  private readonly riskTolerance: number;

  constructor(
    initialCash: number = 10000,
    minTradeSize: number = 0.01,
    maxTradeSize: number = 1.0,
    riskTolerance: number = 0.02
  ) {
    if (initialCash <= 0) throw new Error("initialCash must be positive");
    if (minTradeSize <= 0) throw new Error("minTradeSize must be positive");
    if (maxTradeSize <= 0 || maxTradeSize < minTradeSize) {
      throw new Error("maxTradeSize must be >= minTradeSize");
    }
    if (riskTolerance < 0 || riskTolerance >= 1) {
      throw new Error("riskTolerance must be in [0, 1)");
    }

    this.initialCash = initialCash;
    this.minTradeSize = minTradeSize;
    this.maxTradeSize = maxTradeSize;
    this.riskTolerance = riskTolerance;
    this.portfolio = {
      cash: initialCash,
      positions: new Map(),
      trades: [],
    };
  }

  /**
   * Analyze signals from CRE workflow and make trading decisions.
   *
   * FIX: Signal strength is now calculated only from signals that match
   * the direction (BUY signals for buyStrength, SELL for sellStrength).
   * Previously divided by total signal count, which diluted everything.
   */
  analyzeSignals(signals: TradingSignal[]): {
    action: "BUY" | "SELL" | "HOLD";
    asset: string;
    amount: number;
    confidence: number;
    reasoning: string;
  }[] {
    const byAsset = new Map<string, TradingSignal[]>();
    for (const signal of signals) {
      const existing = byAsset.get(signal.asset) || [];
      existing.push(signal);
      byAsset.set(signal.asset, existing);
    }

    const decisions = [];

    for (const [asset, assetSignals] of byAsset) {
      const buySignals = assetSignals.filter((s) => s.signal === "BUY");
      const sellSignals = assetSignals.filter((s) => s.signal === "SELL");
      const reasons: string[] = [];

      // Average strength among matching signals only (not all signals)
      const buyStrength =
        buySignals.length > 0
          ? buySignals.reduce((sum, s) => sum + s.strength, 0) / buySignals.length
          : 0;
      const sellStrength =
        sellSignals.length > 0
          ? sellSignals.reduce((sum, s) => sum + s.strength, 0) / sellSignals.length
          : 0;

      for (const s of [...buySignals, ...sellSignals]) {
        reasons.push(`${s.type}: ${s.reason}`);
      }

      const netStrength = buyStrength - sellStrength;
      // With opposing strategies (momentum vs mean reversion), they rarely agree.
      // 0.2 = trade when one signal is significantly stronger.
      const minConfidence = 0.2;

      if (netStrength > minConfidence) {
        // Position size as fraction of available cash, converted to units at current price
        const fraction = this.calculatePositionSize(buyStrength);
        const currentPrice = assetSignals[0]?.currentPrice || 0;
        const dollarAmount = this.portfolio.cash * fraction;
        const amount = currentPrice > 0 ? dollarAmount / currentPrice : 0;
        decisions.push({
          action: "BUY" as const,
          asset,
          amount,
          confidence: buyStrength,
          reasoning: `Consensus BUY (${(buyStrength * 100).toFixed(1)}%): ${reasons.join("; ")}`,
        });
      } else if (netStrength < -minConfidence) {
        const position = this.portfolio.positions.get(asset);
        const fraction = this.calculatePositionSize(sellStrength);
        const amount = position ? position.amount * fraction : 0;
        decisions.push({
          action: "SELL" as const,
          asset,
          amount,
          confidence: sellStrength,
          reasoning: `Consensus SELL (${(sellStrength * 100).toFixed(1)}%): ${reasons.join("; ")}`,
        });
      } else {
        decisions.push({
          action: "HOLD" as const,
          asset,
          amount: 0,
          confidence: 0,
          reasoning: `Inconclusive (buy: ${(buyStrength * 100).toFixed(1)}%, sell: ${(sellStrength * 100).toFixed(1)}%)`,
        });
      }
    }

    return decisions;
  }

  /**
   * Kelly Criterion-inspired position sizing
   */
  private calculatePositionSize(strength: number): number {
    const baseSize = this.maxTradeSize * strength;
    const adjustedSize = baseSize * (1 - this.riskTolerance);
    return Math.max(this.minTradeSize, Math.min(this.maxTradeSize, adjustedSize));
  }

  /**
   * Execute a trade (simulation)
   */
  executeTrade(
    action: "BUY" | "SELL",
    asset: string,
    amount: number,
    price: number,
    reason: string
  ): boolean {
    if (amount <= 0 || price <= 0) return false;

    const cost = amount * price;

    if (action === "BUY") {
      if (this.portfolio.cash < cost) {
        console.log(`Insufficient cash for BUY ${amount} ${asset}`);
        return false;
      }
      this.portfolio.cash -= cost;
      const position = this.portfolio.positions.get(asset) || { amount: 0, avgPrice: 0 };
      const totalAmount = position.amount + amount;
      position.avgPrice =
        totalAmount > EPSILON
          ? (position.avgPrice * position.amount + price * amount) / totalAmount
          : 0;
      position.amount = totalAmount;
      this.portfolio.positions.set(asset, position);
    } else {
      const position = this.portfolio.positions.get(asset);
      if (!position || position.amount < amount - EPSILON) {
        console.log(`Insufficient ${asset} for SELL`);
        return false;
      }
      this.portfolio.cash += cost;
      position.amount -= amount;
      // Use epsilon comparison instead of === 0 to avoid float dust
      if (position.amount < EPSILON) {
        this.portfolio.positions.delete(asset);
      }
    }

    this.portfolio.trades.push({
      timestamp: Date.now(),
      action,
      asset,
      amount,
      price,
      reason,
    });

    return true;
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary() {
    return {
      cash: this.portfolio.cash,
      positions: Array.from(this.portfolio.positions.entries()).map(
        ([asset, pos]) => ({ asset, amount: pos.amount, avgPrice: pos.avgPrice })
      ),
      totalTrades: this.portfolio.trades.length,
    };
  }

  /**
   * Calculate P&L given current prices
   */
  calculatePnL(currentPrices: Map<string, number>): number {
    let totalValue = this.portfolio.cash;
    for (const [asset, position] of this.portfolio.positions) {
      const price = currentPrices.get(asset) || 0;
      totalValue += position.amount * price;
    }
    return totalValue - this.initialCash;
  }
}

// ============================================================================
// Demo: Simulate agent consuming x402 signals
// ============================================================================

async function demo() {
  console.log("AgentTrade AI - x402 Signal Consumer Demo\n");

  const agent = new AgentTradeAI(10000);

  const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:3000";

  console.log(`Fetching signals from ${GATEWAY_URL}/signals...\n`);

  try {
    const response = await fetch(`${GATEWAY_URL}/signals`, {
      headers: {
        "x-payment": "demo-payment-header",
      },
    });

    if (response.status === 402) {
      console.log("Server requires x402 payment ($0.01 USDC)");
      console.log("In production, x402-fetch handles this automatically.\n");
    }

    if (response.ok) {
      const data = (await response.json()) as {
        prices: Record<string, number>;
        signals: TradingSignal[];
      };
      console.log("Received signals from CRE workflow:");
      console.log(`  Prices: ETH=$${data.prices?.ETH}, BTC=$${data.prices?.BTC}`);
      console.log(`  Signals: ${data.signals?.length} signals\n`);

      if (data.signals) {
        const decisions = agent.analyzeSignals(data.signals);
        for (const decision of decisions) {
          console.log(`\n=== ${decision.asset} ===`);
          console.log(`Action: ${decision.action}`);
          console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
          console.log(`Reasoning: ${decision.reasoning}`);

          if (decision.action !== "HOLD") {
            const price = data.prices[decision.asset];
            agent.executeTrade(decision.action, decision.asset, decision.amount, price, decision.reasoning);
          }
        }
      }

      console.log("\nPortfolio:", JSON.stringify(agent.getPortfolioSummary(), null, 2));
      return;
    }
  } catch {
    console.log("Could not reach gateway server. Running with mock data.\n");
  }

  // Fallback: demo with mock signals
  console.log("Running demo with example signals...\n");

  const mockSignals: TradingSignal[] = [
    { type: "momentum", asset: "ETH", signal: "BUY", strength: 0.7, reason: "Strong upward momentum: +2.3%", currentPrice: 2340.5 },
    { type: "meanReversion", asset: "ETH", signal: "HOLD", strength: 0.2, reason: "Price 0.5% from MA", currentPrice: 2340.5 },
    { type: "momentum", asset: "BTC", signal: "SELL", strength: 0.6, reason: "Downward momentum: -1.8%", currentPrice: 62100.0 },
    { type: "meanReversion", asset: "BTC", signal: "BUY", strength: 0.4, reason: "Price 3.1% below MA - oversold", currentPrice: 62100.0 },
  ];

  const decisions = agent.analyzeSignals(mockSignals);

  for (const decision of decisions) {
    console.log(`\n=== ${decision.asset} ===`);
    console.log(`Action: ${decision.action}`);
    console.log(`Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    console.log(`Reasoning: ${decision.reasoning}`);

    if (decision.action !== "HOLD") {
      const price = mockSignals.find((s) => s.asset === decision.asset)?.currentPrice || 0;
      agent.executeTrade(decision.action, decision.asset, decision.amount, price, decision.reasoning);
    }
  }

  console.log("\nPortfolio:", JSON.stringify(agent.getPortfolioSummary(), null, 2));
}

// Only run demo when executed directly
const isDirectRun =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].includes("agent") || process.argv[1].includes("index"));

if (isDirectRun && !process.argv[1]?.includes("vitest") && !process.argv[1]?.includes("test")) {
  demo().catch(console.error);
}

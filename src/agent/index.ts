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

interface Portfolio {
  cash: number;
  positions: Map<string, { amount: number; avgPrice: number }>;
  trades: Array<{
    timestamp: number;
    action: "BUY" | "SELL";
    asset: string;
    amount: number;
    price: number;
    reason: string;
  }>;
}

// ============================================================================
// AI Trading Agent
// ============================================================================

export class AgentTradeAI {
  private portfolio: Portfolio;
  private initialCash: number;
  private minTradeSize: number;
  private maxTradeSize: number;
  private riskTolerance: number;

  constructor(
    initialCash: number = 10000,
    minTradeSize: number = 0.01,
    maxTradeSize: number = 1.0,
    riskTolerance: number = 0.02
  ) {
    this.initialCash = initialCash;
    this.portfolio = {
      cash: initialCash,
      positions: new Map(),
      trades: [],
    };
    this.minTradeSize = minTradeSize;
    this.maxTradeSize = maxTradeSize;
    this.riskTolerance = riskTolerance;
  }

  /**
   * Analyze signals from CRE workflow and make trading decision
   */
  analyzeSignals(signals: TradingSignal[]): {
    action: "BUY" | "SELL" | "HOLD";
    asset: string;
    amount: number;
    confidence: number;
    reasoning: string;
  }[] {
    // Group signals by asset
    const byAsset = new Map<string, TradingSignal[]>();
    for (const signal of signals) {
      const existing = byAsset.get(signal.asset) || [];
      existing.push(signal);
      byAsset.set(signal.asset, existing);
    }

    const decisions = [];

    for (const [asset, assetSignals] of byAsset) {
      let buyStrength = 0;
      let sellStrength = 0;
      const reasons: string[] = [];

      for (const signal of assetSignals) {
        if (signal.signal === "BUY") {
          buyStrength += signal.strength;
          reasons.push(`${signal.type}: ${signal.reason}`);
        } else if (signal.signal === "SELL") {
          sellStrength += signal.strength;
          reasons.push(`${signal.type}: ${signal.reason}`);
        }
      }

      buyStrength /= assetSignals.length;
      sellStrength /= assetSignals.length;

      const netStrength = buyStrength - sellStrength;
      const minConfidence = 0.3;

      if (netStrength > minConfidence) {
        const amount = this.calculatePositionSize(buyStrength);
        decisions.push({
          action: "BUY" as const,
          asset,
          amount,
          confidence: buyStrength,
          reasoning: `Consensus BUY (${(buyStrength * 100).toFixed(1)}%): ${reasons.join("; ")}`,
        });
      } else if (netStrength < -minConfidence) {
        const amount = this.calculatePositionSize(sellStrength);
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
    const cost = amount * price;

    if (action === "BUY") {
      if (this.portfolio.cash < cost) {
        console.log(`❌ Insufficient cash for BUY ${amount} ${asset}`);
        return false;
      }
      this.portfolio.cash -= cost;
      const position = this.portfolio.positions.get(asset) || { amount: 0, avgPrice: 0 };
      const totalAmount = position.amount + amount;
      position.avgPrice = (position.avgPrice * position.amount + price * amount) / totalAmount;
      position.amount = totalAmount;
      this.portfolio.positions.set(asset, position);
      console.log(`✅ BUY ${amount.toFixed(4)} ${asset} @ $${price.toFixed(2)}`);
    } else {
      const position = this.portfolio.positions.get(asset);
      if (!position || position.amount < amount) {
        console.log(`❌ Insufficient ${asset} for SELL`);
        return false;
      }
      this.portfolio.cash += cost;
      position.amount -= amount;
      if (position.amount === 0) this.portfolio.positions.delete(asset);
      console.log(`✅ SELL ${amount.toFixed(4)} ${asset} @ $${price.toFixed(2)}`);
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
  console.log("═══════════════════════════════════════════════════════");
  console.log("  AgentTrade AI - x402 Signal Consumer Demo");
  console.log("═══════════════════════════════════════════════════════\n");

  const agent = new AgentTradeAI(10000);

  // Simulate fetching signals from x402 gateway
  const GATEWAY_URL = (globalThis as any).process?.env?.GATEWAY_URL || "http://localhost:3000";

  console.log(`Fetching signals from ${GATEWAY_URL}/signals...\n`);

  try {
    const response = await fetch(`${GATEWAY_URL}/signals`, {
      headers: {
        // In production, x402-fetch would auto-add payment header
        "x-payment": "demo-payment-header",
      },
    });

    if (response.status === 402) {
      console.log("💰 Server requires x402 payment ($0.01 USDC)");
      console.log("   In production, x402-fetch handles this automatically.\n");
      // Fall through to demo with mock data
    }

    if (response.ok) {
      const data = await response.json();
      console.log("📊 Received signals from CRE workflow:");
      console.log(`   Prices: ETH=$${data.prices?.ETH}, BTC=$${data.prices?.BTC}`);
      console.log(`   Signals: ${data.signals?.length} signals\n`);

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

      console.log("\n📋 Portfolio:", JSON.stringify(agent.getPortfolioSummary(), null, 2));
      return;
    }
  } catch (e) {
    console.log("⚠️  Could not reach gateway server. Running with mock data.\n");
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

  console.log("\n📋 Portfolio:", JSON.stringify(agent.getPortfolioSummary(), null, 2));
}

// Run demo if executed directly
demo().catch(console.error);

/**
 * Tests for AgentTradeAI class
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgentTradeAI } from "../agent/index.js";

describe("AgentTradeAI", () => {
  let agent: AgentTradeAI;

  beforeEach(() => {
    agent = new AgentTradeAI(10000, 0.01, 1.0, 0.02);
  });

  describe("initialization", () => {
    it("should initialize with correct starting balance", () => {
      const summary = agent.getPortfolioSummary();
      expect(summary.cash).toBe(10000);
      expect(summary.positions).toHaveLength(0);
      expect(summary.totalTrades).toBe(0);
    });

    it("should reject invalid parameters", () => {
      expect(() => new AgentTradeAI(-1)).toThrow("initialCash must be positive");
      expect(() => new AgentTradeAI(100, -1)).toThrow("minTradeSize must be positive");
      expect(() => new AgentTradeAI(100, 0.5, 0.1)).toThrow("maxTradeSize must be >= minTradeSize");
      expect(() => new AgentTradeAI(100, 0.01, 1.0, 1.5)).toThrow("riskTolerance must be in [0, 1)");
    });
  });

  describe("trade execution", () => {
    it("should execute BUY trade when sufficient cash available", () => {
      const success = agent.executeTrade("BUY", "ETH", 1.0, 2000, "Test buy");
      expect(success).toBe(true);

      const summary = agent.getPortfolioSummary();
      expect(summary.cash).toBe(8000);
      expect(summary.positions).toHaveLength(1);
      expect(summary.positions[0].asset).toBe("ETH");
      expect(summary.positions[0].amount).toBe(1.0);
      expect(summary.totalTrades).toBe(1);
    });

    it("should fail BUY trade when insufficient cash", () => {
      const success = agent.executeTrade("BUY", "BTC", 1.0, 50000, "Too expensive");
      expect(success).toBe(false);

      const summary = agent.getPortfolioSummary();
      expect(summary.cash).toBe(10000);
      expect(summary.positions).toHaveLength(0);
      expect(summary.totalTrades).toBe(0);
    });

    it("should execute SELL trade when position exists", () => {
      agent.executeTrade("BUY", "ETH", 2.0, 2000, "Buy first");
      const success = agent.executeTrade("SELL", "ETH", 1.0, 2100, "Take profit");
      expect(success).toBe(true);

      const summary = agent.getPortfolioSummary();
      expect(summary.cash).toBe(8100);
      expect(summary.positions).toHaveLength(1);
      expect(summary.positions[0].amount).toBe(1.0);
      expect(summary.totalTrades).toBe(2);
    });

    it("should fail SELL trade when insufficient position", () => {
      const success = agent.executeTrade("SELL", "ETH", 1.0, 2000, "Nothing to sell");
      expect(success).toBe(false);

      const summary = agent.getPortfolioSummary();
      expect(summary.cash).toBe(10000);
      expect(summary.positions).toHaveLength(0);
    });

    it("should reject zero or negative amount/price", () => {
      expect(agent.executeTrade("BUY", "ETH", 0, 2000, "zero")).toBe(false);
      expect(agent.executeTrade("BUY", "ETH", 1, 0, "zero price")).toBe(false);
      expect(agent.executeTrade("BUY", "ETH", -1, 2000, "negative")).toBe(false);
    });

    it("should remove position cleanly after full sell (float safety)", () => {
      agent.executeTrade("BUY", "ETH", 0.1, 2000, "Small buy");
      agent.executeTrade("SELL", "ETH", 0.1, 2100, "Full sell");

      const summary = agent.getPortfolioSummary();
      expect(summary.positions).toHaveLength(0);
    });

    it("should calculate correct average price on multiple buys", () => {
      agent.executeTrade("BUY", "ETH", 1.0, 2000, "Buy 1");
      agent.executeTrade("BUY", "ETH", 1.0, 3000, "Buy 2");

      const summary = agent.getPortfolioSummary();
      expect(summary.positions[0].amount).toBe(2.0);
      expect(summary.positions[0].avgPrice).toBe(2500); // (2000+3000)/2
    });
  });

  describe("signal analysis", () => {
    it("should detect BUY consensus correctly (no dilution)", () => {
      const signals = [
        {
          type: "momentum",
          asset: "ETH",
          signal: "BUY" as const,
          strength: 0.8,
          reason: "Strong momentum",
          currentPrice: 2000,
        },
        {
          type: "meanReversion",
          asset: "ETH",
          signal: "BUY" as const,
          strength: 0.6,
          reason: "Oversold",
          currentPrice: 2000,
        },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe("BUY");
      expect(decisions[0].asset).toBe("ETH");
      expect(decisions[0].confidence).toBe(0.7); // Average of 0.8 and 0.6
    });

    it("should detect BUY even when mixed with HOLD (no dilution bug)", () => {
      const signals = [
        {
          type: "momentum",
          asset: "ETH",
          signal: "BUY" as const,
          strength: 0.8,
          reason: "Strong momentum",
          currentPrice: 2000,
        },
        {
          type: "meanReversion",
          asset: "ETH",
          signal: "HOLD" as const,
          strength: 0,
          reason: "Near equilibrium",
          currentPrice: 2000,
        },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(1);
      // With the fix: BUY strength = 0.8 (from 1 BUY signal), net = 0.8 > 0.3 = BUY
      // Old buggy code: BUY strength = 0.8/2 = 0.4, net = 0.4 > 0.3 = barely BUY
      expect(decisions[0].action).toBe("BUY");
      expect(decisions[0].confidence).toBe(0.8); // NOT 0.4
    });

    it("should detect SELL consensus", () => {
      const signals = [
        {
          type: "momentum",
          asset: "BTC",
          signal: "SELL" as const,
          strength: 0.9,
          reason: "Downward momentum",
          currentPrice: 50000,
        },
        {
          type: "meanReversion",
          asset: "BTC",
          signal: "SELL" as const,
          strength: 0.7,
          reason: "Overbought",
          currentPrice: 50000,
        },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].action).toBe("SELL");
      expect(decisions[0].asset).toBe("BTC");
      expect(decisions[0].confidence).toBe(0.8);
    });

    it("should recommend HOLD when signals are conflicting", () => {
      const signals = [
        {
          type: "momentum",
          asset: "ETH",
          signal: "BUY" as const,
          strength: 0.5,
          reason: "Weak buy",
          currentPrice: 2000,
        },
        {
          type: "meanReversion",
          asset: "ETH",
          signal: "SELL" as const,
          strength: 0.5,
          reason: "Weak sell",
          currentPrice: 2000,
        },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(1);
      // Net strength = 0.5 - 0.5 = 0, within threshold
      expect(decisions[0].action).toBe("HOLD");
      expect(decisions[0].asset).toBe("ETH");
    });

    it("should BUY when one signal dominates by > 0.2", () => {
      const signals = [
        {
          type: "meanReversion",
          asset: "ETH",
          signal: "BUY" as const,
          strength: 0.9,
          reason: "Deeply oversold",
          currentPrice: 2000,
        },
        {
          type: "momentum",
          asset: "ETH",
          signal: "SELL" as const,
          strength: 0.5,
          reason: "Mild downtrend",
          currentPrice: 2000,
        },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(1);
      // Net = 0.9 - 0.5 = 0.4 > 0.2 threshold → BUY
      expect(decisions[0].action).toBe("BUY");
      expect(decisions[0].confidence).toBe(0.9);
    });

    it("should handle multiple assets independently", () => {
      const signals = [
        { type: "momentum", asset: "ETH", signal: "BUY" as const, strength: 0.9, reason: "Up", currentPrice: 2000 },
        { type: "momentum", asset: "BTC", signal: "SELL" as const, strength: 0.8, reason: "Down", currentPrice: 50000 },
      ];

      const decisions = agent.analyzeSignals(signals);
      expect(decisions).toHaveLength(2);
      const ethDecision = decisions.find((d) => d.asset === "ETH");
      const btcDecision = decisions.find((d) => d.asset === "BTC");
      expect(ethDecision?.action).toBe("BUY");
      expect(btcDecision?.action).toBe("SELL");
    });
  });

  describe("P&L calculation", () => {
    it("should calculate P&L correctly", () => {
      agent.executeTrade("BUY", "ETH", 2.0, 2000, "Initial buy");

      const currentPrices = new Map([["ETH", 2200]]);
      const pnl = agent.calculatePnL(currentPrices);

      // P&L = (2.0 * 2200 + 6000) - 10000 = 400
      expect(pnl).toBe(400);
    });

    it("should return 0 P&L when no trades made", () => {
      const currentPrices = new Map([["ETH", 2200]]);
      const pnl = agent.calculatePnL(currentPrices);
      expect(pnl).toBe(0);
    });

    it("should handle missing prices gracefully", () => {
      agent.executeTrade("BUY", "ETH", 1.0, 2000, "Buy");
      // No price provided for ETH - treats as 0
      const pnl = agent.calculatePnL(new Map());
      expect(pnl).toBe(-2000); // Lost the 2000 spent, position valued at 0
    });
  });
});

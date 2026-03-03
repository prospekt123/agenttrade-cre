/**
 * Tests for workflow signal strategies
 *
 * Uses vi.mock to avoid loading the CRE SDK (which has ESM import issues).
 * The signal functions and aggregation logic are tested directly.
 */

import { describe, it, expect, vi } from "vitest";

// Mock the CRE SDK before importing workflow (SDK has broken ESM directory imports)
vi.mock("@chainlink/cre-sdk", () => ({
  cre: { capabilities: { EVMClient: class {}, CronCapability: class {}, HTTPCapability: class {} }, handler: vi.fn() },
  Runner: { newRunner: vi.fn() },
  getNetwork: vi.fn(),
  encodeCallMsg: vi.fn(),
  bytesToHex: vi.fn(),
  ok: vi.fn(),
  consensusIdenticalAggregation: vi.fn(),
  decodeJson: vi.fn(),
}));

import {
  calculateMomentumSignal,
  calculateMeanReversionSignal,
  aggregateSignals,
  type TradingSignal,
} from "../workflow/index.js";

describe("Workflow Signal Strategies", () => {
  describe("Momentum Strategy", () => {
    it("should detect BUY signal on strong upward momentum", () => {
      const history = [
        { timestamp: 1000, price: 2000 },
        { timestamp: 2000, price: 2020 },
        { timestamp: 3000, price: 2040 },
        { timestamp: 4000, price: 2060 },
        { timestamp: 5000, price: 2080 },
      ];

      const signal = calculateMomentumSignal(history, 2100, "ETH");
      expect(signal.signal).toBe("BUY");
      expect(signal.type).toBe("momentum");
      expect(signal.strength).toBeGreaterThan(0);
      expect(signal.asset).toBe("ETH");
    });

    it("should detect SELL signal on strong downward momentum", () => {
      const history = [
        { timestamp: 1000, price: 2100 },
        { timestamp: 2000, price: 2080 },
        { timestamp: 3000, price: 2060 },
        { timestamp: 4000, price: 2040 },
        { timestamp: 5000, price: 2020 },
      ];

      const signal = calculateMomentumSignal(history, 2000, "ETH");
      expect(signal.signal).toBe("SELL");
      expect(signal.type).toBe("momentum");
      expect(signal.strength).toBeGreaterThan(0);
    });

    it("should return HOLD when momentum is weak", () => {
      const history = [
        { timestamp: 1000, price: 2000 },
        { timestamp: 2000, price: 2005 },
      ];

      const signal = calculateMomentumSignal(history, 2010, "ETH");
      expect(signal.signal).toBe("HOLD");
      expect(signal.strength).toBe(0);
    });

    it("should return HOLD when insufficient history", () => {
      const history = [{ timestamp: 1000, price: 2000 }];

      const signal = calculateMomentumSignal(history, 2100, "ETH");
      expect(signal.signal).toBe("HOLD");
      expect(signal.reason).toContain("Insufficient");
    });

    it("should cap strength at 1.0", () => {
      const history = [
        { timestamp: 1000, price: 1000 },
        { timestamp: 2000, price: 1010 },
      ];
      const signal = calculateMomentumSignal(history, 1500, "ETH");
      expect(signal.signal).toBe("BUY");
      expect(signal.strength).toBeLessThanOrEqual(1);
    });
  });

  describe("Mean Reversion Strategy", () => {
    it("should detect BUY signal when price is below moving average", () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        price: 2100 - i,
      })).reverse();

      const signal = calculateMeanReversionSignal(history, 2000, "ETH");
      expect(signal.signal).toBe("BUY");
      expect(signal.type).toBe("meanReversion");
      expect(signal.reason).toContain("oversold");
    });

    it("should detect SELL signal when price is above moving average", () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        price: 2000 + i,
      })).reverse();

      const signal = calculateMeanReversionSignal(history, 2200, "ETH");
      expect(signal.signal).toBe("SELL");
      expect(signal.type).toBe("meanReversion");
      expect(signal.reason).toContain("overbought");
    });

    it("should return HOLD when price is near moving average", () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i * 1000,
        price: 2000,
      }));

      const signal = calculateMeanReversionSignal(history, 2005, "ETH");
      expect(signal.signal).toBe("HOLD");
      expect(signal.reason).toContain("equilibrium");
    });

    it("should return HOLD when insufficient history", () => {
      const history = [{ timestamp: 1000, price: 2000 }];

      const signal = calculateMeanReversionSignal(history, 2100, "BTC");
      expect(signal.signal).toBe("HOLD");
      expect(signal.reason).toContain("Insufficient");
    });

    it("should cap strength at 1.0", () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        timestamp: i * 1000,
        price: 2000,
      }));
      const signal = calculateMeanReversionSignal(history, 1800, "ETH");
      expect(signal.signal).toBe("BUY");
      expect(signal.strength).toBeLessThanOrEqual(1);
    });
  });

  describe("Signal Aggregation", () => {
    it("should correctly aggregate BUY signals without dilution", () => {
      const signals: TradingSignal[] = [
        { type: "momentum", asset: "ETH", signal: "BUY", strength: 0.8, reason: "Up", currentPrice: 2000 },
        { type: "meanReversion", asset: "ETH", signal: "HOLD", strength: 0, reason: "Flat", currentPrice: 2000 },
      ];

      const agg = aggregateSignals(signals);
      // BUY strength = 0.8 (from 1 BUY signal), not diluted by HOLD
      expect(agg.ETH.buyStrength).toBe(0.8);
      expect(agg.ETH.sellStrength).toBe(0);
      // Net strength = 0.8 - 0 = 0.8 > 0.3 threshold
      expect(agg.ETH.recommendation).toBe("BUY");
    });

    it("should correctly aggregate SELL signals without dilution", () => {
      const signals: TradingSignal[] = [
        { type: "momentum", asset: "BTC", signal: "SELL", strength: 0.7, reason: "Down", currentPrice: 50000 },
        { type: "meanReversion", asset: "BTC", signal: "HOLD", strength: 0, reason: "OK", currentPrice: 50000 },
      ];

      const agg = aggregateSignals(signals);
      expect(agg.BTC.sellStrength).toBe(0.7);
      // Net strength = 0 - 0.7 = -0.7 < -0.3 threshold
      expect(agg.BTC.recommendation).toBe("SELL");
    });

    it("should HOLD when conflicting signals cancel out", () => {
      const signals: TradingSignal[] = [
        { type: "momentum", asset: "ETH", signal: "BUY", strength: 0.5, reason: "Up", currentPrice: 2000 },
        { type: "meanReversion", asset: "ETH", signal: "SELL", strength: 0.5, reason: "Over", currentPrice: 2000 },
      ];

      const agg = aggregateSignals(signals);
      // Net = 0.5 - 0.5 = 0, well within threshold
      expect(agg.ETH.recommendation).toBe("HOLD");
    });

    it("should BUY when one direction dominates by > 0.2 threshold", () => {
      const signals: TradingSignal[] = [
        { type: "meanReversion", asset: "ETH", signal: "BUY", strength: 0.9, reason: "Oversold", currentPrice: 2000 },
        { type: "momentum", asset: "ETH", signal: "SELL", strength: 0.5, reason: "Down", currentPrice: 2000 },
      ];

      const agg = aggregateSignals(signals);
      // Net = 0.9 - 0.5 = 0.4 > 0.2 threshold
      expect(agg.ETH.recommendation).toBe("BUY");
    });

    it("should handle multiple assets independently", () => {
      const signals: TradingSignal[] = [
        { type: "momentum", asset: "ETH", signal: "BUY", strength: 0.9, reason: "Up", currentPrice: 2000 },
        { type: "momentum", asset: "BTC", signal: "SELL", strength: 0.8, reason: "Down", currentPrice: 50000 },
      ];

      const agg = aggregateSignals(signals);
      expect(agg.ETH.recommendation).toBe("BUY");
      expect(agg.BTC.recommendation).toBe("SELL");
    });

    it("should return 0 strength when no signals match direction", () => {
      const signals: TradingSignal[] = [
        { type: "momentum", asset: "ETH", signal: "HOLD", strength: 0, reason: "Flat", currentPrice: 2000 },
        { type: "meanReversion", asset: "ETH", signal: "HOLD", strength: 0, reason: "OK", currentPrice: 2000 },
      ];

      const agg = aggregateSignals(signals);
      expect(agg.ETH.buyStrength).toBe(0);
      expect(agg.ETH.sellStrength).toBe(0);
      expect(agg.ETH.recommendation).toBe("HOLD");
    });
  });

  describe("Signal Integration", () => {
    it("should produce complementary signals that agents can aggregate", () => {
      const history = [
        { timestamp: 1000, price: 2200 },
        { timestamp: 2000, price: 2180 },
        { timestamp: 3000, price: 2150 },
        { timestamp: 4000, price: 2120 },
        { timestamp: 5000, price: 2100 },
      ];

      const momentumSignal = calculateMomentumSignal(history, 2000, "ETH");
      const meanRevSignal = calculateMeanReversionSignal(history, 2000, "ETH");

      expect(momentumSignal.signal).toBe("SELL");
      expect(meanRevSignal.signal).toBe("BUY");
      expect(momentumSignal.type).toBe("momentum");
      expect(meanRevSignal.type).toBe("meanReversion");
    });
  });
});

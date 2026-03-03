# Contributing to AgentTrade

Thank you for your interest in contributing to AgentTrade!

## Development Setup

1. Fork the repository
2. Clone your fork
3. Follow the setup instructions in `SETUP.md`
4. Create a feature branch: `git checkout -b feature/your-feature`

## Code Style

This project uses:
- **Biome** for formatting and linting (when available)
- **TypeScript** for type safety
- **ESM** modules (`.js` extensions in imports)

### Style Guidelines

- Use descriptive variable names
- Add comments for complex logic
- Export interfaces for reusable types
- Keep functions focused and small
- Use async/await over promises

## Testing

Before submitting:

```bash
# Type check
bun run typecheck

# Build workflow
bun run build

# Simulate
bun run simulate

# Test agent
bun run agent
```

All commands should complete without errors.

## Submitting Changes

1. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add new trading strategy"
   ```

2. **Push to your fork**:
   ```bash
   git push origin feature/your-feature
   ```

3. **Open a Pull Request** with:
   - Clear description of changes
   - Why the change is needed
   - How to test it
   - Screenshots/output if applicable

## Ideas for Contributions

### New Trading Strategies

Add new signal detection algorithms in `src/signals/`:
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Bollinger Bands
- Volume-weighted signals
- Machine learning models

### Enhanced AI Agent

Improve `src/agent/index.ts` with:
- LLM integration (GPT-4, Claude)
- Sentiment analysis from news
- Multi-asset portfolio optimization
- Risk-adjusted position sizing
- Stop-loss and take-profit logic

### More Data Sources

Integrate additional Chainlink products:
- More Data Feeds (BTC, LINK, etc.)
- Proof of Reserve
- VRF for randomized strategies
- Functions for off-chain computation

### Cross-Chain Features

- CCIP integration for cross-chain swaps
- Multi-chain portfolio balancing
- Arbitrage detection across chains

### DEX Integration

- Uniswap trade execution
- 1inch aggregator integration
- Slippage protection
- Gas optimization

### x402 Payments

- Agent-to-agent micropayments
- Pay-per-signal pricing
- Subscription models for premium signals

## Documentation

When adding features:
- Update `README.md` if it affects usage
- Document new configuration in `src/config.ts`
- Add examples to help users understand
- Update `docs/architecture.md` for architectural changes

## Code of Conduct

- Be respectful and professional
- Help others learn and grow
- Focus on constructive feedback
- Collaborate openly

## Questions?

Open an issue or reach out on the Chainlink Discord.

---

Happy coding! 🚀

# Quick Start Guide

Get AgentTrade running in 5 minutes.

## 1. Install Prerequisites

```bash
# Bun (package manager)
curl -fsSL https://bun.sh/install | bash

# CRE CLI (Chainlink Runtime Environment)
# Visit: https://docs.chain.link/cre/getting-started/cli-installation
```

## 2. Setup Project

```bash
cd chainlink-project

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your CRE credentials from cre.chain.link
```

## 3. Build & Run

```bash
# Build the workflow
bun run build

# Simulate with real Sepolia data
bun run simulate
```

**Expected output:**
```
Current ETH/USD price: $2,340.50

=== TRADING SIGNALS ===
MOMENTUM: BUY
  Strength: 65.0%
  Reason: Strong upward momentum: +2.3%
```

## 4. Test AI Agent

```bash
# Run standalone agent
bun run agent
```

**Expected output:**
```
=== AI AGENT DECISION ===
Action: BUY
Amount: 0.65
Confidence: 65.0%
✅ BUY 0.65 ETH @ $2340.50
```

## 5. (Optional) Deploy

**Requires Early Access approval from cre.chain.link/request-access**

```bash
# Deploy to Chainlink DON
bun run deploy
```

## That's it! 🚀

**Next steps:**
- Read [`README.md`](./README.md) for full documentation
- See [`SETUP.md`](./SETUP.md) for detailed setup
- Check [`docs/architecture.md`](./docs/architecture.md) for technical details
- Follow [`docs/demo-script.md`](./docs/demo-script.md) to record your demo

## Troubleshooting

**Build fails?**
- Check CRE CLI is installed: `cre --version`
- Verify `.env` has correct credentials

**Simulation fails?**
- Ensure workflow is built first: `bun run build`
- Check Sepolia RPC is accessible

**Need help?**
- Full setup guide: [`SETUP.md`](./SETUP.md)
- Chainlink docs: https://docs.chain.link/cre
- Hackathon Discord: Chainlink Convergence server

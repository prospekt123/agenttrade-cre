# AgentTrade Setup Guide

Complete setup instructions for the AgentTrade hackathon project.

## Prerequisites

### 1. Install Bun

Bun is required as the package manager and TypeScript runtime.

**macOS/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (WSL recommended):**
```bash
# Install WSL first, then:
curl -fsSL https://bun.sh/install | bash
```

Verify installation:
```bash
bun --version
```

### 2. Install CRE CLI

The Chainlink Runtime Environment CLI is required to build and simulate workflows.

**Visit the official installation guide:**
https://docs.chain.link/cre/getting-started/cli-installation

**Platform-specific instructions:**

- **macOS**: Download binary or use Homebrew (if available)
- **Linux**: Download binary for your architecture
- **Windows**: Use WSL and follow Linux instructions

Verify installation:
```bash
cre --version
```

### 3. Create CRE Account

1. Visit [cre.chain.link](https://cre.chain.link)
2. Sign up with your email
3. Complete verification
4. Save your account credentials

### 4. Request Early Access (Optional)

For DON deployment (not required for simulation):

1. Visit [cre.chain.link/request-access](https://cre.chain.link/request-access)
2. Describe your project (AgentTrade hackathon submission)
3. Wait for approval email

**Note**: You can complete the hackathon using simulation only. Deployment is optional.

## Project Setup

### 1. Clone/Copy Project

```bash
cd /path/to/your/workspace
# Project is at: /home/moltbot/clawd/chainlink-project
```

### 2. Install Dependencies

```bash
cd chainlink-project
bun install
```

This installs:
- `@chainlink/cre-sdk` - CRE TypeScript SDK
- `viem` - Ethereum library
- `dotenv` - Environment configuration
- `axios` - HTTP client
- TypeScript and type definitions

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Required for CRE CLI
CRE_ACCOUNT_EMAIL=your-email@example.com
CRE_API_KEY=your-cre-api-key

# Optional: For testnet deployment testing
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
PRIVATE_KEY=your-wallet-private-key

# Optional: For AI enhancements
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

**Getting RPC URL (Optional):**
1. Create free account at [alchemy.com](https://www.alchemy.com)
2. Create Sepolia app
3. Copy HTTP URL

**Getting Private Key (Optional):**
1. Use MetaMask or any Ethereum wallet
2. Export private key
3. **NEVER commit this to git**

### 4. Verify Setup

```bash
# Check TypeScript compilation
bun run typecheck

# Should show no errors
```

## Building the Workflow

### 1. Build WASM Binary

```bash
bun run build
```

**What this does:**
- Compiles `src/workflow/index.ts` to WebAssembly
- Uses CRE CLI under the hood
- Outputs to `dist/workflow.wasm`

**Expected output:**
```
🔨 Building CRE Workflow...

[CRE CLI output...]

✅ Build successful!
📦 Workflow compiled to: dist/workflow.wasm

Next steps:
  - Simulate: bun run simulate
  - Deploy: bun run deploy
```

**Troubleshooting:**

- **"cre: command not found"**: Install CRE CLI (see prerequisites)
- **Authentication error**: Check `.env` credentials
- **Build error**: Check TypeScript syntax in workflow files

### 2. Simulate Workflow

```bash
bun run simulate
```

**What this does:**
- Runs workflow locally using CRE CLI
- Makes **real calls** to Sepolia testnet
- Fetches live ETH/USD price from Chainlink Data Feed
- Generates trading signals
- Shows console output

**Expected output:**
```
🚀 Starting CRE Workflow Simulation...

[2026-02-20T12:00:00Z] Price check triggered
Current ETH/USD price: $2,340.50

=== TRADING SIGNALS ===
MOMENTUM: BUY
  Strength: 65.0%
  Reason: Strong upward momentum: +2.3%

MEANREVERSION: HOLD
  Strength: 15.0%
  Reason: Price 0.5% from MA - near equilibrium
======================

✅ Simulation completed successfully
```

**Troubleshooting:**

- **"Workflow binary not found"**: Run `bun run build` first
- **RPC errors**: Check Sepolia RPC endpoint is working
- **Authentication errors**: Verify CRE credentials in `.env`

### 3. Run AI Agent

```bash
bun run agent
```

**What this does:**
- Runs the AI agent in standalone mode
- Uses example signals to demonstrate decision logic
- Shows trading decisions and portfolio updates

**Expected output:**
```
=== AI AGENT DECISION ===
Action: BUY
Amount: 0.65
Confidence: 65.0%
Reasoning:
Consensus BUY signal (65.0% confidence)
momentum: Strong upward momentum: +2.3%
meanReversion: Price 0.5% from MA - near equilibrium
========================

✅ BUY 0.65 ETH @ $2340.50

Portfolio Summary: {
  cash: 8478.68,
  positions: [ { asset: 'ETH', amount: 0.65, avgPrice: 2340.5 } ],
  totalTrades: 1
}
```

## Deployment (Optional)

**⚠️ Requires Early Access approval**

### 1. Get Early Access

1. Complete form at [cre.chain.link/request-access](https://cre.chain.link/request-access)
2. Wait for approval (can take 1-2 days)
3. Receive deployment credentials

### 2. Deploy to DON

```bash
bun run deploy
```

**What this does:**
- Uploads workflow WASM to Chainlink DON
- Registers workflow with name "agenttrade-ai-trading"
- Activates workflow to run on schedule

**Expected output:**
```
🚀 Deploying AgentTrade CRE Workflow...

Workflow binary: dist/workflow.wasm

Deploying to Chainlink DON...

[CRE CLI deployment output...]

✅ Deployment successful!

Next steps:
  1. Monitor your workflow at https://cre.chain.link
  2. Run the AI agent: bun run agent
  3. Check logs for trading signals
```

### 3. Monitor Deployment

1. Visit [cre.chain.link](https://cre.chain.link)
2. Sign in with your account
3. Navigate to "Workflows"
4. Find "agenttrade-ai-trading"
5. View logs and execution history

## Development Workflow

### Making Changes

1. **Edit source files** in `src/`
2. **Rebuild**: `bun run build`
3. **Test**: `bun run simulate`
4. **Repeat** until satisfied

### Testing Strategies

```bash
# Quick iteration with signal logic
bun src/signals/momentum.ts

# Test agent standalone
bun run agent

# Full workflow simulation
bun run simulate
```

### Code Structure

```
src/
├── config.ts              # Configuration
├── workflow/
│   ├── index.ts          # Main workflow (EDIT THIS for workflow logic)
│   └── build.ts          # Build script (don't modify)
├── agent/
│   └── index.ts          # AI agent (EDIT THIS for decision logic)
└── signals/
    ├── momentum.ts       # Momentum strategy (ADD MORE STRATEGIES HERE)
    └── meanReversion.ts  # Mean reversion strategy
```

## Customization

### Add New Trading Strategy

1. Create `src/signals/yourStrategy.ts`:

```typescript
export interface YourSignal {
  signal: "BUY" | "SELL" | "HOLD";
  strength: number;
  reason: string;
}

export function calculateYourSignal(
  priceHistory: any[],
  currentPrice: number
): YourSignal {
  // Your logic here
  return {
    signal: "HOLD",
    strength: 0,
    reason: "Your reasoning",
  };
}
```

2. Import in `src/workflow/index.ts`:

```typescript
import { calculateYourSignal } from "../signals/yourStrategy.js";
```

3. Call in workflow callback:

```typescript
const yourSignal = calculateYourSignal(priceHistory, price);
signals.push({ type: "yourStrategy", ...yourSignal });
```

4. Rebuild and test:

```bash
bun run build && bun run simulate
```

### Change Execution Frequency

Edit `src/config.ts`:

```typescript
checkInterval: "0 */1 * * * *", // Every 1 minute
// or
checkInterval: "0 0 * * * *",   // Every hour
// or
checkInterval: "0 0 0 * * *",   // Daily at midnight
```

**Cron format**: `second minute hour day month dayOfWeek`

### Add More Assets

1. Add Data Feed to `src/config.ts`:

```typescript
btcUsdFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
```

2. Fetch price in workflow:

```typescript
const btcPriceData = await evmClient.readContract({
  address: config.btcUsdFeed as `0x${string}`,
  abi: [...],
  functionName: "latestRoundData",
});
```

3. Generate signals for BTC
4. Update agent to handle multiple assets

## Hackathon Submission

### Required Files

- [x] `README.md` - Project overview
- [x] `SETUP.md` - This file
- [x] `docs/architecture.md` - Technical architecture
- [x] `docs/demo-script.md` - Video demo script
- [x] All source code in `src/`
- [x] `package.json` with dependencies
- [x] `.env.example` (no secrets)

### Submission Checklist

- [ ] Code builds without errors
- [ ] Simulation runs successfully
- [ ] All Chainlink integrations documented
- [ ] Video demo recorded (3-5 min)
- [ ] GitHub repo is public
- [ ] README links all files using Chainlink
- [ ] All code written during Feb 6 - Mar 1, 2026

### Recording Demo Video

Follow [`docs/demo-script.md`](./docs/demo-script.md) for complete script.

**Quick steps:**

1. **Test everything**:
   ```bash
   bun run build && bun run simulate
   ```

2. **Record screen** showing:
   - Architecture explanation
   - Code walkthrough
   - Live simulation with real data
   - AI agent making decisions

3. **Upload to YouTube** (public or unlisted)

4. **Include link** in hackathon submission

## Troubleshooting

### Common Issues

**Build fails:**
- Check CRE CLI is installed: `cre --version`
- Verify credentials in `.env`
- Check TypeScript syntax: `bun run typecheck`

**Simulation fails:**
- Ensure workflow is built: `bun run build`
- Check Sepolia RPC is accessible
- Verify Data Feed addresses are correct

**No price data:**
- Sepolia testnet may be slow, retry
- Check Data Feed contract address
- Verify chain ID is correct

**Import errors:**
- Use `.js` extensions in imports (not `.ts`)
- Check `package.json` has `"type": "module"`
- Verify all dependencies installed

### Getting Help

1. **Chainlink Documentation**: https://docs.chain.link/cre
2. **Hackathon Discord**: Join Chainlink Convergence server
3. **Office Hours**: Feb 17-27 (check schedule)
4. **GitHub Issues**: Open issue in your repo

## Next Steps

1. ✅ Complete setup
2. ✅ Build and simulate workflow
3. ✅ Test AI agent
4. 🎯 Customize strategies
5. 🎯 Record demo video
6. 🎯 Submit to hackathon

---

**Good luck with the hackathon!** 🚀

If you run into issues, check the documentation or reach out to the Chainlink community.

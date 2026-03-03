# AgentTrade - AI Agents Consuming CRE Trading Signals via x402 Payments

> **Submission for Chainlink Convergence Hackathon 2026 - CRE & AI Track**

AgentTrade demonstrates how **AI trading agents can consume Chainlink CRE workflows via x402 micropayments**. The system uses CRE to orchestrate real-time price analysis from Chainlink Data Feeds, generates AI-powered trading signals, and exposes them through an x402-gated API that any AI agent can pay to access.

## The Problem

AI agents need reliable, tamper-proof market data to make trading decisions. Today, agents either:
- Use centralized APIs with no verifiability guarantees
- Build custom oracle integrations, duplicating effort
- Have no standard way to pay for premium data services

There's no decentralized, pay-per-use infrastructure for AI agents to access verified market intelligence.

## The Solution

AgentTrade creates a **CRE workflow that reads Chainlink Data Feeds**, runs multi-strategy signal analysis, and serves the results through an **x402-gated API**. AI agents pay $0.01 USDC per request to access verified trading signals - no accounts, no API keys, just programmatic payments.

```
┌─────────────────────────────────────────────────────────┐
│                    CRE Workflow (DON)                     │
│                                                           │
│  ┌────────────┐    ┌──────────────┐   ┌──────────────┐  │
│  │ Cron       │───>│ EVM Client   │──>│ Signal       │  │
│  │ Trigger    │    │ callContract │   │ Analysis     │  │
│  │ (5 min)    │    │ (Data Feeds) │   │ (AI Logic)   │  │
│  └────────────┘    └──────────────┘   └──────────────┘  │
│                                              │           │
│  ┌────────────┐                              │           │
│  │ HTTP       │<─── x402 Payment ────────────┘           │
│  │ Trigger    │     (Agent Request)                      │
│  └────────────┘                                          │
└──────────────────────────────┬────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  x402 Gateway       │
                    │  POST /signals      │
                    │  $0.01 USDC/request │
                    └─────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  AI Trading Agent   │
                    │  - Analyze signals  │
                    │  - Position sizing  │
                    │  - Risk management  │
                    │  - Execute trades   │
                    └─────────────────────┘
```

## How CRE Is Used

CRE is the **core orchestration layer** that makes this system work:

1. **Cron Trigger** (`src/workflow/index.ts` [L424](src/workflow/index.ts)): Schedules price checks every 5 minutes across the DON
2. **EVM Client + callContract** (`src/workflow/index.ts` [L237-265](src/workflow/index.ts)): Reads ETH/USD and BTC/USD prices directly from Chainlink Data Feeds on Sepolia using `evmClient.callContract()` with ABI-encoded `latestRoundData()` calls
3. **HTTP Trigger** (`src/workflow/index.ts` [L349-415](src/workflow/index.ts)): Allows AI agents to request on-demand signals, enabling the x402 payment integration
4. **Signal Generation**: The workflow runs momentum and mean reversion strategies on verified price data and returns structured trading signals

Without CRE, each AI agent would need its own oracle integration, its own scheduler, and its own price verification. CRE provides the decentralized execution environment that makes the signals trustworthy.

## x402 Integration

The x402 protocol enables **AI agents to programmatically pay for CRE workflow outputs**:

1. Agent requests signals from `/signals` endpoint
2. Server returns `402 Payment Required` with USDC payment details
3. Agent's x402-enabled client auto-pays $0.01 USDC
4. Server validates payment and returns CRE-generated trading signals
5. Agent uses signals for trading decisions

See: `server/src/server.ts` for the x402 gateway implementation.

## Quick Start

### Prerequisites

- **Node.js** v18+
- **CRE CLI** - [Installation Guide](https://docs.chain.link/cre/getting-started/cli-installation)

### Installation

```bash
git clone https://github.com/decentrathai/chainlink-agenttrade.git
cd chainlink-agenttrade
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Simulate CRE Workflow

```bash
# Runs workflow locally, makes real calls to Sepolia Chainlink Data Feeds
npm run simulate
```

### Run AI Agent Demo

```bash
# Runs the AI trading agent (uses mock data if gateway not running)
npm run agent
```

### Start x402 Gateway

```bash
# Starts the x402-gated signal API
npm run server
# Then in another terminal:
npm run agent  # Agent will pay for and consume signals
```

## Project Structure

```
├── src/
│   ├── workflow/
│   │   └── index.ts          # CRE workflow: Chainlink Data Feed reads + signal generation
│   └── agent/
│       └── index.ts          # AI trading agent: signal analysis + portfolio management
├── server/
│   └── src/
│       └── server.ts         # x402 gateway: micropayment-gated signal API
├── scripts/
│   ├── simulate.js           # CRE CLI simulation runner
│   └── deploy.js             # CRE deployment script
├── config.staging.json       # CRE workflow config (chain, data feed addresses)
├── .env.example              # Environment variable template
└── package.json
```

## Chainlink Integration

### CRE Workflow (`src/workflow/index.ts`)

| Component | Usage | Lines |
|-----------|-------|-------|
| `CronCapability` | Scheduled price checks every 5 min | L424 |
| `HTTPCapability` | On-demand signal requests from agents | L425-435 |
| `EVMClient.callContract()` | Read Chainlink Data Feeds on Sepolia | L237-265 |
| `encodeCallMsg` / `bytesToHex` | ABI encoding for `latestRoundData()` | L247-254 |
| `Runner` / `cre.handler` | Workflow orchestration | L438-440 |
| Signal Analysis (exported) | Momentum + Mean Reversion strategies | L74-225 |
| `aggregateSignals` | Correct per-direction signal aggregation | L191-225 |

### Chainlink Data Feeds (Sepolia)

| Feed | Address | File |
|------|---------|------|
| ETH/USD | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | `config.staging.json` |
| BTC/USD | `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43` | `config.staging.json` |

## Trading Strategies

1. **Momentum Detection** - Identifies significant price acceleration/deceleration over lookback periods
2. **Mean Reversion** - Detects overbought/oversold conditions via moving average deviation

The AI agent aggregates signals using confidence-weighted consensus and sizes positions via Kelly Criterion-inspired risk management.

## Demo Video

See [`docs/demo-script.md`](docs/demo-script.md) for the video demo script.

## License

MIT License - Built for Chainlink Convergence Hackathon 2026

---

**Track**: CRE & AI  
**Built with**: Chainlink CRE, Chainlink Data Feeds, x402, TypeScript  
**Chain**: Ethereum Sepolia (Testnet)

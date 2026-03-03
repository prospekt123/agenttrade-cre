# AgentTrade Demo Video Script (3-5 minutes)

## Intro (30s)
- "AgentTrade lets AI agents pay for verified trading signals using Chainlink CRE and x402"
- Show architecture diagram from README
- "The problem: AI agents need trustworthy market data but have no standard pay-per-use infrastructure"

## CRE Workflow (90s)
- Show `src/workflow/index.ts` - highlight CRE SDK imports
- Walk through: Cron trigger -> EVMClient.callContract() -> Chainlink Data Feed read
- Show `config.staging.json` with Sepolia data feed addresses
- Run `npm run simulate` - show real price data coming from Chainlink feeds
- Point out: "This runs across Chainlink's DON - decentralized, verified execution"

## x402 Integration (60s)
- Show `server/src/server.ts` - x402 gateway
- Explain: "Any AI agent can request signals - they just need to pay $0.01 USDC"
- Start server: `npm run server`
- Show 402 Payment Required response
- Show how x402-enabled client auto-pays and receives signals

## AI Agent (60s)
- Show `src/agent/index.ts` - the AI trading agent
- Run `npm run agent`
- Show: agent fetches signals, analyzes with momentum + mean reversion, makes BUY/SELL/HOLD decisions
- Show portfolio management and risk controls

## Wrap-up (30s)
- "CRE provides the decentralized execution layer - verified prices, scheduled workflows, HTTP triggers"
- "x402 enables the pay-per-use model - agents pay with USDC, no accounts needed"
- "Together: a complete infrastructure for AI agents to consume verifiable market intelligence"

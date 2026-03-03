# AgentTrade Architecture

## System Overview

AgentTrade is a **decentralized AI trading system** built on Chainlink Runtime Environment (CRE). It demonstrates how AI agents can consume blockchain data through CRE workflows to make autonomous trading decisions.

## Core Components

### 1. CRE Workflow Layer

**Purpose**: Orchestrate data fetching and signal generation in a decentralized, consensus-driven manner.

**Components**:

- **Trigger**: Cron-based (executes every 5 minutes)
- **Callback**: `onPriceCheck` function that:
  1. Fetches price data from Chainlink Data Feeds
  2. Maintains price history
  3. Generates trading signals
  4. Returns results to agent

**Key Code**: `src/workflow/index.ts`

```typescript
cre.handler(
  cron.trigger({ schedule: "0 */5 * * * *" }),
  onPriceCheck
);
```

**Consensus**: Every operation (price fetch, signal calculation) is executed across multiple DON nodes with BFT consensus, ensuring tamper-proof results.

### 2. Data Feed Integration

**Purpose**: Provide reliable, decentralized price data.

**Implementation**:

```typescript
const evmClient = new cre.capabilities.EVMClient(
  runtime,
  config.sepoliaChainId
);

const priceData = await evmClient.readContract({
  address: config.ethUsdFeed,
  abi: AGGREGATOR_V3_ABI,
  functionName: "latestRoundData",
});
```

**Data Feeds Used**:
- ETH/USD: `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- BTC/USD: `0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43`

**Network**: Ethereum Sepolia (testnet)

### 3. Signal Generation Layer

**Purpose**: Analyze price data to generate actionable trading signals.

**Strategies Implemented**:

#### A. Momentum Strategy (`src/signals/momentum.ts`)

Detects trending markets by measuring rate of price change.

**Logic**:
- Calculate price change over last 5-6 periods
- If change > threshold (1.5%): **BUY signal**
- If change < -threshold (-1.5%): **SELL signal**
- Otherwise: **HOLD**

**Formula**:
```
priceChange = (currentPrice - price_5_periods_ago) / price_5_periods_ago
```

**Use Case**: Catches strong trending moves early

#### B. Mean Reversion Strategy (`src/signals/meanReversion.ts`)

Identifies overbought/oversold conditions relative to moving average.

**Logic**:
- Calculate 20-period Simple Moving Average (SMA)
- Measure deviation from MA
- If price < MA - threshold: **BUY signal** (oversold)
- If price > MA + threshold: **SELL signal** (overbought)
- Otherwise: **HOLD**

**Formula**:
```
deviation = (currentPrice - MA_20) / MA_20
```

**Use Case**: Exploits mean-reverting behavior in range-bound markets

### 4. AI Agent Decision Layer

**Purpose**: Aggregate signals, manage risk, and execute trades.

**Class**: `AgentTradeAI` (`src/agent/index.ts`)

**Decision Process**:

1. **Signal Aggregation**
   ```typescript
   // Weight each signal by strength
   buyStrength = sum(signal.strength for signal in BUY signals) / total_signals
   sellStrength = sum(signal.strength for signal in SELL signals) / total_signals
   ```

2. **Confidence Calculation**
   ```typescript
   netStrength = buyStrength - sellStrength
   confidence = |netStrength|
   ```

3. **Decision Threshold**
   - Require minimum 30% confidence
   - If netStrength > 0.3: **BUY**
   - If netStrength < -0.3: **SELL**
   - Otherwise: **HOLD**

4. **Position Sizing**
   - Based on Kelly Criterion principles
   - Scaled by signal strength and risk tolerance
   - Bounded by min/max trade sizes

**Risk Management**:
- Portfolio tracking (cash + positions)
- P&L calculation
- Trade history logging

## Data Flow

```
1. TRIGGER (every 5 min)
   │
   ▼
2. CRE Workflow DON
   ├─> Multiple nodes execute independently
   └─> BFT consensus on results
   │
   ▼
3. FETCH PRICE DATA
   ├─> Read Chainlink Data Feed
   ├─> Parse price (8 decimals)
   └─> Update price history
   │
   ▼
4. GENERATE SIGNALS
   ├─> Momentum strategy
   ├─> Mean reversion strategy
   └─> Combine signals
   │
   ▼
5. AI AGENT DECISION
   ├─> Aggregate signal strengths
   ├─> Calculate confidence
   ├─> Determine action (BUY/SELL/HOLD)
   └─> Size position
   │
   ▼
6. EXECUTE TRADE (simulation)
   ├─> Update portfolio
   ├─> Record trade
   └─> Log results
```

## Consensus & Security

### CRE Consensus Computing

Every operation in the workflow benefits from decentralized consensus:

1. **Price Fetching**
   - Multiple DON nodes read from Chainlink Data Feed
   - Results aggregated via BFT consensus
   - Single verified price emerges

2. **Signal Calculation**
   - Each node calculates signals independently
   - Results compared and validated
   - Consensus ensures correct signal output

3. **Security Guarantees**
   - No single point of failure
   - Byzantine Fault Tolerant (BFT)
   - Same security as blockchain transactions

## Configuration

All parameters configurable via `src/config.ts`:

```typescript
{
  // Data feeds
  ethUsdFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  
  // Trading parameters
  minTradeSize: 0.01,
  maxTradeSize: 1.0,
  riskTolerance: 0.02,
  
  // Signal parameters
  maShortPeriod: 5,
  maLongPeriod: 20,
  momentumThreshold: 0.015,
  
  // Workflow
  checkInterval: "0 */5 * * * *",
  sepoliaChainId: 5009297550715157269n,
}
```

## Deployment Options

### 1. Local Simulation

```bash
bun run build && bun run simulate
```

- Runs workflow locally
- Makes real calls to Sepolia
- No DON deployment needed
- Perfect for testing

### 2. CRE DON Deployment

```bash
bun run deploy
```

- Deploys to production DON
- Runs 24/7 on Chainlink infrastructure
- Full consensus guarantees
- Requires Early Access

## Extension Points

The architecture is designed for easy extension:

### Add New Signals
1. Create new file in `src/signals/`
2. Export signal calculation function
3. Import in workflow and call in callback

### Add New Assets
1. Add Data Feed address to `config.ts`
2. Update workflow to fetch additional prices
3. Modify agent to handle multiple assets

### Add Trade Execution
1. Integrate DEX contract (Uniswap, 1inch)
2. Add write capabilities to workflow
3. Execute swaps based on agent decisions

### Add x402 Payments
1. Import x402 from skills
2. Add payment capability to workflow
3. Implement agent-to-agent micropayments

## Performance Considerations

### Price History Storage

Current implementation uses in-memory storage:
```typescript
const priceHistory: Array<{ timestamp: number; price: number }> = [];
```

**Limitations**: Data lost on restart

**Production Solution**: 
- Use external storage (Redis, PostgreSQL)
- CRE HTTP capability to persist data
- S3 integration (see CRE templates)

### Execution Frequency

Current: Every 5 minutes

**Considerations**:
- More frequent = higher costs
- Less frequent = missed opportunities
- Optimize based on market volatility

## Cost Analysis

### Testnet (Free)
- Sepolia Data Feeds: Free
- CRE simulation: Free
- CRE deployment: Free during Early Access

### Mainnet (Future)
- CRE execution: Pay per workflow run
- Data Feeds: Free (read-only)
- Gas costs: For on-chain trades

## Security Best Practices

1. **Never commit private keys**
   - Use `.env` (gitignored)
   - Rotate keys regularly

2. **Validate all inputs**
   - Use Zod schemas
   - Check price feed staleness
   - Verify consensus results

3. **Implement circuit breakers**
   - Max loss per trade
   - Daily loss limits
   - Automatic pause on anomalies

4. **Audit smart contracts**
   - Before mainnet deployment
   - Use OpenZeppelin patterns
   - Test extensively on testnet

## Conclusion

AgentTrade demonstrates a clean architecture for AI-powered trading using CRE:

- **Decentralized**: No single point of failure
- **Composable**: Easy to extend with new strategies
- **Secure**: BFT consensus on all operations
- **Scalable**: Can handle multiple assets and strategies

This architecture can serve as a foundation for production trading systems, prediction markets, automated rebalancing, and more.

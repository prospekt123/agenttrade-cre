# Chainlink Integration Documentation

This document lists **all files** in this project that use Chainlink products, as required for hackathon submission.

## Chainlink Runtime Environment (CRE)

### Core Workflow Files

1. **`src/workflow/index.ts`**
   - **Lines 11-13**: Import CRE SDK
   - **Lines 17-30**: Define workflow callback function
   - **Lines 33-40**: Create EVM client for blockchain reads
   - **Lines 43-58**: Read from Chainlink Data Feed using CRE
   - **Lines 97-105**: Register CRE handler with cron trigger
   - **Usage**: Main workflow orchestration using CRE Runtime

2. **`src/config.ts`**
   - **Lines 6-7**: Chainlink Data Feed addresses
   - **Lines 23**: Sepolia chain ID for CRE EVM client
   - **Usage**: Configuration for CRE workflow

3. **`src/workflow/build.ts`**
   - **Lines 24-31**: Execute CRE CLI to build workflow
   - **Usage**: Build script for CRE WASM compilation

### Scripts

4. **`scripts/simulate.js`**
   - **Lines 23-32**: Execute CRE CLI for simulation
   - **Usage**: Run workflow simulation using CRE

5. **`scripts/deploy.js`**
   - **Lines 39-49**: Execute CRE CLI for deployment
   - **Usage**: Deploy workflow to Chainlink DON

### Configuration

6. **`package.json`**
   - **Line 12**: `@chainlink/cre-sdk` dependency
   - **Lines 7-9**: Build, simulate, deploy scripts using CRE
   - **Usage**: Project dependencies and CRE CLI integration

7. **`.env.example`**
   - **Lines 1-3**: CRE account credentials
   - **Usage**: CRE authentication configuration

## Chainlink Data Feeds

### Price Data Integration

8. **`src/workflow/index.ts`**
   - **Lines 43-58**: Read ETH/USD price from Chainlink Data Feed
   - **Contract**: `0x694AA1769357215DE4FAC081bf1f309aDC325306` (ETH/USD Sepolia)
   - **Function**: `latestRoundData()` from AggregatorV3Interface
   - **Lines 61-62**: Parse price with 8 decimals (Chainlink standard)
   - **Usage**: Fetch real-time, tamper-proof price data

9. **`src/config.ts`**
   - **Line 6**: `ethUsdFeed: "0x694AA1769357215DE4FAC081bf1f309aDC325306"`
   - **Line 7**: `btcUsdFeed: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43"`
   - **Usage**: Chainlink Data Feed contract addresses

## Summary of Chainlink Integration

### CRE Components Used

| Component | Usage | Files |
|-----------|-------|-------|
| CRE SDK | Workflow orchestration | `src/workflow/index.ts` |
| CRE CLI | Build & deployment | `scripts/*.js`, `src/workflow/build.ts` |
| Cron Trigger | Scheduled execution | `src/workflow/index.ts:97-105` |
| EVM Client | Blockchain reads | `src/workflow/index.ts:33-40` |
| Runtime | Workflow context | `src/workflow/index.ts:17` |

### Data Feed Components Used

| Component | Usage | Files |
|-----------|-------|-------|
| AggregatorV3Interface | Price fetching | `src/workflow/index.ts:43-58` |
| ETH/USD Feed (Sepolia) | Real-time ETH price | `src/config.ts:6` |
| BTC/USD Feed (Sepolia) | Real-time BTC price | `src/config.ts:7` |

### Networks

- **Sepolia Testnet** (Ethereum)
  - Chain ID: `5009297550715157269`
  - Used for: Chainlink Data Feeds

### Workflow Execution Flow

1. **Trigger**: CRE Cron Capability fires every 5 minutes
2. **Fetch**: CRE EVM Client reads Chainlink Data Feed
3. **Process**: Workflow generates trading signals
4. **Consensus**: CRE DON reaches BFT consensus on results
5. **Output**: Signals passed to AI agent

### Code Examples

#### Reading from Data Feed via CRE

```typescript
// src/workflow/index.ts
const evmClient = new cre.capabilities.EVMClient(
  runtime,
  config.sepoliaChainId
);

const priceData = await evmClient.readContract({
  address: config.ethUsdFeed as `0x${string}`,
  abi: [
    {
      inputs: [],
      name: "latestRoundData",
      outputs: [
        { name: "roundId", type: "uint80" },
        { name: "answer", type: "int256" },
        { name: "startedAt", type: "uint256" },
        { name: "updatedAt", type: "uint256" },
        { name: "answeredInRound", type: "uint80" },
      ],
      stateMutability: "view",
      type: "function",
    },
  ],
  functionName: "latestRoundData",
});

const price = Number(priceData[1]) / 1e8; // 8 decimals
```

#### Registering CRE Workflow

```typescript
// src/workflow/index.ts
export function registerWorkflow() {
  const cron = new cre.capabilities.CronCapability();

  cre.handler(
    cron.trigger({
      schedule: defaultConfig.checkInterval,
    }),
    onPriceCheck
  );
}
```

### Documentation References

All Chainlink integrations are documented in:

- **Technical**: [`docs/architecture.md`](./architecture.md)
- **Setup**: [`SETUP.md`](../SETUP.md)
- **README**: [`README.md`](../README.md)
- **Submission**: [`HACKATHON_SUBMISSION.md`](../HACKATHON_SUBMISSION.md)

### External Dependencies

```json
// package.json
{
  "dependencies": {
    "@chainlink/cre-sdk": "latest",
    "viem": "^2.21.54"
  }
}
```

- `@chainlink/cre-sdk`: Official Chainlink CRE TypeScript SDK
- `viem`: Required by CRE for EVM interactions

### Environment Variables

```bash
# .env
CRE_ACCOUNT_EMAIL=your-email@example.com
CRE_API_KEY=your-cre-api-key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR-KEY
```

## Verification

To verify Chainlink integration:

1. **Build workflow**: `bun run build`
   - Uses CRE CLI to compile to WASM
   
2. **Simulate**: `bun run simulate`
   - Executes CRE workflow
   - Fetches real data from Chainlink Data Feeds
   
3. **Check output**: Look for price data in console
   - Example: `Current ETH/USD price: $2,340.50`

## Chainlink Product Links

- **CRE Documentation**: https://docs.chain.link/cre
- **Data Feeds Documentation**: https://docs.chain.link/data-feeds
- **CRE SDK GitHub**: https://github.com/smartcontractkit/cre-sdk-typescript
- **Sepolia Data Feeds**: https://docs.chain.link/data-feeds/price-feeds/addresses?network=ethereum&page=1#sepolia-testnet

---

This documentation satisfies the hackathon requirement to "link all files that use Chainlink products."

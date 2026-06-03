# Arbitrage Bot - Production-Grade MEV Trading System

A high-performance, zero-capital arbitrage bot targeting Uniswap V3 and Uniswap V4 pools.

## Architecture

### Smart Contracts (Solidity >=0.8.24)
- **TriangularArbExecutorV3.sol**: Core execution contract with V3 flash swap callbacks
- **UniswapV4Executor.sol**: V4 unlock/lock executor with EIP-1153 transient storage
- **MakerDAOMintWrapper.sol**: DAI Flash Mint integration for zero-fee capital
- **FlashTipping.sol**: Block builder tip calculation and coinbase transfers

### Rust Backend Engine
- **Real-time WebSocket Listeners**: Pool event subscription using alloy-rs
- **Off-chain Math Optimization**: Q64.96 tick math and pricing calculations
- **Local EVM Simulation**: revm-based state caching and transaction simulation
- **Flashbots Integration**: Multi-relay bundle submission (Flashbots, BeaverBuild, Titan, Builder069)
- **CEX Hedging**: Binance/OKX API clients for delta-neutral positions
- **Intent Solving**: CoW Swap and UniswapX order monitoring

### Next.js Frontend
- **3D Mempool Visualizer**: Three.js particle stream of pending transactions
- **Liquidity Bubble Map**: Interactive pool visualization with volatility indicators
- **Arbitrage Dashboard**: Real-time opportunity scanning with profit analytics
- **Auto-Pilot Mode**: Automated trade execution with configurable parameters
- **Telemetry Console**: Microsecond-level latency breakdown

## Quick Start

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat deploy --network mainnet
```

### 2. Rust Engine
```bash
cd rust-engine
cargo build --release
source .env
cargo run --release
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Configuration

Create a `.env` file in each directory based on `.env.example`:
- **RPC_URL**: Ethereum RPC endpoint
- **PRIVATE_KEY**: Deployer/Executor private key
- **FLASHBOTS_RELAY**: Flashbots relay endpoint
- **BINANCE_API_KEY**: Binance API key for hedging

## Security Considerations

- Private keys are loaded via environment variables only
- Smart contracts implement `onlyExecutor` modifier
- Flash swap callbacks verify pool authorization
- Atomic execution with profitability checks
- Dynamic gas optimization and tipping

## License

MIT - See LICENSE for details
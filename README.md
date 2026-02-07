# PlayFrens

**Play poker with your frens. On-chain security, off-chain speed.**

PlayFrens is a multiplayer poker platform built on [Yellow Network](https://yellow.org) state channels ([ERC-7824](https://erc7824.org)). Players deposit once, play unlimited hands with zero gas fees and instant settlement, then withdraw when done. ENS names for identity, Base Sepolia for security.

Built for the Yellow Network + ENS hackathon tracks. No custom smart contracts needed — uses Yellow's deployed Custody + Adjudicator contracts.

## How It Works

### The Problem

Traditional on-chain games require a blockchain transaction for every action — dealing cards, placing bets, distributing pots. That means gas fees on every hand, block confirmation waits, and a terrible UX for real-time games like poker.

### The Solution: Yellow Network State Channels

PlayFrens leverages [ERC-7824](https://erc7824.org) state channels via Yellow Network to move gameplay off-chain while keeping funds secured on-chain:

```
 On-Chain (one-time)                Off-Chain (every hand)
┌─────────────────────────┐        ┌───────────────────────────────┐
│                         │        │                               │
│  1. Deposit ytest.usd   │        │  3. Play poker hands          │
│     to Custody contract │───▶    │     - Deal cards              │
│                         │        │     - Place bets              │
│  2. Funds enter         │        │     - Showdown                │
│     Unified Balance     │        │     - Pot distribution        │
│                         │        │     ALL INSTANT, 0 GAS FEES   │
│  6. Withdraw from       │  ◀───  │                               │
│     Custody back to     │        │  5. Close session             │
│     wallet              │        │     funds → Unified Balance   │
└─────────────────────────┘        └───────────────────────────────┘
```

### Channels vs App Sessions

Yellow Network uses a two-layer off-chain system:

**Layer 1 — Channels (on-chain anchor)**
- 1:1 payment channel between user and Clearnode (Yellow's message broker)
- Created via the Custody smart contract on Base Sepolia
- Funds are cryptographically locked — only the rightful owner can withdraw
- Provides the on-chain security guarantee

**Layer 2 — App Sessions (off-chain game state)**
- Multi-party sessions for specific applications (our poker game)
- Created off-chain via Clearnode RPC — no gas needed
- Funds allocated from each player's Unified Balance into the session
- State updates signed and submitted after every hand

```
┌──────────────────────────────────────────────────┐
│                  CLEARNODE                         │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Player A  │  │ Player B  │  │ Player C  │        │
│  │ Unified   │  │ Unified   │  │ Unified   │        │
│  │ Balance   │  │ Balance   │  │ Balance   │        │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘        │
│        │               │               │             │
│        └───────────────┼───────────────┘             │
│                        ▼                             │
│              ┌──────────────────┐                    │
│              │   APP SESSION    │                    │
│              │  (Poker Game)    │                    │
│              │                  │                    │
│              │  Server = Judge  │                    │
│              │  weight=100      │                    │
│              │  quorum=100      │                    │
│              └──────────────────┘                    │
└──────────────────────────────────────────────────────┘
                         │
                   On-Chain Anchor
                         ▼
              ┌──────────────────┐
              │  Custody Contract │
              │  (Base Sepolia)   │
              │                   │
              │  Funds locked     │
              │  Challenge period │
              │  Withdraw anytime │
              └──────────────────┘
```

### Per-Hand Fund Distribution (0 Gas!)

After **every poker hand**, the server submits updated chip allocations to the Clearnode — no blockchain transaction needed:

1. **Hand plays out** entirely off-chain via Socket.io (deal, bet, showdown)
2. **Server computes** new balances: `playerChips * chipUnit = ytest.usd amount`
3. **Server signs** the new state as Trusted Judge (weight=100, quorum=100)
4. **Clearnode records** the updated allocations instantly
5. **No gas, no wait** — the cryptographically signed state IS the settlement

This means a 6-player poker game with 100 hands produces **zero on-chain transactions** during gameplay. Only the initial deposit and final withdrawal touch the blockchain.

### On-Chain Security

If the server ever goes offline or acts maliciously:

| Aspect | Guarantee |
|--------|-----------|
| **Fund custody** | Locked in audited Custody contract on Base Sepolia |
| **Game fairness** | Server acts as Trusted Judge with signed state updates |
| **Dispute resolution** | On-chain Adjudicator contract with challenge period |
| **Player exit** | Withdraw anytime from Custody contract |
| **State integrity** | Cryptographic signatures on every state update |

Players can submit the last valid signed state to the on-chain Adjudicator and recover their funds after a challenge period — the same security as having funds in a smart contract, with the speed of a centralized server.

## Features

- **Zero gas poker** — Unlimited hands after a single deposit
- **Instant settlement** — Pot distribution in milliseconds, not block times
- **ENS identity** — Find friends by .eth name, see avatars at the table
- **Real-time multiplayer** — Up to 6 players per table via Socket.io
- **Configurable tables** — Custom buy-in, blinds, and chip denominations
- **Deposit & withdraw** — Faucet (testnet), on-chain deposit to Custody, withdraw to wallet
- **On-chain security** — Funds always recoverable via Custody contract

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 9
- A wallet with Base Sepolia ETH (for gas on deposit/withdraw)

### Setup

```bash
git clone <repo-url>
cd PlayFrens
pnpm install
```

Copy and configure environment:

```bash
cp .env.example apps/server/.env
cp .env.example apps/web/.env
```

You'll need:
- **Alchemy API key** — free at [alchemy.com](https://alchemy.com)
- **WalletConnect Project ID** — free at [cloud.walletconnect.com](https://cloud.walletconnect.com)
- **Server wallet private key** — generate a new wallet, fund with Base Sepolia ETH

### Run

```bash
pnpm dev
```

This starts:
- **Web app** at `http://localhost:5173`
- **Game server** at `http://localhost:3001`

### Build

```bash
pnpm build
pnpm typecheck
```

## How to Play

1. Open the app in two browser tabs with different wallets
2. **Tab 1**: Connect wallet → Authorize Yellow → Create a table → copy the room code
3. **Tab 2**: Connect wallet → Authorize Yellow → Join with the room code
4. Both players can request test tokens via the **Faucet** button
5. Hit **Deal Cards** to start a hand
6. Play through — fold, check, call, bet, raise
7. Send reactions to your frens while you play

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Motion (framer-motion) |
| Wallet | RainbowKit v2 + wagmi v2 + viem |
| Real-time | Socket.io |
| Poker Engine | poker-ts |
| State Channels | Yellow Network / @erc7824/nitrolite SDK |
| Chain | Base Sepolia (84532) |
| ENS | wagmi hooks (mainnet resolution) |

## Smart Contracts

All contracts are Yellow Network's deployed contracts on Base Sepolia — no custom contracts.

| Contract | Address |
|----------|---------|
| Custody | `0x019B65A265EB3363822f2752141b3dF16131b262` |
| Adjudicator | `0x7c7ccbc98469190849BCC6c926307794fDfB11F2` |
| Token (ytest.usd) | `0xDB9F293e3898c9E5536A3be1b0C56c89d2b32DEb` |

## Environment Variables

### Server (`apps/server/.env`)

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Server wallet private key (Trusted Judge) |
| `SESSION_KEY_PRIVATE_KEY` | Optional session key (auto-generated if omitted) |
| `BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint |
| `CLEARNODE_WS_URL` | Yellow Network Clearnode WebSocket URL |
| `CLEARNODE_APPLICATION` | Auth application name (default: PlayFrens) |
| `CLEARNODE_SCOPE` | Auth scope (default: playfrens.app) |
| `PORT` | Server port (default: 3001) |

### Client (`apps/web/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 project ID |
| `VITE_SERVER_URL` | Game server URL |
| `VITE_CLEARNODE_WS_URL` | Clearnode WebSocket URL |
| `VITE_BASE_SEPOLIA_RPC_URL` | Base Sepolia RPC endpoint |
| `VITE_CLEARNODE_APPLICATION` | Auth application name |
| `VITE_CLEARNODE_SCOPE` | Auth scope |

## Project Structure

```
PlayFrens/
├── apps/
│   ├── web/                    # React + Vite frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── layout/     # Header, nav
│   │       │   ├── lobby/      # Room creation, ENS search, deposit/withdraw
│   │       │   └── games/
│   │       │       └── poker/  # Table, seats, cards, action bar
│   │       ├── hooks/          # useSocket, useGameState, useYellow, useCustody
│   │       ├── lib/            # wagmi config, socket client, Yellow RPC client
│   │       └── providers/      # wagmi + RainbowKit + QueryClient
│   │
│   └── server/                 # Node.js game server
│       └── src/
│           ├── games/          # GameRoom base + PokerRoom (wraps poker-ts)
│           ├── rooms/          # RoomManager (room lifecycle)
│           ├── socket/         # Socket.io event handlers + middleware
│           └── yellow/         # Clearnode client, auth, session manager
│
└── packages/
    └── shared/                 # Shared types, events, constants
```

## Adding New Games

The architecture is game-agnostic. To add a new game:

1. Create `apps/server/src/games/<name>/<Name>Room.ts` extending `GameRoom`
2. Create `apps/web/src/components/games/<name>/` with UI components
3. Add the game type to `GameType` in `packages/shared/src/types/game.ts`
4. Register in `RoomManager.createRoom()` switch statement

## License

MIT

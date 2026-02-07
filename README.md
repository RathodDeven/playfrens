# PlayFrens

On-chain multiplayer game platform where friends find each other via ENS, deposit USDC into Yellow Network state channels, play games off-chain (instant, gasless), and withdraw when done.

Built for the Yellow Network + ENS hackathon tracks. Base Sepolia testnet. No custom smart contracts needed — uses Yellow's deployed Custody + Adjudicator contracts.

## How It Works

1. **Connect wallet** via RainbowKit
2. **Find your frens** by ENS name
3. **Deposit once** into a Yellow Network state channel (testnet faucet available)
4. **Play poker** — all game actions are off-chain, instant, and gasless
5. **Withdraw** when you're done — settle on-chain

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Motion (framer-motion) |
| Wallet | RainbowKit + wagmi v2 + viem |
| Real-time | Socket.io |
| Poker Engine | poker-ts |
| State Channels | Yellow Network / Clearnode |
| Chain | Base Sepolia (84532) |
| ENS | wagmi hooks (mainnet resolution) |

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Setup

```bash
git clone <repo-url>
cd PlayFrens
pnpm install
```

Copy the env template and fill in your keys:

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
- Game server on `http://localhost:3001`
- Web app on `http://localhost:5173`

### Build

```bash
pnpm build
pnpm typecheck
```

## Project Structure

```
PlayFrens/
├── apps/
│   ├── web/                  # React + Vite frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── layout/   # Header, nav
│   │       │   ├── lobby/    # Room creation, ENS search, deposits
│   │       │   └── games/
│   │       │       └── poker/  # Table, seats, cards, actions
│   │       ├── hooks/        # useSocket, useGameState, useYellow
│   │       ├── lib/          # wagmi config, socket client
│   │       └── providers/    # wagmi + RainbowKit
│   │
│   └── server/               # Node.js game server
│       └── src/
│           ├── games/        # GameRoom base + PokerRoom
│           ├── rooms/        # RoomManager
│           ├── yellow/       # Clearnode client, auth, sessions
│           └── socket/       # Event handlers
│
└── packages/
    └── shared/               # Shared types, events, constants
```

## How to Play

1. Open the app in two browser tabs with different wallets
2. **Tab 1**: Connect wallet → Create a table → copy the room code
3. **Tab 2**: Connect wallet → Join with the room code
4. Both players can request test tokens via the faucet
5. Hit **Deal Cards** to start a hand
6. Play through — fold, check, call, bet, raise
7. Send reactions to your frens while you play

## Adding New Games

The architecture is game-agnostic. To add a new game:

1. Create `apps/server/src/games/<name>/<Name>Room.ts` extending `GameRoom`
2. Create `apps/web/src/components/games/<name>/` with UI components
3. Add the game type to `GameType` in `packages/shared/src/types/game.ts`
4. Register in `RoomManager.createRoom()`

## Yellow Network Integration

PlayFrens uses Yellow Network state channels for deposits and settlements:

- **Custody**: `0x019B65A265EB3363822f2752141b3dF16131b262`
- **Adjudicator**: `0x7c7ccbc98469190849BCC6c926307794fDfB11F2`
- **Token**: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`

The server acts as a Trusted Judge, submitting chip allocations to the Clearnode after each hand.

## License

MIT

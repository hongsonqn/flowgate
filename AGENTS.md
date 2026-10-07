# FlowGate

> Usage-Triggered Budget Authorization System

## Deployed Contracts

| Contract     | Chain        | Chain ID | Address                                    | Tx / Explorer |
|-------------|-------------|----------|--------------------------------------------|---------------|
| BudgetGate  | Arc Testnet | 5042002  | `0xc841890e086a9611c3e141cd34369a4f5fed0122` | [Deployed] |

## Token Addresses

| Token | Chain       | Chain ID | Address                                    | Decimals |
|-------|------------|----------|--------------------------------------------|----------|
| USDC  | Arc Testnet | 5042002  | `0x3600000000000000000000000000000000000000` | 6        |

## Environment

- Backend API: `http://localhost:3001` (Hono, `server/index.ts`)
- Frontend: `http://localhost:5173` (Vite + React + TypeScript)
- PostgreSQL: `127.0.0.1:5432`, database `flowgate`, named volume `flowgate-pgdata`

## Architecture

- `contracts/BudgetGate.sol` — Solidity contract (Arc Testnet)
- `server/` — Hono API backend (budgets, recipients, attestations, activity log)
- `src/components/` — React frontend (Layout, Dashboard, CreateBudget, BudgetDetail, RecipientView, LandingHero)
- `src/contracts/BudgetGate.ts` — ABI + address constants

## Key Notes

- USDC on Arc is both native gas AND ERC-20 — never double-count
- BudgetGate contract address wired via `VITE_BUDGET_GATE_ADDRESS` env var (fallback in `src/contracts/BudgetGate.ts`)
- Chain ID: 5042002 (Arc Testnet)

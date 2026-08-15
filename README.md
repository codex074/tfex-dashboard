# TFEX Trading Journal

A bilingual (Thai/English) web application for recording, reviewing, and
analyzing TFEX trading activity. It combines a trading ledger, portfolio
tracking, trading journal, performance analytics, broker statement management,
and capital flow tracking into one personal trading intelligence platform.

## Architecture

```
Browser
   │
   ▼
React + TypeScript (Vite + Tailwind + TanStack Query)
   │
   │ REST API (JSON)
   ▼
Fastify (Node.js + TypeScript)
   │
   ▼
Service Layer (trade engine, portfolio, analytics, drawdown)
   │
   ▼
Drizzle ORM
   │
   ▼
SQLite (/data/tfex.db)
```

The canonical architecture doc lives in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Repository layout

```
tfexdash/
├── apps/
│   ├── web/        React + TypeScript + Vite + Tailwind + i18n
│   └── api/        Fastify + Drizzle + better-sqlite3
├── packages/
│   └── shared/     Shared domain constants, money helpers, Zod schemas
├── data/           SQLite database (gitignored)
├── docs/           Architecture, database, analytics, i18n docs
├── AGENTS.md       Project specification
└── package.json    pnpm workspace root
```

## Prerequisites

- Node.js >= 20
- pnpm (workspace package manager)

## Getting started

```bash
# Install dependencies
pnpm install

# Build native better-sqlite3 (if pnpm skipped it)
pnpm rebuild better-sqlite3

# Seed demo data (marked clearly as DEMO DATA)
pnpm db:seed

# Run backend (port 4000) and frontend (port 5173)
pnpm dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

### Individual commands

```bash
pnpm dev:api          # Fastify API only
pnpm dev:web          # Vite frontend only
pnpm build            # Build all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run domain unit tests
pnpm db:migrate       # Run drizzle-kit migrate (generated migrations)
pnpm db:generate      # Generate drizzle migrations
pnpm backup           # SQLite-safe backup to /backups
```

## Financial correctness rules

- **Capital flow is not trading performance.** Deposits are never profit and
  withdrawals are never loss.
- Money is stored as integer **satang** (1 THB = 100 satang). Prices are
  stored as integer points at scale 100. No floating-point arithmetic is used
  for financial math.
- Broker statements and historical snapshots are preserved verbatim as
  authoritative records.

## Localization

The UI supports Thai (default) and English. Language choice is persisted in
`localStorage` and applied immediately without a page reload. See
[`docs/I18N.md`](docs/I18N.md).
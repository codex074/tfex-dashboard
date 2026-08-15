# Architecture

## Overview

TFEX Trading Journal is a monorepo with two applications and one shared
package:

- `apps/web` — React + TypeScript + Vite + Tailwind + i18next
- `apps/api` — Fastify + Drizzle ORM + better-sqlite3
- `packages/shared` — domain constants, integer money/price helpers, Zod schemas

## Layering

React components only perform presentation, form state, query state, and
translation. They never touch SQLite directly and never reimplement financial
math. All important business logic lives in the backend service/domain layer.

```
apps/web/src
  components/   Presentational UI
  pages/        Route-level views
  hooks/        TanStack Query + shared hooks
  services/     api.ts (fetch client)
  i18n/         translation resources + init
  utils/        formatting (Intl)

apps/api/src
  routes/       Fastify route handlers (thin, validation only)
  services/     service layer orchestrating queries + domain logic
  domain/       pure, unit-tested financial logic
  db/           schema, client, migrations, seed, backup
  lib/          error types, parse/serialize helpers

packages/shared/src
  constants.ts  SIDE/ACTION/status enums (stored verbatim)
  money.ts      integer satang + integer price helpers
  schemas.ts    Zod request validation schemas
```

## Financial precision

Money is stored as integer **satang** (1 THB = 100 satang). Prices are stored
as integer **points** at scale 100 (1070.50 → 107050). All arithmetic is
performed on integers. `bigint` is used for the shared conversion helpers to
avoid JavaScript number precision issues for large amounts; the API layer
ultimately stores `number` (safe because TFEX account values remain well within
`Number.MAX_SAFE_INTEGER`).

## Data flow

1. Browser posts a JSON body (money/prices as decimal strings).
2. Fastify validates with Zod (from `@tfex/shared`).
3. The route handler delegates to a service.
4. The service converts decimal strings to integers and invokes domain logic.
5. Domain logic (trade engine, analytics, drawdown, capital flow) is pure and
   operates only on integers.
6. Results are serialized back to decimal strings.

## Source of truth

```
Broker Statement
  ↓
Broker Transaction
  ↓
Calculated Trade
  ↓
Analytics
```

For historical account values, broker daily snapshots take priority over
reconstructed values.

## Error handling

The API returns a consistent error envelope:

```json
{ "error": { "code": "DUPLICATE_TRANSACTION", "message": "..." } }
```

Error codes are language-neutral; the frontend maps them to translated text.
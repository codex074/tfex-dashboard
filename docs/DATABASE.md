# Database

## Engine

SQLite via `better-sqlite3` (synchronous, WAL mode enabled, foreign keys ON).
Drizzle ORM provides the schema. Default location: `data/tfex.db`.

## Tables

| Table | Purpose |
|-------|---------|
| `brokers` | Broker directory |
| `accounts` | Trading accounts (multi-account ready) |
| `cash_transactions` | Capital movements (deposit/withdrawal/interest/adjustment) |
| `broker_transactions` | Raw broker fills (source of truth for trades) |
| `trades` | Derived trade grouping |
| `trade_transactions` | Many-to-many mapping of transactions to trades |
| `positions` | Cached/derived open-position state |
| `daily_account_snapshots` | Authoritative daily portfolio values |
| `strategies` | Trading strategies |
| `trade_journals` | One journal entry per trade |
| `tags` / `trade_tags` | User-generated journal tags |
| `attachments` | File metadata (files stored on disk, not in SQLite) |
| `users` / `auth_sessions` | Member identities, roles, and hashed login sessions |
| `instruments` | Admin-maintained instrument-family directory |
| `user_brokers` / `user_instruments` | Per-user multi-select dropdown defaults |

## Key constraints

- `trade_transactions.broker_transaction_id` is unique — a broker transaction
  can only belong to one trade.
- `daily_account_snapshots(account_id, snapshot_date)` is unique.
- `trade_journals.trade_id` is unique (one journal per trade).
- Monetary columns are integer satang; prices are integer points (scale 100).

## Migrations

Production migrations are generated with `drizzle-kit generate` and applied
with `drizzle-kit migrate`:

```bash
pnpm db:generate
pnpm db:migrate
```

The dev server also runs an idempotent create-table migrator on boot
(`apps/api/src/db/migrate.ts`) so the local database is always usable. Never
hand-edit the production database schema directly.

## Backup

```bash
pnpm backup
```

Uses the SQLite online backup API (WAL-safe), writing to `backups/tfex-YYYY-MM-DD.db`.

## Data integrity

- Never silently modify broker transactions.
- Never overwrite original historical values.
- Never delete financial records without confirmation.
- Never merge uncertain trades automatically.
- Capital flow stays separate from trading performance.

## Account deletion

Accounts are soft-deleted: `accounts.deleted_at` is set and the row is hidden
from the live account list. The account can be restored within a 24-hour grace
window (`POST /api/accounts/:id/restore`). After the window elapses the row is
physically purged (cascade deletion of its transactions, trades, positions,
snapshots and journals) the next time deleted accounts are listed.

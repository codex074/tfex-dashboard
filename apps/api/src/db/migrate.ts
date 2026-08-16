import { getDb } from "./client.js";
import { sql } from "drizzle-orm";

/**
 * Idempotent CREATE TABLE statements via raw SQL, generated from the Drizzle
 * schema at runtime. This keeps the dev workflow simple (no external
 * migration files required) while still using Drizzle as the source of truth.
 *
 * NOTE: for production, use `drizzle-kit generate` + `drizzle-kit migrate`
 * (AGENTS.md §74). This runner is a convenience for the MVP.
 */

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER', is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id)`,
  `CREATE TABLE IF NOT EXISTS brokers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS instruments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS user_brokers (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    broker_id INTEGER NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, broker_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_instruments (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    instrument_id INTEGER NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, instrument_id)
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    broker_id INTEGER REFERENCES brokers(id) ON DELETE SET NULL,
    account_number TEXT,
    account_type TEXT NOT NULL DEFAULT 'DERIVATIVES',
    currency TEXT NOT NULL DEFAULT 'THB',
    initial_capital INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS accounts_broker_idx ON accounts (broker_id)`,
  `CREATE TABLE IF NOT EXISTS instrument_contract_specs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, instrument_family TEXT NOT NULL,
    multiplier_satang_per_point INTEGER NOT NULL, tick_size_points INTEGER NOT NULL DEFAULT 10,
    effective_date TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS instrument_specs_family_date_unique ON instrument_contract_specs (instrument_family, effective_date)`,
  `CREATE TABLE IF NOT EXISTS broker_contract_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT, broker_id INTEGER NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
    instrument_family TEXT NOT NULL, initial_margin INTEGER NOT NULL, maintenance_margin INTEGER NOT NULL,
    commission INTEGER NOT NULL DEFAULT 0, trading_fee INTEGER NOT NULL DEFAULT 0, clearing_fee INTEGER NOT NULL DEFAULT 0,
    regulatory_fee INTEGER NOT NULL DEFAULT 0, vat INTEGER NOT NULL DEFAULT 0, other_fee INTEGER NOT NULL DEFAULT 0,
    effective_date TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS broker_terms_broker_family_date_unique ON broker_contract_terms (broker_id, instrument_family, effective_date)`,
  `CREATE TABLE IF NOT EXISTS cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    broker_id INTEGER REFERENCES brokers(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reference TEXT,
    payment_method TEXT,
    note TEXT,
    attachment_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS cash_transactions_account_date_idx ON cash_transactions (account_id, transaction_date)`,
  `CREATE TABLE IF NOT EXISTS broker_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    trade_date TEXT NOT NULL,
    trade_time TEXT,
    instrument TEXT NOT NULL,
    contract_month TEXT,
    side TEXT NOT NULL,
    action TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL,
    cost_price INTEGER,
    commission INTEGER NOT NULL DEFAULT 0,
    trading_fee INTEGER NOT NULL DEFAULT 0,
    clearing_fee INTEGER NOT NULL DEFAULT 0,
    regulatory_fee INTEGER NOT NULL DEFAULT 0,
    vat INTEGER NOT NULL DEFAULT 0,
    other_fee INTEGER NOT NULL DEFAULT 0,
    total_fee INTEGER,
    realized_pnl INTEGER,
    broker_reference TEXT,
    source TEXT NOT NULL DEFAULT 'MANUAL',
    source_document_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS broker_transactions_account_date_idx ON broker_transactions (account_id, trade_date)`,
  `CREATE INDEX IF NOT EXISTS broker_transactions_instrument_idx ON broker_transactions (instrument)`,
  `CREATE INDEX IF NOT EXISTS broker_transactions_reference_idx ON broker_transactions (broker_reference)`,
  `CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    direction TEXT NOT NULL,
    opened_at TEXT,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    total_entry_quantity INTEGER NOT NULL DEFAULT 0,
    total_exit_quantity INTEGER NOT NULL DEFAULT 0,
    average_entry_price INTEGER,
    average_exit_price INTEGER,
    gross_pnl INTEGER NOT NULL DEFAULT 0,
    total_fees INTEGER NOT NULL DEFAULT 0,
    net_pnl INTEGER NOT NULL DEFAULT 0,
    holding_duration_seconds INTEGER,
    strategy_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE INDEX IF NOT EXISTS trades_account_idx ON trades (account_id)`,
  `CREATE TABLE IF NOT EXISTS trade_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    broker_transaction_id INTEGER NOT NULL REFERENCES broker_transactions(id) ON DELETE RESTRICT,
    sequence INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS trade_transactions_broker_unique ON trade_transactions (broker_transaction_id)`,
  `CREATE INDEX IF NOT EXISTS trade_transactions_trade_idx ON trade_transactions (trade_id)`,
  `CREATE TABLE IF NOT EXISTS positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    direction TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    average_price INTEGER NOT NULL,
    market_price INTEGER,
    unrealized_pnl INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS positions_unique_idx ON positions (account_id, instrument, direction)`,
  `CREATE TABLE IF NOT EXISTS daily_account_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    snapshot_date TEXT NOT NULL,
    cash_balance INTEGER NOT NULL DEFAULT 0,
    equity_balance INTEGER NOT NULL DEFAULT 0,
    initial_margin INTEGER,
    maintenance_margin INTEGER,
    excess_equity INTEGER,
    realized_pnl INTEGER,
    unrealized_pnl INTEGER,
    deposit_total INTEGER,
    withdrawal_total INTEGER,
    source TEXT NOT NULL DEFAULT 'MANUAL',
    source_document_id TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS snapshots_account_date_unique ON daily_account_snapshots (account_id, snapshot_date)`,
  `CREATE TABLE IF NOT EXISTS strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS trade_journals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    strategy_id INTEGER,
    setup TEXT,
    timeframe TEXT,
    entry_reason TEXT,
    exit_reason TEXT,
    confidence INTEGER,
    emotion TEXT,
    followed_plan INTEGER,
    mistakes TEXT,
    lessons TEXT,
    things_done_well TEXT,
    improvements TEXT,
    pre_trade_note TEXT,
    post_trade_note TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS trade_journals_trade_unique ON trade_journals (trade_id)`,
  `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
  `CREATE TABLE IF NOT EXISTS trade_tags (
    trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (trade_id, tag_id)
  )`,
  `CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`,
];

export function migrate() {
  const db = getDb();
  db.transaction((tx) => {
    for (const statement of CREATE_STATEMENTS) {
      tx.run(sql.raw(statement));
    }
    // MVP upgrades for databases created before contract settings existed.
    for (const statement of [
      "ALTER TABLE broker_transactions ADD COLUMN instrument_family TEXT",
      "ALTER TABLE broker_transactions ADD COLUMN multiplier_satang_per_point INTEGER",
      "ALTER TABLE trades ADD COLUMN instrument_family TEXT",
      "ALTER TABLE trades ADD COLUMN multiplier_satang_per_point INTEGER",
      "ALTER TABLE trades ADD COLUMN initial_margin_per_contract INTEGER",
      "ALTER TABLE trades ADD COLUMN broker_id INTEGER REFERENCES brokers(id) ON DELETE SET NULL",
      "ALTER TABLE accounts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE",
      "CREATE INDEX IF NOT EXISTS accounts_user_idx ON accounts (user_id)",
    ]) {
      try { tx.run(sql.raw(statement)); } catch { /* column already exists */ }
    }
  });
}

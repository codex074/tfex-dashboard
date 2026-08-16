import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Core domain schema (AGENTS.md §15-29).
 *
 * Financial precision strategy: money stored in integer satang, prices stored
 * in integer points (scale 100). See @tfex/shared/src/money.ts.
 *
 * Monetary and price values are always integers. No floating point is used
 * for financial data.
 */

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
};

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("USER"), // ADMIN | USER
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => ({ authSessionsUserIdx: index("auth_sessions_user_idx").on(table.userId) }),
);

export const brokers = sqliteTable("brokers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  ...timestamps,
});

/** Admin-maintained instrument families exposed in user dropdowns. */
export const instruments = sqliteTable("instruments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const userBrokers = sqliteTable(
  "user_brokers",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    brokerId: integer("broker_id").notNull().references(() => brokers.id, { onDelete: "cascade" }),
  },
  (table) => ({ userBrokersPk: primaryKey({ columns: [table.userId, table.brokerId] }) }),
);

export const userInstruments = sqliteTable(
  "user_instruments",
  {
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    instrumentId: integer("instrument_id").notNull().references(() => instruments.id, { onDelete: "cascade" }),
  },
  (table) => ({ userInstrumentsPk: primaryKey({ columns: [table.userId, table.instrumentId] }) }),
);

/** Exchange-level contract terms; values are versioned by effective date. */
export const instrumentContractSpecs = sqliteTable(
  "instrument_contract_specs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    instrumentFamily: text("instrument_family").notNull(),
    multiplierSatangPerPoint: integer("multiplier_satang_per_point").notNull(),
    tickSizePoints: integer("tick_size_points").notNull().default(10),
    effectiveDate: text("effective_date").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    instrumentSpecsFamilyDateUnique: uniqueIndex("instrument_specs_family_date_unique").on(table.instrumentFamily, table.effectiveDate),
  }),
);

/** Broker/account commercial terms; distinct from exchange contract specs. */
export const brokerContractTerms = sqliteTable(
  "broker_contract_terms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brokerId: integer("broker_id").notNull().references(() => brokers.id, { onDelete: "cascade" }),
    instrumentFamily: text("instrument_family").notNull(),
    initialMargin: integer("initial_margin").notNull(),
    maintenanceMargin: integer("maintenance_margin").notNull(),
    commission: integer("commission").notNull().default(0),
    tradingFee: integer("trading_fee").notNull().default(0),
    clearingFee: integer("clearing_fee").notNull().default(0),
    regulatoryFee: integer("regulatory_fee").notNull().default(0),
    vat: integer("vat").notNull().default(0),
    otherFee: integer("other_fee").notNull().default(0),
    effectiveDate: text("effective_date").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    brokerTermsBrokerFamilyDateUnique: uniqueIndex("broker_terms_broker_family_date_unique").on(table.brokerId, table.instrumentFamily, table.effectiveDate),
  }),
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    brokerId: integer("broker_id").references(() => brokers.id, {
      onDelete: "set null",
    }),
    accountNumber: text("account_number"),
    accountType: text("account_type").notNull().default("DERIVATIVES"),
    currency: text("currency").notNull().default("THB"),
    // Integer satang (initial capital contribution).
    initialCapital: integer("initial_capital").notNull().default(0),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => ({
    accountsBrokerIdx: index("accounts_broker_idx").on(table.brokerId),
    accountsUserIdx: index("accounts_user_idx").on(table.userId),
  }),
);

export const cashTransactions = sqliteTable(
  "cash_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // DEPOSIT | WITHDRAWAL | INTEREST | ADJUSTMENT
    transactionDate: text("transaction_date").notNull(), // YYYY-MM-DD
    amount: integer("amount").notNull(), // integer satang, always > 0
    reference: text("reference"),
    paymentMethod: text("payment_method"),
    note: text("note"),
    attachmentId: integer("attachment_id").references(() => attachments.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (table) => ({
    cashTransactionsAccountDateIdx: index(
      "cash_transactions_account_date_idx",
    ).on(table.accountId, table.transactionDate),
  }),
);

export const brokerTransactions = sqliteTable(
  "broker_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),

    tradeDate: text("trade_date").notNull(),
    tradeTime: text("trade_time"),

    instrument: text("instrument").notNull(),
    contractMonth: text("contract_month"),

    side: text("side").notNull(), // LONG | SHORT
    action: text("action").notNull(), // OPEN | CLOSE

    quantity: integer("quantity").notNull(),
    price: integer("price").notNull(), // integer points (scale 100)
    costPrice: integer("cost_price"), // integer points (scale 100)

    // Fees (integer satang, >= 0).
    commission: integer("commission").notNull().default(0),
    tradingFee: integer("trading_fee").notNull().default(0),
    clearingFee: integer("clearing_fee").notNull().default(0),
    regulatoryFee: integer("regulatory_fee").notNull().default(0),
    vat: integer("vat").notNull().default(0),
    otherFee: integer("other_fee").notNull().default(0),
    totalFee: integer("total_fee"),

    // Broker-reported realized P/L (integer satang, may be negative).
    realizedPnl: integer("realized_pnl"),

    brokerReference: text("broker_reference"),
    source: text("source").notNull().default("MANUAL"),
    sourceDocumentId: text("source_document_id"),
    instrumentFamily: text("instrument_family"),
    multiplierSatangPerPoint: integer("multiplier_satang_per_point"),
    ...timestamps,
  },
  (table) => ({
    brokerTransactionsAccountDateIdx: index(
      "broker_transactions_account_date_idx",
    ).on(table.accountId, table.tradeDate),
    brokerTransactionsInstrumentIdx: index(
      "broker_transactions_instrument_idx",
    ).on(table.instrument),
    brokerTransactionsReferenceIdx: index(
      "broker_transactions_reference_idx",
    ).on(table.brokerReference),
  }),
);

export const trades = sqliteTable(
  "trades",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    brokerId: integer("broker_id").references(() => brokers.id, {
      onDelete: "set null",
    }),
    instrument: text("instrument").notNull(),
    direction: text("direction").notNull(), // LONG | SHORT

    openedAt: text("opened_at"),
    closedAt: text("closed_at"),

    status: text("status").notNull().default("OPEN"), // OPEN | PARTIAL | CLOSED

    totalEntryQuantity: integer("total_entry_quantity").notNull().default(0),
    totalExitQuantity: integer("total_exit_quantity").notNull().default(0),

    // Integer points (scale 100).
    averageEntryPrice: integer("average_entry_price"),
    averageExitPrice: integer("average_exit_price"),

    // Integer satang.
    grossPnl: integer("gross_pnl").notNull().default(0),
    totalFees: integer("total_fees").notNull().default(0),
    netPnl: integer("net_pnl").notNull().default(0),

    holdingDurationSeconds: integer("holding_duration_seconds"),

    strategyId: integer("strategy_id").references(() => strategies.id, {
      onDelete: "set null",
    }),
    instrumentFamily: text("instrument_family"),
    multiplierSatangPerPoint: integer("multiplier_satang_per_point"),
    initialMarginPerContract: integer("initial_margin_per_contract"),
    ...timestamps,
  },
  (table) => ({
    tradesAccountIdx: index("trades_account_idx").on(table.accountId),
  }),
);

/**
 * Maps broker transactions to trades. Unique constraint on
 * brokerTransactionId prevents one transaction belonging to multiple trades.
 */
export const tradeTransactions = sqliteTable(
  "trade_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    brokerTransactionId: integer("broker_transaction_id")
      .notNull()
      .references(() => brokerTransactions.id, { onDelete: "restrict" }),
    sequence: integer("sequence").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => ({
    tradeTransactionsBrokerUnique: uniqueIndex(
      "trade_transactions_broker_unique",
    ).on(table.brokerTransactionId),
    tradeTransactionsTradeIdx: index("trade_transactions_trade_idx").on(
      table.tradeId,
    ),
  }),
);

export const positions = sqliteTable(
  "positions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    instrument: text("instrument").notNull(),
    direction: text("direction").notNull(), // LONG | SHORT
    quantity: integer("quantity").notNull(),
    averagePrice: integer("average_price").notNull(), // integer points
    marketPrice: integer("market_price"), // integer points, nullable
    unrealizedPnl: integer("unrealized_pnl").notNull().default(0),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => ({
    positionsUniqueIdx: uniqueIndex("positions_unique_idx").on(
      table.accountId,
      table.instrument,
      table.direction,
    ),
  }),
);

export const dailyAccountSnapshots = sqliteTable(
  "daily_account_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    snapshotDate: text("snapshot_date").notNull(),

    cashBalance: integer("cash_balance").notNull().default(0),
    equityBalance: integer("equity_balance").notNull().default(0),

    initialMargin: integer("initial_margin"),
    maintenanceMargin: integer("maintenance_margin"),
    excessEquity: integer("excess_equity"),

    realizedPnl: integer("realized_pnl"),
    unrealizedPnl: integer("unrealized_pnl"),

    depositTotal: integer("deposit_total"),
    withdrawalTotal: integer("withdrawal_total"),

    source: text("source").notNull().default("MANUAL"),
    sourceDocumentId: text("source_document_id"),
    ...timestamps,
  },
  (table) => ({
    snapshotsAccountDateUnique: uniqueIndex(
      "snapshots_account_date_unique",
    ).on(table.accountId, table.snapshotDate),
  }),
);

export const strategies = sqliteTable("strategies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const tradeJournals = sqliteTable(
  "trade_journals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    strategyId: integer("strategy_id").references(() => strategies.id, {
      onDelete: "set null",
    }),
    setup: text("setup"),
    timeframe: text("timeframe"),
    entryReason: text("entry_reason"),
    exitReason: text("exit_reason"),
    confidence: integer("confidence"), // 1-5
    emotion: text("emotion"),
    followedPlan: integer("followed_plan", { mode: "boolean" }),
    mistakes: text("mistakes"),
    lessons: text("lessons"),
    thingsDoneWell: text("things_done_well"),
    improvements: text("improvements"),
    preTradeNote: text("pre_trade_note"),
    postTradeNote: text("post_trade_note"),
    ...timestamps,
  },
  (table) => ({
    tradeJournalsTradeUnique: uniqueIndex("trade_journals_trade_unique").on(
      table.tradeId,
    ),
  }),
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...timestamps,
});

export const tradeTags = sqliteTable(
  "trade_tags",
  {
    tradeId: integer("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tradeTagsPk: primaryKey({ columns: [table.tradeId, table.tagId] }),
  }),
);

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // STATEMENT | DEPOSIT_SLIP | ...
  originalFilename: text("original_filename").notNull(),
  storedFilename: text("stored_filename").notNull(),
  relativePath: text("relative_path").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  uploadedAt: text("uploaded_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
});

export const brokersRelations = relations(brokers, ({ many }) => ({
  accounts: many(accounts),
  users: many(userBrokers),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(authSessions),
  accounts: many(accounts),
  brokers: many(userBrokers),
  instruments: many(userInstruments),
}));

export const instrumentsRelations = relations(instruments, ({ many }) => ({ users: many(userInstruments) }));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  broker: one(brokers, {
    fields: [accounts.brokerId],
    references: [brokers.id],
  }),
  cashTransactions: many(cashTransactions),
  brokerTransactions: many(brokerTransactions),
  trades: many(trades),
  snapshots: many(dailyAccountSnapshots),
}));

export const cashTransactionsRelations = relations(
  cashTransactions,
  ({ one }) => ({
    account: one(accounts, {
      fields: [cashTransactions.accountId],
      references: [accounts.id],
    }),
    attachment: one(attachments, {
      fields: [cashTransactions.attachmentId],
      references: [attachments.id],
    }),
  }),
);

export const brokerTransactionsRelations = relations(
  brokerTransactions,
  ({ one }) => ({
    account: one(accounts, {
      fields: [brokerTransactions.accountId],
      references: [accounts.id],
    }),
  }),
);

export const tradesRelations = relations(trades, ({ one, many }) => ({
  account: one(accounts, {
    fields: [trades.accountId],
    references: [accounts.id],
  }),
  strategy: one(strategies, {
    fields: [trades.strategyId],
    references: [strategies.id],
  }),
  transactions: many(tradeTransactions),
  journal: one(tradeJournals),
  tags: many(tradeTags),
}));

export const tradeTransactionsRelations = relations(
  tradeTransactions,
  ({ one }) => ({
    trade: one(trades, {
      fields: [tradeTransactions.tradeId],
      references: [trades.id],
    }),
    brokerTransaction: one(brokerTransactions, {
      fields: [tradeTransactions.brokerTransactionId],
      references: [brokerTransactions.id],
    }),
  }),
);

export const tradeJournalsRelations = relations(tradeJournals, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeJournals.tradeId],
    references: [trades.id],
  }),
  strategy: one(strategies, {
    fields: [tradeJournals.strategyId],
    references: [strategies.id],
  }),
}));

export const tradeTagsRelations = relations(tradeTags, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeTags.tradeId],
    references: [trades.id],
  }),
  tag: one(tags, {
    fields: [tradeTags.tagId],
    references: [tags.id],
  }),
}));

export const strategiesRelations = relations(strategies, ({ many }) => ({
  trades: many(trades),
  journals: many(tradeJournals),
}));

export type Broker = typeof brokers.$inferSelect;
export type NewBroker = typeof brokers.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
export type InstrumentContractSpec = typeof instrumentContractSpecs.$inferSelect;
export type NewInstrumentContractSpec = typeof instrumentContractSpecs.$inferInsert;
export type BrokerContractTerm = typeof brokerContractTerms.$inferSelect;
export type NewBrokerContractTerm = typeof brokerContractTerms.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type NewCashTransaction = typeof cashTransactions.$inferInsert;
export type BrokerTransaction = typeof brokerTransactions.$inferSelect;
export type NewBrokerTransaction = typeof brokerTransactions.$inferInsert;
export type Trade = typeof trades.$inferSelect;
export type NewTrade = typeof trades.$inferInsert;
export type TradeTransaction = typeof tradeTransactions.$inferSelect;
export type NewTradeTransaction = typeof tradeTransactions.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type DailyAccountSnapshot = typeof dailyAccountSnapshots.$inferSelect;
export type NewDailyAccountSnapshot =
  typeof dailyAccountSnapshots.$inferInsert;
export type Strategy = typeof strategies.$inferSelect;
export type NewStrategy = typeof strategies.$inferInsert;
export type TradeJournal = typeof tradeJournals.$inferSelect;
export type NewTradeJournal = typeof tradeJournals.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type Schema = {
  users: typeof users;
  authSessions: typeof authSessions;
  brokers: typeof brokers;
  instruments: typeof instruments;
  userBrokers: typeof userBrokers;
  userInstruments: typeof userInstruments;
  instrumentContractSpecs: typeof instrumentContractSpecs;
  brokerContractTerms: typeof brokerContractTerms;
  accounts: typeof accounts;
  cashTransactions: typeof cashTransactions;
  brokerTransactions: typeof brokerTransactions;
  trades: typeof trades;
  tradeTransactions: typeof tradeTransactions;
  positions: typeof positions;
  dailyAccountSnapshots: typeof dailyAccountSnapshots;
  strategies: typeof strategies;
  tradeJournals: typeof tradeJournals;
  tags: typeof tags;
  tradeTags: typeof tradeTags;
  attachments: typeof attachments;
};

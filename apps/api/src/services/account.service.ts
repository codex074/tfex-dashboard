import { and, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { TRADE_STATUS } from "@tfex/shared";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { computeCapitalFlow } from "../domain/portfolio.js";
import { parseMoneyOrZero } from "../lib/parse.js";
import { money } from "../lib/serialize.js";
import { errors } from "../lib/errors.js";
import { positionTotals } from "./position.service.js";

/** Deleted accounts remain recoverable (undo) for this long. */
export const ACCOUNT_DELETE_GRACE_MS = 24 * 60 * 60 * 1000;

export interface CreateAccountInput {
  userId?: number;
  name: string;
  brokerId?: number;
  accountNumber?: string | null;
  accountType?: string;
  currency?: string;
  initialCapital: string;
}

export function createAccount(db: Db, input: CreateAccountInput) {
  const row = db
    .insert(schema.accounts)
    .values({
      name: input.name,
      userId: input.userId,
      brokerId: input.brokerId,
      accountNumber: input.accountNumber ?? null,
      accountType: input.accountType ?? "DERIVATIVES",
      currency: input.currency ?? "THB",
      initialCapital: parseMoneyOrZero(input.initialCapital),
    })
    .returning()
    .get();
  return row;
}

/**
 * Lists only live (non-deleted) accounts. Soft-deleted accounts are surfaced
 * separately through `listDeletedAccounts` so they can be restored within the
 * grace window.
 */
export function listAccounts(db: Db, userId?: number) {
  const conditions = [isNull(schema.accounts.deletedAt)];
  if (userId !== undefined) {
    conditions.push(eq(schema.accounts.userId, userId));
  }
  return db
    .select()
    .from(schema.accounts)
    .where(and(...conditions))
    .orderBy(desc(schema.accounts.createdAt))
    .all();
}

/** Soft-deleted accounts that are still within the 24h undo window. */
export function listDeletedAccounts(db: Db, userId?: number) {
  purgeExpiredDeletedAccounts(db);
  const cutoff = graceCutoffIso();
  const conditions = [
    isNotNull(schema.accounts.deletedAt),
    gte(schema.accounts.deletedAt, cutoff),
  ];
  if (userId !== undefined) {
    conditions.push(eq(schema.accounts.userId, userId));
  }
  return db
    .select()
    .from(schema.accounts)
    .where(and(...conditions))
    .orderBy(desc(schema.accounts.deletedAt))
    .all();
}

export function getAccount(db: Db, id: number) {
  const account = db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.id, id), isNull(schema.accounts.deletedAt)))
    .get();
  if (!account) {
    throw errors.notFound("Account");
  }
  return account;
}

/**
 * Marks an account as deleted without destroying its data. The row is only
 * physically removed once the grace window elapses (see purge).
 */
export function deleteAccount(db: Db, id: number) {
  const account = getAccount(db, id);
  return db
    .update(schema.accounts)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, account.id))
    .returning()
    .get();
}

/**
 * Restores a soft-deleted account as long as it is still within the undo
 * window.
 */
export function restoreAccount(db: Db, id: number) {
  const account = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id))
    .get();
  if (!account || !account.deletedAt) {
    throw errors.notFound("Deleted account");
  }
  if (Date.now() - Date.parse(account.deletedAt) > ACCOUNT_DELETE_GRACE_MS) {
    throw errors.conflict("Account delete grace period has expired");
  }
  return db
    .update(schema.accounts)
    .set({ deletedAt: null })
    .where(eq(schema.accounts.id, id))
    .returning()
    .get();
}

function graceCutoffIso(): string {
  return new Date(Date.now() - ACCOUNT_DELETE_GRACE_MS).toISOString();
}

/**
 * Physically deletes accounts whose grace window has elapsed. Cascade
 * foreign keys remove the associated transactions, trades, positions,
 * snapshots and journals.
 */
export function purgeExpiredDeletedAccounts(db: Db) {
  const cutoff = graceCutoffIso();
  const expired = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(
      and(
        isNotNull(schema.accounts.deletedAt),
        lt(schema.accounts.deletedAt, cutoff),
      ),
    )
    .all();
  for (const { id } of expired) {
    db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
  }
  return expired.length;
}

export interface AccountSummary {
  account: ReturnType<typeof toAccountDto>;
  cashBalance: string;
  equityBalance: string;
  totalDeposits: string;
  totalWithdrawals: string;
  netCapitalFlow: string;
  netTradingProfit: string;
  realizedPnl: string;
  unrealizedPnl: string;
}

export function accountSummary(db: Db, accountId: number): AccountSummary {
  const account = getAccount(db, accountId);

  const cashTxs = db
    .select()
    .from(schema.cashTransactions)
    .where(eq(schema.cashTransactions.accountId, accountId))
    .all();

  const flows = computeCapitalFlow(
    cashTxs.map((t) => ({ type: t.type, amount: t.amount })),
  );

  const snapshots = db
    .select()
    .from(schema.dailyAccountSnapshots)
    .where(eq(schema.dailyAccountSnapshots.accountId, accountId))
    .orderBy(desc(schema.dailyAccountSnapshots.snapshotDate))
    .limit(1)
    .all();

  const latest = snapshots[0];
  const positions = positionTotals(db, accountId);

  const brokerRealizedPnl = db
    .select({
      realizedPnl: schema.brokerTransactions.realizedPnl,
    })
    .from(schema.brokerTransactions)
    .where(eq(schema.brokerTransactions.accountId, accountId))
    .all();

  const brokerReportedRealized = brokerRealizedPnl.reduce(
    (sum, r) => sum + (r.realizedPnl ?? 0),
    0,
  );

  // A position closed manually from the dashboard is calculated into its
  // derived Trade record. Its broker transaction has no broker-reported P/L,
  // so summing broker_transactions.realized_pnl would incorrectly leave the
  // dashboard at zero. Completed trade results are the canonical calculated
  // value until an authoritative broker snapshot is imported.
  const closedTrades = db
    .select({ netPnl: schema.trades.netPnl })
    .from(schema.trades)
    .where(
      and(
        eq(schema.trades.accountId, accountId),
        eq(schema.trades.status, TRADE_STATUS.CLOSED),
      ),
    )
    .all();
  const calculatedRealized = closedTrades.reduce(
    (sum, trade) => sum + trade.netPnl,
    0,
  );
  const totalRealized =
    closedTrades.length > 0 ? calculatedRealized : brokerReportedRealized;

  // A broker snapshot cash balance is treated as free cash. For accounts
  // without a snapshot, derive it from capital, realized performance and the
  // currently locked initial margin.
  const cashBalance = latest?.cashBalance ?? (
    account.initialCapital + flows.netCapitalFlow + totalRealized - positions.marginUsed
  );
  // Live Equity intentionally includes collateral: it remains the account's
  // asset even though it is unavailable for new orders.
  const equityBalance = cashBalance + positions.marginUsed + positions.unrealizedPnl;

  const netTradingProfit = totalRealized + positions.unrealizedPnl;

  return {
    account: toAccountDto(account),
    cashBalance: money(cashBalance) ?? "0",
    equityBalance: money(equityBalance) ?? "0",
    totalDeposits: money(flows.totalDeposits) ?? "0",
    totalWithdrawals: money(flows.totalWithdrawals) ?? "0",
    netCapitalFlow: money(flows.netCapitalFlow) ?? "0",
    netTradingProfit: money(netTradingProfit) ?? "0",
    realizedPnl: money(totalRealized) ?? "0",
    unrealizedPnl: money(positions.unrealizedPnl) ?? "0",
  };
}

export function toAccountDto(account: schema.Account) {
  return {
    id: account.id,
    name: account.name,
    brokerId: account.brokerId,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    currency: account.currency,
    initialCapital: money(account.initialCapital) ?? "0",
    isActive: account.isActive,
    deletedAt: account.deletedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
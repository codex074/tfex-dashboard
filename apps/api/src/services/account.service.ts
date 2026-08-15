import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { computeCapitalFlow } from "../domain/portfolio.js";
import { parseMoneyOrZero } from "../lib/parse.js";
import { money } from "../lib/serialize.js";
import { errors } from "../lib/errors.js";

export interface CreateAccountInput {
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

export function listAccounts(db: Db) {
  return db.select().from(schema.accounts).orderBy(desc(schema.accounts.createdAt)).all();
}

export function getAccount(db: Db, id: number) {
  const account = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id))
    .get();
  if (!account) {
    throw errors.notFound("Account");
  }
  return account;
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

  const realizedPnl = db
    .select({
      realizedPnl: schema.brokerTransactions.realizedPnl,
    })
    .from(schema.brokerTransactions)
    .where(eq(schema.brokerTransactions.accountId, accountId))
    .all();

  const totalRealized = realizedPnl.reduce(
    (sum, r) => sum + (r.realizedPnl ?? 0),
    0,
  );

  const cashBalance = latest?.cashBalance ?? 0;
  const equityBalance = latest?.equityBalance ?? cashBalance;

  const netTradingProfit =
    equityBalance - account.initialCapital - flows.totalDeposits +
    flows.totalWithdrawals;

  return {
    account: toAccountDto(account),
    cashBalance: money(cashBalance) ?? "0",
    equityBalance: money(equityBalance) ?? "0",
    totalDeposits: money(flows.totalDeposits) ?? "0",
    totalWithdrawals: money(flows.totalWithdrawals) ?? "0",
    netCapitalFlow: money(flows.netCapitalFlow) ?? "0",
    netTradingProfit: money(netTradingProfit) ?? "0",
    realizedPnl: money(totalRealized) ?? "0",
    unrealizedPnl: money(latest?.unrealizedPnl ?? 0) ?? "0",
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
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { TRADE_STATUS } from "@tfex/shared";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { computeTrade, type TransactionInput } from "../domain/trade-matching.js";
import { errors } from "../lib/errors.js";
import { money, price } from "../lib/serialize.js";
import { toBrokerTransactionDto } from "./transaction.service.js";
import { createBrokerTransaction, type CreateBrokerTransactionInput } from "./transaction.service.js";

export interface CreateTradeInput {
  accountId: number;
  instrument: string;
  direction: string;
  strategyId?: number | null;
}

export interface AssignTransactionInput {
  tradeId: number;
  transactionId: number;
}

function brokerTransactionToInput(
  tx: schema.BrokerTransaction,
): TransactionInput {
  return {
    action: tx.action as TransactionInput["action"],
    quantity: tx.quantity,
    price: tx.price,
    fees: {
      commission: tx.commission,
      tradingFee: tx.tradingFee,
      clearingFee: tx.clearingFee,
      regulatoryFee: tx.regulatoryFee,
      vat: tx.vat,
      otherFee: tx.otherFee,
    },
  };
}

function heldTransactionsForTrade(db: Db, tradeId: number) {
  const rows = db
    .select({
      bt: schema.brokerTransactions,
    })
    .from(schema.tradeTransactions)
    .innerJoin(
      schema.brokerTransactions,
      eq(
        schema.tradeTransactions.brokerTransactionId,
        schema.brokerTransactions.id,
      ),
    )
    .where(eq(schema.tradeTransactions.tradeId, tradeId))
    .orderBy(schema.tradeTransactions.sequence)
    .all();

  return rows.map((r) => r.bt);
}

export function recomputeTrade(db: Db, tradeId: number) {
  const trade = db
    .select()
    .from(schema.trades)
    .where(eq(schema.trades.id, tradeId))
    .get();
  if (!trade) {
    throw errors.notFound("Trade");
  }

  const transactions = heldTransactionsForTrade(db, tradeId);
  const computed = computeTrade(
    trade.direction as "LONG" | "SHORT",
    transactions.map(brokerTransactionToInput),
    trade.multiplierSatangPerPoint ?? 20_000,
  );

  let openedAt: string | null = null;
  for (const tx of transactions) {
    if (openedAt === null || tx.tradeDate < openedAt) {
      openedAt = tx.tradeDate;
    }
  }

  let closedAt: string | null = null;
  for (const tx of transactions) {
    if (tx.action === "CLOSE") {
      if (closedAt === null || tx.tradeDate > closedAt) {
        closedAt = tx.tradeDate;
      }
    }
  }

  const holdingDurationSeconds = computeHoldingSeconds(openedAt, closedAt);

  db.update(schema.trades)
    .set({
      status: computed.status,
      totalEntryQuantity: computed.totalEntryQuantity,
      totalExitQuantity: computed.totalExitQuantity,
      averageEntryPrice: computed.averageEntryPrice,
      averageExitPrice: computed.averageExitPrice,
      grossPnl: computed.grossPnl,
      totalFees: computed.totalFees,
      netPnl: computed.netPnl,
      openedAt,
      closedAt,
      holdingDurationSeconds,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.trades.id, tradeId))
    .run();

  return getTradeById(db, tradeId);
}

function computeHoldingSeconds(
  openedAt: string | null,
  closedAt: string | null,
): number | null {
  if (!openedAt || !closedAt) {
    return null;
  }
  const open = new Date(`${openedAt}T00:00:00Z`).getTime();
  const close = new Date(`${closedAt}T00:00:00Z`).getTime();
  if (Number.isNaN(open) || Number.isNaN(close)) {
    return null;
  }
  return Math.max(0, Math.trunc((close - open) / 1000));
}

export function createTrade(db: Db, input: CreateTradeInput) {
  const trade = db
    .insert(schema.trades)
    .values({
      accountId: input.accountId,
      instrument: input.instrument,
      direction: input.direction,
      strategyId: input.strategyId ?? null,
    })
    .returning()
    .get();
  return trade;
}

function resolveTerms(db: Db, accountId: number, family: string, tradeDate: string, selectedBrokerId?: number) {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
  if (!account) throw errors.notFound("Account");
  const spec = db.select().from(schema.instrumentContractSpecs).where(and(eq(schema.instrumentContractSpecs.instrumentFamily, family), lte(schema.instrumentContractSpecs.effectiveDate, tradeDate), eq(schema.instrumentContractSpecs.isActive, true))).orderBy(desc(schema.instrumentContractSpecs.effectiveDate)).limit(1).get();
  if (!spec) throw errors.validation(`No active contract spec for ${family}`);
  const brokerId = selectedBrokerId ?? account.brokerId;
  const brokerTerms = brokerId ? db.select().from(schema.brokerContractTerms).where(and(eq(schema.brokerContractTerms.brokerId, brokerId), eq(schema.brokerContractTerms.instrumentFamily, family), lte(schema.brokerContractTerms.effectiveDate, tradeDate), eq(schema.brokerContractTerms.isActive, true))).orderBy(desc(schema.brokerContractTerms.effectiveDate)).limit(1).get() : undefined;
  return { spec, brokerTerms };
}

export function assignTransaction(
  db: Db,
  input: AssignTransactionInput,
) {
  const trade = db
    .select()
    .from(schema.trades)
    .where(eq(schema.trades.id, input.tradeId))
    .get();
  if (!trade) {
    throw errors.notFound("Trade");
  }

  const tx = db
    .select()
    .from(schema.brokerTransactions)
    .where(eq(schema.brokerTransactions.id, input.transactionId))
    .get();
  if (!tx) {
    throw errors.notFound("Transaction");
  }

  if (tx.accountId !== trade.accountId) {
    throw errors.invalidTradeAssignment(
      "Transaction and trade belong to different accounts",
    );
  }
  if (tx.instrument !== trade.instrument) {
    throw errors.invalidTradeAssignment(
      "Transaction instrument does not match trade instrument",
    );
  }
  if (tx.side !== trade.direction) {
    throw errors.invalidTradeAssignment(
      "Transaction side does not match trade direction",
    );
  }

  const alreadyMapped = db
    .select()
    .from(schema.tradeTransactions)
    .where(
      eq(schema.tradeTransactions.brokerTransactionId, input.transactionId),
    )
    .get();
  if (alreadyMapped) {
    throw errors.transactionAlreadyAssigned();
  }

  const maxSequence = db
    .select({ max: schema.tradeTransactions.sequence })
    .from(schema.tradeTransactions)
    .where(eq(schema.tradeTransactions.tradeId, input.tradeId))
    .all()
    .reduce((max, row) => Math.max(max, row.max), 0);

  db.insert(schema.tradeTransactions)
    .values({
      tradeId: input.tradeId,
      brokerTransactionId: input.transactionId,
      sequence: maxSequence + 1,
    })
    .run();

  return recomputeTrade(db, input.tradeId);
}

export function openPosition(db: Db, input: Omit<CreateBrokerTransactionInput, "action" | "realizedPnl"> & { instrumentFamily?: string; brokerId?: number }) {
  const family = input.instrumentFamily ?? input.instrument.replace(/[A-Z]\d{2}$/, "");
  const { spec, brokerTerms } = resolveTerms(db, input.accountId, family, input.tradeDate, input.brokerId);
  const transaction = createBrokerTransaction(db, { ...input, instrumentFamily: family, multiplierSatangPerPoint: spec.multiplierSatangPerPoint, commission: input.commission ?? (brokerTerms?.commission ? String(brokerTerms.commission / 100) : "0"), tradingFee: input.tradingFee ?? (brokerTerms?.tradingFee ? String(brokerTerms.tradingFee / 100) : "0"), clearingFee: input.clearingFee ?? (brokerTerms?.clearingFee ? String(brokerTerms.clearingFee / 100) : "0"), regulatoryFee: input.regulatoryFee ?? (brokerTerms?.regulatoryFee ? String(brokerTerms.regulatoryFee / 100) : "0"), vat: input.vat ?? (brokerTerms?.vat ? String(brokerTerms.vat / 100) : "0"), otherFee: input.otherFee ?? (brokerTerms?.otherFee ? String(brokerTerms.otherFee / 100) : "0"), action: "OPEN", realizedPnl: null });
  const trade = db.insert(schema.trades).values({ accountId: input.accountId, instrument: input.instrument, direction: input.side, instrumentFamily: family, multiplierSatangPerPoint: spec.multiplierSatangPerPoint, initialMarginPerContract: brokerTerms?.initialMargin ?? null }).returning().get();
  return assignTransaction(db, { tradeId: trade.id, transactionId: transaction.id }).trade;
}

/** Full close only; the full remaining quantity is calculated from the trade. */
export function closePosition(db: Db, input: { tradeId: number; tradeDate: string; price: string; totalFee?: string | null; brokerReference?: string | null }) {
  const { trade } = getTradeById(db, input.tradeId);
  if (trade.status === "CLOSED") throw errors.conflict("Position is already closed");
  const quantity = trade.totalEntryQuantity - trade.totalExitQuantity;
  if (quantity <= 0) throw errors.conflict("Position has no remaining quantity");
  const transaction = createBrokerTransaction(db, { accountId: trade.accountId, tradeDate: input.tradeDate, instrument: trade.instrument, side: trade.direction, action: "CLOSE", quantity, price: input.price, totalFee: input.totalFee ?? null, realizedPnl: null, brokerReference: input.brokerReference ?? null, source: "MANUAL" });
  return assignTransaction(db, { tradeId: trade.id, transactionId: transaction.id }).trade;
}

export function listTrades(
  db: Db,
  filters: {
    accountId?: number;
    status?: string;
    direction?: string;
    instrument?: string;
    strategyId?: number;
    limit?: number;
    offset?: number;
  } = {},
) {
  const conditions = [];
  if (filters.accountId) {
    conditions.push(eq(schema.trades.accountId, filters.accountId));
  }
  if (filters.status) {
    conditions.push(eq(schema.trades.status, filters.status));
  }
  if (filters.direction) {
    conditions.push(eq(schema.trades.direction, filters.direction));
  }
  if (filters.instrument) {
    conditions.push(eq(schema.trades.instrument, filters.instrument));
  }
  if (filters.strategyId) {
    conditions.push(eq(schema.trades.strategyId, filters.strategyId));
  }

  return db
    .select()
    .from(schema.trades)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.trades.id))
    .limit(filters.limit ?? 100)
    .offset(filters.offset ?? 0)
    .all();
}

export function getTradeById(db: Db, id: number) {
  const trade = db
    .select()
    .from(schema.trades)
    .where(eq(schema.trades.id, id))
    .get();
  if (!trade) {
    throw errors.notFound("Trade");
  }

  const transactions = heldTransactionsForTrade(db, id);
  const mappings = db
    .select()
    .from(schema.tradeTransactions)
    .where(eq(schema.tradeTransactions.tradeId, id))
    .all();

  return { trade, transactions, mappings };
}

export function toTradeDto(trade: schema.Trade) {
  return {
    id: trade.id,
    accountId: trade.accountId,
    instrument: trade.instrument,
    direction: trade.direction,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    status: trade.status,
    totalEntryQuantity: trade.totalEntryQuantity,
    totalExitQuantity: trade.totalExitQuantity,
    averageEntryPrice: price(trade.averageEntryPrice),
    averageExitPrice: price(trade.averageExitPrice),
    grossPnl: money(trade.grossPnl) ?? "0",
    totalFees: money(trade.totalFees) ?? "0",
    netPnl: money(trade.netPnl) ?? "0",
    holdingDurationSeconds: trade.holdingDurationSeconds,
    strategyId: trade.strategyId,
    createdAt: trade.createdAt,
    updatedAt: trade.updatedAt,
  };
}

export function toTradeDetailDto(
  trade: schema.Trade,
  transactions: schema.BrokerTransaction[],
) {
  return {
    ...toTradeDto(trade),
    transactions: transactions.map(toBrokerTransactionDto),
  };
}

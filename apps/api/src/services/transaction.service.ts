import { and, desc, eq, isNull } from "drizzle-orm";
import { CASH_TRANSACTION_TYPE } from "@tfex/shared";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { totalFeeSatang } from "../domain/pnl.js";
import { errors } from "../lib/errors.js";
import {
  parseMoney,
  parseMoneyOrZero,
  parsePrice,
} from "../lib/parse.js";
import { money, price } from "../lib/serialize.js";

export interface CreateBrokerTransactionInput {
  accountId: number;
  tradeDate: string;
  tradeTime?: string | null;
  instrument: string;
  contractMonth?: string | null;
  side: string;
  action: string;
  quantity: number;
  price: string;
  costPrice?: string | null;
  commission?: string;
  tradingFee?: string;
  clearingFee?: string;
  regulatoryFee?: string;
  vat?: string;
  otherFee?: string;
  totalFee?: string | null;
  realizedPnl?: string | null;
  brokerReference?: string | null;
  source?: string;
  sourceDocumentId?: string | null;
  instrumentFamily?: string | null;
  multiplierSatangPerPoint?: number | null;
}

export function createBrokerTransaction(
  db: Db,
  input: CreateBrokerTransactionInput,
) {
  const pricePoints = parsePrice(input.price);
  if (pricePoints === null || pricePoints <= 0) {
    throw errors.validation("price must be greater than 0");
  }

  // Duplicate detection (AGENTS.md §53). Prefer broker reference when present.
  if (input.brokerReference) {
    const existing = db
      .select({ id: schema.brokerTransactions.id })
      .from(schema.brokerTransactions)
      .where(
        and(
          eq(schema.brokerTransactions.accountId, input.accountId),
          eq(schema.brokerTransactions.brokerReference, input.brokerReference),
        ),
      )
      .limit(1)
      .all();

    if (existing.length > 0) {
      throw errors.duplicateTransaction();
    }
  } else {
    // Structural fingerprint for transactions without a broker reference.
    const existing = db
      .select({ id: schema.brokerTransactions.id })
      .from(schema.brokerTransactions)
      .where(
        and(
          eq(schema.brokerTransactions.accountId, input.accountId),
          eq(schema.brokerTransactions.tradeDate, input.tradeDate),
          eq(schema.brokerTransactions.instrument, input.instrument),
          eq(schema.brokerTransactions.action, input.action),
          eq(schema.brokerTransactions.side, input.side),
          eq(schema.brokerTransactions.quantity, input.quantity),
          eq(schema.brokerTransactions.price, pricePoints),
          isNull(schema.brokerTransactions.brokerReference),
        ),
      )
      .limit(1)
      .all();

    if (existing.length > 0) {
      throw errors.duplicateTransaction();
    }
  }

  const feeComponents = {
    commission: parseMoneyOrZero(input.commission),
    tradingFee: parseMoneyOrZero(input.tradingFee),
    clearingFee: parseMoneyOrZero(input.clearingFee),
    regulatoryFee: parseMoneyOrZero(input.regulatoryFee),
    vat: parseMoneyOrZero(input.vat),
    otherFee: parseMoneyOrZero(input.otherFee),
  };

  const totalFee =
    input.totalFee !== null && input.totalFee !== undefined
      ? parseMoneyOrZero(input.totalFee)
      : totalFeeSatang(feeComponents);

  const row = db
    .insert(schema.brokerTransactions)
    .values({
      accountId: input.accountId,
      tradeDate: input.tradeDate,
      tradeTime: input.tradeTime ?? null,
      instrument: input.instrument,
      contractMonth: input.contractMonth ?? null,
      side: input.side,
      action: input.action,
      quantity: input.quantity,
      price: pricePoints,
      costPrice: parsePrice(input.costPrice),
      commission: feeComponents.commission,
      tradingFee: feeComponents.tradingFee,
      clearingFee: feeComponents.clearingFee,
      regulatoryFee: feeComponents.regulatoryFee,
      vat: feeComponents.vat,
      otherFee: feeComponents.otherFee,
      totalFee,
      realizedPnl: parseMoney(input.realizedPnl),
      brokerReference: input.brokerReference ?? null,
      source: input.source ?? "MANUAL",
      sourceDocumentId: input.sourceDocumentId ?? null,
      instrumentFamily: input.instrumentFamily ?? null,
      multiplierSatangPerPoint: input.multiplierSatangPerPoint ?? null,
    })
    .returning()
    .get();

  return row;
}

export function listBrokerTransactions(
  db: Db,
  accountId?: number,
  limit = 100,
  offset = 0,
) {
  const where = accountId
    ? eq(schema.brokerTransactions.accountId, accountId)
    : undefined;
  return db
    .select()
    .from(schema.brokerTransactions)
    .where(where)
    .orderBy(
      desc(schema.brokerTransactions.tradeDate),
      desc(schema.brokerTransactions.id),
    )
    .limit(limit)
    .offset(offset)
    .all();
}

export function getBrokerTransaction(db: Db, id: number) {
  const tx = db
    .select()
    .from(schema.brokerTransactions)
    .where(eq(schema.brokerTransactions.id, id))
    .get();
  if (!tx) {
    throw errors.notFound("Transaction");
  }
  return tx;
}

export interface UpdateBrokerTransactionInput {
  tradeDate?: string;
  quantity?: number;
  price?: string;
  totalFee?: string | null;
  brokerReference?: string | null;
}

export function updateBrokerTransaction(
  db: Db,
  id: number,
  input: UpdateBrokerTransactionInput,
) {
  const existing = getBrokerTransaction(db, id);
  const pricePoints =
    input.price === undefined ? existing.price : parsePrice(input.price);
  if (pricePoints === null || pricePoints <= 0) {
    throw errors.validation("price must be greater than 0");
  }
  const quantity = input.quantity ?? existing.quantity;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw errors.validation("quantity must be greater than 0");
  }

  const totalFee =
    input.totalFee === undefined
      ? existing.totalFee
      : input.totalFee === null
        ? totalFeeSatang({
            commission: existing.commission,
            tradingFee: existing.tradingFee,
            clearingFee: existing.clearingFee,
            regulatoryFee: existing.regulatoryFee,
            vat: existing.vat,
            otherFee: existing.otherFee,
          })
        : parseMoneyOrZero(input.totalFee);

  return db
    .update(schema.brokerTransactions)
    .set({
      tradeDate: input.tradeDate ?? existing.tradeDate,
      quantity,
      price: pricePoints,
      totalFee,
      brokerReference:
        input.brokerReference === undefined
          ? existing.brokerReference
          : input.brokerReference,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.brokerTransactions.id, id))
    .returning()
    .get();
}

export function toBrokerTransactionDto(tx: schema.BrokerTransaction) {
  return {
    id: tx.id,
    accountId: tx.accountId,
    tradeDate: tx.tradeDate,
    tradeTime: tx.tradeTime,
    instrument: tx.instrument,
    contractMonth: tx.contractMonth,
    side: tx.side,
    action: tx.action,
    quantity: tx.quantity,
    price: price(tx.price),
    costPrice: price(tx.costPrice),
    commission: money(tx.commission),
    tradingFee: money(tx.tradingFee),
    clearingFee: money(tx.clearingFee),
    regulatoryFee: money(tx.regulatoryFee),
    vat: money(tx.vat),
    otherFee: money(tx.otherFee),
    totalFee: money(tx.totalFee),
    realizedPnl: money(tx.realizedPnl),
    brokerReference: tx.brokerReference,
    source: tx.source,
    sourceDocumentId: tx.sourceDocumentId,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export interface CreateCashTransactionInput {
  accountId: number;
  type: string;
  transactionDate: string;
  amount: string;
  reference?: string | null;
  paymentMethod?: string | null;
  note?: string | null;
  attachmentId?: number | null;
}

export function createCashTransaction(
  db: Db,
  input: CreateCashTransactionInput,
) {
  const amount = parseMoneyOrZero(input.amount);
  if (amount <= 0) {
    throw errors.validation("amount must be greater than 0");
  }

  return db
    .insert(schema.cashTransactions)
    .values({
      accountId: input.accountId,
      type: input.type,
      transactionDate: input.transactionDate,
      amount,
      reference: input.reference ?? null,
      paymentMethod: input.paymentMethod ?? null,
      note: input.note ?? null,
      attachmentId: input.attachmentId ?? null,
    })
    .returning()
    .get();
}

export function listCashTransactions(
  db: Db,
  accountId?: number,
  limit = 100,
  offset = 0,
) {
  const where = accountId
    ? eq(schema.cashTransactions.accountId, accountId)
    : undefined;
  return db
    .select()
    .from(schema.cashTransactions)
    .where(where)
    .orderBy(desc(schema.cashTransactions.transactionDate))
    .limit(limit)
    .offset(offset)
    .all();
}

export function updateCashTransaction(db: Db, id: number, input: Partial<Omit<CreateCashTransactionInput, "accountId">>) {
  const existing = db.select().from(schema.cashTransactions).where(eq(schema.cashTransactions.id, id)).get();
  if (!existing) throw errors.notFound("Cash transaction");
  const amount = input.amount === undefined ? existing.amount : parseMoneyOrZero(input.amount);
  if (amount <= 0) throw errors.validation("amount must be greater than 0");
  return db.update(schema.cashTransactions).set({ ...input, amount, updatedAt: new Date().toISOString() }).where(eq(schema.cashTransactions.id, id)).returning().get();
}

export function deleteCashTransaction(db: Db, id: number) {
  const existing = db.select({ id: schema.cashTransactions.id }).from(schema.cashTransactions).where(eq(schema.cashTransactions.id, id)).get();
  if (!existing) throw errors.notFound("Cash transaction");
  db.delete(schema.cashTransactions).where(eq(schema.cashTransactions.id, id)).run();
}

export function toCashTransactionDto(tx: schema.CashTransaction) {
  return {
    id: tx.id,
    accountId: tx.accountId,
    type: tx.type,
    transactionDate: tx.transactionDate,
    amount: money(tx.amount) ?? "0",
    reference: tx.reference,
    paymentMethod: tx.paymentMethod,
    note: tx.note,
    attachmentId: tx.attachmentId,
    createdAt: tx.createdAt,
    updatedAt: tx.updatedAt,
  };
}

export interface CashFlowDto {
  totalDeposits: string;
  totalWithdrawals: string;
  totalInterest: string;
  totalAdjustments: string;
  netCapitalFlow: string;
}

export function cashFlowSummary(db: Db, accountId: number): CashFlowDto {
  const rows = db
    .select()
    .from(schema.cashTransactions)
    .where(eq(schema.cashTransactions.accountId, accountId))
    .all();

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalInterest = 0;
  let totalAdjustments = 0;
  for (const row of rows) {
    switch (row.type) {
      case CASH_TRANSACTION_TYPE.DEPOSIT:
        totalDeposits += row.amount;
        break;
      case CASH_TRANSACTION_TYPE.WITHDRAWAL:
        totalWithdrawals += row.amount;
        break;
      case CASH_TRANSACTION_TYPE.INTEREST:
        totalInterest += row.amount;
        break;
      case CASH_TRANSACTION_TYPE.ADJUSTMENT:
        totalAdjustments += row.amount;
        break;
      default:
        break;
    }
  }

  const netCapitalFlow =
    totalDeposits - totalWithdrawals + totalInterest + totalAdjustments;

  return {
    totalDeposits: money(totalDeposits) ?? "0",
    totalWithdrawals: money(totalWithdrawals) ?? "0",
    totalInterest: money(totalInterest) ?? "0",
    totalAdjustments: money(totalAdjustments) ?? "0",
    netCapitalFlow: money(netCapitalFlow) ?? "0",
  };
}

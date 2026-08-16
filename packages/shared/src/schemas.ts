import { z } from "zod";
import {
  ACCOUNT_TYPE,
  ACTION,
  ATTACHMENT_TYPE,
  CASH_TRANSACTION_TYPE,
  SIDE,
  SNAPSHOT_SOURCE,
  TRANSACTION_SOURCE,
} from "./constants.js";

/**
 * Runtime validation schemas (AGENTS.md §3, §61).
 *
 * Rule: quantity > 0, price > 0, fees >= 0, amount > 0.
 * Money is submitted as decimal strings and converted to integer satang in
 * the service layer. Prices are decimal strings converted to integer points.
 */

const moneyString = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/, "Must be a valid baht amount");

export const nonNegativeMoneyString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a non-negative baht amount");

const priceString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid price");

const idSchema = z.number().int().positive();

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
});

export const createUserSchema = loginSchema.extend({
  displayName: z.string().trim().min(1).max(100),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export const createInstrumentSchema = z.object({
  code: z.string().trim().min(1).max(20).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(100),
});

export const updateUserPreferencesSchema = z.object({
  brokerIds: z.array(idSchema).max(50).default([]),
  instrumentIds: z.array(idSchema).max(100).default([]),
});

export const createAccountSchema = z.object({
  name: z.string().min(1),
  brokerId: z.number().int().positive().optional(),
  accountNumber: z.string().optional().nullable(),
  accountType: z.nativeEnum(ACCOUNT_TYPE).default(ACCOUNT_TYPE.DERIVATIVES),
  currency: z.string().default("THB"),
  initialCapital: nonNegativeMoneyString.default("0"),
});

export const updateAccountSchema = createAccountSchema.partial();

export const createBrokerSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().min(1),
});

export const createInstrumentContractSpecSchema = z.object({
  instrumentFamily: z.string().min(1).regex(/^[A-Z0-9]+$/),
  multiplier: nonNegativeMoneyString.refine((value) => value !== "0"),
  tickSize: priceString,
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createBrokerContractTermSchema = z.object({
  brokerId: idSchema,
  instrumentFamily: z.string().min(1).regex(/^[A-Z0-9]+$/),
  initialMargin: nonNegativeMoneyString,
  maintenanceMargin: nonNegativeMoneyString,
  commission: nonNegativeMoneyString.default("0"),
  tradingFee: nonNegativeMoneyString.default("0"),
  clearingFee: nonNegativeMoneyString.default("0"),
  regulatoryFee: nonNegativeMoneyString.default("0"),
  vat: nonNegativeMoneyString.default("0"),
  otherFee: nonNegativeMoneyString.default("0"),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const createCashTransactionSchema = z.object({
  accountId: idSchema,
  type: z.nativeEnum(CASH_TRANSACTION_TYPE),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Amount must be positive"),
  reference: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  attachmentId: z.number().int().positive().optional().nullable(),
});

export const updateCashTransactionSchema = createCashTransactionSchema
  .omit({ accountId: true })
  .partial();

export const createBrokerTransactionSchema = z.object({
  accountId: idSchema,
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tradeTime: z.string().optional().nullable(),
  instrument: z.string().min(1),
  contractMonth: z.string().optional().nullable(),
  side: z.nativeEnum(SIDE),
  action: z.nativeEnum(ACTION),
  quantity: z.number().int().positive(),
  price: priceString,
  costPrice: priceString.optional().nullable(),
  commission: nonNegativeMoneyString.default("0"),
  tradingFee: nonNegativeMoneyString.default("0"),
  clearingFee: nonNegativeMoneyString.default("0"),
  regulatoryFee: nonNegativeMoneyString.default("0"),
  vat: nonNegativeMoneyString.default("0"),
  otherFee: nonNegativeMoneyString.default("0"),
  totalFee: nonNegativeMoneyString.optional().nullable(),
  realizedPnl: moneyString.optional().nullable(),
  brokerReference: z.string().optional().nullable(),
  source: z.nativeEnum(TRANSACTION_SOURCE).default(TRANSACTION_SOURCE.MANUAL),
  sourceDocumentId: z.string().optional().nullable(),
});

export const openPositionSchema = createBrokerTransactionSchema.omit({
  action: true,
  realizedPnl: true,
}).extend({
  // Fee values must remain absent when the user does not enter an override,
  // allowing the broker contract term to supply its configured default.
  commission: nonNegativeMoneyString.optional(),
  tradingFee: nonNegativeMoneyString.optional(),
  clearingFee: nonNegativeMoneyString.optional(),
  regulatoryFee: nonNegativeMoneyString.optional(),
  vat: nonNegativeMoneyString.optional(),
  otherFee: nonNegativeMoneyString.optional(),
  instrumentFamily: z.string().min(1).regex(/^[A-Z0-9]+$/),
  brokerId: idSchema.optional(),
});

export const closePositionSchema = z.object({
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: priceString,
  totalFee: nonNegativeMoneyString.optional().nullable(),
  brokerReference: z.string().optional().nullable(),
});

export const updateBrokerTransactionSchema = createBrokerTransactionSchema
  .partial()
  .omit({ accountId: true });

// Keep trade identity immutable from the transaction editor. Changing its
// instrument, side, or action would invalidate the mapping to a Trade.
export const updateManualBrokerTransactionSchema = updateBrokerTransactionSchema.pick({
  tradeDate: true,
  quantity: true,
  price: true,
  totalFee: true,
  brokerReference: true,
});

export const createPositionSchema = z.object({
  accountId: idSchema,
  instrument: z.string().min(1),
  direction: z.nativeEnum(SIDE),
  quantity: z.number().int().positive(),
  averagePrice: priceString,
  marketPrice: priceString.optional().nullable(),
});

/** A mark is a price observation, never a broker transaction or trade close. */
export const markPositionPriceSchema = z.object({
  accountId: idSchema,
  instrument: z.string().min(1),
  direction: z.nativeEnum(SIDE),
  marketPrice: priceString,
});

export const upsertSnapshotSchema = z.object({
  accountId: idSchema,
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cashBalance: nonNegativeMoneyString.default("0"),
  equityBalance: nonNegativeMoneyString.default("0"),
  initialMargin: nonNegativeMoneyString.optional().nullable(),
  maintenanceMargin: nonNegativeMoneyString.optional().nullable(),
  excessEquity: nonNegativeMoneyString.optional().nullable(),
  realizedPnl: moneyString.optional().nullable(),
  unrealizedPnl: moneyString.optional().nullable(),
  depositTotal: nonNegativeMoneyString.optional().nullable(),
  withdrawalTotal: nonNegativeMoneyString.optional().nullable(),
  source: z.nativeEnum(SNAPSHOT_SOURCE).default(SNAPSHOT_SOURCE.MANUAL),
  sourceDocumentId: z.string().optional().nullable(),
});

export const createStrategySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
});

export const createTradeSchema = z.object({
  accountId: idSchema,
  instrument: z.string().min(1),
  direction: z.nativeEnum(SIDE),
  strategyId: z.number().int().positive().optional().nullable(),
});

export const assignTransactionToTradeSchema = z.object({
  transactionId: idSchema,
});

export const createJournalSchema = z.object({
  tradeId: idSchema,
  strategyId: z.number().int().positive().optional().nullable(),
  setup: z.string().optional().nullable(),
  timeframe: z.string().optional().nullable(),
  entryReason: z.string().optional().nullable(),
  exitReason: z.string().optional().nullable(),
  confidence: z.number().int().min(1).max(5).optional().nullable(),
  emotion: z.string().optional().nullable(),
  followedPlan: z.boolean().optional().nullable(),
  mistakes: z.string().optional().nullable(),
  lessons: z.string().optional().nullable(),
  thingsDoneWell: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  preTradeNote: z.string().optional().nullable(),
  postTradeNote: z.string().optional().nullable(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export const createTagSchema = z.object({
  name: z.string().min(1),
});

export const createAttachmentSchema = z.object({
  type: z.nativeEnum(ATTACHMENT_TYPE),
});

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export const tradeListQuerySchema = listQuerySchema.extend({
  status: z.string().optional(),
  direction: z.string().optional(),
  instrument: z.string().optional(),
  strategyId: z.coerce.number().int().positive().optional(),
});

export const dateRangeQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Shared domain constants.
 *
 * These values are stored verbatim in the database and must never be
 * translated. UI labels are handled separately through i18n.
 */

export const SIDE = {
  LONG: "LONG",
  SHORT: "SHORT",
} as const;
export type Side = (typeof SIDE)[keyof typeof SIDE];

export const ACTION = {
  OPEN: "OPEN",
  CLOSE: "CLOSE",
} as const;
export type Action = (typeof ACTION)[keyof typeof ACTION];

export const TRADE_STATUS = {
  OPEN: "OPEN",
  PARTIAL: "PARTIAL",
  CLOSED: "CLOSED",
} as const;
export type TradeStatus = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];

export const DIRECTION = SIDE;
export type Direction = Side;

export const CASH_TRANSACTION_TYPE = {
  DEPOSIT: "DEPOSIT",
  WITHDRAWAL: "WITHDRAWAL",
  INTEREST: "INTEREST",
  ADJUSTMENT: "ADJUSTMENT",
} as const;
export type CashTransactionType =
  (typeof CASH_TRANSACTION_TYPE)[keyof typeof CASH_TRANSACTION_TYPE];

export const ACCOUNT_TYPE = {
  DERIVATIVES: "DERIVATIVES",
} as const;
export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

export const ATTACHMENT_TYPE = {
  STATEMENT: "STATEMENT",
  DEPOSIT_SLIP: "DEPOSIT_SLIP",
  WITHDRAWAL_SLIP: "WITHDRAWAL_SLIP",
  CONFIRMATION_NOTE: "CONFIRMATION_NOTE",
  SETTLEMENT_STATEMENT: "SETTLEMENT_STATEMENT",
  TRADE_IMAGE: "TRADE_IMAGE",
  OTHER: "OTHER",
} as const;
export type AttachmentType =
  (typeof ATTACHMENT_TYPE)[keyof typeof ATTACHMENT_TYPE];

export const SNAPSHOT_SOURCE = {
  BROKER: "BROKER",
  MANUAL: "MANUAL",
} as const;
export type SnapshotSource =
  (typeof SNAPSHOT_SOURCE)[keyof typeof SNAPSHOT_SOURCE];

export const TRANSACTION_SOURCE = {
  MANUAL: "MANUAL",
  CSV: "CSV",
  BROKER: "BROKER",
} as const;
export type TransactionSource =
  (typeof TRANSACTION_SOURCE)[keyof typeof TRANSACTION_SOURCE];

export const ALL_SIDES: readonly Side[] = [SIDE.LONG, SIDE.SHORT];
export const ALL_ACTIONS: readonly Action[] = [ACTION.OPEN, ACTION.CLOSE];
export const ALL_TRADE_STATUSES: readonly TradeStatus[] = [
  TRADE_STATUS.OPEN,
  TRADE_STATUS.PARTIAL,
  TRADE_STATUS.CLOSED,
];
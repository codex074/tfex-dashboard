import { TRADE_STATUS, type Action, type Direction } from "@tfex/shared";
import {
  grossPnlSatang,
  totalFeeSatang,
  weightedAveragePrice,
} from "./pnl.js";

/**
 * Trade engine (AGENTS.md §20, §21, §65).
 *
 * A Trade groups one or more broker transactions of the same instrument and
 * direction. This module computes a trade's derived state from its linked
 * transactions using FIFO lot allocation, supporting scale-in, scale-out and
 * partial close.
 */

export interface TransactionInput {
  action: Action; // OPEN | CLOSE
  quantity: number;
  price: number; // integer points
  fees?: {
    commission?: number | null;
    tradingFee?: number | null;
    clearingFee?: number | null;
    regulatoryFee?: number | null;
    vat?: number | null;
    otherFee?: number | null;
  };
}

export interface TradeComputation {
  totalEntryQuantity: number;
  totalExitQuantity: number;
  averageEntryPrice: number | null;
  averageExitPrice: number | null;
  grossPnl: number;
  totalFees: number;
  netPnl: number;
  status: "OPEN" | "PARTIAL" | "CLOSED";
}

/**
 * FIFO lot allocation of CLOSE transactions against OPEN transactions.
 *
 * Returns the realized gross P/L allocated to already-closed quantity.
 * Fees from both OPEN and CLOSE transactions are summed separately by the
 * caller (all fees on the trade are attributed unconditionally).
 */
function realizedGrossFromLots(
  direction: Direction,
  transactions: ReadonlyArray<TransactionInput>,
  pointValueSatang?: number,
): number {
  // Running FIFO queue of remaining open lots (price points).
  const openLots: Array<{ quantity: number; price: number }> = [];
  let gross = 0;

  for (const tx of transactions) {
    if (tx.action === "OPEN") {
      if (tx.quantity > 0) {
        openLots.push({ quantity: tx.quantity, price: tx.price });
      }
      continue;
    }

    // CLOSE
    let remainingClose = tx.quantity;
    while (remainingClose > 0 && openLots.length > 0) {
      const lot = openLots[0];
      if (lot === undefined) {
        break;
      }
      const take = Math.min(lot.quantity, remainingClose);
      gross += grossPnlSatang({
        direction,
        entryPrice: lot.price,
        exitPrice: tx.price,
        quantity: take,
        pointValueSatang,
      });
      lot.quantity -= take;
      remainingClose -= take;
      if (lot.quantity === 0) {
        openLots.shift();
      }
    }
    // If more closed than opened, surplus is ignored for realized gross
    // (cannot realize against a non-existent lot).
  }

  return gross;
}

export function computeTrade(
  direction: Direction,
  transactions: ReadonlyArray<TransactionInput>,
  pointValueSatang?: number,
): TradeComputation {
  const entryLots: Array<{ quantity: number; price: number }> = [];
  const exitLots: Array<{ quantity: number; price: number }> = [];
  let totalEntryQuantity = 0;
  let totalExitQuantity = 0;
  let totalFees = 0;

  for (const tx of transactions) {
    totalFees += totalFeeSatang(tx.fees ?? {});
    if (tx.action === "OPEN") {
      entryLots.push({ quantity: tx.quantity, price: tx.price });
      totalEntryQuantity += tx.quantity;
    } else {
      exitLots.push({ quantity: tx.quantity, price: tx.price });
      totalExitQuantity += tx.quantity;
    }
  }

  const grossPnl = realizedGrossFromLots(direction, transactions, pointValueSatang);

  let status: TradeComputation["status"];
  if (totalExitQuantity >= totalEntryQuantity) {
    status = TRADE_STATUS.CLOSED;
  } else if (totalExitQuantity > 0) {
    status = TRADE_STATUS.PARTIAL;
  } else {
    status = TRADE_STATUS.OPEN;
  }

  const averageEntryPrice =
    entryLots.length > 0 ? weightedAveragePrice(entryLots) : null;
  const averageExitPrice =
    exitLots.length > 0 ? weightedAveragePrice(exitLots) : null;

  return {
    totalEntryQuantity,
    totalExitQuantity,
    averageEntryPrice,
    averageExitPrice,
    grossPnl,
    totalFees,
    netPnl: grossPnl - totalFees,
    status,
  };
}

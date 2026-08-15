import { CASH_TRANSACTION_TYPE } from "@tfex/shared";

/**
 * Capital flow & equity math (AGENTS.md §18, §33, §90).
 *
 * Critical rule: Capital Flow ≠ Trading Performance.
 *   Deposit ≠ Profit, Withdrawal ≠ Loss.
 *
 * All amounts are integer satang.
 */

export interface CashTransactionInput {
  type: string; // DEPOSIT | WITHDRAWAL | INTEREST | ADJUSTMENT
  amount: number; // integer satang, always > 0
}

export interface CapitalFlowSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  totalInterest: number;
  totalAdjustments: number;
  netCapitalFlow: number; // deposits - withdrawals (+ interest + adjustment)
}

export function computeCapitalFlow(
  transactions: ReadonlyArray<CashTransactionInput>,
): CapitalFlowSummary {
  let totalDeposits = 0;
  let totalWithdrawals = 0;
  let totalInterest = 0;
  let totalAdjustments = 0;

  for (const tx of transactions) {
    switch (tx.type) {
      case CASH_TRANSACTION_TYPE.DEPOSIT:
        totalDeposits += tx.amount;
        break;
      case CASH_TRANSACTION_TYPE.WITHDRAWAL:
        totalWithdrawals += tx.amount;
        break;
      case CASH_TRANSACTION_TYPE.INTEREST:
        totalInterest += tx.amount;
        break;
      case CASH_TRANSACTION_TYPE.ADJUSTMENT:
        totalAdjustments += tx.amount;
        break;
      default:
        break;
    }
  }

  const netCapitalFlow =
    totalDeposits -
    totalWithdrawals +
    totalInterest +
    totalAdjustments;

  return {
    totalDeposits,
    totalWithdrawals,
    totalInterest,
    totalAdjustments,
    netCapitalFlow,
  };
}

/**
 * Net trading profit (account-level) reconstructed from current equity.
 *
 * Net Trading Profit = Current Equity - Initial Capital - Deposits + Withdrawals
 *
 * (AGENTS.md §33). Adjustments and interest are treated as non-trading flows.
 */
export function netTradingProfitFromEquity(params: {
  currentEquity: number;
  initialCapital: number;
  totalDeposits: number;
  totalWithdrawals: number;
}): number {
  return (
    params.currentEquity -
    params.initialCapital -
    params.totalDeposits +
    params.totalWithdrawals
  );
}
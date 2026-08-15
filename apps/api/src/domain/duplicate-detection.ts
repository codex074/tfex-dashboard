/**
 * Duplicate detection (AGENTS.md §53).
 *
 * A broker transaction is considered a duplicate candidate when its
 * fingerprint matches an existing imported transaction. Fingerprint fields:
 * account, tradeDate, instrument, action, side, quantity, price, reference.
 *
 * Broker references win when available.
 */

export interface TransactionFingerprintInput {
  accountId: number;
  tradeDate: string;
  instrument: string;
  action: string;
  side: string;
  quantity: number;
  price: number; // integer points
  brokerReference?: string | null;
}

export function buildFingerprint(
  tx: TransactionFingerprintInput,
): string {
  if (tx.brokerReference) {
    return [
      tx.accountId,
      "ref",
      tx.brokerReference.trim(),
    ].join("|");
  }

  return [
    tx.accountId,
    tx.tradeDate,
    tx.instrument,
    tx.action,
    tx.side,
    tx.quantity,
    tx.price,
  ].join("|");
}
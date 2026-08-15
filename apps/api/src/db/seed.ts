import "dotenv/config";
import { migrate } from "./migrate.js";
import { getDb } from "./client.js";
import * as schema from "./schema.js";
import { eq } from "drizzle-orm";
import { computeTrade } from "../domain/trade-matching.js";

/**
 * DEMO DATA — development only (AGENTS.md §66).
 *
 * Contains no real broker information. All values are synthetic.
 */

const SATANG = 100;

function clearIfSeeded(db: ReturnType<typeof getDb>) {
  const existing = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.name, "DEMO Trading Account"))
    .get();
  if (existing) {
    // Already seeded; leave as is.
    return false;
  }
  return true;
}

export function seed() {
  const db = getDb();
  migrate();

  if (!clearIfSeeded(db)) {
    console.log("DEMO DATA already present; skipping seed.");
    return;
  }

  db.transaction((tx) => {
    const broker = tx
      .insert(schema.brokers)
      .values({ name: "Demo Broker", shortName: "DEMO" })
      .returning()
      .get();

    const account = tx
      .insert(schema.accounts)
      .values({
        name: "DEMO Trading Account",
        brokerId: broker.id,
        accountNumber: "DEMO-0001",
        accountType: "DERIVATIVES",
        currency: "THB",
        initialCapital: 0, // starting capital is recorded as a deposit below
      })
      .returning()
      .get();

    // Initial deposit
    tx.insert(schema.cashTransactions)
      .values({
        accountId: account.id,
        type: "DEPOSIT",
        transactionDate: "2026-06-01",
        amount: 50000000,
        reference: "DEMO-DEPOSIT-1",
        paymentMethod: "Demo Transfer",
      })
      .run();

    const strategies = [
      { name: "Trend Following", description: "DEMO" },
      { name: "Breakout", description: "DEMO" },
    ];
    const strategyIds = strategies.map((s) =>
      tx.insert(schema.strategies).values(s).returning().get(),
    );

    // Trade 1: Long S50, win — 2 entries, 2 closes (scale in/out)
    const open1 = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-02",
        tradeTime: "09:30",
        instrument: "S50Z26",
        side: "LONG",
        action: "OPEN",
        quantity: 1,
        price: 100000, // 1000.00
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const open2 = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-02",
        tradeTime: "10:00",
        instrument: "S50Z26",
        side: "LONG",
        action: "OPEN",
        quantity: 1,
        price: 101000, // 1010.00
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const close1 = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-03",
        tradeTime: "15:00",
        instrument: "S50Z26",
        side: "LONG",
        action: "CLOSE",
        quantity: 1,
        price: 103000, // 1030.00
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const close2 = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-03",
        tradeTime: "15:10",
        instrument: "S50Z26",
        side: "LONG",
        action: "CLOSE",
        quantity: 1,
        price: 103000,
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const trade1Txs = [open1, open2, close1, close2].map((t) => ({
      action: t.action as "OPEN" | "CLOSE",
      quantity: t.quantity,
      price: t.price,
      fees: { commission: t.commission, vat: t.vat },
    }));
    const trade1Computed = computeTrade("LONG", trade1Txs);

    const trade1 = tx
      .insert(schema.trades)
      .values({
        accountId: account.id,
        instrument: "S50Z26",
        direction: "LONG",
        openedAt: "2026-06-02",
        closedAt: "2026-06-03",
        status: trade1Computed.status,
        totalEntryQuantity: trade1Computed.totalEntryQuantity,
        totalExitQuantity: trade1Computed.totalExitQuantity,
        averageEntryPrice: trade1Computed.averageEntryPrice,
        averageExitPrice: trade1Computed.averageExitPrice,
        grossPnl: trade1Computed.grossPnl,
        totalFees: trade1Computed.totalFees,
        netPnl: trade1Computed.netPnl,
        holdingDurationSeconds: 24 * 3600,
        strategyId: strategyIds[0]?.id ?? null,
      })
      .returning()
      .get();

    for (const [index, t] of [open1, open2, close1, close2].entries()) {
      tx.insert(schema.tradeTransactions)
        .values({
          tradeId: trade1.id,
          brokerTransactionId: t.id,
          sequence: index + 1,
        })
        .run();
    }

    // Trade 2: Short S50, loss
    const shortOpen = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-05",
        tradeTime: "09:30",
        instrument: "S50Z26",
        side: "SHORT",
        action: "OPEN",
        quantity: 1,
        price: 102000,
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const shortClose = tx
      .insert(schema.brokerTransactions)
      .values({
        accountId: account.id,
        tradeDate: "2026-06-05",
        tradeTime: "16:00",
        instrument: "S50Z26",
        side: "SHORT",
        action: "CLOSE",
        quantity: 1,
        price: 103000,
        commission: 50 * SATANG,
        vat: 3.5 * SATANG,
        totalFee: 53.5 * SATANG,
      })
      .returning()
      .get();

    const trade2Computed = computeTrade("SHORT", [
      { action: "OPEN", quantity: 1, price: 102000, fees: { commission: 50 * SATANG, vat: 3.5 * SATANG } },
      { action: "CLOSE", quantity: 1, price: 103000, fees: { commission: 50 * SATANG, vat: 3.5 * SATANG } },
    ]);

    const trade2 = tx
      .insert(schema.trades)
      .values({
        accountId: account.id,
        instrument: "S50Z26",
        direction: "SHORT",
        openedAt: "2026-06-05",
        closedAt: "2026-06-05",
        status: trade2Computed.status,
        totalEntryQuantity: 1,
        totalExitQuantity: 1,
        averageEntryPrice: 102000,
        averageExitPrice: 103000,
        grossPnl: trade2Computed.grossPnl,
        totalFees: trade2Computed.totalFees,
        netPnl: trade2Computed.netPnl,
        holdingDurationSeconds: 6.5 * 3600,
        strategyId: strategyIds[1]?.id ?? null,
      })
      .returning()
      .get();

    for (const [index, t] of [shortOpen, shortClose].entries()) {
      tx.insert(schema.tradeTransactions)
        .values({
          tradeId: trade2.id,
          brokerTransactionId: t.id,
          sequence: index + 1,
        })
        .run();
    }

    // Daily snapshots (equity curve). These reconcile with realized trade
    // P/L: 500,000 + 49,786 (win) - 10,107 (loss) = 539,679.
    const snapshots = [
      { date: "2026-06-01", equity: 50000000 },
      { date: "2026-06-02", equity: 50000000 },
      { date: "2026-06-03", equity: 54978600 },
      { date: "2026-06-04", equity: 54978600 },
      { date: "2026-06-05", equity: 53967900 },
    ];
    for (const s of snapshots) {
      tx.insert(schema.dailyAccountSnapshots)
        .values({
          accountId: account.id,
          snapshotDate: s.date,
          cashBalance: s.equity,
          equityBalance: s.equity,
          source: "MANUAL",
        })
        .run();
    }

    console.log("DEMO DATA seeded successfully.");
  });
}

seed();
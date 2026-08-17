import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

describe("dashboard summary after closing a position", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    const { buildApp } = await import("../../server.js");
    app = buildApp({ disableAuth: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("includes the calculated P/L of a dashboard position close", async () => {
    const account = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Test account", initialCapital: "10000" },
    });
    const accountId = account.json().data.id as number;

    await app.inject({
      method: "POST",
      url: "/api/instrument-contract-specs",
      payload: {
        instrumentFamily: "S50",
        multiplier: "200",
        tickSize: "0.10",
        effectiveDate: "2026-01-01",
      },
    });
    const broker = await app.inject({
      method: "POST",
      url: "/api/brokers",
      payload: { name: "Test broker", shortName: "TB" },
    });
    const brokerId = broker.json().data.id as number;
    await app.inject({
      method: "POST",
      url: "/api/broker-contract-terms",
      payload: {
        brokerId,
        instrumentFamily: "S50",
        initialMargin: "50000",
        maintenanceMargin: "40000",
        commission: "25",
        tradingFee: "2",
        clearingFee: "1",
        regulatoryFee: "0",
        vat: "0",
        otherFee: "0",
        effectiveDate: "2026-01-01",
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/snapshots",
      payload: {
        accountId,
        snapshotDate: "2026-08-15",
        cashBalance: "10000",
        equityBalance: "10000",
      },
    });
    const opened = await app.inject({
      method: "POST",
      url: "/api/trades/open-position",
      payload: {
        accountId,
        instrument: "S50U26",
        instrumentFamily: "S50",
        side: "LONG",
        brokerId,
        quantity: 1,
        price: "1000",
        tradeDate: "2026-08-16",
      },
    });

    const transactionWithFees = await app.inject({
      method: "GET",
      url: `/api/transactions?accountId=${accountId}`,
    });
    expect(transactionWithFees.json().data[0].commission).toBe("25.00");
    expect(transactionWithFees.json().data[0].tradingFee).toBe("2.00");
    const openPositionSummary = await app.inject({
      method: "GET",
      url: `/api/dashboard/summary?accountId=${accountId}`,
    });
    expect(openPositionSummary.json().data.totalFees).toBe("28.00");

    const marked = await app.inject({
      method: "POST",
      url: "/api/positions/mark-price",
      payload: {
        accountId,
        instrument: "S50U26",
        direction: "LONG",
        marketPrice: "1010",
      },
    });
    expect(marked.statusCode).toBe(200);
    expect(marked.json().data.unrealizedPnl).toBe("2000.00");
    expect(marked.json().data.marginUsed).toBe("50000.00");

    const markedAccount = await app.inject({
      method: "GET",
      url: `/api/accounts/${accountId}`,
    });
    // Equity is free cash + locked initial margin + the current mark-to-market P/L.
    expect(markedAccount.json().data.equityBalance).toBe("62000.00");
    expect(markedAccount.json().data.unrealizedPnl).toBe("2000.00");

    const markedTrades = await app.inject({
      method: "GET",
      url: `/api/trades?accountId=${accountId}`,
    });
    expect(markedTrades.json().data[0].unrealizedPnl).toBe("2000.00");

    await app.inject({
      method: "POST",
      url: `/api/trades/${opened.json().data.id as number}/close-position`,
      payload: { tradeDate: "2026-08-16", price: "1010" },
    });
    const closedTrades = await app.inject({
      method: "GET",
      url: `/api/trades?accountId=${accountId}`,
    });
    expect(closedTrades.json().data[0].holdingDays).toBe(1);
    const summary = await app.inject({
      method: "GET",
      url: `/api/dashboard/summary?accountId=${accountId}`,
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json().data.netTradingPnl).toBe("1944.00");
    expect(summary.json().data.totalFees).toBe("56.00");

    const transactionsAfterClose = await app.inject({
      method: "GET",
      url: `/api/transactions?accountId=${accountId}`,
    });
    const closing = transactionsAfterClose
      .json()
      .data.find((tx: { action: string }) => tx.action === "CLOSE") as {
      commission: string;
      tradingFee: string;
    };
    expect(closing.commission).toBe("25.00");
    expect(closing.tradingFee).toBe("2.00");

    const openingTransaction = await app.inject({
      method: "GET",
      url: `/api/transactions?accountId=${accountId}`,
    });
    const opening = openingTransaction
      .json()
      .data.find((tx: { action: string }) => tx.action === "OPEN") as { id: number };
    await app.inject({
      method: "PATCH",
      url: `/api/transactions/${opening.id}`,
      payload: { price: "1005" },
    });
    const correctedSummary = await app.inject({
      method: "GET",
      url: `/api/dashboard/summary?accountId=${accountId}`,
    });
    expect(correctedSummary.json().data.netTradingPnl).toBe("944.00");
  });

  it("starts an equity curve at the first deposit when no broker snapshot exists", async () => {
    const account = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Deposit-only account", initialCapital: "0" },
    });
    const accountId = account.json().data.id as number;

    await app.inject({
      method: "POST",
      url: "/api/cash-transactions",
      payload: { accountId, type: "DEPOSIT", transactionDate: "2026-07-16", amount: "20000" },
    });
    await app.inject({
      method: "POST",
      url: "/api/cash-transactions",
      payload: { accountId, type: "DEPOSIT", transactionDate: "2026-07-31", amount: "5000" },
    });

    const curve = await app.inject({
      method: "GET",
      url: `/api/dashboard/equity?accountId=${accountId}`,
    });

    expect(curve.statusCode).toBe(200);
    expect(curve.json().data.points[0]).toEqual(
      expect.objectContaining({ date: "2026-07-16", equity: "20000.00" }),
    );
    expect(curve.json().data.points.at(-1)).toEqual(
      expect.objectContaining({ equity: "25000.00" }),
    );
  });

  it("adds realized P/L on the contract close date when reconstructing an equity curve", async () => {
    const broker = await app.inject({
      method: "POST",
      url: "/api/brokers",
      payload: { name: "Reconstruction broker", shortName: "RB" },
    });
    const brokerId = broker.json().data.id as number;
    await app.inject({
      method: "POST",
      url: "/api/broker-contract-terms",
      payload: {
        brokerId, instrumentFamily: "S50", initialMargin: "50000", maintenanceMargin: "40000",
        commission: "0", tradingFee: "0", clearingFee: "0", regulatoryFee: "0", vat: "0", otherFee: "0",
        effectiveDate: "2026-01-01",
      },
    });
    const account = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Reconstructed curve", brokerId, initialCapital: "0" },
    });
    const accountId = account.json().data.id as number;
    await app.inject({
      method: "POST",
      url: "/api/cash-transactions",
      payload: { accountId, type: "DEPOSIT", transactionDate: "2026-07-16", amount: "20000" },
    });
    const opened = await app.inject({
      method: "POST",
      url: "/api/trades/open-position",
      payload: { accountId, instrument: "S50U26", instrumentFamily: "S50", side: "LONG", quantity: 1, price: "1000", tradeDate: "2026-07-20" },
    });
    await app.inject({
      method: "POST",
      url: `/api/trades/${opened.json().data.id as number}/close-position`,
      payload: { tradeDate: "2026-07-21", price: "1010", totalFee: "0" },
    });

    const curve = await app.inject({ method: "GET", url: `/api/dashboard/equity?accountId=${accountId}` });
    expect(curve.json().data.points).toContainEqual(
      expect.objectContaining({ date: "2026-07-21", equity: "22000.00" }),
    );
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import * as schema from "../../db/schema.js";

describe("account soft-delete and restore", () => {
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

  it("keeps a deleted account recoverable and hides it from the live list", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Account 001", accountNumber: "001", initialCapital: "100000" },
    });
    const accountId = created.json().data.id as number;

    // Multiple accounts are supported.
    const second = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Account 002", accountNumber: "002", initialCapital: "50000" },
    });
    const secondId = second.json().data.id as number;

    const live = await app.inject({ method: "GET", url: "/api/accounts" });
    expect(live.json().data.map((a: { id: number }) => a.id)).toEqual(
      expect.arrayContaining([accountId, secondId]),
    );

    // Soft delete the first account.
    const deleted = await app.inject({ method: "DELETE", url: `/api/accounts/${accountId}` });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json().data.deletedAt).toBeTruthy();

    // It disappears from the live list but remains listed as deleted.
    const liveAfter = await app.inject({ method: "GET", url: "/api/accounts" });
    expect(liveAfter.json().data.map((a: { id: number }) => a.id)).not.toContain(accountId);
    expect(liveAfter.json().data.map((a: { id: number }) => a.id)).toContain(secondId);

    const deletedList = await app.inject({ method: "GET", url: "/api/accounts/deleted" });
    expect(deletedList.json().data.map((a: { id: number }) => a.id)).toContain(accountId);

    // It can no longer be retrieved as a live account.
    const summary = await app.inject({ method: "GET", url: `/api/accounts/${accountId}` });
    expect(summary.statusCode).toBe(404);

    // Restore it within the grace window.
    const restored = await app.inject({ method: "POST", url: `/api/accounts/${accountId}/restore` });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().data.deletedAt).toBeNull();

    const liveRestored = await app.inject({ method: "GET", url: "/api/accounts" });
    expect(liveRestored.json().data.map((a: { id: number }) => a.id)).toContain(accountId);
  });

  it("rejects restores after the grace window and purges the row", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/accounts",
      payload: { name: "Expiring account", initialCapital: "0" },
    });
    const accountId = created.json().data.id as number;

    await app.inject({ method: "DELETE", url: `/api/accounts/${accountId}` });

    // Backdate the soft-delete marker beyond the 24h window.
    const db = getDb();
    const backdated = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    db.update(schema.accounts)
      .set({ deletedAt: backdated })
      .where(eq(schema.accounts.id, accountId))
      .run();

    const restored = await app.inject({ method: "POST", url: `/api/accounts/${accountId}/restore` });
    expect(restored.statusCode).toBe(409);

    // Listing deleted accounts triggers the lazy purge, removing the expired row.
    const deletedList = await app.inject({ method: "GET", url: "/api/accounts/deleted" });
    expect(deletedList.json().data.map((a: { id: number }) => a.id)).not.toContain(accountId);

    const remaining = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).all();
    expect(remaining).toHaveLength(0);
  });
});
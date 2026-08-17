import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

describe("membership roles and user defaults", () => {
  let app: FastifyInstance;
  let adminToken = "";
  let userToken = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    const { buildApp } = await import("../../server.js");
    app = buildApp();
    await app.ready();
    const bootstrap = await app.inject({ method: "POST", url: "/api/auth/bootstrap", payload: { displayName: "Admin", email: "admin@example.com", password: "password123" } });
    adminToken = bootstrap.json().data.token as string;
    await app.inject({ method: "POST", url: "/api/admin/users", headers: { authorization: `Bearer ${adminToken}` }, payload: { displayName: "Trader", email: "trader@example.com", password: "password123", role: "USER" } });
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "trader@example.com", password: "password123" } });
    userToken = login.json().data.token as string;
  });

  afterAll(async () => { await app.close(); });

  it("allows Admin to maintain brokers and instruments but rejects User", async () => {
    const broker = await app.inject({ method: "POST", url: "/api/brokers", headers: { authorization: `Bearer ${adminToken}` }, payload: { name: "Demo Broker", shortName: "DB" } });
    const instrument = await app.inject({ method: "POST", url: "/api/instruments", headers: { authorization: `Bearer ${adminToken}` }, payload: { code: "S50", name: "SET50 Index Futures" } });
    expect(broker.statusCode).toBe(200);
    expect(instrument.statusCode).toBe(200);
    const forbidden = await app.inject({ method: "POST", url: "/api/brokers", headers: { authorization: `Bearer ${userToken}` }, payload: { name: "No", shortName: "NO" } });
    expect(forbidden.statusCode).toBe(403);
  });

  it("stores multiple broker and instrument defaults for the current User", async () => {
    const broker2 = await app.inject({ method: "POST", url: "/api/brokers", headers: { authorization: `Bearer ${adminToken}` }, payload: { name: "Second Broker", shortName: "SB" } });
    const go = await app.inject({ method: "POST", url: "/api/instruments", headers: { authorization: `Bearer ${adminToken}` }, payload: { code: "GO", name: "Gold Online Futures" } });
    const brokers = (await app.inject({ method: "GET", url: "/api/brokers", headers: { authorization: `Bearer ${userToken}` } })).json().data as { id: number }[];
    const instruments = (await app.inject({ method: "GET", url: "/api/instruments", headers: { authorization: `Bearer ${userToken}` } })).json().data as { id: number }[];
    const saved = await app.inject({ method: "PUT", url: "/api/me/preferences", headers: { authorization: `Bearer ${userToken}` }, payload: { brokerIds: [...brokers.map((x) => x.id), broker2.json().data.id], instrumentIds: [...instruments.map((x) => x.id), go.json().data.id] } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data.brokers.length).toBeGreaterThanOrEqual(2);
    expect(saved.json().data.instruments.length).toBeGreaterThanOrEqual(2);
  });

  it("prevents a User from reading another member's trading account", async () => {
    const account = await app.inject({ method: "POST", url: "/api/accounts", headers: { authorization: `Bearer ${adminToken}` }, payload: { name: "Admin account", initialCapital: "1000" } });
    const response = await app.inject({ method: "GET", url: `/api/dashboard/summary?accountId=${account.json().data.id as number}`, headers: { authorization: `Bearer ${userToken}` } });
    expect(response.statusCode).toBe(403);
  });
});

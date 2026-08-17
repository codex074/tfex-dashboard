import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";

describe("self-registration and admin activation", () => {
  let app: FastifyInstance;
  let adminToken = "";
  let memberToken = "";

  beforeAll(async () => {
    process.env.DATABASE_URL = ":memory:";
    const { buildApp } = await import("../../server.js");
    app = buildApp();
    await app.ready();
    const bootstrap = await app.inject({ method: "POST", url: "/api/auth/bootstrap", payload: { displayName: "Admin", email: "admin2@example.com", password: "password123" } });
    adminToken = bootstrap.json().data.token as string;
    await app.inject({ method: "POST", url: "/api/admin/users", headers: { authorization: `Bearer ${adminToken}` }, payload: { displayName: "Member", email: "member@example.com", password: "password123", role: "USER" } });
    const memberLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "member@example.com", password: "password123" } });
    memberToken = memberLogin.json().data.token as string;
  });

  afterAll(async () => { await app.close(); });

  it("rejects registration when password and confirmPassword do not match", async () => {
    const response = await app.inject({ method: "POST", url: "/api/auth/register", payload: { displayName: "New Trader", email: "mismatch@example.com", password: "password123", confirmPassword: "different123" } });
    expect(response.statusCode).toBe(400);
  });

  it("registers a new user as inactive and blocks login until an admin activates them", async () => {
    const register = await app.inject({ method: "POST", url: "/api/auth/register", payload: { displayName: "New Trader", email: "newtrader@example.com", password: "password123", confirmPassword: "password123" } });
    expect(register.statusCode).toBe(200);
    expect(register.json().data.isActive).toBe(false);

    const blockedLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "newtrader@example.com", password: "password123" } });
    expect(blockedLogin.statusCode).toBe(401);

    const unauthenticatedActivate = await app.inject({ method: "PATCH", url: `/api/admin/users/${register.json().data.id as number}`, payload: { isActive: true } });
    expect(unauthenticatedActivate.statusCode).toBe(401);

    const nonAdminActivate = await app.inject({ method: "PATCH", url: `/api/admin/users/${register.json().data.id as number}`, headers: { authorization: `Bearer ${memberToken}` }, payload: { isActive: true } });
    expect(nonAdminActivate.statusCode).toBe(403);

    const activate = await app.inject({ method: "PATCH", url: `/api/admin/users/${register.json().data.id as number}`, headers: { authorization: `Bearer ${adminToken}` }, payload: { isActive: true } });
    expect(activate.statusCode).toBe(200);
    expect(activate.json().data.isActive).toBe(true);

    const allowedLogin = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email: "newtrader@example.com", password: "password123" } });
    expect(allowedLogin.statusCode).toBe(200);
  });

  it("rate-limits repeated registration attempts from the same IP", async () => {
    let last;
    for (let i = 0; i < 6; i++) {
      last = await app.inject({ method: "POST", url: "/api/auth/register", payload: { displayName: "Spammer", email: `spammer${i}@example.com`, password: "password123", confirmPassword: "password123" } });
    }
    expect(last!.statusCode).toBe(429);
  });
});

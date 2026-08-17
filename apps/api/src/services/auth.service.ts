import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, asc, eq, gt, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { errors } from "../lib/errors.js";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: number;
  email: string;
  displayName: string;
  role: "ADMIN" | "USER";
  isActive: boolean;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function userCount(db: Db): number {
  return db.select({ id: schema.users.id }).from(schema.users).all().length;
}

export function createUser(db: Db, input: { email: string; displayName: string; password: string; role: "ADMIN" | "USER"; isActive?: boolean }) {
  const existing = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, input.email)).get();
  if (existing) throw errors.conflict("Email is already registered");
  return db.insert(schema.users).values({
    email: input.email,
    displayName: input.displayName,
    passwordHash: hashPassword(input.password),
    role: input.role,
    isActive: input.isActive ?? true,
  }).returning().get();
}

export function setUserActive(db: Db, userId: number, isActive: boolean) {
  const user = db.update(schema.users).set({ isActive }).where(eq(schema.users.id, userId)).returning().get();
  if (!user) throw errors.notFound("User");
  return toUserDto(user);
}

/**
 * Update mutable user fields (admin-only). Refuses to demote/deactivate the
 * last active administrator so an admin cannot accidentally lock every
 * administrator out of the system (including themselves).
 */
export function updateUser(
  db: Db,
  userId: number,
  input: { displayName?: string; role?: "ADMIN" | "USER"; isActive?: boolean },
) {
  const target = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (!target) throw errors.notFound("User");

  const nextRole = input.role ?? (target.role === "ADMIN" ? "ADMIN" : "USER");
  const nextActive = input.isActive ?? target.isActive;

  const removingActiveAdmin =
    target.role === "ADMIN" &&
    target.isActive &&
    (nextRole !== "ADMIN" || !nextActive);

  if (removingActiveAdmin) {
    const activeAdmins = db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.role, "ADMIN"), eq(schema.users.isActive, true)))
      .all().length;
    if (activeAdmins <= 1) {
      throw errors.validation("Cannot deactivate or demote the last active administrator");
    }
  }

  const updated = db
    .update(schema.users)
    .set({
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    })
    .where(eq(schema.users.id, userId))
    .returning()
    .get();
  if (!updated) throw errors.notFound("User");
  return toUserDto(updated);
}

export function createSession(db: Db, email: string, password: string) {
  const user = db.select().from(schema.users).where(eq(schema.users.email, email)).get();
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    throw errors.unauthorized("Invalid email or password");
  }
  const token = randomBytes(32).toString("base64url");
  db.insert(schema.authSessions).values({
    userId: user.id,
    tokenHash: tokenHash(token),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
  }).run();
  return { token, user: toUserDto(user) };
}

export function getUserByToken(db: Db, token: string): AuthUser | undefined {
  const now = new Date().toISOString();
  const row = db.select({ user: schema.users }).from(schema.authSessions)
    .innerJoin(schema.users, eq(schema.authSessions.userId, schema.users.id))
    .where(and(eq(schema.authSessions.tokenHash, tokenHash(token)), gt(schema.authSessions.expiresAt, now), eq(schema.users.isActive, true)))
    .get();
  return row ? toUserDto(row.user) : undefined;
}

export function deleteSession(db: Db, token: string): void {
  db.delete(schema.authSessions).where(eq(schema.authSessions.tokenHash, tokenHash(token))).run();
}

export function listUsers(db: Db) {
  return db.select().from(schema.users).orderBy(asc(schema.users.displayName)).all().map(toUserDto);
}

export function getUserPreferences(db: Db, userId: number) {
  const brokers = db.select({ broker: schema.brokers }).from(schema.userBrokers)
    .innerJoin(schema.brokers, eq(schema.userBrokers.brokerId, schema.brokers.id))
    .where(eq(schema.userBrokers.userId, userId)).orderBy(asc(schema.brokers.name)).all().map((row) => row.broker);
  const instruments = db.select({ instrument: schema.instruments }).from(schema.userInstruments)
    .innerJoin(schema.instruments, eq(schema.userInstruments.instrumentId, schema.instruments.id))
    .where(eq(schema.userInstruments.userId, userId)).orderBy(asc(schema.instruments.code)).all().map((row) => row.instrument);
  return { brokers, instruments };
}

export function updateUserPreferences(db: Db, userId: number, brokerIds: number[], instrumentIds: number[]) {
  const uniqueBrokerIds = [...new Set(brokerIds)];
  const uniqueInstrumentIds = [...new Set(instrumentIds)];
  if (uniqueBrokerIds.length > 0) {
    const found = db.select({ id: schema.brokers.id }).from(schema.brokers).where(inArray(schema.brokers.id, uniqueBrokerIds)).all();
    if (found.length !== uniqueBrokerIds.length) throw errors.validation("One or more brokers do not exist");
  }
  if (uniqueInstrumentIds.length > 0) {
    const found = db.select({ id: schema.instruments.id }).from(schema.instruments).where(inArray(schema.instruments.id, uniqueInstrumentIds)).all();
    if (found.length !== uniqueInstrumentIds.length) throw errors.validation("One or more instruments do not exist");
  }
  db.transaction((tx) => {
    tx.delete(schema.userBrokers).where(eq(schema.userBrokers.userId, userId)).run();
    tx.delete(schema.userInstruments).where(eq(schema.userInstruments.userId, userId)).run();
    if (uniqueBrokerIds.length > 0) tx.insert(schema.userBrokers).values(uniqueBrokerIds.map((brokerId) => ({ userId, brokerId }))).run();
    if (uniqueInstrumentIds.length > 0) tx.insert(schema.userInstruments).values(uniqueInstrumentIds.map((instrumentId) => ({ userId, instrumentId }))).run();
  });
  return getUserPreferences(db, userId);
}

export function toUserDto(user: schema.User): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role === "ADMIN" ? "ADMIN" : "USER", isActive: user.isActive };
}

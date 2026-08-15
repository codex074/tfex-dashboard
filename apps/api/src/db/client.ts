import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

let db: BetterSQLite3Database<typeof schema> | undefined;

export function getConnectionUrl(): string {
  return process.env.DATABASE_URL ?? "./data/tfex.db";
}

export function resolveDbPath(url: string): string {
  if (url === ":memory:") {
    return ":memory:";
  }
  if (url.startsWith("file:")) {
    return url.slice("file:".length);
  }
  return url;
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db) {
    return db;
  }
  const url = getConnectionUrl();
  const dbPath = resolveDbPath(url);
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  return db;
}

/** Build an in-memory database. Used by tests and seed tooling. */
export function createMemoryDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = BetterSQLite3Database<typeof schema>;
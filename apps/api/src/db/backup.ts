import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConnectionUrl, resolveDbPath } from "./client.js";

/**
 * Safe SQLite backup using the online backup API (AGENTS.md §75).
 * Handles WAL mode correctly.
 */

function main() {
  const dbPath = resolveDbPath(getConnectionUrl());
  if (dbPath === ":memory:") {
    console.error("Cannot back up an in-memory database.");
    process.exit(1);
  }

  const source = new Database(dbPath, { readonly: true });
  const backupsDir = path.resolve("backups");
  fs.mkdirSync(backupsDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const targetPath = path.join(backupsDir, `tfex-${date}.db`);

  source
    .backup(targetPath)
    .then(() => {
      console.log(`Backup written to ${targetPath}`);
    })
    .catch((err) => {
      console.error("Backup failed", err);
      process.exitCode = 1;
    })
    .finally(() => {
      source.close();
    });
}

main();
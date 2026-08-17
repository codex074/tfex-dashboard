import "dotenv/config";
import { eq } from "drizzle-orm";
import { migrate } from "./migrate.js";
import { getDb } from "./client.js";
import * as schema from "./schema.js";

/**
 * REFERENCE MARKET DATA — TFEX brokers, instrument families, and exchange
 * contract terms (AGENTS.md §16-17, §101).
 *
 * Sourcing (authoritative, not third-party write-ups):
 *   - 36 Full License TFEX brokers — TFEX Participants > Member List
 *     https://www.tfex.co.th/en/market-data/participants/member-list
 *     ("TFEX has 36 Full License Members (Data as of May 15, 2025)")
 *   - Contract multiplier / tick size — TFEX contract-specification pages
 *     https://www.tfex.co.th/en/products/<group>/<product>/contract-specification
 *   - Margin rates — Thailand Clearing House (TCH) under set.or.th. These are
 *     published as % of contract value and re-based daily from settlement
 *     prices, so they are intentionally left NULL below and must be entered by
 *     the Admin from the TCH "Margin Rate" page / notice PDF.
 *   - Broker commission — broker-specific and not published by TFEX. Where a
 *     broker does not publish a public rate, commission is left 0 (unknown),
 *     never guessed (§54 Data Integrity).
 *
 * Effective leverage is derived, not stored: 10_000 / initialMarginRateBps.
 */

/** Contract multiplier expressed as integer satang per point. */
const THB_PER_POINT = 100;

interface InstrumentSeed {
  code: string;
  name: string;
  family: string;
  multiplierSatangPerPoint: number;
  tickSizePoints: number;
}

/** Exchange contract terms — multiplier & tick from TFEX contract specs. */
const INSTRUMENTS: InstrumentSeed[] = [
  { code: "S50", name: "SET50 Index Futures", family: "S50", multiplierSatangPerPoint: 200 * THB_PER_POINT, tickSizePoints: 10 },
  { code: "S50O", name: "SET50 Index Options", family: "S50O", multiplierSatangPerPoint: 200 * THB_PER_POINT, tickSizePoints: 10 },
  { code: "SSF", name: "Single Stock Futures", family: "SSF", multiplierSatangPerPoint: 1000 * THB_PER_POINT, tickSizePoints: 1 },
  { code: "GF", name: "Gold Futures", family: "GF", multiplierSatangPerPoint: 0, tickSizePoints: 1000 },
  { code: "GO", name: "Gold Online Futures", family: "GO", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
  { code: "SILVER", name: "Silver Online Futures", family: "SILVER", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
  { code: "GD", name: "Gold-D", family: "GD", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
  { code: "USD", name: "USD Futures", family: "USD", multiplierSatangPerPoint: 1000 * THB_PER_POINT, tickSizePoints: 1 },
  { code: "USDJPY", name: "USD/JPY Futures", family: "USDJPY", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
  { code: "EURUSD", name: "EUR/USD Futures", family: "EURUSD", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
  { code: "EURTHB", name: "EUR/THB Futures", family: "EURTHB", multiplierSatangPerPoint: 1000 * THB_PER_POINT, tickSizePoints: 1 },
  { code: "JPYTHB", name: "JPY/THB Futures", family: "JPYTHB", multiplierSatangPerPoint: 1000 * THB_PER_POINT, tickSizePoints: 1 },
  { code: "TGB5", name: "5Y Government Bond Futures", family: "TGB5", multiplierSatangPerPoint: 0, tickSizePoints: 1 },
  { code: "RSS3", name: "RSS3 Futures", family: "RSS3", multiplierSatangPerPoint: 0, tickSizePoints: 5 },
  { code: "RSS3D", name: "RSS3D Futures", family: "RSS3D", multiplierSatangPerPoint: 0, tickSizePoints: 5 },
  { code: "JRF", name: "Japanese Rubber Futures", family: "JRF", multiplierSatangPerPoint: 0, tickSizePoints: 0 },
];

interface BrokerSeed {
  shortName: string;
  name: string;
}

/** 36 Full License TFEX members (TFEX Member List, as of May 15 2025). */
const BROKERS: BrokerSeed[] = [
  { shortName: "AIRA", name: "Aira Securities Public Company Limited" },
  { shortName: "ASL", name: "ASL Securities Company Limited" },
  { shortName: "ASPS", name: "Asia Plus Securities Company Limited" },
  { shortName: "BLS", name: "Bualuang Securities Public Company Limited" },
  { shortName: "BYD", name: "Beyond Securities Public Company Limited" },
  { shortName: "CAF", name: "Classic Ausiris Investment Advisory Securities Co., Ltd." },
  { shortName: "CGSI", name: "CGS International Securities (Thailand) Company Limited" },
  { shortName: "CLSAT", name: "CLSA Securities (Thailand) Limited" },
  { shortName: "DAOLSEC", name: "DAOL Securities (Thailand) Public Company Limited" },
  { shortName: "DBSV", name: "DBS Vickers Securities (Thailand) Company Limited" },
  { shortName: "FSS", name: "Finansia Syrus Securities Public Company Limited" },
  { shortName: "GBS", name: "Globlex Securities Company Limited" },
  { shortName: "HGF", name: "Hua Seng Heng Gold Futures Co., Ltd." },
  { shortName: "INVX", name: "InnovestX Securities Co., Ltd." },
  { shortName: "IVG", name: "I V Global Securities Public Company Limited" },
  { shortName: "JPM", name: "JPMorgan Securities (Thailand) Limited" },
  { shortName: "KGI", name: "KGI Securities (Thailand) Public Company Limited" },
  { shortName: "KINGSFORD", name: "Kingsford Securities Public Company Limited" },
  { shortName: "KKPS", name: "Kiatnakin Phatra Securities Public Company Limited" },
  { shortName: "KS", name: "Kasikorn Securities Public Company Limited" },
  { shortName: "KSS", name: "Krungsri Securities Public Company Limited" },
  { shortName: "KTX", name: "Krungthai XSpring Securities Company Limited" },
  { shortName: "LHS", name: "Land and Houses Securities Public Company Limited" },
  { shortName: "LIB", name: "Liberator Securities Company Limited" },
  { shortName: "MST", name: "Maybank Securities (Thailand) Public Company Limited" },
  { shortName: "MTSGF", name: "MTS Capital Co., Ltd." },
  { shortName: "PI", name: "PI Securities Public Company Limited" },
  { shortName: "PST", name: "Phillip Securities (Thailand) Public Company Limited" },
  { shortName: "SBITO", name: "SBI Thai Online Securities Company Limited" },
  { shortName: "TISCO", name: "Tisco Securities Company Limited" },
  { shortName: "TNITY", name: "Trinity Securities Company Limited" },
  { shortName: "TTBWEALTH", name: "TTB Wealth Securities Public Company Limited" },
  { shortName: "UBS", name: "UBS Securities (Thailand) Limited" },
  { shortName: "UOBKH", name: "UOB Kay Hian Securities (Thailand) Public Company Limited" },
  { shortName: "YLG", name: "YLG Bullion & Futures Co., Ltd." },
  { shortName: "YUANTA", name: "Yuanta Securities (Thailand) Company Limited" },
];

const EFFECTIVE_DATE = "2025-05-15";

function upsertInstrument(db: ReturnType<typeof getDb>, row: InstrumentSeed) {
  const existing = db
    .select({ id: schema.instruments.id })
    .from(schema.instruments)
    .where(eq(schema.instruments.code, row.code))
    .get();
  if (existing) return existing.id;

  return (
    db
      .insert(schema.instruments)
      .values({ code: row.code, name: row.name })
      .returning()
      .get().id
  );
}

function upsertBroker(db: ReturnType<typeof getDb>, row: BrokerSeed) {
  const existing = db
    .select({ id: schema.brokers.id })
    .from(schema.brokers)
    .where(eq(schema.brokers.shortName, row.shortName))
    .get();
  if (existing) return existing.id;

  return (
    db
      .insert(schema.brokers)
      .values({ shortName: row.shortName, name: row.name })
      .returning()
      .get().id
  );
}

function upsertContractSpec(db: ReturnType<typeof getDb>, row: InstrumentSeed) {
  const existing = db
    .select({ id: schema.instrumentContractSpecs.id })
    .from(schema.instrumentContractSpecs)
    .where(eq(schema.instrumentContractSpecs.instrumentFamily, row.family))
    .get();
  if (existing) return existing.id;

  return (
    db
      .insert(schema.instrumentContractSpecs)
      .values({
        instrumentFamily: row.family,
        multiplierSatangPerPoint: row.multiplierSatangPerPoint,
        tickSizePoints: row.tickSizePoints,
        initialMarginRateBps: null,
        maintenanceMarginRateBps: null,
        effectiveDate: EFFECTIVE_DATE,
      })
      .returning()
      .get().id
  );
}

export function seedReference() {
  const db = getDb();
  migrate();

  db.transaction((tx) => {
    for (const row of BROKERS) {
      upsertBroker(tx, row);
    }
    for (const row of INSTRUMENTS) {
      upsertInstrument(tx, row);
      upsertContractSpec(tx, row);
    }
  });

  console.log(
    `REFERENCE MARKET DATA seeded: ${BROKERS.length} brokers, ${INSTRUMENTS.length} instrument families.`,
  );
  console.log(
    "NOTE: margin rates (initial/maintenance) and per-broker commission are left empty by design — complete them from TCH and each broker's official fee schedule.",
  );
}

seedReference();
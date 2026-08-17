import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import type { NewBroker, NewInstrument, NewStrategy, NewTag } from "../db/schema.js";
import { parseBps, parseMoneyOrZero, parsePriceOrZero } from "../lib/parse.js";
import { bpsToPercentString, money, price } from "../lib/serialize.js";
import { errors } from "../lib/errors.js";

/** Broker, strategy and tag management (AGENTS.md §16-17, §27-28). */

export function createBroker(db: Db, input: NewBroker) {
  return db.insert(schema.brokers).values(input).returning().get();
}

export function listBrokers(db: Db) {
  return db.select().from(schema.brokers).orderBy(asc(schema.brokers.name)).all();
}

export function createInstrument(db: Db, input: NewInstrument) {
  const existing = db.select().from(schema.instruments).where(eq(schema.instruments.code, input.code)).get();
  if (existing) throw errors.conflict(`Instrument ${input.code} already exists`);
  return db.insert(schema.instruments).values(input).returning().get();
}

export function listInstruments(db: Db) {
  return db.select().from(schema.instruments).orderBy(asc(schema.instruments.code)).all();
}

export function toInstrumentDto(row: schema.Instrument) {
  return { id: row.id, code: row.code, name: row.name, isActive: row.isActive, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export function createInstrumentContractSpec(db: Db, input: { instrumentFamily: string; multiplier: string; tickSize: string; initialMarginRate?: string | null; maintenanceMarginRate?: string | null; effectiveDate: string }) {
  return db.insert(schema.instrumentContractSpecs).values({
    instrumentFamily: input.instrumentFamily,
    multiplierSatangPerPoint: parseMoneyOrZero(input.multiplier),
    tickSizePoints: parsePriceOrZero(input.tickSize),
    initialMarginRateBps: parseBps(input.initialMarginRate),
    maintenanceMarginRateBps: parseBps(input.maintenanceMarginRate),
    effectiveDate: input.effectiveDate,
  }).returning().get();
}

export function listInstrumentContractSpecs(db: Db) { return db.select().from(schema.instrumentContractSpecs).orderBy(asc(schema.instrumentContractSpecs.instrumentFamily), asc(schema.instrumentContractSpecs.effectiveDate)).all(); }

export function createBrokerContractTerm(db: Db, input: { brokerId: number; instrumentFamily: string; initialMargin: string; maintenanceMargin: string; commission: string; tradingFee: string; clearingFee: string; regulatoryFee: string; vat: string; otherFee: string; effectiveDate: string }) {
  return db.insert(schema.brokerContractTerms).values({ brokerId: input.brokerId, instrumentFamily: input.instrumentFamily, initialMargin: parseMoneyOrZero(input.initialMargin), maintenanceMargin: parseMoneyOrZero(input.maintenanceMargin), commission: parseMoneyOrZero(input.commission), tradingFee: parseMoneyOrZero(input.tradingFee), clearingFee: parseMoneyOrZero(input.clearingFee), regulatoryFee: parseMoneyOrZero(input.regulatoryFee), vat: parseMoneyOrZero(input.vat), otherFee: parseMoneyOrZero(input.otherFee), effectiveDate: input.effectiveDate }).returning().get();
}

export function listBrokerContractTerms(db: Db) { return db.select().from(schema.brokerContractTerms).orderBy(asc(schema.brokerContractTerms.instrumentFamily), asc(schema.brokerContractTerms.effectiveDate)).all(); }

export function toInstrumentContractSpecDto(row: schema.InstrumentContractSpec) { return { id: row.id, instrumentFamily: row.instrumentFamily, multiplier: money(row.multiplierSatangPerPoint) ?? "0", tickSize: price(row.tickSizePoints) ?? "0", initialMarginRate: bpsToPercentString(row.initialMarginRateBps), maintenanceMarginRate: bpsToPercentString(row.maintenanceMarginRateBps), effectiveDate: row.effectiveDate, isActive: row.isActive }; }
export function toBrokerContractTermDto(row: schema.BrokerContractTerm) { return { id: row.id, brokerId: row.brokerId, instrumentFamily: row.instrumentFamily, initialMargin: money(row.initialMargin) ?? "0", maintenanceMargin: money(row.maintenanceMargin) ?? "0", commission: money(row.commission) ?? "0", tradingFee: money(row.tradingFee) ?? "0", clearingFee: money(row.clearingFee) ?? "0", regulatoryFee: money(row.regulatoryFee) ?? "0", vat: money(row.vat) ?? "0", otherFee: money(row.otherFee) ?? "0", effectiveDate: row.effectiveDate, isActive: row.isActive }; }

export function createStrategy(db: Db, input: NewStrategy) {
  return db.insert(schema.strategies).values(input).returning().get();
}

export function listStrategies(db: Db) {
  return db
    .select()
    .from(schema.strategies)
    .orderBy(asc(schema.strategies.name))
    .all();
}

export function createTag(db: Db, input: NewTag) {
  const existing = db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.name, input.name))
    .get();
  if (existing) {
    return existing;
  }
  return db.insert(schema.tags).values(input).returning().get();
}

export function listTags(db: Db) {
  return db.select().from(schema.tags).orderBy(asc(schema.tags.name)).all();
}

export function toBrokerDto(broker: schema.Broker) {
  return {
    id: broker.id,
    name: broker.name,
    shortName: broker.shortName,
    createdAt: broker.createdAt,
    updatedAt: broker.updatedAt,
  };
}

export function toStrategyDto(strategy: schema.Strategy) {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    isActive: strategy.isActive,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
  };
}

export function toTagDto(tag: schema.Tag) {
  return {
    id: tag.id,
    name: tag.name,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

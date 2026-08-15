import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.js";
import { createBrokerSchema, createBrokerContractTermSchema, createInstrumentContractSpecSchema, createStrategySchema, createTagSchema } from "@tfex/shared";
import {
  createBroker,
  createBrokerContractTerm,
  createInstrumentContractSpec,
  createStrategy,
  createTag,
  listBrokers,
  listBrokerContractTerms,
  listInstrumentContractSpecs,
  listStrategies,
  listTags,
  toBrokerDto,
  toBrokerContractTermDto,
  toInstrumentContractSpecDto,
  toStrategyDto,
  toTagDto,
} from "../services/catalog.service.js";
import { errors } from "../lib/errors.js";

export function registerCatalogRoutes(app: FastifyInstance, db: Db) {
  app.get("/api/brokers", async () => {
    return { data: listBrokers(db).map(toBrokerDto) };
  });

  app.post("/api/brokers", async (request) => {
    const parsed = createBrokerSchema.parse(request.body);
    return { data: toBrokerDto(createBroker(db, parsed)) };
  });

  app.get("/api/instrument-contract-specs", async () => ({ data: listInstrumentContractSpecs(db).map(toInstrumentContractSpecDto) }));
  app.post("/api/instrument-contract-specs", async (request) => ({ data: toInstrumentContractSpecDto(createInstrumentContractSpec(db, createInstrumentContractSpecSchema.parse(request.body))) }));
  app.get("/api/broker-contract-terms", async () => ({ data: listBrokerContractTerms(db).map(toBrokerContractTermDto) }));
  app.post("/api/broker-contract-terms", async (request) => ({ data: toBrokerContractTermDto(createBrokerContractTerm(db, createBrokerContractTermSchema.parse(request.body))) }));

  app.get("/api/strategies", async () => {
    return { data: listStrategies(db).map(toStrategyDto) };
  });

  app.post("/api/strategies", async (request) => {
    const parsed = createStrategySchema.parse(request.body);
    return { data: toStrategyDto(createStrategy(db, parsed)) };
  });

  app.get("/api/tags", async () => {
    return { data: listTags(db).map(toTagDto) };
  });

  app.post("/api/tags", async (request) => {
    const parsed = createTagSchema.parse(request.body);
    return { data: toTagDto(createTag(db, parsed)) };
  });
}

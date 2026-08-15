import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import * as schema from "../db/schema.js";
import { errors } from "../lib/errors.js";

export interface UpsertJournalInput {
  tradeId: number;
  strategyId?: number | null;
  setup?: string | null;
  timeframe?: string | null;
  entryReason?: string | null;
  exitReason?: string | null;
  confidence?: number | null;
  emotion?: string | null;
  followedPlan?: boolean | null;
  mistakes?: string | null;
  lessons?: string | null;
  thingsDoneWell?: string | null;
  improvements?: string | null;
  preTradeNote?: string | null;
  postTradeNote?: string | null;
  tagIds?: number[];
}

export function upsertJournal(db: Db, input: UpsertJournalInput) {
  const trade = db
    .select({ id: schema.trades.id })
    .from(schema.trades)
    .where(eq(schema.trades.id, input.tradeId))
    .get();
  if (!trade) {
    throw errors.notFound("Trade");
  }

  const values = {
    strategyId: input.strategyId ?? null,
    setup: input.setup ?? null,
    timeframe: input.timeframe ?? null,
    entryReason: input.entryReason ?? null,
    exitReason: input.exitReason ?? null,
    confidence: input.confidence ?? null,
    emotion: input.emotion ?? null,
    followedPlan: input.followedPlan ?? null,
    mistakes: input.mistakes ?? null,
    lessons: input.lessons ?? null,
    thingsDoneWell: input.thingsDoneWell ?? null,
    improvements: input.improvements ?? null,
    preTradeNote: input.preTradeNote ?? null,
    postTradeNote: input.postTradeNote ?? null,
  };

  const existing = db
    .select()
    .from(schema.tradeJournals)
    .where(eq(schema.tradeJournals.tradeId, input.tradeId))
    .get();

  const journal = existing
    ? db
        .update(schema.tradeJournals)
        .set({ ...values, updatedAt: new Date().toISOString() })
        .where(eq(schema.tradeJournals.tradeId, input.tradeId))
        .returning()
        .get()
    : db
        .insert(schema.tradeJournals)
        .values({ tradeId: input.tradeId, ...values })
        .returning()
        .get();

  if (input.tagIds) {
    db.delete(schema.tradeTags)
      .where(eq(schema.tradeTags.tradeId, input.tradeId))
      .run();

    if (input.tagIds.length > 0) {
      db.insert(schema.tradeTags)
        .values(input.tagIds.map((tagId) => ({ tradeId: input.tradeId, tagId })))
        .run();
    }
  }

  return getJournal(db, input.tradeId);
}

export function getJournal(db: Db, tradeId: number) {
  const journal = db
    .select()
    .from(schema.tradeJournals)
    .where(eq(schema.tradeJournals.tradeId, tradeId))
    .get();

  if (!journal) {
    return null;
  }

  const tagRows = db
    .select({ tag: schema.tags })
    .from(schema.tradeTags)
    .innerJoin(schema.tags, eq(schema.tradeTags.tagId, schema.tags.id))
    .where(eq(schema.tradeTags.tradeId, tradeId))
    .all();

  return toJournalDto(journal, tagRows.map((r) => r.tag));
}

function toJournalDto(journal: schema.TradeJournal, tags: schema.Tag[]) {
  return {
    id: journal.id,
    tradeId: journal.tradeId,
    strategyId: journal.strategyId,
    setup: journal.setup,
    timeframe: journal.timeframe,
    entryReason: journal.entryReason,
    exitReason: journal.exitReason,
    confidence: journal.confidence,
    emotion: journal.emotion,
    followedPlan: journal.followedPlan,
    mistakes: journal.mistakes,
    lessons: journal.lessons,
    thingsDoneWell: journal.thingsDoneWell,
    improvements: journal.improvements,
    preTradeNote: journal.preTradeNote,
    postTradeNote: journal.postTradeNote,
    createdAt: journal.createdAt,
    updatedAt: journal.updatedAt,
    tags: tags.map((t) => ({ id: t.id, name: t.name })),
  };
}
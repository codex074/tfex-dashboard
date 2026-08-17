import { errors } from "./errors.js";

/**
 * Minimal in-memory sliding-window limiter for public, unauthenticated
 * endpoints (e.g. registration) where a database-backed or distributed
 * limiter would be overkill for a single-process deployment.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): void {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw errors.rateLimited();
  recent.push(now);
  hits.set(key, recent);
}

export function resetRateLimit(): void {
  hits.clear();
}

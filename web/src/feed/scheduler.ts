/**
 * Spread a batch of events over time so a poll that returns several new
 * events plays them one after another instead of all at once.
 */
export interface Spaced<T> {
  item: T;
  /** Delay from now, in milliseconds. */
  delayMs: number;
}

export function spaceOut<T>(
  items: readonly T[],
  windowMs: number,
  minGapMs = 500,
  maxGapMs = 3000,
): Spaced<T>[] {
  if (items.length === 0) return [];
  const rawGap = windowMs / items.length;
  const gap = Math.min(maxGapMs, Math.max(minGapMs, rawGap));
  return items.map((item, index) => ({ item, delayMs: Math.round(index * gap) }));
}

/**
 * Baseline pulse tempo from the number of agents online. Hundreds of agents
 * produce a relaxed 60 to 80 beats per minute; an empty network idles slowly.
 */
export function baselineBpm(agentsOnline: number): number {
  const clamped = Math.max(0, Math.min(agentsOnline, 1500));
  return Math.round((52 + clamped * 0.04) * 10) / 10;
}

/** Transient tempo nudge from agents joining (+) or leaving (-), in bpm. */
export const JOIN_NUDGE_BPM = 0.8;

/** Half-life of a tempo nudge, in milliseconds. */
export const NUDGE_HALF_LIFE_MS = 25_000;

export function decayNudge(nudge: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return nudge;
  const decayed = nudge * Math.pow(0.5, elapsedMs / NUDGE_HALF_LIFE_MS);
  return Math.abs(decayed) < 0.01 ? 0 : decayed;
}

export function clampBpm(bpm: number): number {
  return Math.max(40, Math.min(120, bpm));
}

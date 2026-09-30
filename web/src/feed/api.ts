import { normalizeSnapshot, type SwarmSnapshot } from './types';

export const SWARM_URL = 'https://api.imd.fun/swarm';

/** The API caches for 10 s; polling faster than that returns the same document. */
export const POLL_INTERVAL_MS = 15_000;

export class FeedError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FeedError';
  }
}

/** Fetch and parse one snapshot. Rejects with a FeedError on any failure. */
export async function fetchSnapshot(signal?: AbortSignal): Promise<SwarmSnapshot> {
  let response: Response;
  try {
    response = await fetch(SWARM_URL, { signal, cache: 'no-store', headers: { accept: 'application/json' } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new FeedError('Could not reach api.imd.fun.', error);
  }
  if (!response.ok) {
    throw new FeedError(`api.imd.fun answered with status ${response.status}.`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new FeedError('api.imd.fun answered with something that is not JSON.', error);
  }
  try {
    return normalizeSnapshot(body);
  } catch (error) {
    throw new FeedError('api.imd.fun answered with an unexpected document.', error);
  }
}

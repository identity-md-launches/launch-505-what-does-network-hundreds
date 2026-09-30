import { useEffect, useRef, useState } from 'react';
import { fetchSnapshot, POLL_INTERVAL_MS } from './api';
import { eventKey, newEvents, type SwarmEvent, type SwarmHealth } from './types';
import type { FeedStatus } from '../state';

export interface FeedState {
  status: FeedStatus;
  error: string | null;
  health: SwarmHealth;
  lastUpdate: number | null;
}

const EMPTY_HEALTH: SwarmHealth = { agentsOnline: 0, workingNow: 0, acceptedLastDay: 0, jobsDoneLastDay: 0 };

/**
 * Poll the live snapshot while `enabled`. The first successful response is
 * handed to `onFirst` (newest first) so the app can replay a few recent
 * events; every later poll reports only unseen events to `onNew`, oldest first.
 */
export function useSwarmFeed(
  enabled: boolean,
  onNew: (events: SwarmEvent[]) => void,
  onFirst: (recent: SwarmEvent[]) => void,
) {
  const [state, setState] = useState<FeedState>({
    status: 'connecting',
    error: null,
    health: EMPTY_HEALTH,
    lastUpdate: null,
  });
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;
  const onFirstRef = useRef(onFirst);
  onFirstRef.current = onFirst;
  /** Most recent events from the last good poll, newest first, for the catch-up replay. */
  const latest = useRef<SwarmEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const seen = new Set<string>();
    let first = true;
    let timer: number | null = null;
    let cancelled = false;
    const controller = new AbortController();

    async function poll(): Promise<void> {
      try {
        const snapshot = await fetchSnapshot(controller.signal);
        if (cancelled) return;
        const fresh = newEvents(snapshot.events, seen);
        for (const event of snapshot.events) seen.add(eventKey(event));
        latest.current = [...snapshot.events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
        setState({ status: 'live', error: null, health: snapshot.health, lastUpdate: Date.now() });
        if (first) onFirstRef.current(latest.current);
        else if (fresh.length > 0) onNewRef.current(fresh);
        first = false;
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'The request failed.';
        setState((prev) => ({ ...prev, status: 'unavailable', error: message }));
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    setState((prev) => ({ ...prev, status: 'connecting', error: null }));
    void poll();

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [enabled]);

  return { ...state, latest };
}

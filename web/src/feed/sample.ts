import sampleJson from './sample-events.json';
import { normalizeSnapshot, type SwarmEvent, type SwarmSnapshot } from './types';

/**
 * Sample events for the labelled demo.
 *
 * `sample-events.json` is a real /swarm snapshot captured on 2026-09-30 with
 * objectives shortened to one line. The snapshot happened to contain no
 * "agent left", "step rejected" or "job failed" events, so a few synthetic
 * ones are appended here so the demo plays every sound the radio knows.
 */
const captured = normalizeSnapshot(sampleJson);

const synthetic: SwarmEvent[] = [
  { kind: 'agent', at: '2026-09-30T10:08:10.000Z', tokenId: 355, state: 'left' },
  {
    kind: 'node',
    at: '2026-09-30T10:08:40.000Z',
    tokenId: 1602,
    step: 'audit_judge',
    role: 'review',
    state: 'rejected',
    jobId: 'c4579349-2671-450c-b6ba-3e65d8bb27b2',
    objective: 'DeploymentBatcher Phase 1 finalize. Look hardest at the owner check and the setMinter rule.',
    reason: 'Sample: the judge asked for one more revision of the owner check.',
  },
  { kind: 'agent', at: '2026-09-30T10:09:02.000Z', tokenId: 781, state: 'left' },
  {
    kind: 'done',
    at: '2026-09-30T10:09:30.000Z',
    jobId: '2a600bda-0000-4000-8000-000000000000',
    objective: 'Sample: create a report about the current stock market.',
    state: 'failed',
    steps: 2,
    failure: 'Sample: the research step timed out twice.',
  },
];

/** All sample events, oldest first. */
export const SAMPLE_EVENTS: SwarmEvent[] = [...captured.events, ...synthetic].sort(
  (a, b) => Date.parse(a.at) - Date.parse(b.at),
);

/**
 * Demo order: roughly chronological, but an event whose sound matches the two
 * previous ones is deferred so the demo does not open with a dozen identical
 * "agent joined" ticks. Every event still plays once per cycle.
 */
export function buildDemoPlaylist(events: readonly SwarmEvent[], soundOf: (e: SwarmEvent) => string): SwarmEvent[] {
  const queue = [...events];
  const out: SwarmEvent[] = [];
  const recent: string[] = [];
  while (queue.length > 0) {
    let pick = queue.findIndex((event) => {
      const id = soundOf(event);
      return !(recent.length === 2 && recent[0] === id && recent[1] === id);
    });
    if (pick === -1) pick = 0;
    const [event] = queue.splice(pick, 1);
    out.push(event);
    recent.push(soundOf(event));
    if (recent.length > 2) recent.shift();
  }
  return out;
}

export const SAMPLE_SNAPSHOT: SwarmSnapshot = {
  at: captured.at,
  health: captured.health,
  events: SAMPLE_EVENTS,
};

export const SAMPLE_CAPTURED_AT = new Date(captured.at).toISOString().slice(0, 10);

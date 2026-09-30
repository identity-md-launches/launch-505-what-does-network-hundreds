/**
 * Shapes of the https://api.imd.fun/swarm snapshot that Swarm Radio uses.
 *
 * The endpoint returns one JSON document per request: network health, counts,
 * per-seat statistics and the ~60 most recent events. There is no push
 * stream, so the site polls and diffs.
 */

export type EventKind = 'agent' | 'job' | 'node' | 'done' | 'site';

export interface SwarmEvent {
  kind: EventKind;
  /** ISO-8601 timestamp of the event. */
  at: string;
  /** Seat token id for agent and node events. */
  tokenId?: number;
  /** agent: joined | left. node: working | accepted | rejected | failed. done: completed | failed. */
  state?: string;
  /** Workflow step name for node events, e.g. audit_judge, create_video. */
  step?: string;
  /** Step role for node events: implement | review | tests | integrate. */
  role?: string;
  jobId?: string;
  objective?: string | null;
  reason?: string | null;
  /** Number of steps a finished job ran. */
  steps?: number;
  failure?: string | null;
  ensName?: string;
  cid?: string;
}

export interface SwarmHealth {
  agentsOnline: number;
  workingNow: number;
  acceptedLastDay: number;
  jobsDoneLastDay: number;
}

export interface SwarmSnapshot {
  /** Snapshot time in ms since the epoch. */
  at: number;
  health: SwarmHealth;
  events: SwarmEvent[];
}

const KINDS: ReadonlySet<string> = new Set(['agent', 'job', 'node', 'done', 'site']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Turn one raw event object into a SwarmEvent, or null when it is unusable. */
export function normalizeEvent(raw: unknown): SwarmEvent | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind;
  const at = raw.at;
  if (typeof kind !== 'string' || !KINDS.has(kind)) return null;
  if (typeof at !== 'string' || Number.isNaN(Date.parse(at))) return null;
  const event: SwarmEvent = { kind: kind as EventKind, at };
  const tokenId = optionalNumber(raw.tokenId);
  if (tokenId !== undefined) event.tokenId = tokenId;
  const state = optionalString(raw.state);
  if (state) event.state = state;
  const step = optionalString(raw.step);
  if (step) event.step = step;
  const role = optionalString(raw.role);
  if (role) event.role = role;
  const jobId = optionalString(raw.jobId);
  if (jobId) event.jobId = jobId;
  if (typeof raw.objective === 'string') event.objective = raw.objective;
  if (typeof raw.reason === 'string') event.reason = raw.reason;
  const steps = optionalNumber(raw.steps);
  if (steps !== undefined) event.steps = steps;
  if (typeof raw.failure === 'string') event.failure = raw.failure;
  const ensName = optionalString(raw.ensName);
  if (ensName) event.ensName = ensName;
  const cid = optionalString(raw.cid);
  if (cid) event.cid = cid;
  return event;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** Parse the whole /swarm document. Throws when the document is not a snapshot. */
export function normalizeSnapshot(raw: unknown): SwarmSnapshot {
  if (!isRecord(raw) || !Array.isArray(raw.events)) {
    throw new Error('The response is not a swarm snapshot.');
  }
  const health = isRecord(raw.health) ? raw.health : {};
  const events = raw.events
    .map(normalizeEvent)
    .filter((event): event is SwarmEvent => event !== null);
  return {
    at: typeof raw.at === 'number' ? raw.at : Date.now(),
    health: {
      agentsOnline: toCount(health.agentsOnline),
      workingNow: toCount(health.workingNow),
      acceptedLastDay: toCount(health.acceptedLastDay),
      jobsDoneLastDay: toCount(health.jobsDoneLastDay),
    },
    events,
  };
}

/**
 * Stable identity for an event across polls. The API has no event ids, so the
 * key is built from the fields that together make an event unique.
 */
export function eventKey(event: SwarmEvent): string {
  return [
    event.kind,
    event.at,
    event.tokenId ?? '',
    event.jobId ?? '',
    event.step ?? '',
    event.state ?? '',
  ].join('|');
}

/** Events in `next` that are not in `seen`, oldest first. */
export function newEvents(next: SwarmEvent[], seen: ReadonlySet<string>): SwarmEvent[] {
  const fresh = next.filter((event) => !seen.has(eventKey(event)));
  fresh.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return fresh;
}

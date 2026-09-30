import { describe, expect, it } from 'vitest';
import sampleJson from './sample-events.json';
import { buildDemoPlaylist, SAMPLE_EVENTS } from './sample';
import { baselineBpm, clampBpm, decayNudge, spaceOut } from './scheduler';
import { eventKey, newEvents, normalizeEvent, normalizeSnapshot } from './types';
import { eventTitle } from './describe';
import { soundFor } from '../audio/map';

describe('normalizeSnapshot', () => {
  it('parses the captured sample document', () => {
    const snapshot = normalizeSnapshot(sampleJson);
    expect(snapshot.events.length).toBe(60);
    expect(snapshot.health.agentsOnline).toBeGreaterThan(0);
    expect(snapshot.events.every((e) => ['agent', 'job', 'node', 'done', 'site'].includes(e.kind))).toBe(true);
  });

  it('drops malformed events and rejects non-snapshots', () => {
    expect(normalizeEvent({ kind: 'bogus', at: '2026-01-01T00:00:00Z' })).toBeNull();
    expect(normalizeEvent({ kind: 'agent', at: 'not a date' })).toBeNull();
    expect(normalizeEvent(null)).toBeNull();
    expect(() => normalizeSnapshot({ health: {} })).toThrow();
    const snap = normalizeSnapshot({ events: [{ kind: 'job', at: '2026-01-01T00:00:00Z' }, 42] });
    expect(snap.events).toHaveLength(1);
    expect(snap.health.agentsOnline).toBe(0);
  });
});

describe('newEvents', () => {
  it('returns only unseen events, oldest first', () => {
    const snapshot = normalizeSnapshot(sampleJson);
    const seen = new Set(snapshot.events.slice(5).map(eventKey));
    const fresh = newEvents(snapshot.events, seen);
    expect(fresh).toHaveLength(5);
    for (let i = 1; i < fresh.length; i += 1) {
      expect(Date.parse(fresh[i].at)).toBeGreaterThanOrEqual(Date.parse(fresh[i - 1].at));
    }
    expect(newEvents(snapshot.events, new Set(snapshot.events.map(eventKey)))).toHaveLength(0);
  });

  it('keys distinguish the same step in different states', () => {
    const a = normalizeEvent({ kind: 'node', at: '2026-01-01T00:00:00Z', tokenId: 1, step: 'x', state: 'working', jobId: 'j' })!;
    const b = { ...a, state: 'accepted' };
    expect(eventKey(a)).not.toBe(eventKey(b));
  });
});

describe('soundFor and eventTitle', () => {
  it('maps every sample event to a sound with a label and description', () => {
    for (const event of SAMPLE_EVENTS) {
      const sound = soundFor(event);
      expect(sound.label.length).toBeGreaterThan(0);
      expect(sound.description.length).toBeGreaterThan(0);
      expect(sound.frequency).toBeGreaterThan(0);
      expect(eventTitle(event).length).toBeGreaterThan(0);
    }
  });

  it('gives each role its own accepted-step pitch and nudges tempo on joins and leaves', () => {
    const base = { kind: 'node' as const, at: '2026-01-01T00:00:00Z', state: 'accepted', step: 's' };
    const pitches = ['implement', 'review', 'tests', 'integrate'].map((role) => soundFor({ ...base, role }).frequency);
    expect(new Set(pitches).size).toBe(4);
    expect(soundFor({ kind: 'agent', at: base.at, state: 'joined' }).tempoNudge).toBeGreaterThan(0);
    expect(soundFor({ kind: 'agent', at: base.at, state: 'left' }).tempoNudge).toBeLessThan(0);
    expect(soundFor({ kind: 'done', at: base.at, state: 'failed' }).id).toBe('failed');
    expect(soundFor({ kind: 'site', at: base.at }).id).toBe('site');
  });

  it('demo playlist keeps every event and avoids three identical sounds in a row', () => {
    const playlist = buildDemoPlaylist(SAMPLE_EVENTS, (e) => soundFor(e).id);
    expect(playlist).toHaveLength(SAMPLE_EVENTS.length);
    expect(new Set(playlist)).toEqual(new Set(SAMPLE_EVENTS));
    const ids = playlist.map((e) => soundFor(e).id);
    const firstTen = ids.slice(0, 10);
    expect(new Set(firstTen).size).toBeGreaterThan(2);
    for (let i = 2; i < ids.length; i += 1) {
      if (ids[i] === ids[i - 1] && ids[i] === ids[i - 2]) {
        // Only allowed when nothing else was left in the queue.
        expect(new Set(ids.slice(i)).size).toBe(1);
      }
    }
  });

  it('demo sample covers every sound id', () => {
    const ids = new Set(SAMPLE_EVENTS.map((e) => soundFor(e).id));
    expect([...ids].sort()).toEqual(
      ['accepted', 'completed', 'failed', 'job', 'joined', 'left', 'rejected', 'site', 'working'].sort(),
    );
  });
});

describe('scheduler', () => {
  it('spaces events across the window within the gap bounds', () => {
    const spaced = spaceOut(['a', 'b', 'c'], 12_000, 500, 3000);
    expect(spaced.map((s) => s.delayMs)).toEqual([0, 3000, 6000]);
    const many = spaceOut(Array.from({ length: 50 }, (_, i) => i), 12_000, 500, 3000);
    expect(many[1].delayMs).toBe(500);
    expect(spaceOut([], 1000)).toEqual([]);
  });

  it('derives a relaxed tempo from agents online and decays nudges', () => {
    expect(baselineBpm(0)).toBe(52);
    expect(baselineBpm(524)).toBeCloseTo(73, 0);
    expect(baselineBpm(10_000)).toBe(baselineBpm(1500));
    expect(decayNudge(1, 0)).toBe(1);
    expect(decayNudge(1, 25_000)).toBeCloseTo(0.5, 2);
    expect(decayNudge(0.8, 600_000)).toBe(0);
    expect(clampBpm(500)).toBe(120);
  });
});

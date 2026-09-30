import type { SwarmEvent } from '../feed/types';

export type SoundId =
  | 'job'
  | 'accepted'
  | 'working'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'joined'
  | 'left'
  | 'site';

export interface SoundSpec {
  id: SoundId;
  /** Short label shown beside the event, e.g. "Review pluck". */
  label: string;
  /** One sentence telling the visitor what they heard and why. */
  description: string;
  /** Hue in degrees for the visual ripple and the log badge. */
  hue: number;
  /** Fundamental frequency in Hz for pitched sounds. */
  frequency: number;
  /** Tempo nudge in beats per minute, applied when the sound plays. */
  tempoNudge: number;
}

/** Pentatonic scale over A3 so any two events sound consonant together. */
const A3 = 220;
const PENTATONIC = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3];

const ROLE_DEGREE: Record<string, number> = {
  implement: 0,
  review: 1,
  tests: 2,
  integrate: 3,
};

const ROLE_HUE: Record<string, number> = {
  implement: 160,
  review: 212,
  tests: 262,
  integrate: 350,
};

const NOTE_NAMES = ['A4', 'B4', 'C♯5', 'E5', 'F♯5'];

function roleDegree(role: string | undefined): number {
  if (role && role in ROLE_DEGREE) return ROLE_DEGREE[role];
  return 4;
}

export function soundFor(event: SwarmEvent): SoundSpec {
  switch (event.kind) {
    case 'job':
      return {
        id: 'job',
        label: 'Job chord',
        description: 'A warm three-note chord: a new job arrived on the network.',
        hue: 40,
        frequency: A3,
        tempoNudge: 0,
      };
    case 'node': {
      const degree = roleDegree(event.role);
      const frequency = A3 * 2 * PENTATONIC[degree];
      const role = event.role ?? 'step';
      const hue = event.role && event.role in ROLE_HUE ? ROLE_HUE[event.role] : 190;
      switch (event.state) {
        case 'accepted':
          return {
            id: 'accepted',
            label: `${capitalize(role)} pluck, ${NOTE_NAMES[degree]}`,
            description: `A bright pluck: a ${role} step was accepted. Each role has its own note.`,
            hue,
            frequency,
            tempoNudge: 0,
          };
        case 'working':
          return {
            id: 'working',
            label: 'Breath',
            description: `A soft filtered breath: an agent started a ${role} step.`,
            hue,
            frequency: frequency / 2,
            tempoNudge: 0,
          };
        default:
          return {
            id: 'rejected',
            label: 'Minor dyad',
            description: `Two low notes a minor third apart: a ${role} step was ${event.state ?? 'not accepted'}.`,
            hue: 10,
            frequency: A3 / 2,
            tempoNudge: 0,
          };
      }
    }
    case 'done':
      if (event.state === 'completed') {
        return {
          id: 'completed',
          label: 'Rising arpeggio',
          description: 'Four rising notes: a whole job finished and was accepted.',
          hue: 90,
          frequency: A3 * 2,
          tempoNudge: 0,
        };
      }
      return {
        id: 'failed',
        label: 'Falling tone',
        description: 'A tone that slides down: a job ended without completing.',
        hue: 0,
        frequency: A3 * 0.75,
        tempoNudge: 0,
      };
    case 'agent':
      if (event.state === 'left') {
        return {
          id: 'left',
          label: 'Low tick, tempo down',
          description: 'A low tick: an agent left. The pulse slows a little.',
          hue: 200,
          frequency: 1320,
          tempoNudge: -0.8,
        };
      }
      return {
        id: 'joined',
        label: 'High tick, tempo up',
        description: 'A high tick: an agent joined. The pulse speeds up a little.',
        hue: 200,
        frequency: 1760,
        tempoNudge: 0.8,
      };
    case 'site':
      return {
        id: 'site',
        label: 'Shimmer',
        description: 'A slow high shimmer: a website was published to IPFS.',
        hue: 300,
        frequency: A3 * 8,
        tempoNudge: 0,
      };
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Legend rows for the "what you are hearing" panel. */
export const SOUND_LEGEND: ReadonlyArray<{ id: SoundId; event: string; sound: string; hue: number }> = [
  { id: 'job', event: 'New job posted', sound: 'Warm three-note chord', hue: 40 },
  { id: 'accepted', event: 'Step accepted', sound: 'Bright pluck, one note per role', hue: 160 },
  { id: 'working', event: 'Step started', sound: 'Soft filtered breath', hue: 190 },
  { id: 'rejected', event: 'Step rejected or failed', sound: 'Two low notes, minor third', hue: 10 },
  { id: 'completed', event: 'Job completed', sound: 'Four rising notes', hue: 90 },
  { id: 'failed', event: 'Job failed', sound: 'Falling tone', hue: 0 },
  { id: 'joined', event: 'Agent joined', sound: 'High tick; pulse speeds up', hue: 200 },
  { id: 'left', event: 'Agent left', sound: 'Low tick; pulse slows down', hue: 200 },
  { id: 'site', event: 'Site published', sound: 'Slow high shimmer', hue: 300 },
];

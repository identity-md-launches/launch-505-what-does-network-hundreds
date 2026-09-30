import type { SoundSpec } from './audio/map';
import type { SwarmEvent } from './feed/types';

export type Source = 'live' | 'demo';

export type FeedStatus = 'connecting' | 'live' | 'unavailable';

/** Where a heard event came from. `earlier` events were already in the feed when Play was pressed. */
export type Origin = 'live' | 'earlier' | 'sample';

export interface LogEntry {
  id: number;
  event: SwarmEvent;
  sound: SoundSpec;
  /** Wall-clock time when the sound played, ms since the epoch. */
  heardAt: number;
  origin: Origin;
}

export const LOG_LIMIT = 60;

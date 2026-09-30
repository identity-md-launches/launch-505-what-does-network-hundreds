import { useCallback, useEffect, useRef, useState } from 'react';
import { SwarmAudio } from './audio/engine';
import { soundFor } from './audio/map';
import { POLL_INTERVAL_MS, SWARM_URL } from './feed/api';
import { buildDemoPlaylist, SAMPLE_EVENTS, SAMPLE_SNAPSHOT } from './feed/sample';
import { baselineBpm, clampBpm, decayNudge, spaceOut } from './feed/scheduler';
import type { SwarmEvent } from './feed/types';
import { useSwarmFeed } from './feed/useSwarmFeed';
import { LOG_LIMIT, type LogEntry, type Origin, type Source } from './state';
import { Controls } from './ui/Controls';
import { EventLog } from './ui/EventLog';
import { FeedStatus } from './ui/FeedStatus';
import { Legend } from './ui/Legend';
import { NowPlaying } from './ui/NowPlaying';
import { Visualizer, type VisualizerHandle } from './ui/Visualizer';

const AUDIO_SUPPORTED = SwarmAudio.isSupported();
const REPLAY_COUNT = 4;
const DEMO_PLAYLIST = buildDemoPlaylist(SAMPLE_EVENTS, (event) => soundFor(event).id);

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function App() {
  const audioRef = useRef<SwarmAudio | null>(null);
  const vizRef = useRef<VisualizerHandle>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const pending = useRef(new Set<number>());
  const nextId = useRef(1);
  const playingRef = useRef(false);
  const nudge = useRef({ value: 0, at: 0 });

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [visualOnly, setVisualOnly] = useState(!AUDIO_SUPPORTED);
  const [source, setSource] = useState<Source>('live');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [bpm, setBpm] = useState(baselineBpm(0));
  const [audioError, setAudioError] = useState<string | null>(null);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  function audio(): SwarmAudio {
    if (!audioRef.current) audioRef.current = new SwarmAudio();
    return audioRef.current;
  }

  const audioActive = playing && !visualOnly && AUDIO_SUPPORTED;

  const hear = useCallback((event: SwarmEvent, origin: Origin) => {
    if (!playingRef.current) return;
    const sound = soundFor(event);
    audioRef.current?.play(sound);
    vizRef.current?.ripple(sound.hue, event.jobId ?? `agent:${event.tokenId ?? 0}`);
    if (sound.tempoNudge !== 0) {
      const now = Date.now();
      nudge.current = {
        value: decayNudge(nudge.current.value, now - nudge.current.at) + sound.tempoNudge,
        at: now,
      };
    }
    setEntries((prev) => {
      const entry: LogEntry = { id: nextId.current++, event, sound, heardAt: Date.now(), origin };
      return [entry, ...prev].slice(0, LOG_LIMIT);
    });
  }, []);

  const clearPending = useCallback(() => {
    for (const handle of pending.current) window.clearTimeout(handle);
    pending.current.clear();
  }, []);

  const schedule = useCallback(
    (events: SwarmEvent[], origin: Origin, windowMs: number, minGap = 500, maxGap = 3000) => {
      for (const { item, delayMs } of spaceOut(events, windowMs, minGap, maxGap)) {
        const handle = window.setTimeout(() => {
          pending.current.delete(handle);
          hear(item, origin);
        }, delayMs);
        pending.current.add(handle);
      }
    },
    [hear],
  );

  /** Play the most recent events already in the feed so listening starts with sound. */
  const replayRecent = useCallback(
    (newestFirst: SwarmEvent[]) => {
      if (!playingRef.current) return;
      const recent = newestFirst.slice(0, REPLAY_COUNT).reverse();
      schedule(recent, 'earlier', REPLAY_COUNT * 1800, 1200, 2200);
    },
    [schedule],
  );

  const feed = useSwarmFeed(
    source === 'live',
    (events) => schedule(events, 'live', POLL_INTERVAL_MS * 0.8),
    (recent) => replayRecent(recent),
  );
  const health = source === 'demo' ? SAMPLE_SNAPSHOT.health : feed.health;

  // Demo loop: one sample event every 2.2 to 4.2 seconds, cycling forever.
  useEffect(() => {
    if (!playing || source !== 'demo') return;
    let index = 0;
    let timer: number | null = null;
    const step = () => {
      hear(DEMO_PLAYLIST[index], 'sample');
      index = (index + 1) % DEMO_PLAYLIST.length;
      timer = window.setTimeout(step, 2200 + Math.random() * 2000);
    };
    timer = window.setTimeout(step, 600);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [playing, source, hear]);

  // Tempo: baseline from agents online plus a decaying nudge from joins and leaves.
  useEffect(() => {
    const base = baselineBpm(health.agentsOnline);
    const tick = () => {
      const now = Date.now();
      const value = clampBpm(base + decayNudge(nudge.current.value, now - nudge.current.at));
      setBpm(value);
      audioRef.current?.setTempo(value);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [health.agentsOnline]);

  // Beats drive the visual pulse: from the audio clock when it runs, otherwise from a timer.
  useEffect(() => {
    if (audioActive) {
      const engine = audio();
      engine.onBeat = (index) => vizRef.current?.beat(index);
      return () => {
        engine.onBeat = null;
      };
    }
    if (!playing) return;
    let index = 0;
    const timer = window.setInterval(() => vizRef.current?.beat(index++), 60000 / bpm);
    return () => window.clearInterval(timer);
    // audio() is a stable lazy getter on a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioActive, playing, bpm]);

  useEffect(() => {
    audioRef.current?.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    audioRef.current?.setMuted(muted);
  }, [muted]);

  async function startAudio(): Promise<void> {
    if (!AUDIO_SUPPORTED) return;
    try {
      const engine = audio();
      await engine.start();
      engine.setVolume(volume);
      engine.setMuted(muted);
      setAudioError(null);
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'The browser refused to start audio.');
    }
  }

  async function togglePlay(): Promise<void> {
    if (playing) {
      playingRef.current = false;
      setPlaying(false);
      clearPending();
      await audioRef.current?.stop();
      return;
    }
    playingRef.current = true;
    setPlaying(true);
    if (!visualOnly) await startAudio();
    // If the feed is not connected yet, the hook replays once its first poll succeeds.
    if (source === 'live') replayRecent(feed.latest.current);
  }

  async function changeVisualOnly(value: boolean): Promise<void> {
    setVisualOnly(value);
    if (!playing) return;
    if (value) await audioRef.current?.stop();
    else await startAudio();
  }

  function changeSource(next: Source): void {
    if (next === source) return;
    clearPending();
    setSource(next);
    // Switching to live re-enables the feed hook, whose first poll triggers the replay.
  }

  async function playDemo(): Promise<void> {
    clearPending();
    setSource('demo');
    // The demo button unmounts once the source changes; keep keyboard focus on the transport.
    window.requestAnimationFrame(() => playButtonRef.current?.focus());
    if (!playing) {
      playingRef.current = true;
      setPlaying(true);
      if (!visualOnly) await startAudio();
    }
  }

  const vizLabel = playing
    ? `Field of ${Math.min(health.agentsOnline, 600)} dots, one per online agent, pulsing at ${bpm.toFixed(0)} beats per minute. Each event draws a coloured ripple.`
    : 'Field of dots, one per online agent. Press Play to start the pulse and ripples.';

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="brand">
          <h1>Swarm Radio</h1>
          <p className="tagline">
            What does a network of hundreds of AI agents sound like? Live events from the{' '}
            <a href="https://imd.fun">identity.md</a> job network, turned into browser-made sound and light.
          </p>
        </div>
        <FeedStatus
          source={source}
          status={feed.status}
          error={feed.error}
          agentsOnline={feed.health.agentsOnline}
          lastUpdate={feed.lastUpdate}
          onPlayDemo={() => void playDemo()}
        />
      </header>

      <main id="main" className="layout">
        <div className="stage">
          <Visualizer
            ref={vizRef}
            agentsOnline={health.agentsOnline}
            active={playing}
            reducedMotion={reducedMotion}
            label={vizLabel}
          />
          <Controls
            playButtonRef={playButtonRef}
            playing={playing}
            muted={muted}
            volume={volume}
            visualOnly={visualOnly}
            audioSupported={AUDIO_SUPPORTED}
            source={source}
            onTogglePlay={() => void togglePlay()}
            onToggleMute={() => setMuted((m) => !m)}
            onVolume={setVolume}
            onVisualOnly={(value) => void changeVisualOnly(value)}
            onSource={changeSource}
          />
          {audioError && (
            <p className="note note--warn" role="alert">
              Audio could not start: {audioError}. The visuals still run; try Play again or switch to
              visual-only mode.
            </p>
          )}
          <NowPlaying
            entry={entries[0] ?? null}
            bpm={bpm}
            agentsOnline={health.agentsOnline}
            workingNow={health.workingNow}
            playing={playing}
          />
          <Legend />
        </div>
        <EventLog entries={entries} playing={playing} />
      </main>

      <footer className="site-footer">
        <p>
          Every sound is synthesized in your browser with the Web Audio API; no music files, nothing recorded
          or uploaded. Events come from <a href={SWARM_URL}>api.imd.fun/swarm</a>, polled every 15 seconds.
          Job links open the identity.md explorer.
        </p>
      </footer>
    </>
  );
}

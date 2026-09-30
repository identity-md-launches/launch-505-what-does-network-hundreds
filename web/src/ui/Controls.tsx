import type { RefObject } from 'react';
import type { Source } from '../state';

interface Props {
  playButtonRef: RefObject<HTMLButtonElement | null>;
  playing: boolean;
  muted: boolean;
  volume: number;
  visualOnly: boolean;
  audioSupported: boolean;
  source: Source;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onVolume: (value: number) => void;
  onVisualOnly: (value: boolean) => void;
  onSource: (source: Source) => void;
}

export function Controls({
  playButtonRef,
  playing,
  muted,
  volume,
  visualOnly,
  audioSupported,
  source,
  onTogglePlay,
  onToggleMute,
  onVolume,
  onVisualOnly,
  onSource,
}: Props) {
  const audioControlsDisabled = visualOnly || !audioSupported;
  return (
    <div className="controls">
      <div className="controls__row" role="group" aria-label="Playback">
        <button
          ref={playButtonRef}
          type="button"
          className="btn btn--primary"
          onClick={onTogglePlay}
          aria-pressed={playing}
        >
          <span aria-hidden="true" className="btn__icon">
            {playing ? '❚❚' : '▶'}
          </span>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={onToggleMute}
          aria-pressed={muted}
          disabled={audioControlsDisabled}
        >
          {muted ? 'Unmute' : 'Mute'}
        </button>
        <div className="volume">
          <label htmlFor="volume">Volume</label>
          <input
            id="volume"
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(event) => onVolume(Number(event.currentTarget.value) / 100)}
            disabled={audioControlsDisabled}
            aria-valuetext={`${Math.round(volume * 100)} percent`}
          />
          <output htmlFor="volume" className="volume__value">
            {Math.round(volume * 100)}%
          </output>
        </div>
      </div>
      <div className="controls__row">
        <label className="check">
          <input
            type="checkbox"
            checked={visualOnly}
            onChange={(event) => onVisualOnly(event.currentTarget.checked)}
            disabled={!audioSupported}
          />
          Visual-only mode (no sound)
        </label>
        <fieldset className="source">
          <legend>Source</legend>
          <label className="check">
            <input
              type="radio"
              name="source"
              value="live"
              checked={source === 'live'}
              onChange={() => onSource('live')}
            />
            Live feed
          </label>
          <label className="check">
            <input
              type="radio"
              name="source"
              value="demo"
              checked={source === 'demo'}
              onChange={() => onSource('demo')}
            />
            Demo (sample events)
          </label>
        </fieldset>
      </div>
      {!audioSupported && (
        <p className="note">This browser has no Web Audio support, so Swarm Radio runs in visual-only mode.</p>
      )}
    </div>
  );
}

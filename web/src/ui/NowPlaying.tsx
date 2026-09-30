import { eventTitle, formatTime } from '../feed/describe';
import type { LogEntry } from '../state';

interface Props {
  entry: LogEntry | null;
  bpm: number;
  agentsOnline: number;
  workingNow: number;
  playing: boolean;
}

export function NowPlaying({ entry, bpm, agentsOnline, workingNow, playing }: Props) {
  return (
    <section className="now" aria-labelledby="now-heading">
      <h2 id="now-heading" className="visually-hidden">
        Now playing
      </h2>
      <dl className="stats">
        <div>
          <dt>Pulse</dt>
          <dd className="num">{bpm.toFixed(1)} bpm</dd>
        </div>
        <div>
          <dt>Agents online</dt>
          <dd className="num">{agentsOnline.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Working now</dt>
          <dd className="num">{workingNow.toLocaleString()}</dd>
        </div>
      </dl>
      {entry ? (
        <div className="now__card" style={{ '--hue': entry.sound.hue } as React.CSSProperties}>
          <p className="now__label">
            <span className="swatch" aria-hidden="true" />
            Last sound: {entry.sound.label}
          </p>
          <p className="now__title">{eventTitle(entry.event)}</p>
          <p className="now__desc">
            {entry.sound.description} Happened at {formatTime(entry.event.at)}.
          </p>
        </div>
      ) : (
        <div className="now__card now__card--idle">
          <p className="now__label">{playing ? 'Listening for the next event' : 'Paused'}</p>
          <p className="now__desc">
            {playing
              ? 'The drone and pulse are playing. Each network event adds one short sound.'
              : 'Press Play to hear the drone, the pulse and every new event.'}
          </p>
        </div>
      )}
    </section>
  );
}

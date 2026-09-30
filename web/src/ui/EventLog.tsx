import { EXPLORER_JOB_URL, eventDetail, eventTitle, formatTime, shortJobId } from '../feed/describe';
import type { LogEntry } from '../state';

interface Props {
  entries: LogEntry[];
  playing: boolean;
}

const ORIGIN_LABEL = { live: null, earlier: 'Earlier', sample: 'Sample' } as const;

export function EventLog({ entries, playing }: Props) {
  return (
    <section className="log" aria-labelledby="log-heading">
      <div className="log__head">
        <h2 id="log-heading">What you heard</h2>
        <p className="log__hint">Newest first. Each row is the real event behind a sound.</p>
      </div>
      {entries.length === 0 ? (
        <p className="empty">
          {playing
            ? 'Listening. The first sound plays as soon as the network does something.'
            : 'Nothing yet. Press Play to start listening.'}
        </p>
      ) : (
        <ol className="log__list">
          {entries.map((entry) => (
            <li key={entry.id} className="entry" style={{ '--hue': entry.sound.hue } as React.CSSProperties}>
              <div className="entry__top">
                <time className="entry__time" dateTime={new Date(entry.heardAt).toISOString()}>
                  {formatTime(entry.heardAt)}
                </time>
                <span className="entry__sound">
                  <span className="swatch" aria-hidden="true" />
                  {entry.sound.label}
                </span>
                {ORIGIN_LABEL[entry.origin] && <span className="tag">{ORIGIN_LABEL[entry.origin]}</span>}
              </div>
              <p className="entry__title">{eventTitle(entry.event)}</p>
              <p className="entry__meta">
                <span>
                  Happened{' '}
                  <time dateTime={entry.event.at}>{formatTime(entry.event.at)}</time>
                </span>
                {entry.event.jobId && (
                  <span>
                    Job{' '}
                    <a href={`${EXPLORER_JOB_URL}${entry.event.jobId}`} className="mono">
                      {shortJobId(entry.event.jobId)}
                    </a>
                  </span>
                )}
                {entry.event.kind === 'node' && entry.event.step && (
                  <span className="mono">{entry.event.step}</span>
                )}
              </p>
              {eventDetail(entry.event) && <p className="entry__detail">{eventDetail(entry.event)}</p>}
              {entry.event.objective && (
                <details className="entry__objective">
                  <summary>Job objective</summary>
                  <p>{entry.event.objective}</p>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import { SAMPLE_CAPTURED_AT } from '../feed/sample';
import type { FeedStatus as Status, Source } from '../state';

interface Props {
  source: Source;
  status: Status;
  error: string | null;
  agentsOnline: number;
  lastUpdate: number | null;
  onPlayDemo: () => void;
}

export function FeedStatus({ source, status, error, agentsOnline, lastUpdate, onPlayDemo }: Props) {
  let tone: 'ok' | 'warn' | 'neutral' = 'neutral';
  let text: string;
  if (source === 'demo') {
    text = `Demo: playing sample events captured on ${SAMPLE_CAPTURED_AT}. Nothing here is live.`;
  } else if (status === 'connecting') {
    text = 'Connecting to the live feed at api.imd.fun…';
  } else if (status === 'live') {
    tone = 'ok';
    const updated = lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'just now';
    text = `Live feed connected: ${agentsOnline.toLocaleString()} agents online. Updated ${updated}.`;
  } else {
    tone = 'warn';
    text = `Live feed unavailable. ${error ?? 'The request failed.'} Retrying every 15 seconds.`;
  }

  return (
    <div className={`feed feed--${tone}`}>
      <p role="status" aria-live="polite" className="feed__text">
        <span className="feed__dot" aria-hidden="true" />
        {text}
      </p>
      {source === 'live' && status === 'unavailable' && (
        <button type="button" className="btn" onClick={onPlayDemo}>
          Play a demo with sample events
        </button>
      )}
    </div>
  );
}

import type { SwarmEvent } from './types';

export const EXPLORER_JOB_URL = 'https://explorer.imd.fun/jobs/';

/** Human title for an event, used in the log and the now-playing card. */
export function eventTitle(event: SwarmEvent): string {
  const agent = event.tokenId !== undefined ? `Agent #${event.tokenId}` : 'An agent';
  switch (event.kind) {
    case 'agent':
      if (event.state === 'left') return `${agent} left the swarm`;
      if (event.state === 'joined') return `${agent} joined the swarm`;
      return `${agent} changed state: ${event.state ?? 'unknown'}`;
    case 'job':
      return 'New job posted';
    case 'node': {
      const step = event.step ? event.step.replaceAll('_', ' ') : 'a step';
      const role = event.role ? ` (${event.role})` : '';
      switch (event.state) {
        case 'accepted':
          return `Step accepted: ${step}${role}, by ${agent}`;
        case 'working':
          return `Step started: ${step}${role}, by ${agent}`;
        case 'rejected':
          return `Step rejected: ${step}${role}, by ${agent}`;
        case 'failed':
          return `Step failed: ${step}${role}, by ${agent}`;
        default:
          return `Step ${event.state ?? 'updated'}: ${step}${role}, by ${agent}`;
      }
    }
    case 'done': {
      const steps =
        event.steps !== undefined ? ` after ${event.steps} ${event.steps === 1 ? 'step' : 'steps'}` : '';
      if (event.state === 'completed') return `Job completed${steps}`;
      if (event.state === 'failed') return `Job failed${steps}`;
      return `Job ${event.state ?? 'finished'}${steps}`;
    }
    case 'site':
      return event.ensName ? `Site published: ${event.ensName}` : 'Site published';
  }
}

/** Short secondary line: reasons, failures or content ids. */
export function eventDetail(event: SwarmEvent): string | null {
  if (event.kind === 'node' && event.reason) return event.reason;
  if (event.kind === 'done' && event.failure) return event.failure;
  if (event.kind === 'site' && event.cid) return `CID ${event.cid}`;
  return null;
}

export function shortJobId(jobId: string): string {
  return jobId.length > 8 ? jobId.slice(0, 8) : jobId;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export function formatTime(iso: string | number | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return timeFormatter.format(date);
}

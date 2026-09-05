import type { BatchState, RunStatus, SourceStatus } from './types.ts';

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

const EM_DASH = '—';

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return EM_DASH;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return `${minutes}m ${String(remSeconds).padStart(2, '0')}s`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return EM_DASH;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function relativeTime(iso: string | null | undefined, nowMs: number = Date.now()): string {
  if (!iso) return EM_DASH;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return EM_DASH;
  const diffSeconds = Math.round((nowMs - then) / 1000);
  if (diffSeconds < 0) return 'in the future';
  if (diffSeconds < 45) return 'just now';
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function sourceStatusTone(status: SourceStatus): Tone {
  switch (status) {
    case 'VERIFIED':
      return 'ok';
    case 'FAILED':
      return 'bad';
    case 'REGISTERED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function runStatusTone(status: RunStatus): Tone {
  switch (status) {
    case 'SUCCESS':
      return 'ok';
    case 'PARTIAL':
      return 'warn';
    case 'FAILED':
      return 'bad';
    case 'RUNNING':
      return 'info';
    case 'PENDING':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function batchStateTone(state: BatchState): Tone {
  switch (state) {
    case 'COMPLETED':
      return 'ok';
    case 'IN_PROGRESS':
      return 'info';
    case 'BLOCKED':
      return 'bad';
    case 'PLANNED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

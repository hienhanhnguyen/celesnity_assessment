'use client';

import { relativeTime, sourceStatusTone, titleCase } from '@/lib/format.ts';
import type { SourceView } from '@/lib/types.ts';
import { Badge, Button, Callout, Card, CardHeader, EmptyState, Spinner, StatusDot } from './ui.tsx';

export function SourcesPanel({
  sources,
  loading,
  error,
  selectedId,
  onSelect,
  onRegister,
}: {
  sources: SourceView[] | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRegister: () => void;
}) {
  return (
    <Card className="self-start">
      <CardHeader
        title="Sources"
        subtitle={sources ? `${sources.length} registered` : undefined}
        actions={
          <Button size="sm" variant="primary" onClick={onRegister}>
            Register
          </Button>
        }
      />

      {loading && !sources && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
          <Spinner /> Loading…
        </div>
      )}
      {error && (
        <div className="p-4">
          <Callout tone="bad" title="Could not load sources">
            {error}
            <div className="mt-1 text-slate-500">
              Is the backend running on the configured API base?
            </div>
          </Callout>
        </div>
      )}
      {sources && sources.length === 0 && (
        <EmptyState>No sources yet. Register one to begin.</EmptyState>
      )}
      {sources && sources.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {sources.map((source) => {
            const active = source.id === selectedId;
            return (
              <li key={source.id}>
                <button
                  type="button"
                  onClick={() => onSelect(source.id)}
                  className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-sky-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="mt-1.5">
                    <StatusDot tone={sourceStatusTone(source.status)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={`truncate text-sm font-semibold ${active ? 'text-sky-900' : 'text-slate-800'}`}
                      >
                        {source.name}
                      </span>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">{source.type}</Badge>
                      <span className="text-[0.7rem] text-slate-400">
                        {titleCase(source.status)}
                      </span>
                      {source.hasSecret && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[0.7rem] text-slate-400"
                          title="A secret is stored (encrypted)"
                        >
                          <LockIcon /> secret
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-[0.7rem] text-slate-400">
                      {source.lastTestedAt
                        ? `tested ${relativeTime(source.lastTestedAt)}`
                        : 'not tested'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function LockIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1a4 4 0 0 0-4 4v2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-1V5a4 4 0 0 0-4-4zm2 6V5a2 2 0 1 0-4 0v2h4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

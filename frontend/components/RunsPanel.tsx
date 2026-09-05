'use client';

import { api } from '@/lib/api.ts';
import { formatDateTime, formatDuration, relativeTime, runStatusTone } from '@/lib/format.ts';
import { useApi } from '@/lib/useApi.ts';
import { Badge, Callout, EmptyState, Spinner } from './ui.tsx';

export function RunsPanel({ sourceId, reloadSignal }: { sourceId: string; reloadSignal: number }) {
  const runs = useApi(() => api.listRuns(sourceId), [sourceId, reloadSignal]);

  return (
    <div>
      {runs.loading && !runs.data && (
        <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
          <Spinner /> Loading runs…
        </div>
      )}
      {runs.error && (
        <div className="p-4">
          <Callout tone="bad" title="Could not load runs">
            {runs.error}
          </Callout>
        </div>
      )}
      {runs.data && runs.data.length === 0 && (
        <EmptyState>No collection runs yet - use “Collect” to start one.</EmptyState>
      )}
      {runs.data && runs.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[0.7rem] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Duration</th>
                <th className="px-3 py-2 text-center font-medium">Fetched</th>
                <th className="px-3 py-2 text-center font-medium">Normalized</th>
                <th className="px-3 py-2 text-center font-medium">Dupes</th>
                <th className="px-3 py-2 text-center font-medium">Malformed</th>
                <th className="px-3 py-2 text-center font-medium">Errors</th>
                <th className="px-4 py-2 font-medium">Trigger</th>
              </tr>
            </thead>
            <tbody>
              {runs.data.map((run) => (
                <tr
                  key={run.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2">
                    <Badge tone={runStatusTone(run.status)}>{run.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600" title={formatDateTime(run.startedAt)}>
                    {relativeTime(run.startedAt)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-slate-600">
                    {formatDuration(run.durationMs)}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-slate-700">
                    {run.fetched}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums font-medium text-slate-800">
                    {run.normalized}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-slate-500">
                    {run.duplicates}
                  </td>
                  <td
                    className={`px-3 py-2 text-center tabular-nums ${run.malformed > 0 ? 'font-medium text-amber-700' : 'text-slate-500'}`}
                  >
                    {run.malformed}
                  </td>
                  <td
                    className={`px-3 py-2 text-center tabular-nums ${run.errors > 0 ? 'font-medium text-rose-700' : 'text-slate-500'}`}
                  >
                    {run.errors}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{run.trigger ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

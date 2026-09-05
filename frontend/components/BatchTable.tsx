'use client';

import { batchStateTone, titleCase } from '@/lib/format.ts';
import type { BatchSummary } from '@/lib/types.ts';
import { Badge, Callout, EmptyState, Spinner } from './ui.tsx';
import { FreshnessBadge, IndicatorBadges } from './indicators.tsx';

export function BatchTable({
  batches,
  loading,
  error,
  selectedBatchId,
  onOpen,
}: {
  batches: BatchSummary[] | null;
  loading: boolean;
  error: string | null;
  selectedBatchId: string | null;
  onOpen: (batchId: string) => void;
}) {
  if (loading && !batches) {
    return (
      <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-400">
        <Spinner /> Loading batches…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4">
        <Callout tone="bad" title="Could not load batches">
          {error}
        </Callout>
      </div>
    );
  }
  if (batches && batches.length === 0) {
    return <EmptyState>No batches match this view.</EmptyState>;
  }
  if (!batches) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-[0.7rem] uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2 font-medium">Batch</th>
            <th className="px-3 py-2 font-medium">Work order</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Current station</th>
            <th className="px-3 py-2 text-right font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Freshness</th>
            <th className="px-4 py-2 font-medium">Indicators</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((batch) => {
            const active = batch.batchId === selectedBatchId;
            return (
              <tr
                key={batch.batchId}
                onClick={() => onOpen(batch.batchId)}
                className={`cursor-pointer border-b border-slate-50 last:border-0 ${
                  active ? 'bg-sky-50' : 'hover:bg-slate-50/60'
                }`}
              >
                <td className="px-4 py-2.5 font-medium text-slate-800">{batch.batchId}</td>
                <td className="px-3 py-2.5 text-slate-600">{batch.workOrderId}</td>
                <td className="px-3 py-2.5">
                  <Badge tone={batchStateTone(batch.state)}>{titleCase(batch.state)}</Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-700">
                  {batch.currentStation ? titleCase(batch.currentStation) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                  {batch.currentQuantity ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  <FreshnessBadge freshness={batch.freshness} />
                </td>
                <td className="px-4 py-2.5">
                  <IndicatorBadges indicators={batch.indicators} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

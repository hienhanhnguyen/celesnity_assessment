'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api.ts';
import { titleCase } from '@/lib/format.ts';
import { BATCH_STATES, type BatchState, type BatchSummary } from '@/lib/types.ts';
import { useApi } from '@/lib/useApi.ts';
import { Callout, Card, CardHeader, EmptyState, Spinner } from './ui.tsx';
import { LineBoard } from './LineBoard.tsx';
import { BatchTable } from './BatchTable.tsx';
import { BatchDetailModal } from './BatchDetailModal.tsx';

export function ProductionView() {
  const config = useApi(() => api.getConfig(), []);
  const [dataVersion, setDataVersion] = useState(0);
  const lines = useApi(() => api.listLines(), [dataVersion]);

  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<BatchState | null>(null);
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  useEffect(() => {
    const list = lines.data;
    if (!list) return;
    const first = list[0];
    if (!first) return;
    setSelectedLineId((current) =>
      current && list.some((line) => line.lineId === current) ? current : first.lineId,
    );
  }, [lines.data]);

  const batches = useApi<BatchSummary[]>(
    () =>
      selectedLineId
        ? api.listBatches({ lineId: selectedLineId, state: stateFilter ?? undefined })
        : Promise.resolve([]),
    [selectedLineId, stateFilter, dataVersion],
  );

  const onMutated = useCallback(() => setDataVersion((version) => version + 1), []);

  const selectedLine = useMemo(
    () => lines.data?.find((line) => line.lineId === selectedLineId) ?? null,
    [lines.data, selectedLineId],
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Production Lines</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Live line status from the normalized event log - visibility &amp; traceability only.
          </p>
        </div>
        {config.data && (
          <p className="text-xs text-slate-400">
            Freshness threshold:{' '}
            <span className="font-medium text-slate-600">
              {config.data.staleThresholdMinutes} min
            </span>
          </p>
        )}
      </div>

      {lines.loading && !lines.data && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Spinner /> Loading lines…
        </div>
      )}
      {lines.error && (
        <Callout tone="bad" title="Could not load lines">
          {lines.error}
        </Callout>
      )}
      {lines.data && lines.data.length === 0 && (
        <EmptyState>
          No production lines yet - collect data on the Data Sources view first.
        </EmptyState>
      )}

      {lines.data && lines.data.length > 0 && (
        <div className="space-y-6">
          {/* Line selector */}
          <div className="flex flex-wrap gap-2">
            {lines.data.map((line) => {
              const active = line.lineId === selectedLineId;
              return (
                <button
                  key={line.lineId}
                  type="button"
                  onClick={() => setSelectedLineId(line.lineId)}
                  aria-pressed={active}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-sky-600 text-white'
                      : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {line.lineId}
                  <span
                    className={`rounded-full px-1.5 text-xs tabular-nums ${
                      active ? 'bg-sky-500/60 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {line.batchCount}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Station board */}
          {selectedLine && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stations · {selectedLine.lineId}
              </h2>
              <LineBoard line={selectedLine} />
            </section>
          )}

          {/* Batches */}
          <Card>
            <CardHeader
              title="Batches"
              subtitle={selectedLineId ? `Line ${selectedLineId}` : undefined}
              actions={
                <div className="flex flex-wrap items-center gap-1">
                  <FilterPill
                    label="All"
                    active={stateFilter === null}
                    onClick={() => setStateFilter(null)}
                  />
                  {BATCH_STATES.map((state) => (
                    <FilterPill
                      key={state}
                      label={titleCase(state)}
                      active={stateFilter === state}
                      onClick={() => setStateFilter(state)}
                    />
                  ))}
                </div>
              }
            />
            <BatchTable
              batches={batches.data}
              loading={batches.loading}
              error={batches.error}
              selectedBatchId={openBatchId}
              onOpen={setOpenBatchId}
            />
          </Card>
        </div>
      )}

      {openBatchId && (
        <BatchDetailModal
          batchId={openBatchId}
          onClose={() => setOpenBatchId(null)}
          onMutated={onMutated}
        />
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-800 text-white'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

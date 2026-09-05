'use client';

import { useState } from 'react';
import { api } from '@/lib/api.ts';
import { formatDateTime, titleCase } from '@/lib/format.ts';
import { SOURCE_TYPES, STATIONS, type SourceType, type Station } from '@/lib/types.ts';
import { useApi } from '@/lib/useApi.ts';
import { Badge, Callout, CardHeader, EmptyState, Spinner, controlClass } from './ui.tsx';

export function ObservationsPanel({ version }: { version: number }) {
  const [batchId, setBatchId] = useState('');
  const [lineId, setLineId] = useState('');
  const [station, setStation] = useState<'' | Station>('');
  const [sourceType, setSourceType] = useState<'' | SourceType>('');
  const [appliedTick, setAppliedTick] = useState(0);

  const apply = () => setAppliedTick((tick) => tick + 1);

  const records = useApi(
    () =>
      api.listObservations({
        batchId: batchId.trim() || undefined,
        lineId: lineId.trim() || undefined,
        station: station || undefined,
        sourceType: sourceType || undefined,
      }),
    [appliedTick, version],
  );

  function clearFilters() {
    setBatchId('');
    setLineId('');
    setStation('');
    setSourceType('');
    setAppliedTick((tick) => tick + 1);
  }

  const hasFilters = Boolean(batchId || lineId || station || sourceType);

  return (
    <div>
      <CardHeader
        title="Normalized records"
        subtitle="Deduplicated canonical events with source + run provenance."
        actions={
          records.data ? (
            <span className="text-xs text-slate-400">{records.data.length} shown</span>
          ) : undefined
        }
      />

      <form
        className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <label className="flex-1 basis-40">
          <span className="mb-1 block text-[0.7rem] font-medium text-slate-600">Batch ID</span>
          <input
            className={controlClass}
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            placeholder="BATCH-0001"
            autoComplete="off"
          />
        </label>
        <label className="flex-1 basis-40">
          <span className="mb-1 block text-[0.7rem] font-medium text-slate-600">Line ID</span>
          <input
            className={controlClass}
            value={lineId}
            onChange={(event) => setLineId(event.target.value)}
            placeholder="LINE-A"
            autoComplete="off"
          />
        </label>
        <label className="flex-1 basis-40">
          <span className="mb-1 block text-[0.7rem] font-medium text-slate-600">Station</span>
          <select
            className={controlClass}
            value={station}
            onChange={(event) => {
              setStation(event.target.value as '' | Station);
              setAppliedTick((tick) => tick + 1);
            }}
          >
            <option value="">All stations</option>
            {STATIONS.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 basis-40">
          <span className="mb-1 block text-[0.7rem] font-medium text-slate-600">Source type</span>
          <select
            className={controlClass}
            value={sourceType}
            onChange={(event) => {
              setSourceType(event.target.value as '' | SourceType);
              setAppliedTick((tick) => tick + 1);
            }}
          >
            <option value="">All sources</option>
            {SOURCE_TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            Apply
          </button>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {records.loading && !records.data && (
        <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-400">
          <Spinner /> Loading records…
        </div>
      )}
      {records.error && (
        <div className="p-4">
          <Callout tone="bad" title="Could not load records">
            {records.error}
          </Callout>
        </div>
      )}
      {records.data && records.data.length === 0 && (
        <EmptyState>
          {hasFilters
            ? 'No records match these filters.'
            : 'No normalized records yet - collect from a source to populate the dataset.'}
        </EmptyState>
      )}
      {records.data && records.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[0.7rem] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Work order</th>
                <th className="px-3 py-2 font-medium">Line</th>
                <th className="px-3 py-2 font-medium">Station</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Event time</th>
                <th className="px-3 py-2 font-medium">Flags</th>
                <th className="px-4 py-2 font-medium">Provenance</th>
              </tr>
            </thead>
            <tbody>
              {records.data.map((record) => {
                const { provenance } = record;
                return (
                  <tr
                    key={provenance.observationId}
                    className="border-b border-slate-50 align-top last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 font-medium text-slate-800">{record.batchId}</td>
                    <td className="px-3 py-2 text-slate-600">{record.workOrderId ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-600">{record.lineId ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{titleCase(record.station)}</td>
                    <td className="px-3 py-2">
                      <Badge tone="neutral">{record.sourceType}</Badge>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {record.quantity ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                      {formatDateTime(record.eventTime)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {record.late && <Badge tone="warn">late</Badge>}
                        {record.conflictFlags.map((flag) => (
                          <Badge key={flag} tone="bad">
                            {flag}
                          </Badge>
                        ))}
                        {!record.late && record.conflictFlags.length === 0 && (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-mono-tight leading-relaxed text-slate-500">
                        <div title="Originating source-record id">
                          rec {provenance.sourceRecordId}
                        </div>
                        <div className="text-slate-400" title="Run that produced this record">
                          run {provenance.runId}
                        </div>
                        {provenance.supersededObservationIds.length > 0 && (
                          <div className="mt-0.5">
                            <Badge tone="info">
                              +{provenance.supersededObservationIds.length} superseded
                            </Badge>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { relativeTime, titleCase } from '@/lib/format.ts';
import type { LineView } from '@/lib/types.ts';
import { StatusDot } from './ui.tsx';

export function LineBoard({ line }: { line: LineView }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {line.stations.map((station, index) => {
        const tone = station.lastEventTime === null ? 'neutral' : station.stale ? 'warn' : 'ok';
        return (
          <div
            key={station.station}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center rounded bg-slate-100 text-[0.7rem] font-semibold text-slate-500">
                {index + 1}
              </span>
              <span
                className="truncate text-xs font-semibold text-slate-700"
                title={titleCase(station.station)}
              >
                {titleCase(station.station)}
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums text-slate-900">
                {station.wip}
              </span>
              <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">WIP</span>
            </div>

            <div className="mt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700 tabular-nums">
                {station.completedQuantity}
              </span>{' '}
              done
            </div>

            <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[0.7rem] text-slate-400">
              <StatusDot tone={tone} />
              <span title={station.lastEventTime ?? undefined}>
                {station.lastEventTime ? relativeTime(station.lastEventTime) : 'no events'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

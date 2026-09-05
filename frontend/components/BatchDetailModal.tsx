'use client';

import { useState } from 'react';
import { api } from '@/lib/api.ts';
import { batchStateTone, formatDateTime, relativeTime, titleCase } from '@/lib/format.ts';
import type { BatchDetail, ManagementEventType } from '@/lib/types.ts';
import { useApi, useMutation } from '@/lib/useApi.ts';
import { Badge, Button, Callout, Modal, Spinner, controlClass } from './ui.tsx';
import { FreshnessBadge, IndicatorBadges } from './indicators.tsx';

const MANAGEMENT_TONE: Record<ManagementEventType, 'bad' | 'info' | 'neutral'> = {
  BLOCK: 'bad',
  RESUME: 'info',
  ACKNOWLEDGE: 'neutral',
  NOTE: 'neutral',
};

export function BatchDetailModal({
  batchId,
  onClose,
  onMutated,
}: {
  batchId: string;
  onClose: () => void;
  onMutated: () => void;
}) {
  const detailApi = useApi(() => api.getBatch(batchId), [batchId]);
  const [noteText, setNoteText] = useState('');

  const acknowledge = useMutation((note?: string) => api.acknowledgeBatch(batchId, note));
  const block = useMutation((note?: string) => api.blockBatch(batchId, note));
  const resume = useMutation((note?: string) => api.resumeBatch(batchId, note));
  const note = useMutation((text: string) => api.noteBatch(batchId, text));

  const anyPending = acknowledge.pending || block.pending || resume.pending || note.pending;
  const actionError = acknowledge.error ?? block.error ?? resume.error ?? note.error;

  async function runAction(result: Promise<BatchDetail | undefined>) {
    const updated = await result;
    if (updated) {
      setNoteText('');
      detailApi.reload();
      onMutated();
    }
  }

  const detail = detailApi.data;
  const trimmedNote = noteText.trim();

  return (
    <Modal
      open
      onClose={onClose}
      widthClass="max-w-3xl"
      title={batchId}
      subtitle={detail ? `${detail.workOrderId} · ${detail.lineId}` : undefined}
    >
      {detailApi.loading && !detail && (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-400">
          <Spinner /> Loading batch…
        </div>
      )}
      {detailApi.error && (
        <Callout tone="bad" title="Could not load batch">
          {detailApi.error}
        </Callout>
      )}

      {detail && (
        <div className="space-y-5">
          {/* Status strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Badge tone={batchStateTone(detail.state)}>{titleCase(detail.state)}</Badge>
            <span className="text-sm text-slate-600">
              <span className="text-slate-400">Station:</span>{' '}
              <span className="font-medium text-slate-800">
                {detail.currentStation ? titleCase(detail.currentStation) : '—'}
              </span>
            </span>
            <span className="text-sm text-slate-600">
              <span className="text-slate-400">Qty:</span>{' '}
              <span className="font-medium tabular-nums text-slate-800">
                {detail.currentQuantity ?? '—'}
              </span>
            </span>
            <FreshnessBadge freshness={detail.freshness} />
            <IndicatorBadges indicators={detail.indicators} emptyText="no exceptions" />
          </div>

          {/* Actions */}
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Management actions
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Improves visibility only - actor &amp; timestamp are stamped server-side; the source
              history is never overwritten.
            </p>
            <textarea
              className={`${controlClass} mt-2 resize-none`}
              rows={2}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Optional note (required for “Add note”)…"
              disabled={anyPending}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => runAction(acknowledge.run(trimmedNote || undefined))}
                loading={acknowledge.pending}
                disabled={anyPending}
              >
                Acknowledge
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => runAction(block.run(trimmedNote || undefined))}
                loading={block.pending}
                disabled={anyPending || detail.state === 'BLOCKED' || detail.state === 'COMPLETED'}
              >
                Block
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => runAction(resume.run(trimmedNote || undefined))}
                loading={resume.pending}
                disabled={anyPending || detail.state !== 'BLOCKED'}
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => runAction(note.run(trimmedNote))}
                loading={note.pending}
                disabled={anyPending || trimmedNote.length === 0}
              >
                Add note
              </Button>
            </div>
            {actionError && (
              <div className="mt-2">
                <Callout tone="bad">{actionError}</Callout>
              </div>
            )}
          </section>

          {/* Timeline */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Canonical timeline ({detail.timeline.length})
            </h3>
            {detail.timeline.length === 0 ? (
              <p className="text-sm text-slate-400">No accepted events yet.</p>
            ) : (
              <ol className="space-y-2">
                {detail.timeline.map((entry, index) => (
                  <li
                    key={`${entry.station}-${entry.provenance.observationId}`}
                    className="rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="grid h-5 w-5 place-items-center rounded bg-slate-100 text-[0.7rem] font-semibold text-slate-500">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {titleCase(entry.station)}
                      </span>
                      <Badge tone="neutral">{entry.sourceType}</Badge>
                      <span className="text-xs text-slate-500">
                        qty{' '}
                        <span className="font-medium tabular-nums text-slate-700">
                          {entry.quantity ?? '—'}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500" title={entry.eventTime}>
                        {formatDateTime(entry.eventTime)}
                      </span>
                      {entry.late && <Badge tone="warn">late</Badge>}
                      {entry.conflictFlags.map((flag) => (
                        <Badge key={flag} tone="bad">
                          {flag}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-1.5 font-mono-tight leading-relaxed text-slate-400">
                      <span title="Winning observation id">
                        obs {entry.provenance.observationId}
                      </span>
                      {' · '}
                      <span title="Source">src {entry.provenance.sourceId}</span>
                      {' · '}
                      <span title="Run">run {entry.provenance.runId}</span>
                      {' · '}
                      <span title="Source-record id">rec {entry.provenance.sourceRecordId}</span>
                      {entry.provenance.supersededObservationIds.length > 0 && (
                        <>
                          {' '}
                          <Badge tone="info">
                            +{entry.provenance.supersededObservationIds.length} superseded
                          </Badge>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Management history */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Management history ({detail.managementEvents.length})
            </h3>
            {detail.managementEvents.length === 0 ? (
              <p className="text-sm text-slate-400">No management actions recorded.</p>
            ) : (
              <ul className="space-y-2">
                {detail.managementEvents.map((event) => (
                  <li key={event.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Badge tone={MANAGEMENT_TONE[event.type]}>{titleCase(event.type)}</Badge>
                      <span className="text-sm text-slate-700">{event.actor}</span>
                      <span className="text-xs text-slate-400" title={event.createdAt}>
                        {relativeTime(event.createdAt)}
                      </span>
                    </div>
                    {event.note && <p className="mt-1.5 text-sm text-slate-600">{event.note}</p>}
                    <p className="mt-1 font-mono-tight text-slate-400">{event.organizationId}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}

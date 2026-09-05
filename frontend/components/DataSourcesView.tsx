'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api.ts';
import type { SourceView } from '@/lib/types.ts';
import { useApi } from '@/lib/useApi.ts';
import { Card } from './ui.tsx';
import { SourcesPanel } from './SourcesPanel.tsx';
import { SourceWorkspace } from './SourceWorkspace.tsx';
import { ObservationsPanel } from './ObservationsPanel.tsx';
import { RegisterSourceModal } from './RegisterSourceModal.tsx';

export function DataSourcesView() {
  const sources = useApi(() => api.listSources(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [observationsVersion, setObservationsVersion] = useState(0);

  useEffect(() => {
    const list = sources.data;
    if (!list) return;
    const first = list[0];
    if (!first) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) =>
      current && list.some((source) => source.id === current) ? current : first.id,
    );
  }, [sources.data]);

  const selected: SourceView | null =
    sources.data?.find((source) => source.id === selectedId) ?? null;

  function onRegistered(created: SourceView) {
    sources.reload();
    setSelectedId(created.id);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Data Sources</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register factory data sources, then test, discover, select, and collect.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SourcesPanel
          sources={sources.data}
          loading={sources.loading}
          error={sources.error}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onRegister={() => setModalOpen(true)}
        />

        {selected ? (
          <SourceWorkspace
            key={selected.id}
            source={selected}
            onSourceChanged={sources.reload}
            onCollected={() => setObservationsVersion((version) => version + 1)}
          />
        ) : (
          <Card className="grid min-h-[16rem] place-items-center">
            <p className="px-6 text-center text-sm text-slate-400">
              {sources.data && sources.data.length === 0
                ? 'Register a source to start the collection workflow.'
                : 'Select a source to test, discover, and collect.'}
            </p>
          </Card>
        )}
      </div>

      <Card>
        <ObservationsPanel version={observationsVersion} />
      </Card>

      <RegisterSourceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onRegistered={onRegistered}
      />
    </div>
  );
}

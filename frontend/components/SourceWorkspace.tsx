'use client';
import { useState } from 'react';
import { api } from '@/lib/api.ts';
import {
  formatDuration,
  relativeTime,
  runStatusTone,
  sourceStatusTone,
  titleCase,
} from '@/lib/format.ts';
import type { DiscoveredEntity, RunView, SourceView, TestResult } from '@/lib/types.ts';
import { useMutation } from '@/lib/useApi.ts';
import { Badge, Button, Callout, Card, CardHeader, Spinner } from './ui.tsx';
import { RunsPanel } from './RunsPanel.tsx';

function stringField(obj: Record<string, unknown> | null, key: string): string {
  const value = obj?.[key];
  return typeof value === 'string' ? value : '';
}

function stringList(obj: Record<string, unknown> | null, key: string): string[] {
  const value = obj?.[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function SourceWorkspace({
  source,
  onSourceChanged,
  onCollected,
}: {
  source: SourceView;
  onSourceChanged: () => void;
  onCollected: () => void;
}) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [entities, setEntities] = useState<DiscoveredEntity[] | null>(null);
  const [lastRun, setLastRun] = useState<RunView | null>(null);
  const [runsSignal, setRunsSignal] = useState(0);

  const [selTable, setSelTable] = useState<string>(() => stringField(source.selection, 'table'));
  const [selEndpoints, setSelEndpoints] = useState<string[]>(() =>
    stringList(source.selection, 'endpoints'),
  );

  const test = useMutation(() => api.testSource(source.id));
  const discover = useMutation(() => api.discoverSource(source.id));
  const saveSelection = useMutation((selection: Record<string, unknown>) =>
    api.updateSelection(source.id, selection),
  );
  const collect = useMutation(() => api.collectSource(source.id));

  async function runTest() {
    const result = await test.run();
    if (result) {
      setTestResult(result);
      onSourceChanged();
    }
  }

  async function runDiscover() {
    const result = await discover.run();
    if (result) {
      setEntities(result.entities);
      if (source.type === 'API' && selEndpoints.length === 0) {
        setSelEndpoints(result.entities.map((entity) => entity.name));
      }
    }
  }

  async function persistSelection(selection: Record<string, unknown>) {
    const updated = await saveSelection.run(selection);
    if (updated) onSourceChanged();
  }

  async function runCollect() {
    const run = await collect.run();
    if (run) {
      setLastRun(run);
      setRunsSignal((signal) => signal + 1);
      onSourceChanged();
      onCollected();
    }
  }

  function toggleEndpoint(name: string) {
    setSelEndpoints((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  const configEntries = Object.entries(source.config);
  const savedSelection = source.selection ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              {source.name}
              <Badge tone="neutral">{source.type}</Badge>
              <Badge tone={sourceStatusTone(source.status)}>{titleCase(source.status)}</Badge>
            </span>
          }
          subtitle={
            source.lastTestedAt
              ? `Last tested ${relativeTime(source.lastTestedAt)}`
              : 'Not tested yet'
          }
          actions={
            <>
              <Button size="sm" onClick={runTest} loading={test.pending}>
                Test
              </Button>
              <Button size="sm" onClick={runDiscover} loading={discover.pending}>
                Discover
              </Button>
              <Button size="sm" variant="primary" onClick={runCollect} loading={collect.pending}>
                Collect
              </Button>
            </>
          }
        />

        <div className="space-y-3 px-4 py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs">
            {configEntries.length === 0 && <span className="text-slate-400">No configuration</span>}
            {configEntries.map(([key, value]) => (
              <span key={key} className="text-slate-600">
                <span className="text-slate-400">{key}:</span>{' '}
                <span className="font-medium text-slate-700">{displayValue(value)}</span>
              </span>
            ))}
            <span className="text-slate-600">
              <span className="text-slate-400">secret:</span>{' '}
              {source.hasSecret ? (
                <span className="font-medium text-emerald-700">set · encrypted</span>
              ) : (
                <span className="font-medium text-slate-400">none</span>
              )}
            </span>
          </div>

          {testResult && (
            <Callout
              tone={testResult.ok ? 'ok' : 'bad'}
              title={testResult.ok ? 'Connection OK' : 'Connection failed'}
            >
              {testResult.message}
            </Callout>
          )}
          {!testResult && source.lastError && (
            <Callout tone="bad" title="Last error">
              {source.lastError}
            </Callout>
          )}
          {test.error && (
            <Callout tone="bad" title="Test failed">
              {test.error}
            </Callout>
          )}
          {collect.error && (
            <Callout tone="bad" title="Collection failed">
              {collect.error}
            </Callout>
          )}

          {lastRun && (
            <Callout tone={runStatusTone(lastRun.status)}>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-semibold">Run {lastRun.status}</span>
                <span>in {formatDuration(lastRun.durationMs)}</span>
                <span>· {lastRun.fetched} fetched</span>
                <span>· {lastRun.normalized} normalized</span>
                <span>· {lastRun.duplicates} dupes</span>
                {lastRun.malformed > 0 && <span>· {lastRun.malformed} malformed</span>}
                {lastRun.errors > 0 && <span>· {lastRun.errors} errors</span>}
              </span>
            </Callout>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Discover & selection"
          subtitle="Enumerate what the source exposes, then choose what to collect."
        />
        <div className="space-y-3 px-4 py-3">
          {discover.error && (
            <Callout tone="bad" title="Discover failed">
              {discover.error}
            </Callout>
          )}
          {saveSelection.error && (
            <Callout tone="bad" title="Could not save selection">
              {saveSelection.error}
            </Callout>
          )}

          {!entities && !discover.pending && (
            <p className="text-sm text-slate-500">
              Run <span className="font-medium">Discover</span> to list the{' '}
              {source.type === 'DATABASE'
                ? 'tables'
                : source.type === 'API'
                  ? 'endpoints'
                  : 'pages'}{' '}
              this source exposes.
            </p>
          )}
          {discover.pending && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Spinner /> Discovering…
            </div>
          )}

          {entities && source.type === 'DATABASE' && (
            <DatabaseSelection
              entities={entities}
              selected={selTable}
              onSelect={setSelTable}
              onSave={() => persistSelection({ table: selTable })}
              saving={saveSelection.pending}
            />
          )}
          {entities && source.type === 'API' && (
            <ApiSelection
              entities={entities}
              selected={selEndpoints}
              onToggle={toggleEndpoint}
              onSave={() => persistSelection({ endpoints: selEndpoints })}
              saving={saveSelection.pending}
            />
          )}
          {entities && source.type === 'CRAWLER' && <CrawlerSelection entities={entities} />}

          {savedSelection && (
            <p className="text-xs text-slate-400">
              Saved selection:{' '}
              <span className="font-mono-tight text-slate-500">
                {JSON.stringify(savedSelection)}
              </span>
            </p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Collection runs"
          subtitle="Status, duration, counts, and errors per run."
        />
        <RunsPanel sourceId={source.id} reloadSignal={runsSignal} />
      </Card>
    </div>
  );
}

function DatabaseSelection({
  entities,
  selected,
  onSelect,
  onSave,
  saving,
}: {
  entities: DiscoveredEntity[];
  selected: string;
  onSelect: (name: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Choose the table to collect observations from.</p>
      <div className="space-y-1.5">
        {entities.map((entity) => (
          <label
            key={entity.name}
            className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 ${
              selected === entity.name
                ? 'border-sky-400 bg-sky-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="db-table"
              checked={selected === entity.name}
              onChange={() => onSelect(entity.name)}
              className="mt-0.5 h-4 w-4 text-sky-600 focus:ring-sky-500/40"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{entity.name}</span>
              {entity.fields && entity.fields.length > 0 && (
                <span className="mt-0.5 block truncate font-mono-tight text-slate-400">
                  {entity.fields.join(', ')}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={onSave} loading={saving} disabled={!selected}>
        Save selection
      </Button>
    </div>
  );
}

function ApiSelection({
  entities,
  selected,
  onToggle,
  onSave,
  saving,
}: {
  entities: DiscoveredEntity[];
  selected: string[];
  onToggle: (name: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">Choose which endpoints to collect.</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {entities.map((entity) => (
          <label
            key={entity.name}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(entity.name)}
              onChange={() => onToggle(entity.name)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/40"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-800">{entity.name}</span>
              <span className="text-[0.7rem] text-slate-400">{entity.produces}</span>
            </span>
          </label>
        ))}
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={onSave}
        loading={saving}
        disabled={selected.length === 0}
      >
        Save selection
      </Button>
    </div>
  );
}

function CrawlerSelection({ entities }: { entities: DiscoveredEntity[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        This crawler walks all delivery pages (loop-guarded). No selection is required.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((entity) => (
          <Badge key={entity.name} tone="neutral">
            {entity.name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { api } from '@/lib/api.ts';
import type { RegisterSourceBody, SourceType, SourceView } from '@/lib/types.ts';
import { useMutation } from '@/lib/useApi.ts';
import { Button, Callout, Field, Modal, controlClass } from './ui.tsx';

interface TypeOption {
  type: SourceType;
  label: string;
  blurb: string;
  disabled?: boolean;
}

const TYPE_OPTIONS: TypeOption[] = [
  { type: 'DATABASE', label: 'Database', blurb: 'Postgres production DB · masked password' },
  { type: 'API', label: 'Application API', blurb: 'Paginated JSON REST' },
  { type: 'CRAWLER', label: 'Crawler', blurb: 'Supplier delivery HTML' },
];

interface FieldSpec {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  numeric?: boolean;
  required?: boolean;
}

const CONFIG_FIELDS: Record<SourceType, FieldSpec[]> = {
  DATABASE: [
    { key: 'host', label: 'Host', placeholder: 'postgres', required: true },
    { key: 'port', label: 'Port', placeholder: '5432', numeric: true },
    { key: 'database', label: 'Database', placeholder: 'factory', required: true },
    { key: 'user', label: 'User', placeholder: 'factory_readonly', required: true },
  ],
  API: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'http://localhost:4000', required: true },
    { key: 'pageSize', label: 'Page size', placeholder: '50', numeric: true, hint: 'optional' },
  ],
  CRAWLER: [
    { key: 'baseUrl', label: 'Base URL', placeholder: 'http://localhost:4000', required: true },
    {
      key: 'startPath',
      label: 'Start path',
      placeholder: '/suppliers/deliveries',
      hint: 'optional',
    },
    { key: 'maxPages', label: 'Max pages', placeholder: '20', numeric: true, hint: 'optional' },
  ],
};

const DEFAULT_NAME: Record<SourceType, string> = {
  DATABASE: 'Production Database',
  API: 'Application API',
  CRAWLER: 'Supplier Crawler',
};

const FIXTURE_DB: Record<string, string> = {
  host: 'postgres',
  port: '5432',
  database: 'factory',
  user: 'factory_readonly',
};

export function RegisterSourceModal({
  open,
  onClose,
  onRegistered,
}: {
  open: boolean;
  onClose: () => void;
  onRegistered: (source: SourceView) => void;
}) {
  const [type, setType] = useState<SourceType>('DATABASE');
  const [name, setName] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [ssl, setSsl] = useState(false);
  const [secret, setSecret] = useState('');

  const register = useMutation(api.registerSource);

  const specs = CONFIG_FIELDS[type];
  const setValue = (key: string, value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  function resetForm() {
    setValues({});
    setSsl(false);
    setSecret('');
    setName('');
    register.clearError();
  }

  function chooseType(next: SourceType) {
    setType(next);
    setValues({});
    setSsl(false);
    setSecret('');
    register.clearError();
  }

  function prefillFixture() {
    setValues({ ...FIXTURE_DB });
    if (!name.trim()) setName(DEFAULT_NAME.DATABASE);
  }

  const requiredFilled = specs
    .filter((spec) => spec.required)
    .every((spec) => (values[spec.key] ?? '').trim().length > 0);
  const secretOk = type !== 'DATABASE' || secret.length > 0;
  const canSubmit = name.trim().length > 0 && requiredFilled && secretOk && !register.pending;

  async function submit() {
    const config: Record<string, unknown> = {};
    for (const spec of specs) {
      const raw = (values[spec.key] ?? '').trim();
      if (!raw) continue;
      config[spec.key] = spec.numeric ? Number(raw) : raw;
    }
    if (type === 'DATABASE' && ssl) config.ssl = true;

    const body: RegisterSourceBody = {
      type,
      name: name.trim(),
      config,
      ...(type === 'DATABASE' && secret ? { secret } : {}),
    };

    const created = await register.run(body);
    if (created) {
      onRegistered(created);
      resetForm();
      onClose();
    }
  }

  function close() {
    resetForm();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Register a data source"
      subtitle="Connect a factory data source so it can be tested, discovered, and collected."
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={register.pending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={register.pending}
            disabled={!canSubmit}
          >
            Register source
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-700">Source type</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPE_OPTIONS.map((option) => {
              const active = option.type === type;
              return (
                <button
                  key={option.type}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => chooseType(option.type)}
                  className={[
                    'rounded-lg border px-2.5 py-2 text-left transition-colors',
                    option.disabled
                      ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
                      : active
                        ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <span className="block text-sm font-semibold text-slate-800">{option.label}</span>
                  <span className="mt-0.5 block text-[0.7rem] leading-tight text-slate-500">
                    {option.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Source name" htmlFor="source-name">
          <input
            id="source-name"
            className={controlClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={DEFAULT_NAME[type] || 'A recognizable name'}
            autoComplete="off"
          />
        </Field>

        {type === 'DATABASE' && (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs text-slate-600">
              Use the local factory fixture connection from <code>.env.example</code>.
            </span>
            <Button size="sm" variant="secondary" onClick={prefillFixture}>
              Prefill
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {specs.map((spec) => (
            <Field key={spec.key} label={spec.label} hint={spec.hint} htmlFor={`cfg-${spec.key}`}>
              <input
                id={`cfg-${spec.key}`}
                className={controlClass}
                inputMode={spec.numeric ? 'numeric' : undefined}
                value={values[spec.key] ?? ''}
                onChange={(event) => setValue(spec.key, event.target.value)}
                placeholder={spec.placeholder}
                autoComplete="off"
              />
            </Field>
          ))}
        </div>

        {type === 'DATABASE' && (
          <>
            <Field label="Password" hint="masked · never returned" htmlFor="cfg-secret">
              <input
                id="cfg-secret"
                type="password"
                className={controlClass}
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                placeholder="Paste FACTORY_DB_READONLY_PASSWORD from .env"
                autoComplete="new-password"
              />
            </Field>

            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(event) => setSsl(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/40"
              />
              Require SSL for this connection
            </label>

            <Callout tone="info">
              The password is stored encrypted (AES-256-GCM) and used only in memory during a test
              or collection. It is never returned by the API, shown again, or written to logs.
            </Callout>
          </>
        )}

        {register.error && (
          <Callout tone="bad" title="Could not register">
            {register.error}
          </Callout>
        )}
      </div>
    </Modal>
  );
}

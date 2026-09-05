import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const HERE = __dirname;
const BACKEND_ROOT = resolve(HERE, '..', '..');
const REPO_ROOT = resolve(BACKEND_ROOT, '..');
const RUNTIME_FILE = resolve(HERE, '.runtime.json');
const INIT_DIR = resolve(REPO_ROOT, 'docker', 'postgres', 'init');
const FIXTURES_ENTRY = resolve(REPO_ROOT, 'fixtures', 'src', 'server.ts');

const IMAGE = 'postgres:16-alpine';
const CONTAINER = `celesnity-e2e-${process.pid}-${Date.now().toString(36)}`;
const APP_DB = 'celesnity';
const APP_USER = 'celesnity';
const APP_PASSWORD = 'celesnity_e2e_pw';
const FACTORY_DB = 'factory';
const RO_USER = 'factory_readonly';
const RO_PASSWORD = 'factory_readonly_pw_change_me';

interface E2EGlobals {
  fixtures?: ReturnType<typeof spawn>;
  container?: string;
}

function globals(): E2EGlobals {
  const g = globalThis as unknown as { __CELESNITY_E2E__?: E2EGlobals };
  g.__CELESNITY_E2E__ ??= {};
  return g.__CELESNITY_E2E__;
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { stderr?: unknown; message?: unknown };
    if (e.stderr) return String(e.stderr).trim();
    if (e.message) return String(e.message);
  }
  return String(err);
}

function docker(args: string[], input?: string): string {
  return execFileSync('docker', args, { input, encoding: 'utf8', stdio: 'pipe' });
}

function psql(db: string, args: string[], sql?: string): string {
  return docker(['exec', '-i', CONTAINER, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', APP_USER, '-d', db, ...args], sql);
}

function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const { port } = addr;
        srv.close(() => resolvePort(port));
      } else {
        srv.close(() => reject(new Error('could not obtain a free port')));
      }
    });
  });
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 60_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      docker(['exec', CONTAINER, 'pg_isready', '-U', APP_USER, '-d', APP_DB]);
      return;
    } catch (err) {
      last = err;
      await delay(1000);
    }
  }
  throw new Error(`Postgres in ${CONTAINER} was not ready in 60s: ${describeError(last)}`);
}

async function waitForFixtures(port: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (res.ok) return;
    } catch (err) {
      last = err;
    }
    await delay(500);
  }
  throw new Error(`Fixtures service was not ready on :${port} in 30s: ${describeError(last)}`);
}

async function provision(hostPort: number): Promise<void> {
  await waitForPostgres();

  psql(APP_DB, ['-f', '-'], readFileSync(resolve(INIT_DIR, '01-app.sql'), 'utf8'));

  psql(APP_DB, ['-c', `CREATE ROLE ${RO_USER} LOGIN PASSWORD '${RO_PASSWORD}';`]);
  psql(APP_DB, ['-c', `CREATE DATABASE ${FACTORY_DB};`]);
  const vars = ['-v', `ro_user=${RO_USER}`, '-v', `factory_db=${FACTORY_DB}`];
  psql(FACTORY_DB, [...vars, '-f', '-'], readFileSync(resolve(INIT_DIR, 'lib', 'factory-schema.sql'), 'utf8'));
  psql(FACTORY_DB, [...vars, '-f', '-'], readFileSync(resolve(INIT_DIR, 'lib', 'factory-seed.sql'), 'utf8'));

  const fixturesPort = await freePort();
  const child = spawn(process.execPath, [FIXTURES_ENTRY], {
    env: { ...process.env, FIXTURES_PORT: String(fixturesPort) },
    stdio: 'ignore',
  });
  child.unref();
  globals().fixtures = child;
  await waitForFixtures(fixturesPort);

  const runtime = {
    databaseUrl: `postgres://${APP_USER}:${APP_PASSWORD}@127.0.0.1:${hostPort}/${APP_DB}`,
    fixturesBaseUrl: `http://127.0.0.1:${fixturesPort}`,
    factory: { host: '127.0.0.1', port: hostPort, database: FACTORY_DB, user: RO_USER, password: RO_PASSWORD },
    container: CONTAINER,
    fixturesPid: child.pid ?? null,
  };
  mkdirSync(dirname(RUNTIME_FILE), { recursive: true });
  writeFileSync(RUNTIME_FILE, `${JSON.stringify(runtime, null, 2)}\n`);
}

export default async function globalSetup(): Promise<void> {
  globals().container = CONTAINER;
  docker([
    'run', '-d', '--name', CONTAINER,
    '-e', `POSTGRES_USER=${APP_USER}`,
    '-e', `POSTGRES_PASSWORD=${APP_PASSWORD}`,
    '-e', `POSTGRES_DB=${APP_DB}`,
    '-p', '127.0.0.1:0:5432',
    IMAGE,
  ]);

  try {
    const mapping = docker(['port', CONTAINER, '5432/tcp']).trim(); // e.g. "127.0.0.1:49158"
    const hostPort = Number(mapping.split(':').pop());
    if (!Number.isInteger(hostPort)) {
      throw new Error(`could not parse host port from docker port output: "${mapping}"`);
    }
    await provision(hostPort);
  } catch (err) {
    try {
      globals().fixtures?.kill('SIGKILL');
    } catch {
    }
    try {
      docker(['rm', '-f', CONTAINER]);
    } catch {
    }
    throw err;
  }
}

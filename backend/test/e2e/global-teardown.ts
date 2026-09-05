import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const RUNTIME_FILE = resolve(__dirname, '.runtime.json');

interface E2EGlobals {
  fixtures?: { kill(signal?: NodeJS.Signals): boolean };
  container?: string;
}

export default async function globalTeardown(): Promise<void> {
  const g = (globalThis as unknown as { __CELESNITY_E2E__?: E2EGlobals }).__CELESNITY_E2E__ ?? {};

  try {
    g.fixtures?.kill('SIGTERM');
  } catch {
  }

  let container = g.container ?? null;
  let fixturesPid: number | null = null;
  if (existsSync(RUNTIME_FILE)) {
    try {
      const rt = JSON.parse(readFileSync(RUNTIME_FILE, 'utf8')) as { container?: string; fixturesPid?: number };
      container = container ?? rt.container ?? null;
      fixturesPid = rt.fixturesPid ?? null;
    } catch {
    }
  }

  if (fixturesPid) {
    try {
      process.kill(fixturesPid, 'SIGTERM');
    } catch {
    }
  }

  if (container) {
    try {
      execFileSync('docker', ['rm', '-f', container], { stdio: 'ignore' });
    } catch {
    }
  }

  if (existsSync(RUNTIME_FILE)) {
    try {
      rmSync(RUNTIME_FILE);
    } catch {
    }
  }
}

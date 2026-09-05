import type { RunView } from '../collection/collection.types';
import { RunStatus } from '../common/domain/enums';
import { NotFoundException } from '@nestjs/common';
import { RunsService } from './runs.service';
import type { RunsStore } from './sources.types';

function runView(id: string, sourceId: string): RunView {
  return {
    id,
    sourceId,
    status: RunStatus.SUCCESS,
    startedAt: new Date('2026-09-03T10:00:00.000Z'),
    finishedAt: new Date('2026-09-03T10:00:01.000Z'),
    durationMs: 1000,
    fetched: 3,
    normalized: 3,
    duplicates: 0,
    malformed: 0,
    errors: 0,
    trigger: 'manual',
  };
}

class FakeRunsStore implements RunsStore {
  constructor(private readonly runs: RunView[]) {}

  async listRuns(sourceId: string | null): Promise<RunView[]> {
    return sourceId ? this.runs.filter((r) => r.sourceId === sourceId) : this.runs;
  }

  async getRun(id: string): Promise<RunView | null> {
    return this.runs.find((r) => r.id === id) ?? null;
  }
}

describe('RunsService', () => {
  const runs = [runView('run-1', 'src-1'), runView('run-2', 'src-2'), runView('run-3', 'src-1')];

  it('lists every run when sourceId is null', async () => {
    const svc = new RunsService(new FakeRunsStore(runs));
    expect((await svc.list(null)).map((r) => r.id)).toEqual(['run-1', 'run-2', 'run-3']);
  });

  it('filters runs by sourceId', async () => {
    const svc = new RunsService(new FakeRunsStore(runs));
    expect((await svc.list('src-1')).map((r) => r.id)).toEqual(['run-1', 'run-3']);
  });

  it('gets one run by id', async () => {
    const svc = new RunsService(new FakeRunsStore(runs));
    await expect(svc.get('run-2')).resolves.toMatchObject({ id: 'run-2', sourceId: 'src-2' });
  });

  it('404s on an unknown run', async () => {
    const svc = new RunsService(new FakeRunsStore(runs));
    await expect(svc.get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

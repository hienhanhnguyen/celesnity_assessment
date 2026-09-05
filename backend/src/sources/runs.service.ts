import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { RunView } from '../collection/collection.types';
import { RUNS_STORE, type RunsStore } from './sources.types';

@Injectable()
export class RunsService {
  constructor(@Inject(RUNS_STORE) private readonly store: RunsStore) {}

  list(sourceId: string | null): Promise<RunView[]> {
    return this.store.listRuns(sourceId);
  }

  async get(id: string): Promise<RunView> {
    const run = await this.store.getRun(id);
    if (!run) throw new NotFoundException(`Collection run "${id}" not found`);
    return run;
  }
}

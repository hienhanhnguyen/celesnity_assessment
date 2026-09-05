import { Injectable } from '@nestjs/common';
import { DataSource, type QueryDeepPartialEntity } from 'typeorm';
import type { RunView } from '../collection/collection.types';
import { SourceStatus } from '../common/domain/enums';
import { CollectionRun, Source } from '../database/entities';
import type {
  NewSource,
  RunsStore,
  SourceContextData,
  SourceView,
  SourcesStore,
} from './sources.types';

@Injectable()
export class TypeOrmSourcesStore implements SourcesStore {
  constructor(private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(Source);
  }

  async existsByName(name: string): Promise<boolean> {
    return (await this.repo.countBy({ name })) > 0;
  }

  async create(input: NewSource): Promise<SourceView> {
    const saved = await this.repo.save(
      this.repo.create({
        type: input.type,
        name: input.name,
        config: input.config,
        selection: input.selection,
        status: SourceStatus.REGISTERED,
        hasSecret: input.hasSecret,
        secretCiphertext: input.secret?.ciphertext ?? null,
        secretIv: input.secret?.iv ?? null,
        secretAuthTag: input.secret?.authTag ?? null,
      }),
    );
    return toSourceView(saved);
  }

  async listViews(): Promise<SourceView[]> {
    const rows = await this.repo.find({ order: { createdAt: 'ASC' } });
    return rows.map(toSourceView);
  }

  async loadView(id: string): Promise<SourceView | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? toSourceView(row) : null;
  }

  async loadContext(id: string): Promise<SourceContextData | null> {
    const row = await this.repo
      .createQueryBuilder('s')
      .addSelect(['s.secretCiphertext', 's.secretIv', 's.secretAuthTag'])
      .where('s.id = :id', { id })
      .getOne();
    if (!row) return null;

    const secret =
      row.secretCiphertext && row.secretIv && row.secretAuthTag
        ? { ciphertext: row.secretCiphertext, iv: row.secretIv, authTag: row.secretAuthTag }
        : null;

    return { type: row.type, config: row.config, selection: row.selection, secret };
  }

  async updateSelection(id: string, selection: Record<string, unknown> | null): Promise<SourceView | null> {
    const result = await this.repo.update({ id }, { selection } as QueryDeepPartialEntity<Source>);
    if (!result.affected) return null;
    return this.loadView(id);
  }

  async markTested(id: string, testedAt: Date, lastError: string | null): Promise<void> {
    await this.repo.update({ id }, { lastTestedAt: testedAt, lastError });
  }
}

@Injectable()
export class TypeOrmRunsStore implements RunsStore {
  constructor(private readonly dataSource: DataSource) {}

  private get repo() {
    return this.dataSource.getRepository(CollectionRun);
  }

  async listRuns(sourceId: string | null): Promise<RunView[]> {
    const rows = await this.repo.find({
      where: sourceId ? { sourceId } : {},
      order: { createdAt: 'DESC' },
    });
    return rows.map(toRunView);
  }

  async getRun(id: string): Promise<RunView | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? toRunView(row) : null;
  }
}

function toSourceView(s: Source): SourceView {
  return {
    id: s.id,
    type: s.type,
    name: s.name,
    config: s.config,
    selection: s.selection,
    status: s.status,
    hasSecret: s.hasSecret,
    lastTestedAt: s.lastTestedAt,
    lastError: s.lastError,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function toRunView(r: CollectionRun): RunView {
  return {
    id: r.id,
    sourceId: r.sourceId,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationMs: r.durationMs,
    fetched: r.fetched,
    normalized: r.normalized,
    duplicates: r.duplicates,
    malformed: r.malformed,
    errors: r.errors,
    trigger: r.trigger,
  };
}

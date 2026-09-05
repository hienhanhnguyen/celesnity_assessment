import { Injectable } from '@nestjs/common';
import { DataSource, type QueryDeepPartialEntity } from 'typeorm';
import { RunStatus, type SourceStatus } from '../common/domain/enums';
import { Batch, CollectionError, CollectionRun, Source, SourceObservation, WorkOrder } from '../database/entities';
import type { CollectionStore, PersistBatch, RunPatch, RunView, StoredSource } from './collection.types';

@Injectable()
export class TypeOrmCollectionStore implements CollectionStore {
  constructor(private readonly dataSource: DataSource) {}

  async loadSource(id: string): Promise<StoredSource | null> {
    const row = await this.dataSource
      .getRepository(Source)
      .createQueryBuilder('s')
      .addSelect(['s.secretCiphertext', 's.secretIv', 's.secretAuthTag'])
      .where('s.id = :id', { id })
      .getOne();
    if (!row) return null;

    const secret =
      row.secretCiphertext && row.secretIv && row.secretAuthTag
        ? { ciphertext: row.secretCiphertext, iv: row.secretIv, authTag: row.secretAuthTag }
        : null;

    return {
      id: row.id,
      type: row.type,
      config: row.config,
      selection: row.selection,
      hasSecret: row.hasSecret,
      secret,
    };
  }

  async createRun(sourceId: string, trigger: string | null): Promise<string> {
    const repo = this.dataSource.getRepository(CollectionRun);
    const run = await repo.save(repo.create({ sourceId, trigger, status: RunStatus.PENDING }));
    return run.id;
  }

  async patchRun(id: string, patch: RunPatch): Promise<void> {
    await this.dataSource.getRepository(CollectionRun).update({ id }, patch);
  }

  async loadRun(id: string): Promise<RunView> {
    return this.dataSource.getRepository(CollectionRun).findOneByOrFail({ id });
  }

  async persist(batch: PersistBatch): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      if (batch.workOrders.length > 0) {
        await mgr
          .getRepository(WorkOrder)
          .upsert(batch.workOrders as QueryDeepPartialEntity<WorkOrder>[], ['workOrderId']);
      }
      if (batch.batches.length > 0) {
        await mgr.getRepository(Batch).upsert(batch.batches as QueryDeepPartialEntity<Batch>[], ['batchId']);
      }
      if (batch.observations.length > 0) {
        await mgr
          .getRepository(SourceObservation)
          .insert(batch.observations as QueryDeepPartialEntity<SourceObservation>[]);
      }
      if (batch.errors.length > 0) {
        await mgr
          .getRepository(CollectionError)
          .insert(batch.errors as QueryDeepPartialEntity<CollectionError>[]);
      }
    });
  }

  async updateSourceOutcome(id: string, status: SourceStatus, lastError: string | null): Promise<void> {
    await this.dataSource.getRepository(Source).update({ id }, { status, lastError });
  }
}

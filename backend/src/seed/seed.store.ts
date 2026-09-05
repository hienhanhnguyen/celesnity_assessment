import { Injectable } from '@nestjs/common';
import { DataSource, type QueryDeepPartialEntity } from 'typeorm';
import { type ManagementEventType, SourceStatus } from '../common/domain/enums';
import { Batch, ManagementEvent, Source, WorkOrder } from '../database/entities';
import type {
  SeedBatchInput,
  SeedManagementInput,
  SeedSourceInput,
  SeedStore,
  SeedWorkOrderInput,
} from './seed.types';

@Injectable()
export class TypeOrmSeedStore implements SeedStore {
  constructor(private readonly dataSource: DataSource) {}

  async upsertWorkOrders(rows: SeedWorkOrderInput[]): Promise<void> {
    if (rows.length === 0) return;
    await this.dataSource
      .getRepository(WorkOrder)
      .upsert(rows as QueryDeepPartialEntity<WorkOrder>[], ['workOrderId']);
  }

  async upsertBatches(rows: SeedBatchInput[]): Promise<void> {
    if (rows.length === 0) return;
    await this.dataSource.getRepository(Batch).upsert(rows as QueryDeepPartialEntity<Batch>[], ['batchId']);
  }

  async sourceExists(name: string): Promise<boolean> {
    return (await this.dataSource.getRepository(Source).countBy({ name })) > 0;
  }

  async insertSource(row: SeedSourceInput): Promise<void> {
    const repo = this.dataSource.getRepository(Source);
    await repo.save(
      repo.create({
        type: row.type,
        name: row.name,
        config: row.config,
        selection: row.selection,
        status: SourceStatus.REGISTERED,
        hasSecret: false,
      }),
    );
  }

  async managementEventExists(batchId: string, type: ManagementEventType): Promise<boolean> {
    return (await this.dataSource.getRepository(ManagementEvent).countBy({ batchId, type })) > 0;
  }

  async insertManagementEvent(row: SeedManagementInput): Promise<void> {
    const repo = this.dataSource.getRepository(ManagementEvent);
    await repo.save(
      repo.create({
        batchId: row.batchId,
        type: row.type,
        organizationId: row.organizationId,
        actor: row.actor,
        note: row.note,
      }),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Batch, ManagementEvent } from '../database/entities';
import type { ManagementEventRecord, ManagementStore, NewManagementEvent } from './management.types';

@Injectable()
export class TypeOrmManagementStore implements ManagementStore {
  constructor(private readonly dataSource: DataSource) {}

  async batchExists(batchId: string): Promise<boolean> {
    return (await this.dataSource.getRepository(Batch).countBy({ batchId })) > 0;
  }

  async append(event: NewManagementEvent): Promise<ManagementEventRecord> {
    const repo = this.dataSource.getRepository(ManagementEvent);
    const saved = await repo.save(
      repo.create({
        batchId: event.batchId,
        type: event.type,
        organizationId: event.organizationId,
        actor: event.actor,
        note: event.note,
      }),
    );
    return {
      id: saved.id,
      batchId: saved.batchId,
      type: saved.type,
      organizationId: saved.organizationId,
      actor: saved.actor,
      note: saved.note,
      createdAt: saved.createdAt,
    };
  }
}

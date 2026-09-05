import { Injectable } from '@nestjs/common';
import { DataSource, type QueryDeepPartialEntity } from 'typeorm';
import type { SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';
import { CanonicalEvent, SourceObservation } from '../database/entities';
import type { CanonicalEventInput, NormalizationStore, ObservationRecord } from './normalization.types';

interface RawObservationRow {
  id: string;
  sourceId: string;
  sourceType: SourceType;
  runId: string;
  runStartedAt: Date | null;
  sourceRecordId: string;
  station: Station;
  batchId: string;
  quantity: number | string | null;
  eventTime: Date;
}

@Injectable()
export class TypeOrmNormalizationStore implements NormalizationStore {
  constructor(private readonly dataSource: DataSource) {}

  async loadObservations(): Promise<ObservationRecord[]> {
    const rows = await this.dataSource
      .getRepository(SourceObservation)
      .createQueryBuilder('o')
      .innerJoin('o.source', 's')
      .innerJoin('o.run', 'r')
      .select('o.id', 'id')
      .addSelect('o.sourceId', 'sourceId')
      .addSelect('s.type', 'sourceType')
      .addSelect('o.runId', 'runId')
      .addSelect('r.startedAt', 'runStartedAt')
      .addSelect('o.sourceRecordId', 'sourceRecordId')
      .addSelect('o.station', 'station')
      .addSelect('o.batchId', 'batchId')
      .addSelect('o.quantity', 'quantity')
      .addSelect('o.eventTime', 'eventTime')
      .getRawMany<RawObservationRow>();

    return rows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      sourceType: r.sourceType,
      runId: r.runId,
      runStartedAt: r.runStartedAt === null ? null : new Date(r.runStartedAt),
      sourceRecordId: r.sourceRecordId,
      station: r.station,
      batchId: r.batchId,
      quantity: r.quantity === null ? null : Number(r.quantity),
      eventTime: new Date(r.eventTime),
    }));
  }

  async replaceCanonical(events: CanonicalEventInput[]): Promise<void> {
    await this.dataSource.transaction(async (mgr) => {
      await mgr.createQueryBuilder().delete().from(CanonicalEvent).execute();
      if (events.length > 0) {
        await mgr
          .getRepository(CanonicalEvent)
          .insert(events as QueryDeepPartialEntity<CanonicalEvent>[]);
      }
    });
  }
}

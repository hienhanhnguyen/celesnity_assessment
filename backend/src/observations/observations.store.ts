import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { SourceType } from '../common/domain/enums';
import type { Station } from '../common/domain/station';
import { Batch, CanonicalEvent } from '../database/entities';
import type { BatchRecord, CanonicalRecord } from '../production/production.types';
import type { ObservationsStore } from './observations.types';

interface RawCanonicalRow {
  batchId: string;
  station: Station;
  sourceType: SourceType;
  quantity: number | string | null;
  eventTime: Date;
  late: boolean;
  conflictFlags: string[] | null;
  winningObservationId: string;
  supersededObservationIds: string[] | null;
  sourceId: string;
  runId: string;
  sourceRecordId: string;
}

@Injectable()
export class TypeOrmObservationsStore implements ObservationsStore {
  constructor(private readonly dataSource: DataSource) {}

  async loadCanonical(): Promise<CanonicalRecord[]> {
    const rows = await this.dataSource
      .getRepository(CanonicalEvent)
      .createQueryBuilder('c')
      .innerJoin('c.winningObservation', 'o')
      .select('c.batchId', 'batchId')
      .addSelect('c.station', 'station')
      .addSelect('c.sourceType', 'sourceType')
      .addSelect('c.quantity', 'quantity')
      .addSelect('c.eventTime', 'eventTime')
      .addSelect('c.late', 'late')
      .addSelect('c.conflictFlags', 'conflictFlags')
      .addSelect('c.winningObservationId', 'winningObservationId')
      .addSelect('c.supersededObservationIds', 'supersededObservationIds')
      .addSelect('o.sourceId', 'sourceId')
      .addSelect('o.runId', 'runId')
      .addSelect('o.sourceRecordId', 'sourceRecordId')
      .getRawMany<RawCanonicalRow>();

    return rows.map((row) => ({
      batchId: row.batchId,
      station: row.station,
      sourceType: row.sourceType,
      quantity: row.quantity === null ? null : Number(row.quantity),
      eventTime: new Date(row.eventTime),
      late: Boolean(row.late),
      conflictFlags: row.conflictFlags ?? [],
      winningObservationId: row.winningObservationId,
      supersededObservationIds: row.supersededObservationIds ?? [],
      sourceId: row.sourceId,
      runId: row.runId,
      sourceRecordId: row.sourceRecordId,
    }));
  }

  async loadBatches(): Promise<BatchRecord[]> {
    const batches = await this.dataSource.getRepository(Batch).find();
    return batches.map((batch) => ({
      batchId: batch.batchId,
      workOrderId: batch.workOrderId,
      lineId: batch.lineId,
    }));
  }
}

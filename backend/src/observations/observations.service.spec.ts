import { SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { BatchRecord, CanonicalRecord } from '../production/production.types';
import { ObservationsService } from './observations.service';
import type { ObservationsStore } from './observations.types';

const t = (minutesAgo: number) => new Date(Date.UTC(2026, 8, 3, 12, 0, 0) - minutesAgo * 60_000);

function canon(
  over: Partial<CanonicalRecord> & Pick<CanonicalRecord, 'batchId' | 'station'>,
): CanonicalRecord {
  return {
    sourceType: SourceType.DATABASE,
    quantity: 100,
    eventTime: t(10),
    late: false,
    conflictFlags: [],
    winningObservationId: `obs-${over.batchId}-${over.station}`,
    supersededObservationIds: [],
    sourceId: 'src-1',
    runId: 'run-1',
    sourceRecordId: `rec-${over.batchId}-${over.station}`,
    ...over,
  };
}

class FakeObservationsStore implements ObservationsStore {
  constructor(
    private readonly canonical: CanonicalRecord[],
    private readonly batches: BatchRecord[],
  ) {}

  async loadCanonical(): Promise<CanonicalRecord[]> {
    return this.canonical;
  }

  async loadBatches(): Promise<BatchRecord[]> {
    return this.batches;
  }
}

const BATCHES: BatchRecord[] = [
  { batchId: 'BATCH-0001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
  { batchId: 'BATCH-0005', workOrderId: 'WO-1003', lineId: 'LINE-B' },
];

const CANONICAL: CanonicalRecord[] = [
  canon({ batchId: 'BATCH-0001', station: Station.WASHING, sourceType: SourceType.DATABASE }),
  canon({
    batchId: 'BATCH-0001',
    station: Station.RECEIVING,
    sourceType: SourceType.CRAWLER,
    supersededObservationIds: ['obs-super-1'],
  }),
  canon({
    batchId: 'BATCH-0005',
    station: Station.SORTING,
    sourceType: SourceType.DATABASE,
    conflictFlags: ['QUANTITY_MISMATCH'],
    late: true,
  }),
];

function service(canonical = CANONICAL, batches = BATCHES): ObservationsService {
  return new ObservationsService(new FakeObservationsStore(canonical, batches));
}

describe('ObservationsService', () => {
  it('enriches each record with its work order + line and sorts (batchId, station)', async () => {
    const rows = await service().list();
    expect(rows.map((r) => [r.batchId, r.station])).toEqual([
      ['BATCH-0001', Station.RECEIVING],
      ['BATCH-0001', Station.WASHING],
      ['BATCH-0005', Station.SORTING],
    ]);
    expect(rows[0]).toMatchObject({ workOrderId: 'WO-1001', lineId: 'LINE-A' });
    expect(rows[2]).toMatchObject({ workOrderId: 'WO-1003', lineId: 'LINE-B' });
  });

  it('carries full provenance for each normalized record', async () => {
    const [receiving] = await service().list({ batchId: 'BATCH-0001', station: Station.RECEIVING });
    expect(receiving.provenance).toEqual({
      observationId: 'obs-BATCH-0001-RECEIVING',
      sourceId: 'src-1',
      runId: 'run-1',
      sourceRecordId: 'rec-BATCH-0001-RECEIVING',
      supersededObservationIds: ['obs-super-1'],
    });
  });

  it('carries the conflict flags and late marker through', async () => {
    const [sorting] = await service().list({ batchId: 'BATCH-0005' });
    expect(sorting.conflictFlags).toEqual(['QUANTITY_MISMATCH']);
    expect(sorting.late).toBe(true);
  });

  it('filters by batchId', async () => {
    const rows = await service().list({ batchId: 'BATCH-0005' });
    expect(rows.map((r) => r.batchId)).toEqual(['BATCH-0005']);
  });

  it('filters by station', async () => {
    const rows = await service().list({ station: Station.WASHING });
    expect(rows.map((r) => [r.batchId, r.station])).toEqual([['BATCH-0001', Station.WASHING]]);
  });

  it('filters by lineId, joining through the batch', async () => {
    const rows = await service().list({ lineId: 'LINE-B' });
    expect(rows.map((r) => r.batchId)).toEqual(['BATCH-0005']);
    expect(rows.every((r) => r.lineId === 'LINE-B')).toBe(true);
  });

  it('filters by sourceType', async () => {
    const rows = await service().list({ sourceType: SourceType.CRAWLER });
    expect(rows.map((r) => r.station)).toEqual([Station.RECEIVING]);
  });

  it('nulls workOrderId + lineId when the batch is not in the reference set', async () => {
    const orphan = canon({ batchId: 'BATCH-9999', station: Station.DRYING });
    const rows = await service([orphan], BATCHES).list();
    expect(rows[0]).toMatchObject({ batchId: 'BATCH-9999', workOrderId: null, lineId: null });
  });
});

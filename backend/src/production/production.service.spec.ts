import { NotFoundException } from '@nestjs/common';
import { BatchState, ManagementEventType, SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { Clock } from '../common/time/clock';
import type { AppConfigService } from '../config/app-config.service';
import { ProductionService } from './production.service';
import type {
  BatchRecord,
  CanonicalRecord,
  LineView,
  ManagementRecord,
  ProductionStore,
  StationView,
} from './production.types';

class FakeStore implements ProductionStore {
  constructor(
    private readonly batches: BatchRecord[],
    private readonly events: CanonicalRecord[],
    private readonly management: ManagementRecord[],
  ) {}
  async loadBatches(): Promise<BatchRecord[]> {
    return this.batches;
  }
  async loadCanonicalEvents(): Promise<CanonicalRecord[]> {
    return this.events;
  }
  async loadManagementEvents(): Promise<ManagementRecord[]> {
    return this.management;
  }
}

// fixtures

const NOW = new Date('2026-09-03T12:00:00.000Z');
const mins = (n: number) => new Date(NOW.getTime() - n * 60_000);
const clock: Clock = { now: () => NOW };
const config = {
  domain: { staleThresholdMinutes: 15, seedOrgId: 'org-celesnity-001', seedActor: 'manager@celesnity.local' },
} as unknown as AppConfigService;

let seq = 0;
function cell(
  batchId: string,
  station: Station,
  minutesAgo: number,
  quantity: number | null,
  over: Partial<CanonicalRecord> = {},
): CanonicalRecord {
  seq += 1;
  return {
    batchId,
    station,
    sourceType: SourceType.DATABASE,
    quantity,
    eventTime: mins(minutesAgo),
    late: false,
    conflictFlags: [],
    winningObservationId: `obs-${seq}`,
    supersededObservationIds: [],
    sourceId: 'src-1',
    runId: 'run-1',
    sourceRecordId: `rec-${seq}`,
    ...over,
  };
}

const BATCHES: BatchRecord[] = [
  { batchId: 'BATCH-0001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
  { batchId: 'BATCH-0004', workOrderId: 'WO-1002', lineId: 'LINE-A' },
  { batchId: 'BATCH-0008', workOrderId: 'WO-1005', lineId: 'LINE-A' }, // planned, no events
  { batchId: 'BATCH-0005', workOrderId: 'WO-1003', lineId: 'LINE-B' },
  { batchId: 'BATCH-0007', workOrderId: 'WO-1004', lineId: 'LINE-B' },
];

const EVENTS: CanonicalRecord[] = [
  // full chain, COMPLETED, fresh
  cell('BATCH-0001', Station.RECEIVING, 90, null, { sourceType: SourceType.CRAWLER }),
  cell('BATCH-0001', Station.SORTING, 75, 100),
  cell('BATCH-0001', Station.WASHING, 55, 100),
  cell('BATCH-0001', Station.DRYING, 35, 100),
  cell('BATCH-0001', Station.FOLDING, 18, 100),
  cell('BATCH-0001', Station.DISPATCH, 6, 100, { sourceType: SourceType.API }),
  // missing SORTING, IN_PROGRESS - DRYING, fresh
  cell('BATCH-0004', Station.RECEIVING, 60, null, { sourceType: SourceType.CRAWLER }),
  cell('BATCH-0004', Station.WASHING, 35, 70),
  cell('BATCH-0004', Station.DRYING, 14, 70),
  // IN_PROGRESS - WASHING, stale (50m)
  cell('BATCH-0005', Station.RECEIVING, 120, null, { sourceType: SourceType.CRAWLER }),
  cell('BATCH-0005', Station.SORTING, 100, 50),
  cell('BATCH-0005', Station.WASHING, 50, 50),
  // BLOCKED, currently SORTING
  cell('BATCH-0007', Station.RECEIVING, 50, null, { sourceType: SourceType.CRAWLER }),
  cell('BATCH-0007', Station.SORTING, 40, 40),
];

const MANAGEMENT: ManagementRecord[] = [
  {
    id: 'm-1',
    batchId: 'BATCH-0007',
    type: ManagementEventType.BLOCK,
    actor: 'manager@celesnity.local',
    organizationId: 'org-celesnity-001',
    note: 'jam',
    createdAt: mins(30),
  },
];

function service(): ProductionService {
  return new ProductionService(new FakeStore(BATCHES, EVENTS, MANAGEMENT), clock, config);
}

const stationOf = (line: LineView, station: Station): StationView =>
  line.stations.find((slot) => slot.station === station)!;

describe('ProductionService.getConfig', () => {
  it('returns threshold, station order, and seeded identity', () => {
    expect(service().getConfig()).toEqual({
      staleThresholdMinutes: 15,
      stations: [
        Station.RECEIVING,
        Station.SORTING,
        Station.WASHING,
        Station.DRYING,
        Station.FOLDING,
        Station.DISPATCH,
      ],
      seed: { organizationId: 'org-celesnity-001', actor: 'manager@celesnity.local' },
    });
  });
});

describe('ProductionService.getBatches', () => {
  it('returns every batch summary ordered by batchId, with derived state', async () => {
    const summaries = await service().getBatches();
    expect(summaries.map((s) => s.batchId)).toEqual([
      'BATCH-0001',
      'BATCH-0004',
      'BATCH-0005',
      'BATCH-0007',
      'BATCH-0008',
    ]);
    const byId = new Map(summaries.map((s) => [s.batchId, s.state]));
    expect(byId.get('BATCH-0001')).toBe(BatchState.COMPLETED);
    expect(byId.get('BATCH-0004')).toBe(BatchState.IN_PROGRESS);
    expect(byId.get('BATCH-0005')).toBe(BatchState.IN_PROGRESS);
    expect(byId.get('BATCH-0007')).toBe(BatchState.BLOCKED);
    expect(byId.get('BATCH-0008')).toBe(BatchState.PLANNED);
  });

  it('filters by line', async () => {
    const summaries = await service().getBatches({ lineId: 'LINE-B' });
    expect(summaries.map((s) => s.batchId)).toEqual(['BATCH-0005', 'BATCH-0007']);
  });

  it('filters by state', async () => {
    const summaries = await service().getBatches({ state: BatchState.IN_PROGRESS });
    expect(summaries.map((s) => s.batchId)).toEqual(['BATCH-0004', 'BATCH-0005']);
  });

  it('filters by line and state together', async () => {
    const summaries = await service().getBatches({ lineId: 'LINE-A', state: BatchState.IN_PROGRESS });
    expect(summaries.map((s) => s.batchId)).toEqual(['BATCH-0004']);
  });
});

describe('ProductionService.getBatch', () => {
  it('returns a timeline in station order with provenance links, plus management history', async () => {
    const detail = await service().getBatch('BATCH-0004');

    expect(detail.currentStation).toBe(Station.DRYING);
    expect(detail.currentQuantity).toBe(70);
    expect(detail.state).toBe(BatchState.IN_PROGRESS);
    expect(detail.indicators.missingData).toBe(true);
    expect(detail.timeline.map((entry) => entry.station)).toEqual([
      Station.RECEIVING,
      Station.WASHING,
      Station.DRYING,
    ]);
    expect(detail.timeline[0].provenance).toMatchObject({
      observationId: expect.any(String),
      sourceId: 'src-1',
      runId: 'run-1',
      sourceRecordId: expect.any(String),
      supersededObservationIds: [],
    });
    expect(detail.managementEvents).toEqual([]);
  });

  it('reflects a BLOCK in state, indicators, and management history', async () => {
    const detail = await service().getBatch('BATCH-0007');

    expect(detail.state).toBe(BatchState.BLOCKED);
    expect(detail.indicators.blocked).toBe(true);
    expect(detail.managementEvents).toHaveLength(1);
    expect(detail.managementEvents[0]).toMatchObject({
      type: ManagementEventType.BLOCK,
      actor: 'manager@celesnity.local',
      organizationId: 'org-celesnity-001',
      note: 'jam',
    });
  });

  it('404s an unknown batch', async () => {
    await expect(service().getBatch('BATCH-NOPE')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProductionService.getLines', () => {
  it('builds one board per line, ordered by lineId', async () => {
    const lines = await service().getLines();
    expect(lines.map((line) => line.lineId)).toEqual(['LINE-A', 'LINE-B']);
  });

  it('sums completed quantity per station without double-counting, and rolls up staleness', async () => {
    const [lineA] = await service().getLines();

    expect(lineA.batchCount).toBe(3);
    expect(stationOf(lineA, Station.WASHING).completedQuantity).toBe(170);
    expect(stationOf(lineA, Station.DRYING).completedQuantity).toBe(170);
    expect(stationOf(lineA, Station.SORTING).completedQuantity).toBe(100);
    expect(stationOf(lineA, Station.RECEIVING).completedQuantity).toBe(0);
    expect(stationOf(lineA, Station.DISPATCH).stale).toBe(false);
    expect(stationOf(lineA, Station.WASHING).stale).toBe(true);
  });

  it('counts WIP as non-completed batches at their current station (a blocked batch still occupies its station)', async () => {
    const lines = await service().getLines();
    const lineA = lines[0];
    const lineB = lines[1];

    expect(stationOf(lineA, Station.DRYING).wip).toBe(1);
    expect(stationOf(lineA, Station.DISPATCH).wip).toBe(0);
    expect(stationOf(lineB, Station.WASHING).wip).toBe(1);
    expect(stationOf(lineB, Station.SORTING)).toMatchObject({ wip: 1, completedQuantity: 90 });
  });

  it('leaves an untouched station empty (no last event, not stale)', async () => {
    const lines = await service().getLines();
    const lineB = lines[1];
    expect(stationOf(lineB, Station.DRYING)).toMatchObject({
      wip: 0,
      completedQuantity: 0,
      lastEventTime: null,
      stale: false,
    });
  });
});

describe('ProductionService.getLine', () => {
  it('returns one line board', async () => {
    const line = await service().getLine('LINE-B');
    expect(line.lineId).toBe('LINE-B');
    expect(line.batchCount).toBe(2);
  });

  it('404s an unknown line', async () => {
    await expect(service().getLine('LINE-Z')).rejects.toBeInstanceOf(NotFoundException);
  });
});

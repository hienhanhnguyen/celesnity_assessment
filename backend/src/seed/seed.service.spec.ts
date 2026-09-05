import { ManagementEventType, SourceType } from '../common/domain/enums';
import type { AppConfigService } from '../config/app-config.service';
import { SeedService } from './seed.service';
import type {
  SeedBatchInput,
  SeedManagementInput,
  SeedSourceInput,
  SeedStore,
  SeedWorkOrderInput,
} from './seed.types';

class FakeSeedStore implements SeedStore {
  workOrders: SeedWorkOrderInput[] = [];
  batches: SeedBatchInput[] = [];
  sources: SeedSourceInput[] = [];
  managementEvents: SeedManagementInput[] = [];

  async upsertWorkOrders(rows: SeedWorkOrderInput[]): Promise<void> {
    for (const row of rows) {
      const i = this.workOrders.findIndex((w) => w.workOrderId === row.workOrderId);
      if (i >= 0) this.workOrders[i] = row;
      else this.workOrders.push(row);
    }
  }

  async upsertBatches(rows: SeedBatchInput[]): Promise<void> {
    for (const row of rows) {
      const i = this.batches.findIndex((b) => b.batchId === row.batchId);
      if (i >= 0) this.batches[i] = row;
      else this.batches.push(row);
    }
  }

  async sourceExists(name: string): Promise<boolean> {
    return this.sources.some((s) => s.name === name);
  }

  async insertSource(row: SeedSourceInput): Promise<void> {
    this.sources.push(row);
  }

  async managementEventExists(batchId: string, type: ManagementEventType): Promise<boolean> {
    return this.managementEvents.some((e) => e.batchId === batchId && e.type === type);
  }

  async insertManagementEvent(row: SeedManagementInput): Promise<void> {
    this.managementEvents.push(row);
  }
}

const config = {
  sources: {
    appApiBaseUrl: 'http://fixtures:4000',
    supplierCrawlerBaseUrl: 'http://fixtures:4000',
  },
  domain: {
    staleThresholdMinutes: 15,
    seedOrgId: 'org-celesnity-001',
    seedActor: 'manager@celesnity.local',
  },
} as unknown as AppConfigService;

describe('SeedService', () => {
  it('seeds the reference catalogue, secret-free sources, and the BATCH-0007 block', async () => {
    const store = new FakeSeedStore();
    await new SeedService(store, config).seed();

    expect(store.workOrders.map((w) => w.workOrderId)).toEqual([
      'WO-1001',
      'WO-1002',
      'WO-1003',
      'WO-1004',
      'WO-1005',
    ]);
    expect(store.batches).toHaveLength(8);

    expect(store.sources.map((s) => s.name)).toEqual(['Application API', 'Supplier Crawler']);
    expect(store.sources[0].config).toEqual({ baseUrl: 'http://fixtures:4000' });
    expect(store.sources[1].config).toMatchObject({
      baseUrl: 'http://fixtures:4000',
      startPath: '/suppliers/deliveries',
    });
    expect(store.sources.some((s) => s.type === SourceType.DATABASE)).toBe(false);

    expect(store.managementEvents).toEqual([
      {
        batchId: 'BATCH-0007',
        type: ManagementEventType.BLOCK,
        organizationId: 'org-celesnity-001',
        actor: 'manager@celesnity.local',
        note: expect.any(String),
      },
    ]);
  });

  it('keeps every seeded batch pointing at a seeded work order', async () => {
    const store = new FakeSeedStore();
    await new SeedService(store, config).seed();

    const workOrderIds = new Set(store.workOrders.map((w) => w.workOrderId));
    expect(store.batches.every((b) => workOrderIds.has(b.workOrderId))).toBe(true);
  });

  it('is idempotent - a second seed inserts no duplicate sources, block, or reference rows', async () => {
    const store = new FakeSeedStore();
    const svc = new SeedService(store, config);
    await svc.seed();
    await svc.seed();

    expect(store.workOrders).toHaveLength(5);
    expect(store.batches).toHaveLength(8);
    expect(store.sources).toHaveLength(2);
    expect(store.managementEvents).toHaveLength(1);
  });

  it('runs the seed on application bootstrap', async () => {
    const store = new FakeSeedStore();
    await new SeedService(store, config).onApplicationBootstrap();
    expect(store.sources).toHaveLength(2);
    expect(store.managementEvents).toHaveLength(1);
  });
});

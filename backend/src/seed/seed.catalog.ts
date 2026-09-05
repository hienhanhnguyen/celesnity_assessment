import { ManagementEventType, SourceType } from '../common/domain/enums';
import type { SeedBatchInput, SeedSourceInput, SeedWorkOrderInput } from './seed.types';

export const SEED_WORK_ORDERS: SeedWorkOrderInput[] = [
  { workOrderId: 'WO-1001', lineId: 'LINE-A', status: 'ACTIVE' },
  { workOrderId: 'WO-1002', lineId: 'LINE-A', status: 'ACTIVE' },
  { workOrderId: 'WO-1003', lineId: 'LINE-B', status: 'ACTIVE' },
  { workOrderId: 'WO-1004', lineId: 'LINE-B', status: 'ACTIVE' },
  { workOrderId: 'WO-1005', lineId: 'LINE-A', status: 'PLANNED' },
];

export const SEED_BATCHES: SeedBatchInput[] = [
  { batchId: 'BATCH-0001', workOrderId: 'WO-1001', lineId: 'LINE-A' },
  { batchId: 'BATCH-0002', workOrderId: 'WO-1001', lineId: 'LINE-A' },
  { batchId: 'BATCH-0003', workOrderId: 'WO-1002', lineId: 'LINE-A' },
  { batchId: 'BATCH-0004', workOrderId: 'WO-1002', lineId: 'LINE-A' },
  { batchId: 'BATCH-0005', workOrderId: 'WO-1003', lineId: 'LINE-B' },
  { batchId: 'BATCH-0006', workOrderId: 'WO-1003', lineId: 'LINE-B' },
  { batchId: 'BATCH-0007', workOrderId: 'WO-1004', lineId: 'LINE-B' },
  { batchId: 'BATCH-0008', workOrderId: 'WO-1005', lineId: 'LINE-A' },
];

export const SEED_MANAGEMENT_EVENTS: { batchId: string; type: ManagementEventType; note: string | null }[] = [
  { batchId: 'BATCH-0007', type: ManagementEventType.BLOCK, note: 'Blocked pending supplier quality hold' },
];

export function buildSeedSources(appApiBaseUrl: string, supplierCrawlerBaseUrl: string): SeedSourceInput[] {
  return [
    {
      type: SourceType.API,
      name: 'Application API',
      config: { baseUrl: appApiBaseUrl },
      selection: null,
    },
    {
      type: SourceType.CRAWLER,
      name: 'Supplier Crawler',
      config: { baseUrl: supplierCrawlerBaseUrl, startPath: '/suppliers/deliveries' },
      selection: null,
    },
  ];
}

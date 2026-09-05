import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(import.meta.dirname, '..', 'data');

const BOOT: Date = process.env.FIXTURES_NOW ? new Date(process.env.FIXTURES_NOW) : new Date();

function minutesAgoIso(minutes: number): string {
  return new Date(BOOT.getTime() - minutes * 60_000).toISOString();
}

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf8')) as T;
}

// Raw record shapes (as stored on disk)

interface WorkOrderRow {
  workOrderId: string;
  lineId: string;
  status: string;
  customer: string;
}
interface BatchRow {
  batchId: string;
  workOrderId: string;
  lineId: string;
}
interface TimedRow {
  recordId: string;
  batchId: string | null;
  lineId: string;
  quantity: number | null;
  minutesAgo: number;
}
interface DeliveryRow extends TimedRow {
  supplier: string;
  malformed?: boolean;
}
interface DispatchRow extends TimedRow {
  destination: string;
}

// Public shapes (as served)

export type WorkOrder = WorkOrderRow;
export type BatchMapping = BatchRow;

export interface ReceivingObservation {
  recordId: string;
  batchId: string;
  lineId: string;
  station: 'RECEIVING';
  eventType: 'RECEIVING_LOGGED';
  quantity: number | null;
  eventTime: string;
}
export interface DispatchObservation {
  recordId: string;
  batchId: string;
  lineId: string;
  station: 'DISPATCH';
  eventType: 'DISPATCH_ACCEPTED';
  quantity: number | null;
  eventTime: string;
  destination: string;
}
// A supplier delivery as the crawler will see it. Malformed rows keep null fields
export interface DeliveryRecord {
  recordId: string;
  batchId: string | null;
  lineId: string;
  quantity: number | null;
  eventTime: string;
  supplier: string;
  malformed: boolean;
}

export interface Dataset {
  boot: Date;
  workOrders: WorkOrder[];
  batches: BatchMapping[];
  receiving: ReceivingObservation[];
  dispatch: DispatchObservation[];
  deliveries: DeliveryRecord[];
}

export function loadDataset(): Dataset {
  const receiving = readJson<TimedRow[]>('receiving.json').map<ReceivingObservation>((r) => ({
    recordId: r.recordId,
    batchId: r.batchId as string,
    lineId: r.lineId,
    station: 'RECEIVING',
    eventType: 'RECEIVING_LOGGED',
    quantity: r.quantity,
    eventTime: minutesAgoIso(r.minutesAgo),
  }));

  const dispatch = readJson<DispatchRow[]>('dispatch.json').map<DispatchObservation>((r) => ({
    recordId: r.recordId,
    batchId: r.batchId as string,
    lineId: r.lineId,
    station: 'DISPATCH',
    eventType: 'DISPATCH_ACCEPTED',
    quantity: r.quantity,
    eventTime: minutesAgoIso(r.minutesAgo),
    destination: r.destination,
  }));

  const deliveries = readJson<DeliveryRow[]>('deliveries.json').map<DeliveryRecord>((r) => ({
    recordId: r.recordId,
    batchId: r.batchId,
    lineId: r.lineId,
    quantity: r.quantity,
    eventTime: minutesAgoIso(r.minutesAgo),
    supplier: r.supplier,
    malformed: r.malformed === true,
  }));

  return {
    boot: BOOT,
    workOrders: readJson<WorkOrderRow[]>('work-orders.json'),
    batches: readJson<BatchRow[]>('batches.json'),
    receiving,
    dispatch,
    deliveries,
  };
}

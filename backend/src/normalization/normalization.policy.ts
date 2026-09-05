import { SourceType } from '../common/domain/enums';
import { Station } from '../common/domain/station';
import type { ObservationRecord } from './normalization.types';

export enum ConflictFlag {
  QUANTITY_MISMATCH = 'QUANTITY_MISMATCH',
}

export const STATION_AUTHORITY: Readonly<Record<Station, readonly SourceType[]>> = {
  [Station.RECEIVING]: [SourceType.CRAWLER, SourceType.API],
  [Station.SORTING]: [SourceType.DATABASE],
  [Station.WASHING]: [SourceType.DATABASE],
  [Station.DRYING]: [SourceType.DATABASE],
  [Station.FOLDING]: [SourceType.DATABASE],
  [Station.DISPATCH]: [SourceType.API, SourceType.DATABASE],
};

export function authorityIndex(station: Station, type: SourceType): number {
  const order = STATION_AUTHORITY[station];
  const idx = order.indexOf(type);
  return idx === -1 ? order.length : idx;
}

const runTime = (o: ObservationRecord): number => (o.runStartedAt ? o.runStartedAt.getTime() : -Infinity);

export function compareObservations(a: ObservationRecord, b: ObservationRecord, station: Station): number {
  const byAuthority = authorityIndex(station, a.sourceType) - authorityIndex(station, b.sourceType);
  if (byAuthority !== 0) return byAuthority; // more authoritative (lower index) first

  const byEventTime = b.eventTime.getTime() - a.eventTime.getTime();
  if (byEventTime !== 0) return byEventTime; // later event first

  const byRun = runTime(b) - runTime(a);
  if (byRun !== 0) return byRun; // later run first

  if (a.sourceRecordId < b.sourceRecordId) return -1; // smaller record id first
  if (a.sourceRecordId > b.sourceRecordId) return 1;
  return 0;
}

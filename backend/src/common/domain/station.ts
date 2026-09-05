export enum Station {
  RECEIVING = 'RECEIVING',
  SORTING = 'SORTING',
  WASHING = 'WASHING',
  DRYING = 'DRYING',
  FOLDING = 'FOLDING',
  DISPATCH = 'DISPATCH',
}

export const STATION_ORDER: readonly Station[] = [
  Station.RECEIVING,
  Station.SORTING,
  Station.WASHING,
  Station.DRYING,
  Station.FOLDING,
  Station.DISPATCH,
];

// 1 based index of a station, 0 if unknown
export function stationIndex(station: Station): number {
  return STATION_ORDER.indexOf(station) + 1;
}

export function isStation(value: unknown): value is Station {
  return typeof value === 'string' && (STATION_ORDER as readonly string[]).includes(value);
}

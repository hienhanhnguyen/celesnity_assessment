export interface PageEnvelope<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export const MAX_PAGES = 1000;

export interface PagedWalk<T> {
  rows: T[];
  pages: number;
}

export async function fetchAllPages<T>(
  getPage: (page: number) => Promise<PageEnvelope<T>>,
): Promise<PagedWalk<T>> {
  const rows: T[] = [];
  const visited = new Set<number>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES && !visited.has(page)) {
    visited.add(page);
    const env = await getPage(page);
    if (Array.isArray(env.data)) rows.push(...env.data);
    totalPages =
      Number.isFinite(env.totalPages) && env.totalPages > 0 ? Math.floor(env.totalPages) : page;
    page += 1;
  }

  return { rows, pages: visited.size };
}

import type { Paginated } from "@/lib/api";

/** The server's largest page; it 400s above this. */
const PAGE_SIZE = 100;

/**
 * Every page of a paginated list endpoint, fetched one after another (not in parallel, to stay clear of the
 * rate limiter) and joined into one list -- for pickers that filter in the browser, which would otherwise only
 * search the newest 100 rows. Same helper as the mobile app's (mobile/src/lib/all-pages.ts).
 *
 * Rows are kept once by id: something created mid-fetch shifts later pages down a row and would repeat one.
 */
export async function fetchAllPages<T extends { id: string }>(
  endpoint: string,
  fetchPage: (url: string) => Promise<Paginated<T>>
): Promise<Paginated<T>> {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = (page: number) => `${endpoint}${sep}limit=${PAGE_SIZE}&page=${page}`;

  const first = await fetchPage(url(1));
  const seen = new Set<string>();
  const results: T[] = [];
  const keep = (rows: T[]) => {
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      results.push(row);
    }
  };

  keep(first.results);
  for (let page = 2; page <= first.totalPages; page++) keep((await fetchPage(url(page))).results);

  return { ...first, results, page: 1, limit: results.length, totalPages: 1 };
}

// Run with `bun test src/lib` -- bun's built-in runner, no setup needed.
import { expect, test } from "bun:test";
import { fetchAllPages } from "./all-pages";
import type { Paginated } from "./api";

const rows = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ id: `r${from + i}` }));

test("joins every page, one request after another, keeping each row once", async () => {
  const urls: string[] = [];
  const pages: Record<string, Paginated<{ id: string }>> = {
    "1": { results: rows(0, 100), page: 1, limit: 100, total: 230, totalPages: 3 },
    // A row created mid-fetch shifts page 2 down: r99 shows up again.
    "2": { results: rows(99, 199), page: 2, limit: 100, total: 231, totalPages: 3 },
    "3": { results: rows(199, 231), page: 3, limit: 100, total: 231, totalPages: 3 },
  };
  const all = await fetchAllPages("/items?is_active=true", async (url) => {
    urls.push(url);
    return pages[new URL(url, "http://x").searchParams.get("page")!]!;
  });
  expect(urls).toEqual([
    "/items?is_active=true&limit=100&page=1",
    "/items?is_active=true&limit=100&page=2",
    "/items?is_active=true&limit=100&page=3",
  ]);
  expect(all.results).toHaveLength(231);
  expect(new Set(all.results.map((r) => r.id)).size).toBe(231);
});

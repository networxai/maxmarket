/**
 * Pagination — page, pageSize (1–100), totalCount, totalPages.
 */
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export function parsePaginationQuery(
  page?: unknown,
  pageSize?: unknown
): PaginationQuery {
  const p = Math.max(1, parseInt(String(page ?? DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const ps = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(String(pageSize ?? DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE)
  );
  return { page: p, pageSize: ps };
}

export function paginationMeta(
  totalCount: number,
  query: PaginationQuery
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
  return {
    page: query.page,
    pageSize: query.pageSize,
    totalCount,
    totalPages,
  };
}

export function skipTake(query: PaginationQuery): { skip: number; take: number } {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

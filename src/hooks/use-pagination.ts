"use client";

import { useEffect, useMemo, useState } from "react";

export const DEFAULT_PAGE_SIZE = 10;
export const CUSTOMER_PAGE_SIZE = 5;
export const EXPENSE_PAGE_SIZE = 5;

export function usePagination<T>(
  items: T[],
  pageSize = DEFAULT_PAGE_SIZE,
  resetKey?: string | number
) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems: items.length,
    paginatedItems,
  };
}

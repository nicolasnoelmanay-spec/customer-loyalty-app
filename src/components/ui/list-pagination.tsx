"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ListPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ListPagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: ListPaginationProps) {
  if (totalItems <= pageSize) {
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t px-3 py-3 sm:px-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-sm text-muted-foreground sm:text-left">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-center text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </span>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

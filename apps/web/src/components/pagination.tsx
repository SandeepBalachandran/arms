import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Page links for long lists. Pages live in the URL (?page=2), so the back
// button, refresh and shared links keep the place; other params are kept.

export const PAGE_SIZE = 25;

/** The `page` search param as a page number within 1..pageCount. */
export function pageOf<T>(items: T[], pageParam: string | string[] | undefined, size = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const asked = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Number.isInteger(asked) ? Math.min(Math.max(asked, 1), pageCount) : 1;
  return { page, pageCount, total: items.length, first: (page - 1) * size, items: items.slice((page - 1) * size, page * size) };
}

/** 1 … 4 5 6 … 12: the first, the last and the pages either side of this one. */
function pageNumbers(page: number, pageCount: number) {
  const keep = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const out: (number | "gap")[] = [];
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (out.length && n - (out.at(-1) as number) > 1) out.push("gap");
    out.push(n);
  }
  return out;
}

export function Pagination({ page, pageCount, total, first, shown, params, noun = "items" }: {
  page: number;
  pageCount: number;
  total: number;
  first: number;
  shown: number;
  // The page's other search params, kept on every link.
  params: Record<string, string | string[] | undefined>;
  noun?: string;
}) {
  if (total === 0) return null;
  const href = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (k !== "page" && typeof v === "string" && v) qs.set(k, v);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `?${s}` : "?";
  };
  const box = "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2";
  const step = clsx(box, "border-border bg-surface hover:bg-border/40");

  return (
    <nav aria-label="Pages" className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
      <p className="text-muted">
        {pageCount > 1 ? `${first + 1}–${first + shown} of ${total} ${noun}` : `${total} ${noun}`}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Previous page" className={step}><ChevronLeft className="size-4" /></Link>
          ) : (
            <span aria-hidden className={clsx(step, "opacity-40")}><ChevronLeft className="size-4" /></span>
          )}
          {/* Phones: just "2 / 6"; wider screens get the page numbers. */}
          <span className="px-2 tabular-nums sm:hidden">{page} / {pageCount}</span>
          <span className="hidden items-center gap-1 sm:flex">
            {pageNumbers(page, pageCount).map((n, i) =>
              n === "gap" ? (
                <span key={`gap${i}`} className="px-1 text-muted">…</span>
              ) : (
                <Link
                  key={n}
                  href={href(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={clsx(n === page ? clsx(box, "border-foreground bg-foreground text-background") : step, "tabular-nums")}
                >
                  {n}
                </Link>
              ),
            )}
          </span>
          {page < pageCount ? (
            <Link href={href(page + 1)} aria-label="Next page" className={step}><ChevronRight className="size-4" /></Link>
          ) : (
            <span aria-hidden className={clsx(step, "opacity-40")}><ChevronRight className="size-4" /></span>
          )}
        </div>
      )}
    </nav>
  );
}

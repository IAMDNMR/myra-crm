import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";
export interface SortState<K extends string = string> {
  key: K;
  dir: SortDir;
}

interface Props<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onChange: (s: SortState<K>) => void;
  align?: "left" | "right" | "center";
  className?: string;
}

export function SortableTh<K extends string>({ label, sortKey, sort, onChange, align = "left", className }: Props<K>) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`p-3 text-${align} ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onChange({ key: sortKey, dir: active && sort.dir === "asc" ? "desc" : "asc" })}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        <Icon className={`h-3 w-3 ${active ? "text-foreground" : "text-muted-foreground/60"}`} />
      </button>
    </th>
  );
}

export function sortRows<T>(rows: T[], sort: SortState, getter: (r: T, k: string) => any): T[] {
  const arr = [...rows];
  arr.sort((a, b) => {
    const av = getter(a, sort.key);
    const bv = getter(b, sort.key);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return sort.dir === "asc" ? av - bv : bv - av;
    const as = String(av).toLowerCase();
    const bs = String(bv).toLowerCase();
    return sort.dir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
  });
  return arr;
}

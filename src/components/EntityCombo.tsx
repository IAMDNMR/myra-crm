import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface ComboOption { value: string; label: string; sub?: string }

interface Props {
  table: "contacts" | "companies" | "deals" | "profiles";
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}

export function EntityCombo({ table, value, onChange, placeholder }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const { data: options = [] } = useQuery({
    queryKey: [table, "combo", q],
    queryFn: async (): Promise<ComboOption[]> => {
      try {
        const data = await api.get(`/${table}`);
        const term = q.toLowerCase();
        
        let filtered = (data ?? []);
        if (q) {
          filtered = filtered.filter((r: any) => 
            Object.values(r).some(val => 
              typeof val === 'string' && val.toLowerCase().includes(term)
            )
          );
        }
        
        return filtered.slice(0, 20).map((r: any) => {
          if (table === "contacts") return { value: r.id, label: `${r.first_name} ${r.last_name}`, sub: r.email ?? undefined };
          if (table === "companies") return { value: r.id, label: r.name, sub: r.domain ?? undefined };
          if (table === "deals") return { value: r.id, label: r.name };
          return { value: r.id, label: r.full_name ?? r.email ?? "—", sub: r.email ?? undefined };
        });
      } catch (e) {
        return [];
      }
    },
  });

  const { data: selected } = useQuery({
    queryKey: [table, "selected", value],
    queryFn: async () => {
      if (!value) return null;
      try {
        const r: any = await api.get(`/${table}/${value}`);
        return table === "contacts" ? `${r.first_name} ${r.last_name}` : (r.name ?? r.full_name ?? r.email);
      } catch (e) {
        return null;
      }
    },
    enabled: !!value,
  });

  useEffect(() => { if (!open) setQ(""); }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full h-10 px-3 border rounded-md text-sm text-left bg-background flex items-center justify-between"
      >
        <span className={selected ? "" : "text-muted-foreground"}>{selected ?? placeholder ?? "Select..."}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-64 overflow-auto">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-2 border-b text-sm outline-none bg-transparent"
          />
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Clear
            </button>
          )}
          {options.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">No results</div>
          ) : (
            options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              >
                <div>{o.label}</div>
                {o.sub && <div className="text-xs text-muted-foreground">{o.sub}</div>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

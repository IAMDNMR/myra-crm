import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { api } from "@/lib/api";
import {
  Users,
  Building2,
  KanbanSquare,
  CheckSquare,
  BarChart3,
  Settings,
  LayoutDashboard,
  Plus,
} from "lucide-react";

interface Hit {
  id: string;
  title: string;
  sub?: string;
  to: string;
  group: "Contacts" | "Companies" | "Deals";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const term = q.trim().toLowerCase();
    if (term.length < 1) {
      setHits([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [contacts, companies, deals] = await Promise.all([
          api.get("/contacts"),
          api.get("/companies"),
          api.get("/deals"),
        ]);
        if (cancelled) return;

        const filteredContacts: any[] = (Array.isArray(contacts) ? contacts : []).filter(
          (r: any) =>
            r.first_name?.toLowerCase().includes(term) ||
            r.last_name?.toLowerCase().includes(term) ||
            r.email?.toLowerCase().includes(term),
        ).slice(0, 5);

        const filteredCompanies: any[] = (Array.isArray(companies) ? companies : []).filter(
          (r: any) => r.name?.toLowerCase().includes(term),
        ).slice(0, 5);

        const filteredDeals: any[] = (Array.isArray(deals) ? deals : []).filter(
          (r: any) => r.name?.toLowerCase().includes(term),
        ).slice(0, 5);

        const next: Hit[] = [
          ...filteredContacts.map((r: any) => ({
            id: r.id,
            title: `${r.first_name} ${r.last_name}`,
            sub: r.email ?? undefined,
            to: `/contacts/${r.id}`,
            group: "Contacts" as const,
          })),
          ...filteredCompanies.map((r: any) => ({
            id: r.id,
            title: r.name,
            sub: r.domain ?? undefined,
            to: `/companies/${r.id}`,
            group: "Companies" as const,
          })),
          ...filteredDeals.map((r: any) => ({
            id: r.id,
            title: r.name,
            to: `/deals/${r.id}`,
            group: "Deals" as const,
          })),
        ];
        setHits(next);
      } catch {
        // Silently fail — search results just stay empty
        if (!cancelled) setHits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, open]);

  const go = (to: string) => {
    setOpen(false);
    setQ("");
    navigate({ to });
  };

  const grouped = hits.reduce<Record<string, Hit[]>>((acc, h) => {
    (acc[h.group] ||= []).push(h);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search contacts, companies, deals..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>{q ? "No results found." : "Start typing to search..."}</CommandEmpty>

        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((h) => (
              <CommandItem key={`${group}-${h.id}`} value={`${group}-${h.title}-${h.id}`} onSelect={() => go(h.to)}>
                <span className="font-medium">{h.title}</span>
                {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="h-4 w-4 mr-2" /> Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/contacts")}>
            <Users className="h-4 w-4 mr-2" /> Contacts
          </CommandItem>
          <CommandItem onSelect={() => go("/companies")}>
            <Building2 className="h-4 w-4 mr-2" /> Companies
          </CommandItem>
          <CommandItem onSelect={() => go("/pipeline")}>
            <KanbanSquare className="h-4 w-4 mr-2" /> Pipeline
          </CommandItem>
          <CommandItem onSelect={() => go("/tasks")}>
            <CheckSquare className="h-4 w-4 mr-2" /> Tasks
          </CommandItem>
          <CommandItem onSelect={() => go("/reports")}>
            <BarChart3 className="h-4 w-4 mr-2" /> Reports
          </CommandItem>
          <CommandItem onSelect={() => go("/settings")}>
            <Settings className="h-4 w-4 mr-2" /> Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Create">
          <CommandItem onSelect={() => go("/contacts?new=1")}>
            <Plus className="h-4 w-4 mr-2" /> New contact
          </CommandItem>
          <CommandItem onSelect={() => go("/companies?new=1")}>
            <Plus className="h-4 w-4 mr-2" /> New company
          </CommandItem>
          <CommandItem onSelect={() => go("/pipeline?new=1")}>
            <Plus className="h-4 w-4 mr-2" /> New deal
          </CommandItem>
          <CommandItem onSelect={() => go("/tasks?new=1")}>
            <Plus className="h-4 w-4 mr-2" /> New task
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

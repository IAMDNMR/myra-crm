import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Search, Download, Trash2, Users, X } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { SortableTh, sortRows, type SortState } from "@/components/SortableTh";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { downloadCsv } from "@/lib/csv";
import { CsvImportDialog } from "@/components/CsvImportDialog";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
});

type LeadSortKey = "name" | "email" | "company_name" | "status" | "created";

function LeadsPage() {
  const { user, profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<LeadSortKey>>({ key: "created", dir: "desc" });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      return await api.get("/leads");
    },
  });

  const filtered = useMemo(() => {
    return leads.filter((l: any) => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (q) {
        const term = q.toLowerCase();
        const searchStr = `${l.name} ${l.email} ${l.company_name}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }
      return true;
    });
  }, [leads, statusFilter, q]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (l: any, k) => {
        switch (k) {
          case "name":
            return l.name;
          case "email":
            return l.email;
          case "company_name":
            return l.company_name;
          case "status":
            return l.status;
          case "created":
            return new Date(l.created_at).getTime();
          default:
            return null;
        }
      }),
    [filtered, sort],
  );

  const allSelected = sorted.length > 0 && sorted.every((l: any) => selected.has(l.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((l: any) => l.id)));
  };

  const bulkDelete = async () => {
    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/leads/${id}`)));
      setConfirmDel(false);
      toast.success(`${selected.size} lead${selected.size === 1 ? "" : "s"} deleted`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      "leads",
      sorted.map((l: any) => ({
        name: l.name,
        company_name: l.company_name ?? "",
        email: l.email ?? "",
        phone: l.phone ?? "",
        source: l.source ?? "",
        status: l.status ?? "",
        notes: l.notes ?? "",
        created_at: l.created_at,
      })),
    );
  };

  const statuses = ["new", "contacted", "not_interested", "qualified"];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} {sorted.length === leads.length ? "total" : `of ${leads.length}`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && !isReadOnly && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete ({selected.size})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {!isReadOnly && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
          )}
          {!isReadOnly && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Lead
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>New Lead</SheetTitle>
                </SheetHeader>
                <LeadForm
                  onSave={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["leads"] });
                  }}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or company..." className="pl-9" />
        </div>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        {statusFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStatusFilter("")}
          >
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-3 text-left w-8">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <SortableTh<LeadSortKey> label="Name" sortKey="name" sort={sort} onChange={setSort} />
              <SortableTh<LeadSortKey> label="Email" sortKey="email" sort={sort} onChange={setSort} />
              <th className="p-3 text-left">Phone</th>
              <SortableTh<LeadSortKey> label="Company" sortKey="company_name" sort={sort} onChange={setSort} />
              <SortableTh<LeadSortKey> label="Status" sortKey="status" sort={sort} onChange={setSort} />
              <SortableTh<LeadSortKey> label="Created" sortKey="created" sort={sort} onChange={setSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((l: any) => (
              <tr key={l.id} className="border-t hover:bg-accent/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(l.id)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      e.target.checked ? n.add(l.id) : n.delete(l.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:underline">
                    {l.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{l.email ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{l.phone ?? "—"}</td>
                <td className="p-3">{l.company_name ?? "—"}</td>
                <td className="p-3 capitalize">{l.status?.replace('_', ' ') ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{fmtDate(l.created_at)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Users}
                    title={leads.length === 0 ? "No leads yet" : "No matches"}
                    description={
                      leads.length === 0
                        ? "Add your first lead to get started."
                        : "Try clearing your filters or search."
                    }
                    actionLabel={leads.length === 0 && !isReadOnly ? "Add Lead" : undefined}
                    onAction={leads.length === 0 && !isReadOnly ? () => setOpen(true) : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${selected.size} lead${selected.size === 1 ? "" : "s"}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={bulkDelete}
      />

      <CsvImportDialog
        table="leads"
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={() => qc.invalidateQueries({ queryKey: ["leads"] })}
      />
    </div>
  );
}

export function LeadForm({
  lead,
  onSave,
}: {
  lead?: any;
  onSave: () => void;
}) {
  const [f, setF] = useState({
    name: lead?.name ?? "",
    company_name: lead?.company_name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    source: lead?.source ?? "",
    status: lead?.status ?? "new",
    notes: lead?.notes ?? "",
    custom_fields: lead?.custom_fields ?? {},
  });
  const [busy, setBusy] = useState(false);
  const [showNewField, setShowNewField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const qc = useQueryClient();

  const { data: sources = [] } = useQuery({
    queryKey: ["lead-sources"],
    queryFn: () => api.get("/settings/lead-sources"),
  });

  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields", "lead"],
    queryFn: () => api.get("/settings/custom-fields/lead"),
  });

  const handleAddField = async () => {
    if (!newFieldName.trim()) return;
    try {
      const key = newFieldName.toLowerCase().replace(/[\s_-]+/g, '_');
      await api.post("/settings/custom-fields", {
        entity_type: "lead",
        name: key,
        label: newFieldName
      });
      setShowNewField(false);
      setNewFieldName("");
      qc.invalidateQueries({ queryKey: ["custom-fields", "lead"] });
      toast.success("Field added");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    
    try {
      if (lead) {
        await api.put(`/leads/${lead.id}`, f);
      } else {
        await api.post(`/leads`, f);
      }
      toast.success("Saved");
      onSave();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-4">
      <div>
        <Label>Name *</Label>
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
      </div>
      <div>
        <Label>Company Name</Label>
        <Input value={f.company_name} onChange={(e) => setF({ ...f, company_name: e.target.value })} />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      <div>
        <Label>Source</Label>
        <select
          className="w-full h-10 px-3 border rounded-md text-sm bg-background"
          value={f.source}
          onChange={(e) => setF({ ...f, source: e.target.value })}
        >
          <option value="">Select source...</option>
          {sources.map((src: any) => (
            <option key={src.id} value={src.name}>{src.name}</option>
          ))}
          {f.source && !sources.find((s:any) => s.name === f.source) && (
            <option value={f.source}>{f.source} (Legacy)</option>
          )}
        </select>
      </div>
      <div>
        <Label>Status</Label>
        <select
          className="w-full h-10 px-3 border rounded-md text-sm bg-background"
          value={f.status}
          onChange={(e) => setF({ ...f, status: e.target.value })}
        >
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="not_interested">Not Interested</option>
          <option value="qualified">Qualified</option>
        </select>
      </div>
      <div>
        <Label>Notes</Label>
        <textarea
          className="w-full min-h-[100px] p-3 border rounded-md text-sm bg-background"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </div>

      {customFields.length > 0 && (
        <div className="pt-2 border-t space-y-3">
          <h3 className="text-sm font-semibold">Custom Fields</h3>
          {customFields.map((field: any) => (
            <div key={field.id}>
              <Label>{field.label}</Label>
              <Input
                value={f.custom_fields[field.name] || ""}
                onChange={(e) => setF({ ...f, custom_fields: { ...f.custom_fields, [field.name]: e.target.value } })}
              />
            </div>
          ))}
        </div>
      )}

      {showNewField ? (
        <div className="flex gap-2 items-center p-3 bg-muted rounded-md mt-2">
          <Input 
            placeholder="Field name (e.g. Industry)" 
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            className="flex-1"
          />
          <Button type="button" onClick={handleAddField} size="sm">Add</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewField(false)}>Cancel</Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewField(true)} className="mt-2 text-primary">
          <Plus className="h-4 w-4 mr-1" /> Add Custom Field
        </Button>
      )}

      <div className="pt-4">
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Saving..." : "Save Lead"}
        </Button>
      </div>
    </form>
  );
}

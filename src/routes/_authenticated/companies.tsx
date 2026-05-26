import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Search, Download, Upload, Trash2, Building2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EntityCombo } from "@/components/EntityCombo";
import { toast } from "sonner";
import { fmtCurrency } from "@/lib/format";
import { SortableTh, sortRows, type SortState } from "@/components/SortableTh";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { downloadCsv } from "@/lib/csv";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
});

type CSortKey = "name" | "domain" | "industry" | "size" | "contacts" | "value";

function CompaniesPage() {
  const { user, profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<CSortKey>>({ key: "name", dir: "asc" });
  const [industryFilter, setIndustryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data } = useQuery({
    queryKey: ["companies", q, page],
    queryFn: async () => {
      return await api.get(`/companies?skip=${(page - 1) * limit}&limit=${limit}`);
    },
  });

  const companiesList = data?.items || [];
  const totalCompanies = data?.total || 0;

  const industries = useMemo(
    () => Array.from(new Set(companiesList.map((c: any) => c.industry).filter(Boolean))) as string[],
    [companiesList],
  );

  const filtered = useMemo(
    () => {
      let f = companiesList;
      if (q) f = f.filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));
      return f.filter((c: any) => {
        if (industryFilter && c.industry !== industryFilter) return false;
        if (sizeFilter && c.size !== sizeFilter) return false;
        return true;
      });
    },
    [companiesList, industryFilter, sizeFilter, q],
  );

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (c: any, k) => {
        switch (k) {
          case "name":
            return c.name;
          case "domain":
            return c.domain;
          case "industry":
            return c.industry;
          case "size":
            return c.size;
          case "contacts":
            return c.contacts?.length ?? 0;
          case "value":
            return c.deals?.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0) ?? 0;
          default:
            return null;
        }
      }),
    [filtered, sort],
  );

  const allSelected = sorted.length > 0 && sorted.every((c: any) => selected.has(c.id));
  const toggleAll = () => (allSelected ? setSelected(new Set()) : setSelected(new Set(sorted.map((c: any) => c.id))));

  const bulkDelete = async () => {
    let errorMsg = null;
    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/companies/${id}`)));
    } catch (err: any) {
      errorMsg = err.message;
    }
    setConfirmDel(false);
    if (errorMsg) toast.error(errorMsg);
    else {
      toast.success(`${selected.size} compan${selected.size === 1 ? "y" : "ies"} deleted`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["companies"] });
    }
  };

  const exportCsv = () =>
    downloadCsv(
      "companies",
      sorted.map((c: any) => ({
        name: c.name,
        domain: c.domain ?? "",
        industry: c.industry ?? "",
        size: c.size ?? "",
        website: c.website ?? "",
        contacts: c.contacts?.length ?? 0,
        deal_value: c.deals?.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0) ?? 0,
      })),
    );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const token = localStorage.getItem("access_token");
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE_URL}/companies/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["companies"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import companies");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} {sorted.length === totalCompanies ? "total" : `of ${totalCompanies}`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && !isReadOnly && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDel(true)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete ({selected.size})
            </Button>
          )}
          {!isReadOnly && (
            <>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImport} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
                <Upload className="h-4 w-4 mr-2" /> {isImporting ? "Importing..." : "Import CSV"}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {!isReadOnly && (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" /> Add Company
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>New Company</SheetTitle>
                </SheetHeader>
                <CompanyForm
                  onSave={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["companies"] });
                  }}
                  defaultOwner={user?.id ?? null}
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies..." className="pl-9" />
        </div>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={industryFilter}
          onChange={(e) => setIndustryFilter(e.target.value)}
        >
          <option value="">All industries</option>
          {industries.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={sizeFilter}
          onChange={(e) => setSizeFilter(e.target.value)}
        >
          <option value="">All sizes</option>
          <option>1-10</option>
          <option>11-50</option>
          <option>51-200</option>
          <option>201-1000</option>
          <option>1000+</option>
        </select>
        {(industryFilter || sizeFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIndustryFilter("");
              setSizeFilter("");
            }}
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
              <SortableTh<CSortKey> label="Name" sortKey="name" sort={sort} onChange={setSort} />
              <SortableTh<CSortKey> label="Domain" sortKey="domain" sort={sort} onChange={setSort} />
              <SortableTh<CSortKey> label="Industry" sortKey="industry" sort={sort} onChange={setSort} />
              <SortableTh<CSortKey> label="Size" sortKey="size" sort={sort} onChange={setSort} />
              <SortableTh<CSortKey> label="Contacts" sortKey="contacts" sort={sort} onChange={setSort} align="right" />
              <SortableTh<CSortKey> label="Deal Value" sortKey="value" sort={sort} onChange={setSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c: any) => (
              <tr key={c.id} className="border-t hover:bg-accent/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      e.target.checked ? n.add(c.id) : n.delete(c.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Link to="/companies/$id" params={{ id: c.id }} className="font-medium hover:underline">
                    {c.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{c.domain ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.industry ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.size ?? "—"}</td>
                <td className="p-3 text-right">{c.contacts?.length ?? 0}</td>
                <td className="p-3 text-right">
                  {fmtCurrency(c.deals?.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0))}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Building2}
                    title={totalCompanies === 0 ? "No companies yet" : "No matches"}
                    description={
                      totalCompanies === 0
                        ? "Add a company to group contacts and deals."
                        : "Try clearing filters or your search."
                    }
                    actionLabel={totalCompanies === 0 && !isReadOnly ? "Add Company" : undefined}
                    onAction={totalCompanies === 0 && !isReadOnly ? () => setOpen(true) : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={limit} total={totalCompanies} onChange={setPage} />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${selected.size} compan${selected.size === 1 ? "y" : "ies"}?`}
        description="Contacts and deals linked to these companies will be detached."
        confirmLabel="Delete"
        destructive
        onConfirm={bulkDelete}
      />
    </div>
  );
}

export function CompanyForm({
  company,
  onSave,
  defaultOwner,
}: {
  company?: any;
  onSave: () => void;
  defaultOwner?: string | null;
}) {
  const [f, setF] = useState({
    name: company?.name ?? "",
    domain: company?.domain ?? "",
    industry: company?.industry ?? "",
    size: company?.size ?? "",
    website: company?.website ?? "",
    owner_id: company?.owner_id ?? defaultOwner ?? null,
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (company) {
        await api.put(`/companies/${company.id}`, f);
      } else {
        await api.post('/companies', f);
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
        <Label>Domain</Label>
        <Input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} placeholder="example.com" />
      </div>
      <div>
        <Label>Website</Label>
        <Input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Industry</Label>
          <Input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} />
        </div>
        <div>
          <Label>Size</Label>
          <select
            className="w-full h-10 px-3 border rounded-md text-sm bg-background"
            value={f.size}
            onChange={(e) => setF({ ...f, size: e.target.value })}
          >
            <option value="">—</option>
            <option>1-10</option>
            <option>11-50</option>
            <option>51-200</option>
            <option>201-1000</option>
            <option>1000+</option>
          </select>
        </div>
      </div>
      <div>
        <Label>Owner</Label>
        <EntityCombo
          table="profiles"
          value={f.owner_id}
          onChange={(v) => setF({ ...f, owner_id: v })}
          placeholder="Assign owner"
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving..." : "Save"}
      </Button>
    </form>
  );
}


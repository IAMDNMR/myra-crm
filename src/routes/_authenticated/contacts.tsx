import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Plus, Search, Download, Upload, Trash2, Users, X } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { EntityCombo } from "@/components/EntityCombo";
import { toast } from "sonner";
import { SortableTh, sortRows, type SortState } from "@/components/SortableTh";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { downloadCsv } from "@/lib/csv";
import { Pagination } from "@/components/Pagination";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactSchema, type ContactFormData } from "@/lib/schemas";

export const Route = createFileRoute("/_authenticated/contacts")({
  component: ContactsPage,
});
// ... (cutting intermediate replace for safety, will do a smaller chunk)

type ContactSortKey = "name" | "email" | "company" | "owner" | "created";

function ContactsPage() {
  const { user, profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<ContactSortKey>>({ key: "created", dir: "desc" });
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [bulkOwnerOpen, setBulkOwnerOpen] = useState(false);
  const [bulkOwner, setBulkOwner] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data } = useQuery({
    queryKey: ["contacts", page],
    queryFn: async () => {
      return await api.get(`/contacts?skip=${(page - 1) * limit}&limit=${limit}`);
    },
  });

  const contactsList = data?.items || [];
  const totalContacts = data?.total || 0;

  const filtered = useMemo(() => {
    return contactsList.filter((c: any) => {
      if (ownerFilter && c.owner_id !== ownerFilter) return false;
      if (sourceFilter && c.source !== sourceFilter) return false;
      if (q) {
        const term = q.toLowerCase();
        const searchStr = `${c.first_name} ${c.last_name} ${c.email}`.toLowerCase();
        if (!searchStr.includes(term)) return false;
      }
      return true;
    });
  }, [contactsList, ownerFilter, sourceFilter, q]);

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (c: any, k) => {
        switch (k) {
          case "name":
            return `${c.first_name} ${c.last_name}`;
          case "email":
            return c.email;
          case "company":
            return c.companies?.name;
          case "owner":
            return c.profiles?.full_name;
          case "created":
            return new Date(c.created_at).getTime();
          default:
            return null;
        }
      }),
    [filtered, sort],
  );

  const allSelected = sorted.length > 0 && sorted.every((c: any) => selected.has(c.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((c: any) => c.id)));
  };

  const bulkDelete = async () => {
    try {
      await Promise.all(Array.from(selected).map((id) => api.delete(`/contacts/${id}`)));
      setConfirmDel(false);
      toast.success(`${selected.size} contact${selected.size === 1 ? "" : "s"} deleted`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const bulkReassign = async () => {
    try {
      await Promise.all(
        Array.from(selected).map((id) => api.put(`/contacts/${id}`, { owner_id: bulkOwner }))
      );
      setBulkOwnerOpen(false);
      toast.success("Owner updated");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      "contacts",
      sorted.map((c: any) => ({
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email ?? "",
        phone: c.phone ?? "",
        title: c.title ?? "",
        company: c.companies?.name ?? "",
        owner: c.profiles?.full_name ?? "",
        source: c.source ?? "",
        tags: (c.tags ?? []).join("; "),
        created_at: c.created_at,
      })),
    );
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const token = localStorage.getItem("access_token");
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE_URL}/contacts/import`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Import failed");
      
      toast.success(data.message);
      qc.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to import contacts");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const sources = ["inbound", "outbound", "referral", "event", "other"];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} {sorted.length === totalContacts ? "total" : `of ${totalContacts}`}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && !isReadOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setBulkOwnerOpen(true)}>
                Reassign owner
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete ({selected.size})
              </Button>
            </>
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
                  <Plus className="h-4 w-4 mr-2" /> Add Contact
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>New Contact</SheetTitle>
                </SheetHeader>
                <ContactForm
                  onSave={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["contacts"] });
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
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email..." className="pl-9" />
        </div>
        <div className="w-48">
          <EntityCombo table="profiles" value={ownerFilter} onChange={setOwnerFilter} placeholder="Filter by owner" />
        </div>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {(ownerFilter || sourceFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOwnerFilter(null);
              setSourceFilter("");
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
              <SortableTh<ContactSortKey> label="Name" sortKey="name" sort={sort} onChange={setSort} />
              <SortableTh<ContactSortKey> label="Email" sortKey="email" sort={sort} onChange={setSort} />
              <th className="p-3 text-left">Phone</th>
              <SortableTh<ContactSortKey> label="Company" sortKey="company" sort={sort} onChange={setSort} />
              <SortableTh<ContactSortKey> label="Owner" sortKey="owner" sort={sort} onChange={setSort} />
              <SortableTh<ContactSortKey> label="Created" sortKey="created" sort={sort} onChange={setSort} />
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
                  <Link to="/contacts/$id" params={{ id: c.id }} className="font-medium hover:underline">
                    {c.first_name} {c.last_name}
                  </Link>
                  {c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}
                </td>
                <td className="p-3 text-muted-foreground">{c.email ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.phone ?? "—"}</td>
                <td className="p-3">{c.companies?.name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{c.profiles?.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{fmtDate(c.created_at)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Users}
                    title={totalContacts === 0 ? "No contacts yet" : "No matches"}
                    description={
                      totalContacts === 0
                        ? "Add your first contact to start building your CRM."
                        : "Try clearing your filters or search."
                    }
                    actionLabel={totalContacts === 0 && !isReadOnly ? "Add Contact" : undefined}
                    onAction={totalContacts === 0 && !isReadOnly ? () => setOpen(true) : undefined}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={limit} total={totalContacts} onChange={setPage} />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${selected.size} contact${selected.size === 1 ? "" : "s"}?`}
        description="This action cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={bulkDelete}
      />

      <Sheet open={bulkOwnerOpen} onOpenChange={setBulkOwnerOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Reassign owner</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Label>New owner</Label>
            <EntityCombo table="profiles" value={bulkOwner} onChange={setBulkOwner} placeholder="Pick owner" />
            <Button onClick={bulkReassign} className="w-full">
              Apply to {selected.size} contact{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function ContactForm({
  contact,
  onSave,
  defaultOwner,
}: {
  contact?: any;
  onSave: () => void;
  defaultOwner?: string | null;
}) {
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: contact?.first_name ?? "",
      last_name: contact?.last_name ?? "",
      email: contact?.email ?? "",
      phone: contact?.phone ?? "",
      title: contact?.title ?? "",
      source: contact?.source ?? "",
      company_id: contact?.company_id ?? null,
      owner_id: contact?.owner_id ?? defaultOwner ?? null,
      tags: contact?.tags ?? [],
    }
  });

  const company_id = watch("company_id");
  const owner_id = watch("owner_id");
  const tagsWatch = watch("tags");

  const submit = async (f: ContactFormData) => {
    setBusy(true);
    try {
      if (contact) {
        await api.put(`/contacts/${contact.id}`, f);
      } else {
        await api.post(`/contacts`, f);
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
    <form onSubmit={handleSubmit(submit)} className="space-y-3 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>First name *</Label>
          <Input {...register("first_name")} />
          {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
        </div>
        <div>
          <Label>Last name *</Label>
          <Input {...register("last_name")} />
          {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
      </div>
      <div>
        <Label>Phone</Label>
        <Input {...register("phone")} />
        {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
      </div>
      <div>
        <Label>Title</Label>
        <Input {...register("title")} />
      </div>
      <div>
        <Label>Company</Label>
        <EntityCombo
          table="companies"
          value={company_id ?? null}
          onChange={(v) => setValue("company_id", v)}
          placeholder="Select company"
        />
      </div>
      <div>
        <Label>Owner</Label>
        <EntityCombo
          table="profiles"
          value={owner_id ?? null}
          onChange={(v) => setValue("owner_id", v)}
          placeholder="Assign owner"
        />
      </div>
      <div>
        <Label>Source</Label>
        <select
          className="w-full h-10 px-3 border rounded-md text-sm bg-background"
          {...register("source")}
        >
          <option value="">—</option>
          <option value="inbound">inbound</option>
          <option value="outbound">outbound</option>
          <option value="referral">referral</option>
          <option value="event">event</option>
          <option value="other">other</option>
        </select>
      </div>
      <div>
        <Label>Tags (comma separated)</Label>
        <Input 
          value={tagsWatch?.join(", ") || ""} 
          onChange={(e) => {
            const arr = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
            setValue("tags", arr);
          }} 
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving..." : "Save Contact"}
      </Button>
    </form>
  );
}

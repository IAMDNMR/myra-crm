import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KanbanSquare, Download, Trash2, X, Search, Trophy } from "lucide-react";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { SortableTh, sortRows, type SortState } from "@/components/SortableTh";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { downloadCsv } from "@/lib/csv";
import { EntityCombo } from "@/components/EntityCombo";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";

export const Route = createFileRoute("/_authenticated/pipeline/list")({
  component: PipelineList,
});

type DSortKey = "name" | "company" | "stage" | "value" | "owner" | "close" | "status";

function PipelineList() {
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortState<DSortKey>>({ key: "value", dir: "desc" });
  const [stageFilter, setStageFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [bulkOwnerOpen, setBulkOwnerOpen] = useState(false);
  const [bulkOwner, setBulkOwner] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: dealsData } = useQuery({
    queryKey: ["all-deals", page],
    queryFn: async () => await api.get(`/deals?skip=${(page - 1) * limit}&limit=${limit}`),
  });
  
  const deals = dealsData?.items || [];
  const totalDeals = dealsData?.total || 0;

  const { data: stageList = [] } = useQuery({
    queryKey: ["all-stages"],
    queryFn: async () => (await api.get("/stages")) ?? [],
  });

  const filtered = useMemo(
    () =>
      deals.filter((d: any) => {
        if (stageFilter && d.stage_id !== stageFilter) return false;
        if (statusFilter && d.status !== statusFilter) return false;
        if (ownerFilter && d.owner_id !== ownerFilter) return false;
        if (q) {
          const term = q.toLowerCase();
          const hay = `${d.name ?? ""} ${d.companies?.name ?? ""}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      }),
    [deals, stageFilter, statusFilter, ownerFilter, q],
  );

  const sorted = useMemo(
    () =>
      sortRows(filtered, sort, (d: any, k) => {
        switch (k) {
          case "name":
            return d.name;
          case "company":
            return d.companies?.name;
          case "stage":
            return d.stages?.name;
          case "value":
            return Number(d.value ?? 0);
          case "owner":
            return d.profiles?.full_name;
          case "close":
            return d.close_date ? new Date(d.close_date).getTime() : 0;
          case "status":
            return d.status;
          default:
            return null;
        }
      }),
    [filtered, sort],
  );

  const allSelected = sorted.length > 0 && sorted.every((d: any) => selected.has(d.id));
  const toggleAll = () => (allSelected ? setSelected(new Set()) : setSelected(new Set(sorted.map((d: any) => d.id))));

  const bulkDelete = async () => {
    try {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id) => api.delete(`/deals/${id}`)));
      toast.success(`${selected.size} deal${selected.size === 1 ? "" : "s"} deleted`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["all-deals"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete deals");
    } finally {
      setConfirmDel(false);
    }
  };

  const bulkReassign = async () => {
    try {
      const ids = Array.from(selected);
      await Promise.all(ids.map((id) => api.put(`/deals/${id}`, { owner_id: bulkOwner })));
      toast.success("Owner updated");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["all-deals"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to reassign deals");
    } finally {
      setBulkOwnerOpen(false);
    }
  };

  const totalValue = sorted.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Deals</h1>
          <p className="text-sm text-muted-foreground">
            {sorted.length} {sorted.length === totalDeals ? "total" : `of ${totalDeals}`} ·{" "}
            <span className="font-medium text-foreground">{fmtCurrency(totalValue)}</span>
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && !isReadOnly && (
            <>
              <Button variant="outline" size="sm" onClick={() => setBulkOwnerOpen(true)}>
                Reassign
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDel(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete ({selected.size})
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "deals",
                sorted.map((d: any) => ({
                  name: d.name,
                  company: d.companies?.name ?? "",
                  stage: d.stages?.name ?? "",
                  value: d.value,
                  owner: d.profiles?.full_name ?? "",
                  close_date: d.close_date ?? "",
                  status: d.status,
                  probability: d.probability,
                })),
              )
            }
          >
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Link to="/pipeline">
            <Button variant="outline" size="sm">
              <KanbanSquare className="h-4 w-4 mr-2" />
              Kanban
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deal or company..." className="pl-9" />
        </div>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {stageList.map((s: any) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 px-3 border rounded-md text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <div className="w-48">
          <EntityCombo table="profiles" value={ownerFilter} onChange={setOwnerFilter} placeholder="Filter by owner" />
        </div>
        {(stageFilter || statusFilter || ownerFilter || q) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStageFilter("");
              setStatusFilter("");
              setOwnerFilter(null);
              setQ("");
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
              <SortableTh<DSortKey> label="Deal" sortKey="name" sort={sort} onChange={setSort} />
              <SortableTh<DSortKey> label="Company" sortKey="company" sort={sort} onChange={setSort} />
              <SortableTh<DSortKey> label="Stage" sortKey="stage" sort={sort} onChange={setSort} />
              <SortableTh<DSortKey> label="Value" sortKey="value" sort={sort} onChange={setSort} align="right" />
              <SortableTh<DSortKey> label="Owner" sortKey="owner" sort={sort} onChange={setSort} />
              <SortableTh<DSortKey> label="Close" sortKey="close" sort={sort} onChange={setSort} />
              <SortableTh<DSortKey> label="Status" sortKey="status" sort={sort} onChange={setSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((d: any) => (
              <tr key={d.id} className="border-t hover:bg-accent/40">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      e.target.checked ? n.add(d.id) : n.delete(d.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td className="p-3">
                  <Link to="/deals/$id" params={{ id: d.id }} className="font-medium hover:underline">
                    {d.name}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{d.companies?.name ?? "—"}</td>
                <td className="p-3">
                  {d.stages && (
                    <Badge style={{ backgroundColor: d.stages.color, color: "white" }}>{d.stages.name}</Badge>
                  )}
                </td>
                <td className="p-3 text-right font-medium">{fmtCurrency(d.value)}</td>
                <td className="p-3 text-muted-foreground">{d.profiles?.full_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{fmtDate(d.close_date)}</td>
                <td className="p-3">
                  <Badge variant={d.status === "won" ? "default" : d.status === "lost" ? "destructive" : "secondary"}>
                    {d.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    icon={Trophy}
                    title={totalDeals === 0 ? "No deals yet" : "No matches"}
                    description={
                      totalDeals === 0
                        ? "Create your first deal from the Pipeline."
                        : "Try clearing filters or search."
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={limit} total={totalDeals} onChange={setPage} />

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title={`Delete ${selected.size} deal${selected.size === 1 ? "" : "s"}?`}
        description="Stage history and linked activities will remain but lose their deal reference."
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
              Apply to {selected.size} deal{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

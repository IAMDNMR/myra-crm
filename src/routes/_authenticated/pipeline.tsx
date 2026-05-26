import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable, type DragEndEvent } from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DealForm } from "@/components/DealForm";
import { Plus, List as ListIcon, KanbanSquare } from "lucide-react";
import { fmtCurrency, fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { notifyTeams } from "@/lib/notifyTeams";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const { user, profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addStageId, setAddStageId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines-full"],
    queryFn: async () => (await api.get("/pipelines")) ?? [],
  });
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null);
  const pipeline: any = pipelines.find((p: any) => p.id === selectedPipeline) ?? pipelines.find((p: any) => p.is_default) ?? pipelines[0];
  const stages = useMemo(() => (pipeline?.stages ?? []).sort((a: any, b: any) => a.order_index - b.order_index), [pipeline]);

  const { data: deals = [] } = useQuery({
    queryKey: ["pipeline-deals", pipeline?.id],
    queryFn: async () => {
      if (!pipeline) return [];
      const res = await api.get(`/deals?pipeline_id=${pipeline.id}&status=open`);
      return res?.items || [];
    },
    enabled: !!pipeline,
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    if (isReadOnly) return;
    const dealId = e.active.id as string;
    const toStageId = e.over?.id as string | undefined;
    if (!toStageId) return;
    const deal: any = deals.find((d: any) => d.id === dealId);
    if (!deal || deal.stage_id === toStageId) return;
    const newStage: any = stages.find((s: any) => s.id === toStageId);
    qc.setQueryData(["pipeline-deals", pipeline?.id], (old: any[] = []) => old.map((d) => d.id === dealId ? { ...d, stage_id: toStageId } : d));
    try {
      await api.put(`/deals/${dealId}`, { stage_id: toStageId, probability: newStage?.probability ?? deal.probability });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update deal stage");
      qc.invalidateQueries({ queryKey: ["pipeline-deals"] });
      return;
    }
    if (profile?.teams_webhook_url) {
      notifyTeams(profile.teams_webhook_url, "deal_stage_changed", { dealName: deal.name, stageName: newStage?.name, repName: profile.full_name });
    }
  };

  if (!pipeline) return <div className="p-8 text-muted-foreground">Loading pipeline...</div>;

  const activeDeal = activeId ? deals.find((d: any) => d.id === activeId) : null;

  return (
    <div className="p-4 lg:p-8 max-w-[100rem] mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">Drag deals between stages to update</p>
        </div>
        <div className="flex gap-2 items-center">
          <select className="h-9 px-3 border rounded-md text-sm bg-background" value={pipeline.id} onChange={(e) => setSelectedPipeline(e.target.value)}>
            {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Link to="/pipeline/list"><Button variant="outline" size="sm"><ListIcon className="h-4 w-4 mr-2" />List View</Button></Link>
          {!isReadOnly && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Deal</Button></DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
                <DealForm defaultStageId={addStageId} onSave={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["pipeline-deals"] }); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((s: any) => {
            const cols = deals.filter((d: any) => d.stage_id === s.id);
            const total = cols.reduce((acc: number, d: any) => acc + Number(d.value ?? 0), 0);
            return <StageColumn key={s.id} stage={s} deals={cols} total={total} onAdd={() => { setAddStageId(s.id); setAddOpen(true); }} isReadOnly={isReadOnly} />;
          })}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function StageColumn({ stage, deals, total, onAdd, isReadOnly }: { stage: any; deals: any[]; total: number; onAdd: () => void; isReadOnly?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 flex flex-col bg-muted/50 rounded-lg ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="p-3 border-b" style={{ borderTopColor: stage.color, borderTopWidth: 3, borderTopStyle: "solid" }}>
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm">{stage.name}</div>
          {!isReadOnly && <button onClick={onAdd} className="text-muted-foreground hover:text-foreground"><Plus className="h-4 w-4" /></button>}
        </div>
        <div className="text-xs text-muted-foreground mt-1">{deals.length} · {fmtCurrency(total)}</div>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-32">
        {deals.map((d) => <DealCard key={d.id} deal={d} isReadOnly={isReadOnly} />)}
      </div>
    </div>
  );
}

function DealCard({ deal, dragging, isReadOnly }: { deal: any; dragging?: boolean; isReadOnly?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled: isReadOnly });
  const daysIn = Math.floor((Date.now() - new Date(deal.created_at).getTime()) / 86400000);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-card border rounded-md p-3 ${isReadOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"} shadow-sm hover:shadow-md transition ${isDragging || dragging ? "opacity-50" : ""}`}
    >
      <Link to="/deals/$id" params={{ id: deal.id }} className="font-medium text-sm hover:underline block" onClick={(e) => e.stopPropagation()}>{deal.name}</Link>
      {deal.companies?.name && <div className="text-xs text-muted-foreground mt-0.5">{deal.companies.name}</div>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold">{fmtCurrency(deal.value)}</span>
        <span className="text-xs text-muted-foreground">{daysIn}d</span>
      </div>
      {deal.close_date && <div className="text-xs text-muted-foreground mt-1">Close {fmtDate(deal.close_date)}</div>}
    </div>
  );
}

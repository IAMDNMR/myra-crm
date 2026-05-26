import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { initials } from "@/lib/format";
import { LeadForm } from "./leads";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [editOpen, setEditOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: lead } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      return await api.get(`/leads/${id}`);
    },
  });

  if (!lead) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/leads" className="text-sm text-muted-foreground hover:underline">← Back to Leads</Link>

      <div className="bg-card border rounded-lg p-6 flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
          {initials(lead.name)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{lead.name}</h1>
          <div className="text-sm text-muted-foreground">{lead.company_name}</div>
          <Badge variant="secondary" className="mt-2 capitalize">{lead.status?.replace('_', ' ')}</Badge>
          <div className="mt-2 text-sm flex gap-4 text-muted-foreground">
            {lead.email && <span>✉ {lead.email}</span>}
            {lead.phone && <span>📞 {lead.phone}</span>}
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col gap-2">
            <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
                  <ArrowRight className="h-4 w-4 mr-2" /> Convert Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Convert Lead</DialogTitle>
                </DialogHeader>
                <ConvertLeadForm lead={lead} onComplete={(data: any) => {
                  setConvertOpen(false);
                  qc.invalidateQueries({ queryKey: ["leads"] });
                  qc.invalidateQueries({ queryKey: ["contacts"] });
                  if (data.company_id) qc.invalidateQueries({ queryKey: ["companies"] });
                  if (data.deal_id) qc.invalidateQueries({ queryKey: ["deals"] });
                  // Navigate to the newly created contact
                  navigate({ to: "/contacts/$id", params: { id: data.contact_id } });
                }} />
              </DialogContent>
            </Dialog>
            <Sheet open={editOpen} onOpenChange={setEditOpen}>
              <SheetTrigger asChild><Button variant="outline" size="sm">Edit</Button></SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader><SheetTitle>Edit Lead</SheetTitle></SheetHeader>
                <LeadForm lead={lead} onSave={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["lead", id] }); }} />
              </SheetContent>
            </Sheet>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-lg p-5">
        <h2 className="font-semibold mb-4">Lead Details</h2>
        <div className="space-y-4 text-sm">
          <div>
            <span className="text-muted-foreground block mb-1">Source</span>
            <div>{lead.source || "—"}</div>
          </div>
          <div>
            <span className="text-muted-foreground block mb-1">Notes</span>
            <div className="whitespace-pre-wrap">{lead.notes || "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConvertLeadForm({ lead, onComplete }: { lead: any, onComplete: (data: any) => void }) {
  const [createCompany, setCreateCompany] = useState(!!lead.company_name);
  const [createDeal, setCreateDeal] = useState(true);
  const [dealName, setDealName] = useState(`Deal with ${lead.name}`);
  const [dealValue, setDealValue] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => await api.get("/pipelines") ?? []
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: async () => await api.get("/stages") ?? []
  });

  const selectedPipeline = useMemo(() => {
    return pipelines.find((p: any) => p.id === pipelineId) || pipelines[0];
  }, [pipelines, pipelineId]);

  const pipelineStages = useMemo(() => {
    if (!selectedPipeline) return [];
    return stages.filter((s: any) => s.pipeline_id === selectedPipeline.id).sort((a: any, b: any) => a.order_index - b.order_index);
  }, [stages, selectedPipeline]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/leads/${lead.id}/convert`, {
        create_company: createCompany,
        create_deal: createDeal,
        deal_name: dealName,
        deal_value: Number(dealValue) || 0,
        pipeline_id: selectedPipeline?.id,
        stage_id: stageId || pipelineStages[0]?.id
      });
      toast.success("Lead converted successfully!");
      onComplete(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to convert lead");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-3 p-3 border rounded-md bg-muted/50">
        <h4 className="font-medium text-sm">A new Contact will be created:</h4>
        <div className="text-sm text-muted-foreground">{lead.name} {lead.email ? `(${lead.email})` : ''}</div>
      </div>

      {lead.company_name && (
        <div className="flex items-start gap-2">
          <Checkbox id="chk-company" checked={createCompany} onCheckedChange={(c) => setCreateCompany(!!c)} className="mt-1" />
          <div>
            <Label htmlFor="chk-company" className="font-medium">Create Company</Label>
            <p className="text-xs text-muted-foreground">Will create a company record for "{lead.company_name}"</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2">
        <Checkbox id="chk-deal" checked={createDeal} onCheckedChange={(c) => setCreateDeal(!!c)} className="mt-1" />
        <div>
          <Label htmlFor="chk-deal" className="font-medium">Create Deal</Label>
          <p className="text-xs text-muted-foreground">Create an open deal in your pipeline</p>
        </div>
      </div>

      {createDeal && (
        <div className="space-y-3 pl-6 border-l-2 ml-2">
          <div>
            <Label>Deal Name</Label>
            <Input value={dealName} onChange={e => setDealName(e.target.value)} required />
          </div>
          <div>
            <Label>Amount / Value</Label>
            <Input type="number" min="0" step="0.01" value={dealValue} onChange={e => setDealValue(e.target.value)} />
          </div>
          {pipelines.length > 0 && (
            <div>
              <Label>Pipeline</Label>
              <select className="w-full h-10 px-3 border rounded-md text-sm bg-background mt-1" value={selectedPipeline?.id || ""} onChange={e => {
                setPipelineId(e.target.value);
                setStageId("");
              }}>
                {pipelines.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          {pipelineStages.length > 0 && (
            <div>
              <Label>Stage</Label>
              <select className="w-full h-10 px-3 border rounded-md text-sm bg-background mt-1" value={stageId || pipelineStages[0]?.id} onChange={e => setStageId(e.target.value)}>
                {pipelineStages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <DialogFooter className="pt-4">
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Converting..." : "Convert Lead"}
        </Button>
      </DialogFooter>
    </form>
  );
}

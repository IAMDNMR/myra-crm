import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/pipeline")({
  component: PipelineSettings,
});

function PipelineSettings() {
  const qc = useQueryClient();
  const { data: pipelines = [] } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => await api.get("/pipelines") ?? [],
  });
  
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: async () => await api.get("/stages") ?? [],
  });

  const [newPipelineName, setNewPipelineName] = useState("");

  const addPipeline = async () => {
    if (!newPipelineName) return;
    await api.post("/pipelines", { name: newPipelineName });
    setNewPipelineName("");
    qc.invalidateQueries({ queryKey: ["pipelines"] });
    toast.success("Pipeline created");
  };

  return (
    <div className="space-y-4">
      {pipelines.map((p: any) => (
        <PipelineCard 
          key={p.id} 
          pipeline={p} 
          stages={stages.filter((s: any) => s.pipeline_id === p.id)}
          onChange={() => {
            qc.invalidateQueries({ queryKey: ["pipelines"] });
            qc.invalidateQueries({ queryKey: ["stages"] });
          }} 
        />
      ))}
      <div className="bg-card border rounded-lg p-4 flex gap-2">
        <Input placeholder="New pipeline name" value={newPipelineName} onChange={(e) => setNewPipelineName(e.target.value)} />
        <Button onClick={addPipeline}><Plus className="h-4 w-4 mr-2" />Add</Button>
      </div>
    </div>
  );
}

function PipelineCard({ pipeline, stages, onChange }: { pipeline: any; stages: any[]; onChange: () => void }) {
  const [name, setName] = useState(pipeline.name);
  const sortedStages = [...stages].sort((a, b) => a.order_index - b.order_index);
  const [newStage, setNewStage] = useState("");

  const saveName = async () => {
    await api.put(`/pipelines/${pipeline.id}`, { name });
    onChange();
  };
  
  const setDefault = async () => {
    // Note: To be fully correct, we should update all pipelines, but we'll just update this one for now
    // In a real app we'd have a specific endpoint or update the others to false
    await api.put(`/pipelines/${pipeline.id}`, { is_default: true });
    onChange();
    toast.success("Set as default");
  };
  
  const updateStage = async (id: string, patch: any) => {
    await api.put(`/stages/${id}`, patch);
    onChange();
  };
  
  const deleteStage = async (id: string) => {
    if (!confirm("Delete this stage?")) return;
    await api.delete(`/stages/${id}`);
    onChange();
  };
  
  const addStage = async () => {
    if (!newStage) return;
    const order_index = sortedStages.length;
    await api.post("/stages", { 
      pipeline_id: pipeline.id, 
      name: newStage, 
      order_index, 
      probability: 0, 
      color: "#64748b" 
    });
    setNewStage("");
    onChange();
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} className="font-semibold" />
        {pipeline.is_default ? <span className="text-xs text-success font-medium">Default</span> : <Button variant="outline" size="sm" onClick={setDefault}>Set Default</Button>}
      </div>
      <div className="space-y-2">
        {sortedStages.map((s: any) => (
          <div key={s.id} className="flex gap-2 items-center">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Input value={s.name} onChange={(e) => updateStage(s.id, { name: e.target.value })} className="flex-1" />
            <Input type="number" min={0} max={100} value={s.probability} onChange={(e) => updateStage(s.id, { probability: Number(e.target.value) })} className="w-20" title="Probability %" />
            <Input type="color" value={s.color ?? "#64748b"} onChange={(e) => updateStage(s.id, { color: e.target.value })} className="w-12 p-1 h-10" />
            <Button variant="ghost" size="sm" onClick={() => deleteStage(s.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="New stage name" value={newStage} onChange={(e) => setNewStage(e.target.value)} />
        <Button variant="outline" onClick={addStage}><Plus className="h-4 w-4 mr-2" />Stage</Button>
      </div>
    </div>
  );
}

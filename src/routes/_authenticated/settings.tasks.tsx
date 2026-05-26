import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, GripVertical, CheckSquare } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/settings/tasks")({
  component: TaskStatusesSettings,
});

function TaskStatusesSettings() {
  const qc = useQueryClient();
  const { data: statuses = [] } = useQuery({
    queryKey: ["task_statuses"],
    queryFn: async () => await api.get("/task_statuses") ?? [],
  });

  const sortedStatuses = [...statuses].sort((a, b) => a.order_index - b.order_index);
  const [newName, setNewName] = useState("");

  const addStatus = async () => {
    if (!newName) return;
    const order_index = sortedStatuses.length;
    await api.post("/task_statuses", { 
      name: newName, 
      order_index, 
      color: "#64748b",
      is_closed_state: false
    });
    setNewName("");
    qc.invalidateQueries({ queryKey: ["task_statuses"] });
    toast.success("Status added");
  };

  const updateStatus = async (id: string, patch: any) => {
    await api.put(`/task_statuses/${id}`, patch);
    qc.invalidateQueries({ queryKey: ["task_statuses"] });
  };

  const deleteStatus = async (id: string) => {
    if (!confirm("Delete this task status?")) return;
    await api.delete(`/task_statuses/${id}`);
    qc.invalidateQueries({ queryKey: ["task_statuses"] });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h2 className="text-lg font-semibold">Custom Task Statuses</h2>
        <p className="text-sm text-muted-foreground">Define the steps in your task workflow. Mark statuses that represent a completed task.</p>
        
        <div className="space-y-2 mt-4">
          <div className="grid grid-cols-[auto_1fr_60px_100px_auto] gap-2 px-2 text-xs font-medium text-muted-foreground">
            <div className="w-4"></div>
            <div>Name</div>
            <div>Color</div>
            <div className="text-center">Is Closed?</div>
            <div className="w-8"></div>
          </div>
          {sortedStatuses.map((s: any) => (
            <div key={s.id} className="flex gap-2 items-center bg-background/50 p-2 rounded-md border">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Input 
                value={s.name} 
                onChange={(e) => updateStatus(s.id, { name: e.target.value })} 
                className="flex-1 h-8" 
              />
              <Input 
                type="color" 
                value={s.color ?? "#64748b"} 
                onChange={(e) => updateStatus(s.id, { color: e.target.value })} 
                className="w-12 p-1 h-8" 
              />
              <div className="w-[100px] flex justify-center">
                <Checkbox 
                  checked={s.is_closed_state} 
                  onCheckedChange={(c) => updateStatus(s.id, { is_closed_state: !!c })} 
                />
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteStatus(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
        
        <div className="flex gap-2 pt-4 border-t">
          <Input 
            placeholder="New status name (e.g. In Progress)" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)} 
          />
          <Button onClick={addStatus}><Plus className="h-4 w-4 mr-2" />Add Status</Button>
        </div>
      </div>
    </div>
  );
}

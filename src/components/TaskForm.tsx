import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { EntityCombo } from "./EntityCombo";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { taskSchema, type TaskFormData } from "@/lib/schemas";

export function TaskForm({ task, onSave, defaultContactId, defaultDealId }: { task?: any; onSave: () => void; defaultContactId?: string; defaultDealId?: string }) {
  const { user } = useAuth();
  
  const { data: statuses = [] } = useQuery({
    queryKey: ["task_statuses"],
    queryFn: async () => await api.get("/task_statuses") ?? [],
  });

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      type: task?.type ?? "follow_up",
      due_date: task?.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      priority: task?.priority ?? "medium",
      status_id: task?.status_id ?? "",
      assignee_id: task?.assignee_id ?? user?.id ?? null,
      deal_id: task?.deal_id ?? defaultDealId ?? null,
      contact_id: task?.contact_id ?? defaultContactId ?? null,
    }
  });
  
  const [busy, setBusy] = useState(false);

  const status_id = watch("status_id");
  const assignee_id = watch("assignee_id");
  const deal_id = watch("deal_id");
  const contact_id = watch("contact_id");

  // If no status_id is set, try to default to the first non-closed status
  if (!status_id && statuses.length > 0) {
    const defaultStatus = [...statuses].sort((a, b) => a.order_index - b.order_index)[0];
    if (defaultStatus) {
      setValue("status_id", defaultStatus.id);
    }
  }

  const submit = async (f: TaskFormData) => {
    setBusy(true);
    const payload = { ...f, due_date: new Date(f.due_date).toISOString() };
    
    try {
      if (task) {
        await api.put(`/tasks/${task.id}`, payload);
      } else {
        const data = await api.post("/tasks", payload);
        if (data) {
          await api.post("/activities", {
            type: "task", 
            subject: f.title, 
            deal_id: f.deal_id, 
            contact_id: f.contact_id, 
            user_id: user?.id ?? null,
          });
        }
      }
      toast.success("Saved");
      onSave();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 mt-4">
      <div>
        <Label>Title *</Label>
        <Input {...register("title")} />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <select className="w-full h-10 px-3 border rounded-md text-sm bg-background" {...register("type")}>
            <option value="call">Call</option><option value="email">Email</option><option value="meeting">Meeting</option><option value="follow_up">Follow-up</option><option value="demo">Demo</option><option value="other">Other</option>
          </select>
        </div>
        <div>
          <Label>Priority</Label>
          <select className="w-full h-10 px-3 border rounded-md text-sm bg-background" {...register("priority")}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Due date *</Label>
          <Input type="datetime-local" {...register("due_date")} />
          {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
        </div>
        <div>
          <Label>Status</Label>
          <select className="w-full h-10 px-3 border rounded-md text-sm bg-background" {...register("status_id")}>
            {statuses.sort((a: any, b: any) => a.order_index - b.order_index).map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div><Label>Assignee</Label><EntityCombo table="profiles" value={assignee_id ?? null} onChange={(v) => setValue("assignee_id", v)} /></div>
      <div><Label>Link to Deal</Label><EntityCombo table="deals" value={deal_id ?? null} onChange={(v) => setValue("deal_id", v)} placeholder="Optional" /></div>
      <div><Label>Link to Contact</Label><EntityCombo table="contacts" value={contact_id ?? null} onChange={(v) => setValue("contact_id", v)} placeholder="Optional" /></div>
      <div><Label>Description</Label><Textarea {...register("description")} rows={3} /></div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save Task"}</Button>
    </form>
  );
}

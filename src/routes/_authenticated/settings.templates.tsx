import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Info } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings/templates")({
  component: TemplatesSettings,
});

function TemplatesSettings() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-all"],
    queryFn: async () => {
      try {
        const data = await api.get("/email_templates");
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const del = async (id: string) => {
    if (!confirm("Delete?")) return;
    try {
      await api.delete(`/email_templates/${id}`);
      qc.invalidateQueries({ queryKey: ["templates-all"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete template");
    }
  };

  return (
    <div className="space-y-4">
      {/* Feature notice */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Email templates are coming soon — the API endpoint is not yet active. Templates you create here will be stored once the backend is ready.</span>
      </div>

      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Template</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Template</DialogTitle></DialogHeader>
            <TemplateForm template={editing} onSave={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["templates-all"] }); }} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-card border rounded-lg overflow-hidden">
        <ul>
          {templates.map((t: any) => (
            <li key={t.id} className="flex items-center justify-between p-4 border-b last:border-0">
              <div>
                <div className="font-medium flex items-center gap-2">{t.name} {t.category && <Badge variant="secondary">{t.category}</Badge>}</div>
                <div className="text-sm text-muted-foreground truncate max-w-md">{t.subject}</div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => del(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </li>
          ))}
          {templates.length === 0 && <li className="p-12 text-center text-muted-foreground">No templates yet</li>}
        </ul>
      </div>
    </div>
  );
}

function TemplateForm({ template, onSave }: { template?: any; onSave: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({
    name: template?.name ?? "", category: template?.category ?? "",
    subject: template?.subject ?? "", body: template?.body ?? "",
  });
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...f, created_by: user?.id };
      if (template) {
        await api.put(`/email_templates/${template.id}`, payload);
      } else {
        await api.post("/email_templates", payload);
      }
      toast.success("Saved");
      onSave();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save template");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="follow-up, intro..." /></div>
      </div>
      <div><Label>Subject</Label><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
      <div>
        <Label>Body <span className="text-xs text-muted-foreground">tokens: {`{{first_name}} {{company}} {{rep_name}}`}</span></Label>
        <Textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </div>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving..." : "Save Template"}</Button>
    </form>
  );
}

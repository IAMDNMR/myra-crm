import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Send } from "lucide-react";

export function LogActivityForm({ contactId, dealId, onSave }: { contactId?: string; dealId?: string; onSave: () => void }) {
  const { user, profile } = useAuth();
  const [f, setF] = useState({ type: "call", subject: "", body: "" });
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [templateId, setTemplateId] = useState<string>("");

  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      try {
        const data = await api.get("/email_templates");
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    enabled: f.type === "email",
  });

  const { data: contact } = useQuery({
    queryKey: ["contact-for-template", contactId],
    queryFn: async () => {
      if (!contactId) return null;
      try {
        return await api.get(`/contacts/${contactId}`);
      } catch {
        return null;
      }
    },
    enabled: !!contactId && f.type === "email",
  });

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t: any = templates.find((x: any) => x.id === id);
    if (!t) return;
    const fill = (s: string) => (s ?? "")
      .replaceAll("{{first_name}}", (contact as any)?.first_name ?? "")
      .replaceAll("{{company}}", (contact as any)?.companies?.name ?? "")
      .replaceAll("{{rep_name}}", profile?.full_name ?? "");
    setF((p) => ({ ...p, subject: fill(t.subject), body: fill(t.body) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/activities", {
        type: f.type, subject: f.subject, body: f.body,
        contact_id: contactId ?? null, deal_id: dealId ?? null, user_id: user?.id ?? null,
        send_email: f.type === "email" ? sendEmail : false
      });
      toast.success(sendEmail ? "Email sent & logged" : "Activity logged");
      onSave();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to log activity");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 mt-4">
      <div><Label>Type</Label>
        <select className="w-full h-10 px-3 border rounded-md text-sm bg-background mt-1" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="call">📞 Call</option><option value="email">✉ Email</option><option value="meeting">📅 Meeting</option><option value="note">📝 Note</option>
        </select>
      </div>
      {f.type === "email" && templates.length > 0 && (
        <div><Label>Use template</Label>
          <select className="w-full h-10 px-3 border rounded-md text-sm bg-background mt-1" value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">—</option>
            {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      <div><Label>Subject</Label><Input className="mt-1" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} required /></div>
      <div><Label>Message / Notes</Label><Textarea className="mt-1" rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></div>
      
      {f.type === "email" && !!contactId && (
        <div className="flex items-center gap-2 py-2">
          <Checkbox id="send-email" checked={sendEmail} onCheckedChange={(c) => setSendEmail(!!c)} />
          <Label htmlFor="send-email" className="font-medium cursor-pointer">
            Actually send this email via SMTP
          </Label>
        </div>
      )}

      <Button type="submit" disabled={busy} className="w-full mt-4">
        {busy ? "Processing..." : (f.type === "email" && sendEmail ? <><Send className="w-4 h-4 mr-2" /> Send & Log Email</> : "Log Activity")}
      </Button>
    </form>
  );
}

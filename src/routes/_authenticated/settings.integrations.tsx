import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { notifyTeams } from "@/lib/notifyTeams";
import { Copy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/integrations")({
  component: Integrations,
});

function Integrations() {
  const { profile, refreshProfile, user } = useAuth();
  const [webhook, setWebhook] = useState(profile?.teams_webhook_url ?? "");
  const [busy, setBusy] = useState(false);
  const logAddress = user ? `log+${user.id}@myra.app` : "";

  const save = async () => {
    setBusy(true);
    try {
      await api.put(`/profiles/${profile!.id}`, { teams_webhook_url: webhook || null });
      toast.success("Saved");
      refreshProfile();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (!webhook) { toast.error("Enter a webhook URL first"); return; }
    await notifyTeams(webhook, "deal_won", { dealName: "Test Deal", value: 12345, repName: profile?.full_name ?? "You" });
    toast.success("Test message sent");
  };

  return (
    <div className="space-y-6">
      <section className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Microsoft Teams</h2>
          <p className="text-sm text-muted-foreground">Get notified in Teams when deals advance or close.</p>
        </div>
        <div>
          <Label>Incoming Webhook URL</Label>
          <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://outlook.office.com/webhook/..." />
          <p className="text-xs text-muted-foreground mt-1">Create an Incoming Webhook in your Teams channel and paste the URL here.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
          <Button variant="outline" onClick={test}>Send Test</Button>
        </div>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-4">
        <div>
          <h2 className="font-semibold">Outlook / Email Logging</h2>
          <p className="text-sm text-muted-foreground">BCC this address on any email to auto-log it into the CRM.</p>
        </div>
        <div className="flex gap-2 items-center">
          <Input value={logAddress} readOnly className="font-mono text-sm" />
          <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(logAddress); toast.success("Copied"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Email routing is configured separately — coming in v2. For now, use "Log Email Manually" on contact/deal pages.</p>
      </section>

      <section className="bg-card border rounded-lg p-6 space-y-3 opacity-60">
        <h2 className="font-semibold">Coming Soon</h2>
        <ul className="text-sm space-y-1 text-muted-foreground">
          <li>• Outlook Full Sync (bi-directional email)</li>
          <li>• Teams Bot (slash commands)</li>
          <li>• Power BI connector</li>
          <li>• AI deal scoring</li>
        </ul>
      </section>
    </div>
  );
}

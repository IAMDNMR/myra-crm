import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/webforms")({
  component: WebFormsSettings,
});

function WebFormsSettings() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [returnUrl, setReturnUrl] = useState("https://yourwebsite.com/thank-you");
  const [ownerId, setOwnerId] = useState(profile?.id || "");

  const webhookUrl = `${window.location.origin}/api/webhooks/leads`;

  const snippet = `<!-- MYRA Web-to-Lead Form -->
<form action="${webhookUrl}" method="POST" style="max-w: 400px; font-family: sans-serif; display: flex; flex-direction: column; gap: 10px;">
  <!-- Optional: Hidden field to assign lead owner -->
  <input type="hidden" name="owner_id" value="${ownerId}" />
  <!-- Optional: Redirect URL after success -->
  <input type="hidden" name="redirect_url" value="${returnUrl}" />
  
  <label style="font-size: 14px; font-weight: bold;">Full Name *</label>
  <input type="text" name="name" required style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
  
  <label style="font-size: 14px; font-weight: bold;">Email *</label>
  <input type="email" name="email" required style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
  
  <label style="font-size: 14px; font-weight: bold;">Phone</label>
  <input type="tel" name="phone" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
  
  <label style="font-size: 14px; font-weight: bold;">Company</label>
  <input type="text" name="company_name" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
  
  <label style="font-size: 14px; font-weight: bold;">Message</label>
  <textarea name="notes" rows="4" style="padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></textarea>
  
  <button type="submit" style="padding: 10px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Submit</button>
</form>`;

  const copyCode = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Web-to-Lead Forms</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Generate an HTML form to embed on your website. When visitors fill it out, they will automatically be created as Leads in MYRA.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Assign New Leads To (Owner ID)</Label>
            <Input 
              className="mt-1" 
              value={ownerId} 
              onChange={(e) => setOwnerId(e.target.value)} 
              placeholder="Leave blank for unassigned"
            />
          </div>
          <div>
            <Label>Return URL (After Submit)</Label>
            <Input 
              className="mt-1" 
              value={returnUrl} 
              onChange={(e) => setReturnUrl(e.target.value)} 
              placeholder="https://"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <Label>HTML Embed Code</Label>
            <Button size="sm" variant="outline" onClick={copyCode}>
              {copied ? <CheckCircle2 className="w-4 h-4 mr-2 text-success" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? "Copied!" : "Copy Code"}
            </Button>
          </div>
          <div className="relative">
            <pre className="p-4 bg-muted text-muted-foreground text-xs rounded-md overflow-x-auto whitespace-pre border font-mono">
              {snippet}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

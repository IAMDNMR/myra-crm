import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail, Upload, Users, Send, Plus, Trash2, Search,
  Clock, CheckCircle2, User, FileText, X, ArrowRight,
  Inbox, MailPlus, List, History
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/mailer")({
  component: MailerPage,
});

type TabId = "compose" | "single" | "lists" | "history";

function MailerPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("compose");

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "compose", label: "Bulk Campaign", icon: Send },
    { id: "single", label: "Single Email", icon: MailPlus },
    { id: "lists", label: "Mailing Lists", icon: List },
    { id: "history", label: "Campaign History", icon: History },
  ];

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            Mailer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Send bulk campaigns or individual emails to your contacts</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg border w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "compose" && <BulkCompose />}
      {activeTab === "single" && <SingleCompose />}
      {activeTab === "lists" && <MailingLists />}
      {activeTab === "history" && <CampaignHistory />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   BULK COMPOSE
   ═══════════════════════════════════════════════════════════ */

function BulkCompose() {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"all" | "selected" | "list">("all");
  const [selectedList, setSelectedList] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const { data: lists = [] } = useQuery({
    queryKey: ["mailer-lists"],
    queryFn: () => api.get("/mailer/lists"),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: async () => {
      const res = await api.get("/contacts?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });

  const filteredContacts = useMemo(() =>
    contacts.filter((c: any) =>
      `${c.first_name || ""} ${c.last_name || ""} ${c.email || ""}`.toLowerCase().includes(contactSearch.toLowerCase())
    ), [contacts, contactSearch]
  );

  const toggleContact = (id: string) =>
    setSelectedContacts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const recipientCount = targetType === "all" ? contacts.length
    : targetType === "selected" ? selectedContacts.length
    : lists.find((l: any) => l.id === selectedList)?.contact_count || 0;

  const sendMutation = useMutation({
    mutationFn: (data: any) => api.post("/mailer/send", data),
    onSuccess: (res: any) => {
      toast.success(res.message || "Campaign sent!");
      setSubject(""); setBody(""); setSelectedContacts([]);
      qc.invalidateQueries({ queryKey: ["mailer-campaigns"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to send"),
  });

  const handleSend = () => {
    if (!subject.trim()) return toast.error("Subject is required");
    if (!body.trim()) return toast.error("Message body is required");
    if (targetType === "list" && !selectedList) return toast.error("Please select a mailing list");
    if (targetType === "selected" && selectedContacts.length === 0) return toast.error("Please select at least one contact");

    sendMutation.mutate({
      subject, body, target_type: targetType,
      list_id: selectedList || undefined,
      contact_ids: selectedContacts.length ? selectedContacts : undefined,
    });
  };

  const previewBody = body
    .replace(/\{\{first_name\}\}/g, "John")
    .replace(/\{\{last_name\}\}/g, "Doe")
    .replace(/\{\{email\}\}/g, "john@example.com");

  return (
    <div className="grid lg:grid-cols-[1fr_340px] gap-6">
      {/* Main Compose Area */}
      <div className="space-y-5">
        {/* Audience Card */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="w-4 h-4 text-primary" />
            Recipients
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { val: "all" as const, label: "All Contacts", count: contacts.length },
              { val: "list" as const, label: "Mailing List", count: null },
              { val: "selected" as const, label: "Pick Contacts", count: null },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setTargetType(opt.val)}
                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all text-left ${
                  targetType === opt.val
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-muted hover:border-muted-foreground/30 text-muted-foreground"
                }`}
              >
                {opt.label}
                {opt.count !== null && (
                  <span className="block text-xs mt-0.5 opacity-60">{opt.count} contacts</span>
                )}
              </button>
            ))}
          </div>

          {targetType === "list" && (
            <select
              className="w-full h-10 px-3 border rounded-lg bg-background text-sm"
              value={selectedList}
              onChange={(e) => setSelectedList(e.target.value)}
            >
              <option value="">— Choose a mailing list —</option>
              {lists.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name} ({l.contact_count} contacts)</option>
              ))}
            </select>
          )}

          {targetType === "selected" && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <span className="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1.5 rounded-full whitespace-nowrap">
                  {selectedContacts.length} selected
                </span>
              </div>

              <div className="flex gap-3 text-xs">
                <button onClick={() => {
                  const ids = filteredContacts.map((c: any) => c.id);
                  setSelectedContacts(prev => Array.from(new Set([...prev, ...ids])));
                }} className="text-primary hover:underline font-medium">Select all visible</button>
                <button onClick={() => {
                  const ids = new Set(filteredContacts.map((c: any) => c.id));
                  setSelectedContacts(prev => prev.filter(id => !ids.has(id)));
                }} className="text-muted-foreground hover:underline">Deselect visible</button>
                {selectedContacts.length > 0 && (
                  <button onClick={() => setSelectedContacts([])} className="text-destructive hover:underline">Clear all</button>
                )}
              </div>

              <div className="max-h-[220px] overflow-y-auto rounded-lg border bg-background divide-y">
                {filteredContacts.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">No contacts found</div>
                ) : (
                  filteredContacts.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(c.id)}
                        onChange={() => toggleContact(c.id)}
                        className="w-4 h-4 rounded border-input accent-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Compose Card */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="w-4 h-4 text-primary" />
            Compose
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Big news from our team!"
              className="text-base"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Message</label>
              <div className="flex gap-1.5">
                {["{{first_name}}", "{{last_name}}", "{{email}}"].map(tag => (
                  <button
                    key={tag}
                    onClick={() => setBody(prev => prev + tag)}
                    className="text-[10px] px-2 py-0.5 rounded-full border bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-mono"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="w-full min-h-[220px] p-4 border rounded-lg bg-background text-sm resize-y leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi {{first_name}},\n\nWe're excited to share some updates with you...\n\nBest regards,\nYour Team"}
            />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="space-y-5">
        {/* Summary Card */}
        <div className="bg-card border rounded-xl p-5 space-y-4 sticky top-6">
          <div className="text-sm font-semibold">Campaign Summary</div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Recipients</span>
              <span className="font-semibold text-primary">{recipientCount}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Audience</span>
              <span className="font-medium capitalize">{targetType === "list" ? "Mailing List" : targetType === "selected" ? "Selected" : "All Contacts"}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Subject</span>
              <span className="font-medium truncate max-w-[160px]">{subject || "—"}</span>
            </div>
          </div>

          {/* Preview Toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full text-sm text-primary hover:underline font-medium text-left"
          >
            {showPreview ? "Hide Preview" : "Preview Email ↓"}
          </button>

          {showPreview && body && (
            <div className="bg-muted/30 border rounded-lg p-4 text-sm space-y-2">
              <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Preview</div>
              <div className="font-medium">{subject || "(no subject)"}</div>
              <div className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed border-t pt-2 mt-2">
                {previewBody}
              </div>
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleSend}
            disabled={sendMutation.isPending || recipientCount === 0}
          >
            {sendMutation.isPending ? (
              <><Clock className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
            ) : (
              <><Send className="w-4 h-4 mr-2" /> Send to {recipientCount} recipient{recipientCount !== 1 ? "s" : ""}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SINGLE EMAIL
   ═══════════════════════════════════════════════════════════ */

function SingleCompose() {
  const qc = useQueryClient();
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-all"],
    queryFn: async () => {
      const res = await api.get("/contacts?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });

  const filteredContacts = useMemo(() =>
    contacts.filter((c: any) =>
      c.email && `${c.first_name || ""} ${c.last_name || ""} ${c.email}`.toLowerCase().includes(contactSearch.toLowerCase())
    ).slice(0, 20), [contacts, contactSearch]
  );

  const sendMutation = useMutation({
    mutationFn: (data: any) => api.post("/mailer/send-single", data),
    onSuccess: (res: any) => {
      toast.success(res.message || "Email sent!");
      setToEmail(""); setToName(""); setSubject(""); setBody("");
      qc.invalidateQueries({ queryKey: ["mailer-campaigns"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to send"),
  });

  const handleSend = () => {
    if (!toEmail.trim()) return toast.error("Recipient email is required");
    if (!subject.trim()) return toast.error("Subject is required");
    if (!body.trim()) return toast.error("Message body is required");
    sendMutation.mutate({ to_email: toEmail, to_name: toName, subject, body });
  };

  const pickContact = (c: any) => {
    setToEmail(c.email);
    setToName(`${c.first_name || ""} ${c.last_name || ""}`.trim());
    setShowContactPicker(false);
    setContactSearch("");
  };

  return (
    <div className="max-w-2xl space-y-5">
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <User className="w-4 h-4 text-primary" />
          Recipient
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Email *</label>
              <Input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                onFocus={() => setShowContactPicker(true)}
                placeholder="recipient@example.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Name</label>
              <Input
                value={toName}
                onChange={(e) => setToName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
          </div>

          {showContactPicker && (
            <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-popover border rounded-lg shadow-lg overflow-hidden">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    placeholder="Search contacts..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto">
                {filteredContacts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No contacts found</div>
                ) : (
                  filteredContacts.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => pickContact(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(c.first_name?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t">
                <button onClick={() => setShowContactPicker(false)} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {toEmail && (
          <div className="flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
            <span>Sending to <strong>{toName || toEmail}</strong> {toName && <span className="text-muted-foreground">({toEmail})</span>}</span>
            <button onClick={() => { setToEmail(""); setToName(""); }} className="ml-auto">
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        )}
      </div>

      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="w-4 h-4 text-primary" />
          Compose
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Subject *</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Quick follow-up"
            className="text-base"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Message *</label>
          <textarea
            className="w-full min-h-[200px] p-4 border rounded-lg bg-background text-sm resize-y leading-relaxed"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"Hi {{first_name}},\n\nJust wanted to follow up on our conversation...\n\nBest,"}
          />
        </div>

        <Button onClick={handleSend} disabled={sendMutation.isPending} className="w-full sm:w-auto" size="lg">
          {sendMutation.isPending ? <><Clock className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send Email</>}
        </Button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAILING LISTS
   ═══════════════════════════════════════════════════════════ */

function MailingLists() {
  const qc = useQueryClient();
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingListId, setUploadingListId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data: lists = [] } = useQuery({
    queryKey: ["mailer-lists"],
    queryFn: () => api.get("/mailer/lists"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/mailer/lists", data),
    onSuccess: () => {
      toast.success("List created"); setNewListName(""); setNewListDesc("");
      qc.invalidateQueries({ queryKey: ["mailer-lists"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mailer/lists/${id}`),
    onSuccess: () => {
      toast.success("List deleted"); setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["mailer-lists"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingListId) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8000"}/mailer/lists/${uploadingListId}/upload`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      toast.success(data.message || "CSV uploaded!");
      qc.invalidateQueries({ queryKey: ["mailer-lists"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadingListId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create List */}
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Plus className="w-4 h-4 text-primary" />
          Create New List
        </div>
        <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Name *</label>
            <Input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="e.g. Q3 Webinar Attendees" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Description</label>
            <Input value={newListDesc} onChange={(e) => setNewListDesc(e.target.value)} placeholder="Optional description" />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name: newListName, description: newListDesc || undefined })}
            disabled={!newListName.trim() || createMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" /> Create
          </Button>
        </div>
      </div>

      {/* Lists Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {lists.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No mailing lists yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first list above to get started</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3.5 font-medium">List Name</th>
                <th className="text-left p-3.5 font-medium">Contacts</th>
                <th className="text-left p-3.5 font-medium hidden sm:table-cell">Created</th>
                <th className="text-right p-3.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lists.map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{l.name}</div>
                        {l.description && <div className="text-xs text-muted-foreground">{l.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {l.contact_count}
                    </span>
                  </td>
                  <td className="p-3.5 text-muted-foreground hidden sm:table-cell">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => { setUploadingListId(l.id); fileInputRef.current?.click(); }}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmDel(l.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(open) => !open && setConfirmDel(null)}
        title="Delete mailing list?"
        description="The list will be removed but contacts will remain in your CRM."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDel && deleteMutation.mutate(confirmDel)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CAMPAIGN HISTORY
   ═══════════════════════════════════════════════════════════ */

function CampaignHistory() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const { data: campaigns = [] } = useQuery({
    queryKey: ["mailer-campaigns"],
    queryFn: () => api.get("/mailer/campaigns"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/mailer/campaigns/${id}`),
    onSuccess: () => {
      toast.success("Campaign deleted"); setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["mailer-campaigns"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed"),
  });

  const targetLabel = (t: string) => {
    switch (t) {
      case "all": return "All Contacts";
      case "selected": return "Selected Contacts";
      case "list": return "Mailing List";
      case "single": return "Single Email";
      default: return t;
    }
  };

  return (
    <div className="space-y-4">
      {campaigns.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 text-center">
          <History className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium">No campaigns sent yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your sent campaigns will appear here</p>
        </div>
      ) : (
        campaigns.map((c: any) => (
          <div key={c.id} className="bg-card border rounded-xl overflow-hidden transition-all hover:shadow-sm">
            <div
              className="p-4 flex items-center gap-4 cursor-pointer"
              onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                c.target_type === "single" ? "bg-blue-500/10" : "bg-primary/10"
              }`}>
                {c.target_type === "single"
                  ? <MailPlus className="w-5 h-5 text-blue-500" />
                  : <Send className="w-5 h-5 text-primary" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.subject}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {c.recipients} recipient{c.recipients !== 1 ? "s" : ""}</span>
                  <span>{targetLabel(c.target_type)}{c.list_name ? `: ${c.list_name}` : ""}</span>
                  <span>{new Date(c.created_at).toLocaleDateString()} {new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Sent
                </span>
                <Button
                  variant="ghost" size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={(e) => { e.stopPropagation(); setConfirmDel(c.id); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <ArrowRight className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === c.id ? "rotate-90" : ""}`} />
              </div>
            </div>
            {expandedId === c.id && (
              <div className="border-t bg-muted/20 p-4 space-y-3">
                <div className="grid sm:grid-cols-3 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Sent by:</span> <strong>{c.sent_by_name}</strong></div>
                  <div><span className="text-muted-foreground">Type:</span> <strong>{targetLabel(c.target_type)}</strong></div>
                  <div><span className="text-muted-foreground">Recipients:</span> <strong>{c.recipients}</strong></div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Message Preview</div>
                  <div className="bg-background border rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
                    {c.body}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(open) => !open && setConfirmDel(null)}
        title="Delete campaign record?"
        description="This will only remove the history entry. Emails already sent cannot be recalled."
        confirmLabel="Delete"
        destructive
        onConfirm={() => confirmDel && deleteMutation.mutate(confirmDel)}
      />
    </div>
  );
}

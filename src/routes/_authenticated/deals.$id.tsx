import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtCurrency, fmtDate, fmtDateTime } from "@/lib/format";
import { LogActivityForm } from "@/components/LogActivityForm";
import { TaskForm } from "@/components/TaskForm";
import { DealForm } from "@/components/DealForm";
import { DocumentList } from "@/components/DocumentList";
import { Mail, Phone, Calendar as CalIcon, StickyNote, CheckSquare, Trophy, XCircle, FileText, Plus, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { notifyTeams } from "@/lib/notifyTeams";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  component: DealDetail,
});

const ICON: Record<string, any> = { email: Mail, call: Phone, meeting: CalIcon, note: StickyNote, task: CheckSquare };

const LOST_REASONS = ["Price too high", "Competitor won", "No budget", "No decision", "Bad timing", "Other"];

function DealDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { profile, user } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");

  const { data: deal } = useQuery({ queryKey: ["deal", id], queryFn: async () => await api.get(`/deals/${id}`) });
  const { data: activities = [] } = useQuery({ queryKey: ["deal-acts", id], queryFn: async () => { try { const allActs = await api.get("/activities?limit=1000"); return (allActs?.items || []).filter((a: any) => a.deal_id === id).sort((a: any, b: any) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()); } catch (e) { return []; } } });
  const { data: tasks = [] } = useQuery({ queryKey: ["deal-tasks", id], queryFn: async () => { try { const allTasks = await api.get("/tasks"); return allTasks.filter((t: any) => t.deal_id === id); } catch (e) { return []; } } });
  const { data: history = [] } = useQuery({ queryKey: ["deal-history", id], queryFn: async () => { try { const allHist = await api.get("/deal_stage_history"); return allHist.filter((h: any) => h.deal_id === id).sort((a: any, b: any) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()); } catch (e) { return []; } } });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes", id], queryFn: async () => await api.get(`/quotes?deal_id=${id}`) });

  if (!deal) return <div className="p-8 text-muted-foreground">Loading...</div>;
  const pipelineStages = (deal.pipelines?.stages ?? []).sort((a: any, b: any) => a.order_index - b.order_index);

  const moveStage = async (stageId: string) => {
    if (isReadOnly) return;
    const newStage: any = pipelineStages.find((s: any) => s.id === stageId);
    await api.put(`/deals/${id}`, { stage_id: stageId, probability: newStage?.probability ?? deal.probability });
    try { await api.post("/deal_stage_history", { deal_id: id, from_stage_id: deal.stage_id, to_stage_id: stageId, changed_by: user?.id }); } catch (e) {}
    if (profile?.teams_webhook_url) notifyTeams(profile.teams_webhook_url, "deal_stage_changed", { dealName: deal.name, stageName: newStage?.name, repName: profile.full_name });
    qc.invalidateQueries({ queryKey: ["deal", id] });
    qc.invalidateQueries({ queryKey: ["deal-history", id] });
    toast.success("Stage updated");
  };

  const markWon = async () => {
    await api.put(`/deals/${id}`, { status: "won", probability: 100 });
    if (profile?.teams_webhook_url) notifyTeams(profile.teams_webhook_url, "deal_won", { dealName: deal.name, value: deal.value, repName: profile.full_name });
    qc.invalidateQueries({ queryKey: ["deal", id] });
    toast.success("🎉 Deal won!");
  };

  const markLost = async () => {
    if (!lostReason) { toast.error("Pick a reason"); return; }
    const note = lostNote ? `${lostReason}: ${lostNote}` : lostReason;
    await api.put(`/deals/${id}`, { status: "lost", lost_reason: note });
    qc.invalidateQueries({ queryKey: ["deal", id] });
    setLostOpen(false);
    toast.success("Marked lost");
  };

  const downloadQuotePDF = (quote: any) => {
    const doc = new jsPDF();
    doc.setFont("helvetica");

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("QUOTE", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Quote Number: ${quote.quote_number}`, 14, 30);
    doc.text(`Date: ${fmtDate(quote.created_at)}`, 14, 35);
    if (quote.valid_until) {
      doc.text(`Valid Until: ${fmtDate(quote.valid_until)}`, 14, 40);
    }

    // Bill To
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("Prepared For:", 120, 22);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    if (deal.companies) doc.text(deal.companies.name, 120, 30);
    if (deal.contacts) doc.text(`${deal.contacts.first_name} ${deal.contacts.last_name}`, 120, deal.companies ? 35 : 30);
    if (deal.contacts?.email) doc.text(deal.contacts.email, 120, deal.companies ? 40 : 35);

    // Line Items Header
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 50, 196, 50);
    
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text("Description", 14, 56);
    doc.text("Qty", 120, 56);
    doc.text("Unit Price", 150, 56);
    doc.text("Line Total", 180, 56);
    
    doc.line(14, 60, 196, 60);

    // Line Items
    let y = 68;
    doc.setTextColor(100, 100, 100);
    quote.line_items.forEach((item: any) => {
      doc.text(item.product_name || "Product", 14, y);
      doc.text(item.quantity.toString(), 120, y);
      doc.text(fmtCurrency(item.unit_price), 150, y);
      doc.text(fmtCurrency(item.unit_price * item.quantity), 180, y);
      y += 8;
    });

    doc.line(14, y + 2, 196, y + 2);
    
    // Total
    y += 12;
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("Total:", 150, y);
    doc.text(fmtCurrency(quote.total_amount), 180, y);

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Generated by MYRA CRM", 14, 280);

    doc.save(`Quote-${quote.quote_number}.pdf`);
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/pipeline" className="text-sm text-muted-foreground hover:underline">← Back to Pipeline</Link>
      <div className="bg-card border rounded-lg p-6">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{deal.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {deal.companies && <Link to="/companies/$id" params={{ id: deal.companies?.id }} className="hover:underline">{deal.companies?.name}</Link>}
              {deal.contacts && <> · <Link to="/contacts/$id" params={{ id: deal.contacts?.id }} className="hover:underline">{deal.contacts?.first_name} {deal.contacts?.last_name}</Link></>}
            </div>
            <div className="flex gap-3 mt-3 items-center flex-wrap">
              <span className="text-2xl font-bold">{fmtCurrency(deal.value)}</span>
              {deal.status === "won" && <Badge className="bg-success text-success-foreground">Won</Badge>}
              {deal.status === "lost" && <Badge variant="destructive">Lost</Badge>}
              {deal.status === "open" && deal.stages && <Badge style={{ backgroundColor: deal.stages?.color ?? undefined, color: "white" }}>{deal.stages?.name}</Badge>}
              <span className="text-sm text-muted-foreground">Close: {fmtDate(deal.close_date)}</span>
              <span className="text-sm text-muted-foreground">{deal.probability}% probability</span>
              <span className="text-sm text-muted-foreground">Owner: {deal.profiles?.full_name ?? "—"}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-stretch">
            {deal.status === "open" && !isReadOnly && (
              <>
                <select className="h-9 px-3 border rounded-md text-sm bg-background" value={deal.stage_id ?? ""} onChange={(e) => moveStage(e.target.value)}>
                  {pipelineStages.map((s: any) => <option key={s.id} value={s.id}>Move to: {s.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90 flex-1" onClick={markWon}><Trophy className="h-4 w-4 mr-1" />Won</Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => setLostOpen(true)}><XCircle className="h-4 w-4 mr-1" />Lost</Button>
                </div>
              </>
            )}
            {!isReadOnly && (
              <Sheet open={editOpen} onOpenChange={setEditOpen}>
                <SheetTrigger asChild><Button variant="outline" size="sm">Edit</Button></SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader><SheetTitle>Edit Deal</SheetTitle></SheetHeader>
                  <DealForm deal={deal} onSave={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["deal", id] }); }} />
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </div>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Deal Lost</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select className="w-full h-10 px-3 border rounded-md text-sm bg-background" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
              <option value="">Pick a reason...</option>
              {LOST_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
            <textarea className="w-full p-2 border rounded-md text-sm bg-background" rows={3} placeholder="Additional notes..." value={lostNote} onChange={(e) => setLostNote(e.target.value)} />
            <Button variant="destructive" onClick={markLost} className="w-full">Confirm Lost</Button>
          </div>
        </DialogContent>
      </Dialog>

      {!isReadOnly && (
        <div className="flex gap-2">
          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild><Button size="sm">Log Activity</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
              <LogActivityForm dealId={id} contactId={deal.contacts?.id} onSave={() => { setLogOpen(false); qc.invalidateQueries({ queryKey: ["deal-acts", id] }); }} />
            </DialogContent>
          </Dialog>
          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline">+ Task</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
              <TaskForm defaultDealId={id} defaultContactId={deal.contacts?.id} onSave={() => { setTaskOpen(false); qc.invalidateQueries({ queryKey: ["deal-tasks", id] }); }} />
            </DialogContent>
          </Dialog>
        </div>
      )}

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="quotes">Quotes ({quotes.length})</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">Stage History</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <div className="bg-card border rounded-lg p-5">
            {activities.length === 0 ? <p className="text-sm text-muted-foreground">No activity</p> : (
              <ul className="space-y-3">
                {activities.map((a: any) => {
                  const Icon = ICON[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="flex gap-3 pb-3 border-b last:border-0">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <div className="flex justify-between"><span className="font-medium text-sm">{a.subject ?? a.type}</span><span className="text-xs text-muted-foreground">{fmtDateTime(a.logged_at)}</span></div>
                        {a.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                        <div className="text-xs text-muted-foreground">by {a.profiles?.full_name}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="tasks">
          <div className="bg-card border rounded-lg p-5">
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No tasks</p> : (
              <ul className="space-y-2">
                {tasks.map((t: any) => (
                  <li key={t.id} className="flex justify-between py-2 border-b last:border-0 text-sm">
                    <span>{t.title}</span>
                    <span className="text-muted-foreground">{fmtDate(t.due_date)} · {t.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="quotes">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Deal Quotes</h3>
              {!isReadOnly && (
                <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
                  <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2"/> Create Quote</Button></DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Create New Quote</DialogTitle></DialogHeader>
                    <QuoteForm dealId={id} onSave={() => { setQuoteOpen(false); qc.invalidateQueries({ queryKey: ["quotes", id] }); }} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {quotes.length === 0 ? <p className="text-sm text-muted-foreground">No quotes created yet.</p> : (
              <div className="grid gap-3">
                {quotes.map((q: any) => (
                  <div key={q.id} className="flex justify-between items-center p-3 border rounded-md">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        Quote #{q.quote_number}
                        <Badge variant="outline" className="ml-2 uppercase text-[10px]">{q.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">Created {fmtDate(q.created_at)} · Valid until {q.valid_until ? fmtDate(q.valid_until) : "—"}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-semibold">{fmtCurrency(q.total_amount)}</div>
                      <Button variant="outline" size="sm" onClick={() => downloadQuotePDF(q)}>
                        <Download className="w-4 h-4 mr-1" /> PDF
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="files">
          <DocumentList dealId={id} />
        </TabsContent>
        <TabsContent value="history">
          <div className="bg-card border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground"><tr><th className="p-3 text-left">From</th><th className="p-3 text-left">To</th><th className="p-3 text-left">Changed By</th><th className="p-3 text-left">When</th></tr></thead>
              <tbody>
                {history.length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No changes yet</td></tr> :
                  history.map((h: any) => (
                    <tr key={h.id} className="border-t">
                      <td className="p-3">{h.from_stage?.name ?? "—"}</td>
                      <td className="p-3">{h.to_stage?.name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{h.profiles?.full_name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{fmtDateTime(h.changed_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuoteForm({ dealId, onSave }: { dealId: string; onSave: () => void }) {
  const [quoteNumber, setQuoteNumber] = useState(`QT-${Math.floor(Math.random() * 10000)}`);
  const [validUntil, setValidUntil] = useState("");
  const [lineItems, setLineItems] = useState<{product_id: string, quantity: number, unit_price: number}[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: async () => await api.get("/products") });

  const addLineItem = (productId: string) => {
    const prod: any = products.find((p: any) => p.id === productId);
    if (!prod) return;
    setLineItems([...lineItems, { product_id: prod.id, quantity: 1, unit_price: prod.unit_price }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, val: number) => {
    const arr = [...lineItems];
    (arr[index] as any)[field] = val;
    setLineItems(arr);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setBusy(true);
    try {
      await api.post("/quotes", { deal_id: dealId, quote_number: quoteNumber, valid_until: validUntil || null, line_items: lineItems });
      toast.success("Quote created");
      onSave();
    } catch (err: any) {
      toast.error("Failed to create quote");
    } finally {
      setBusy(false);
    }
  };

  const total = lineItems.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Quote Number</Label>
          <Input className="mt-1" value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} required />
        </div>
        <div>
          <Label>Valid Until</Label>
          <Input type="date" className="mt-1" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
        </div>
      </div>
      
      <div className="border rounded-md p-4 space-y-3 bg-muted/20">
        <Label>Line Items</Label>
        {lineItems.map((it, idx) => {
          const prod: any = products.find((p: any) => p.id === it.product_id);
          return (
            <div key={idx} className="flex gap-2 items-center">
              <div className="flex-1 font-medium text-sm">{prod?.name}</div>
              <Input type="number" min="1" className="w-20" value={it.quantity} onChange={e => updateLineItem(idx, 'quantity', Number(e.target.value))} />
              <div className="text-muted-foreground text-sm px-2">x</div>
              <Input type="number" step="0.01" className="w-24" value={it.unit_price} onChange={e => updateLineItem(idx, 'unit_price', Number(e.target.value))} />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeLineItem(idx)} className="text-destructive"><Trash2 className="w-4 h-4"/></Button>
            </div>
          );
        })}
        {products.length > 0 ? (
          <select 
            className="w-full h-9 px-3 border rounded-md text-sm bg-background mt-2" 
            onChange={(e) => {
              if(e.target.value) { addLineItem(e.target.value); e.target.value = ""; }
            }}
          >
            <option value="">+ Add Product...</option>
            {products.map((p: any) => <option key={p.id} value={p.id}>{p.name} - {fmtCurrency(p.unit_price)}</option>)}
          </select>
        ) : (
          <div className="text-sm text-muted-foreground mt-2">No products available. Go to the Products page to add some.</div>
        )}
      </div>
      
      <div className="flex justify-between items-center pt-2">
        <div className="font-medium">Total: {fmtCurrency(total)}</div>
        <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Quote"}</Button>
      </div>
    </form>
  );
}

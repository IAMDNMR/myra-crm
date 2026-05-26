import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LogActivityForm } from "@/components/LogActivityForm";
import { TaskForm } from "@/components/TaskForm";
import { Mail, Phone, Calendar as CalIcon, StickyNote, CheckSquare, Plus } from "lucide-react";
import { fmtCurrency, fmtDateTime, initials, timeAgo } from "@/lib/format";
import { ContactForm } from "./contacts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { DocumentList } from "@/components/DocumentList";

export const Route = createFileRoute("/_authenticated/contacts/$id")({
  component: ContactDetail,
});

const ICON: Record<string, any> = { email: Mail, call: Phone, meeting: CalIcon, note: StickyNote, task: CheckSquare };

function ContactDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => api.get(`/contacts/${id}`),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["contact-acts", id],
    queryFn: async () => {
      const all = await api.get("/activities?limit=1000");
      return (all?.items || []).filter((a: any) => a.contact_id === id);
    },
  });
  const { data: deals = [] } = useQuery({
    queryKey: ["contact-deals", id],
    queryFn: async () => {
      const all = await api.get("/deals?limit=1000");
      return (all?.items || []).filter((d: any) => d.contact_id === id);
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["contact-tasks", id],
    queryFn: async () => {
      const all = await api.get("/tasks");
      return (all ?? []).filter((t: any) => t.contact_id === id && t.status === "open");
    },
  });

  if (!contact) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
      <Link to="/contacts" className="text-sm text-muted-foreground hover:underline">← Back to Contacts</Link>

      <div className="bg-card border rounded-lg p-6 flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold">
          {initials(`${contact.first_name} ${contact.last_name}`)}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{contact.first_name} {contact.last_name}</h1>
          <div className="text-sm text-muted-foreground">{contact.title}</div>
          {contact.companies && <Badge variant="secondary" className="mt-2">{contact.companies.name}</Badge>}
          <div className="mt-2 text-sm flex gap-4 text-muted-foreground">
            {contact.email && <span>✉ {contact.email}</span>}
            {contact.phone && <span>📞 {contact.phone}</span>}
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex flex-col gap-2">
            <Sheet open={editOpen} onOpenChange={setEditOpen}>
              <SheetTrigger asChild><Button variant="outline" size="sm">Edit</Button></SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader><SheetTitle>Edit Contact</SheetTitle></SheetHeader>
                <ContactForm contact={contact} onSave={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["contact", id] }); }} />
              </SheetContent>
            </Sheet>
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
              <DialogTrigger asChild><Button size="sm">Log Activity</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
                <LogActivityForm contactId={id} onSave={() => { setLogOpen(false); qc.invalidateQueries({ queryKey: ["contact-acts", id] }); }} />
              </DialogContent>
            </Dialog>
            <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />Task</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                <TaskForm defaultContactId={id} onSave={() => { setTaskOpen(false); qc.invalidateQueries({ queryKey: ["contact-tasks", id] }); }} />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity ({activities.length})</TabsTrigger>
          <TabsTrigger value="deals">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <div className="bg-card border rounded-lg p-5">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <ul className="space-y-4">
                {activities.map((a: any) => {
                  const Icon = ICON[a.type] ?? StickyNote;
                  return (
                    <li key={a.id} className="flex gap-3 pb-4 border-b last:border-0 last:pb-0">
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0"><Icon className="h-4 w-4" /></div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-sm">{a.subject ?? a.type}</div>
                          <span className="text-xs text-muted-foreground">{fmtDateTime(a.logged_at)}</span>
                        </div>
                        {a.body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>}
                        <div className="text-xs text-muted-foreground mt-1">by {a.profiles?.full_name ?? "—"} · {timeAgo(a.logged_at)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="deals">
          <div className="bg-card border rounded-lg p-5">
            {deals.length === 0 ? <p className="text-sm text-muted-foreground">No deals</p> : (
              <ul className="space-y-2">
                {deals.map((d: any) => (
                  <li key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <Link to="/deals/$id" params={{ id: d.id }} className="font-medium hover:underline">{d.name}</Link>
                    <div className="flex items-center gap-3">
                      <Badge style={{ backgroundColor: d.stages?.color, color: "white" }}>{d.stages?.name}</Badge>
                      <span className="font-medium">{fmtCurrency(d.value)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="tasks">
          <div className="bg-card border rounded-lg p-5">
            {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks</p> : (
              <ul className="space-y-2">
                {tasks.map((t: any) => (
                  <li key={t.id} className="flex justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{t.title}</span>
                    <Badge variant={t.priority === "high" ? "destructive" : "secondary"}>{t.priority}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>
        <TabsContent value="files">
          <DocumentList contactId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

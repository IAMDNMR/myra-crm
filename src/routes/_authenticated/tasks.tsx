import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "@/components/TaskForm";
import { Phone, Mail, Calendar as CalIcon, CheckCircle, Plus } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

const TYPE_ICON: Record<string, any> = { call: Phone, email: Mail, meeting: CalIcon, follow_up: CheckCircle, demo: CalIcon, other: CheckCircle };

function TasksPage() {
  const { user, profile, isManager } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rawTasks = [] } = useQuery({
    queryKey: ["tasks-all"],
    queryFn: async () => await api.get("/tasks") ?? [],
  });
  
  const { data: statuses = [] } = useQuery({
    queryKey: ["task_statuses"],
    queryFn: async () => await api.get("/task_statuses") ?? [],
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => await api.get("/contacts") ?? [],
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => await api.get("/deals") ?? [],
  });

  // Client-side join
  const tasks = rawTasks.map((t: any) => {
    const statusObj = statuses.find((s: any) => s.id === t.status_id);
    const isClosed = statusObj ? statusObj.is_closed_state : false;
    return {
      ...t,
      statusObj,
      isClosed,
      contacts: contacts.find((c: any) => c.id === t.contact_id),
      deals: deals.find((d: any) => d.id === t.deal_id),
    };
  });

  const myOpen = tasks.filter((t: any) => t.assignee_id === user?.id && !t.isClosed);
  const teamOpen = tasks.filter((t: any) => !t.isClosed);
  const completed = tasks.filter((t: any) => t.isClosed).slice(0, 50);

  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1); tomorrow.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 7);
  const groups = {
    overdue: myOpen.filter((t: any) => t.due_date && new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0))),
    today: myOpen.filter((t: any) => t.due_date && new Date(t.due_date) >= new Date(new Date().setHours(0, 0, 0, 0)) && new Date(t.due_date) < tomorrow),
    week: myOpen.filter((t: any) => t.due_date && new Date(t.due_date) >= tomorrow && new Date(t.due_date) <= weekEnd),
    upcoming: myOpen.filter((t: any) => t.due_date && new Date(t.due_date) > weekEnd),
  };

  const toggle = async (t: any) => {
    if (isReadOnly) return;
    
    // Find a closed status or an open status
    const targetStatus = t.isClosed 
      ? statuses.find((s: any) => !s.is_closed_state)
      : statuses.find((s: any) => s.is_closed_state);
      
    if (!targetStatus) {
      toast.error("No valid status to switch to. Check settings.");
      return;
    }

    await api.put(`/tasks/${t.id}`, { status_id: targetStatus.id });
    qc.invalidateQueries({ queryKey: ["tasks-all"] });
    toast.success(t.isClosed ? "Reopened" : "Completed");
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">{myOpen.length} open assigned to you</p>
        </div>
        {!isReadOnly && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Task</Button></DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Task</DialogTitle></DialogHeader>
              <TaskForm task={editing} onSave={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["tasks-all"] }); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">My Tasks ({myOpen.length})</TabsTrigger>
          {isManager && <TabsTrigger value="team">Team ({teamOpen.length})</TabsTrigger>}
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="done">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="mine" className="space-y-4">
          {(["overdue", "today", "week", "upcoming"] as const).map((k) => groups[k].length > 0 && (
            <div key={k} className="bg-card border rounded-lg">
              <div className={`px-4 py-2 text-sm font-semibold border-b ${k === "overdue" ? "text-destructive" : ""}`}>
                {k === "overdue" ? "🚨 Overdue" : k === "today" ? "Today" : k === "week" ? "This Week" : "Upcoming"} ({groups[k].length})
              </div>
              <ul>{groups[k].map((t: any) => <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={(t) => { setEditing(t); setOpen(true); }} isReadOnly={isReadOnly} />)}</ul>
            </div>
          ))}
          {myOpen.length === 0 && <div className="bg-card border rounded-lg p-12 text-center text-muted-foreground">All clear 🎉</div>}
        </TabsContent>
        {isManager && (
          <TabsContent value="team">
            <div className="bg-card border rounded-lg">
              <ul>{teamOpen.map((t: any) => <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={(t) => { setEditing(t); setOpen(true); }} />)}</ul>
            </div>
          </TabsContent>
        )}
        <TabsContent value="calendar"><CalendarView tasks={myOpen} /></TabsContent>
        <TabsContent value="done">
          <div className="bg-card border rounded-lg">
            <ul>{completed.map((t: any) => <TaskRow key={t.id} task={t} onToggle={toggle} onEdit={(t) => { setEditing(t); setOpen(true); }} />)}</ul>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskRow({ task, onToggle, onEdit, isReadOnly }: { task: any; onToggle: (t: any) => void; onEdit: (t: any) => void; isReadOnly?: boolean }) {
  const Icon = TYPE_ICON[task.type ?? "other"] ?? CheckCircle;
  const overdue = !task.isClosed && task.due_date && new Date(task.due_date) < new Date();
  return (
    <li className="flex items-center gap-3 px-4 py-3 border-b last:border-0 hover:bg-accent/40">
      <input type="checkbox" checked={task.isClosed} onChange={() => onToggle(task)} disabled={isReadOnly} />
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isReadOnly && onEdit(task)}>
        <div className={`text-sm font-medium ${task.isClosed ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
        <div className="text-xs text-muted-foreground truncate">
          {task.statusObj && <Badge variant="outline" className="mr-2" style={{ borderColor: task.statusObj.color, color: task.statusObj.color }}>{task.statusObj.name}</Badge>}
          {task.contacts && <Link to="/contacts/$id" params={{ id: task.contacts.id }} className="hover:underline">{task.contacts.first_name} {task.contacts.last_name}</Link>}
          {task.contacts && task.deals && " · "}
          {task.deals && <Link to="/deals/$id" params={{ id: task.deals.id }} className="hover:underline">{task.deals.name}</Link>}
        </div>
      </div>
      <span className={`text-xs ${overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{fmtDate(task.due_date)}</span>
      <Badge variant={task.priority === "high" ? "destructive" : task.priority === "low" ? "outline" : "secondary"}>{task.priority}</Badge>
    </li>
  );
}

function CalendarView({ tasks }: { tasks: any[] }) {
  const [month, setMonth] = useState(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);
  const byDay: Record<number, any[]> = {};
  tasks.forEach((t) => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
      (byDay[d.getDate()] ||= []).push(t);
    }
  });

  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</Button>
        <h3 className="font-semibold">{month.toLocaleString("en-US", { month: "long", year: "numeric" })}</h3>
        <Button variant="ghost" size="sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="p-2 text-center font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => (
          <div key={i} className={`min-h-20 p-1 border rounded ${d ? "bg-background" : "bg-muted/30"}`}>
            {d && <>
              <div className="text-xs font-medium">{d}</div>
              <div className="space-y-0.5 mt-1">
                {(byDay[d] ?? []).slice(0, 2).map((t: any) => <div key={t.id} className="text-[10px] truncate bg-primary/10 text-primary px-1 rounded">{t.title}</div>)}
                {(byDay[d]?.length ?? 0) > 2 && <div className="text-[10px] text-muted-foreground">+{byDay[d].length - 2}</div>}
              </div>
            </>}
          </div>
        ))}
      </div>
    </div>
  );
}

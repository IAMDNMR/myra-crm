import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { fmtCurrency, fmtDate, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  Calendar as CalIcon,
  StickyNote,
  AlertTriangle,
  CheckSquare,
  KanbanSquare,
  TrendingUp,
  Users,
  Building2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/")({
  component: Dashboard,
});

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "primary" | "success" | "warning" }) {
  const accentClass =
    accent === "success"
      ? "border-l-4 border-l-success"
      : accent === "warning"
      ? "border-l-4 border-l-warning"
      : accent === "primary"
      ? "border-l-4 border-l-primary"
      : "";
  return (
    <div className={`bg-card border rounded-lg p-5 ${accentClass}`}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

const ICON: Record<string, any> = { email: Mail, call: Phone, meeting: CalIcon, note: StickyNote, task: CheckSquare };

function Dashboard() {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const r = refreshKey;

  const { data: deals = [] } = useQuery({
    queryKey: ["dash-deals", r],
    queryFn: async () => {
      const [dealsRes, companiesRes, contactsRes] = await Promise.all([
        api.get("/deals?limit=1000"),
        api.get("/companies?limit=1000"),
        api.get("/contacts?limit=1000")
      ]);
      const dealsData = dealsRes?.items || [];
      const companiesData = companiesRes?.items || [];
      const contactsData = contactsRes?.items || [];
      return dealsData.map((d: any) => ({
        ...d,
        companies: companiesData.find((c: any) => c.id === d.company_id) || null,
        contacts: contactsData.find((c: any) => c.id === d.contact_id) || null,
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const { data: stages = [] } = useQuery({
    queryKey: ["dash-stages"],
    queryFn: async () => {
      const data = await api.get("/stages");
      return data.sort((a: any, b: any) => a.order_index - b.order_index);
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["dash-tasks", user?.id, r],
    queryFn: async () => {
      const [tasksData, contactsRes, dealsRes, statusesData] = await Promise.all([
        api.get("/tasks"),
        api.get("/contacts?limit=1000"),
        api.get("/deals?limit=1000"),
        api.get("/task_statuses")
      ]);
      const contactsData = contactsRes?.items || [];
      const dealsData = dealsRes?.items || [];
      const openStatuses = statusesData.filter((s: any) => !s.is_closed_state).map((s: any) => s.id);
      return tasksData
        .filter((t: any) => t.assignee_id === user!.id && (openStatuses.includes(t.status_id) || !t.status_id))
        .map((t: any) => ({
          ...t,
          contacts: contactsData.find((c: any) => c.id === t.contact_id) || null,
          deals: dealsData.find((d: any) => d.id === t.deal_id) || null,
        }));
    },
    enabled: !!user,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["dash-acts", r],
    queryFn: async () => {
      const [activitiesRes, profilesData, contactsRes, dealsRes] = await Promise.all([
        api.get("/activities?limit=1000"),
        api.get("/profiles"),
        api.get("/contacts?limit=1000"),
        api.get("/deals?limit=1000")
      ]);
      const activitiesData = activitiesRes?.items || [];
      const contactsData = contactsRes?.items || [];
      const dealsData = dealsRes?.items || [];
      return activitiesData.map((a: any) => ({
        ...a,
        profiles: profilesData.find((p: any) => p.id === a.user_id) || null,
        contacts: contactsData.find((c: any) => c.id === a.contact_id) || null,
        deals: dealsData.find((d: any) => d.id === a.deal_id) || null,
      })).sort((a: any, b: any) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()).slice(0, 10);
    },
  });

  const { data: recentContacts = [] } = useQuery({
    queryKey: ["dash-contacts", r],
    queryFn: async () => {
      const [contactsRes, companiesRes] = await Promise.all([
        api.get("/contacts?limit=1000"),
        api.get("/companies?limit=1000")
      ]);
      const contactsData = contactsRes?.items || [];
      const companiesData = companiesRes?.items || [];
      return contactsData.map((c: any) => ({
        ...c,
        companies: companiesData.find((comp: any) => comp.id === c.company_id) || null,
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    },
  });

  const { data: recentCompanies = [] } = useQuery({
    queryKey: ["dash-companies", r],
    queryFn: async () => {
      const companiesRes = await api.get("/companies?limit=1000");
      const companiesData = companiesRes?.items || [];
      return companiesData.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);
    },
  });

  const open = deals.filter((d: any) => d.status === "open");
  const openValue = open.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
  const weightedForecast = open.reduce((s: number, d: any) => s + Number(d.value ?? 0) * (Number(d.probability ?? 0) / 100), 0);
  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const closingMonth = open.filter((d: any) => d.close_date && new Date(d.close_date) <= monthEnd && new Date(d.close_date) >= now);
  const wonMonth = deals.filter((d: any) => d.status === "won" && new Date(d.updated_at) >= monthStart);
  const wonValue = wonMonth.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const todayTasks = tasks.filter((t: any) => t.due_date && new Date(t.due_date) < tomorrow);

  const chartData = stages.map((s: any) => {
    const ds = open.filter((d: any) => d.stage_id === s.id);
    return { name: s.name, count: ds.length, value: ds.reduce((sum: number, d: any) => sum + Number(d.value ?? 0), 0) };
  });

  const stale = open.filter((d: any) => {
    const acts = activities.filter((a: any) => a.deal_id === d.id);
    const last = acts[0] ? new Date(acts[0].logged_at) : new Date(d.created_at);
    return (Date.now() - last.getTime()) / 86400000 >= 14;
  });

  const recentDeals = deals.slice(0, 5);

  const toggleTask = async (id: string) => {
    try {
      const statuses = await api.get("/task_statuses");
      const closedStatus = statuses.find((s: any) => s.is_closed_state);
      if (closedStatus) {
        await api.put(`/tasks/${id}`, { status_id: closedStatus.id });
      } else {
        await api.delete(`/tasks/${id}`); // Fallback if no closed status exists
      }
      toast.success("Task completed");
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e.message || "Failed to update task");
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your sales at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Open Deals" value={String(open.length)} sub={fmtCurrency(openValue)} accent="primary" />
        <KpiCard label="Weighted Forecast" value={fmtCurrency(weightedForecast)} sub="prob-weighted" />
        <KpiCard label="Closing This Month" value={String(closingMonth.length)} sub={fmtCurrency(closingMonth.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0))} />
        <KpiCard label="Tasks Due Today" value={String(todayTasks.length)} accent={todayTasks.length > 0 ? "warning" : undefined} />
        <KpiCard label="Won This Month" value={fmtCurrency(wonValue)} sub={`${wonMonth.length} deals`} accent="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> Pipeline by Stage
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, n) => (n === "value" ? fmtCurrency(v as number) : v)} />
                <Bar dataKey="count" fill="hsl(220 60% 40%)" />
                <Bar dataKey="value" fill="hsl(220 60% 70%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-muted-foreground" /> My Tasks Today
          </h2>
          {todayTasks.length === 0 ? (
            <EmptyState icon={CheckSquare} title="All clear" description="No tasks due today 🎉" />
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((t: any) => (
                <li key={t.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <input type="checkbox" onChange={() => toggleTask(t.id)} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    {t.contacts && (
                      <Link to="/contacts/$id" params={{ id: t.contacts.id }} className="text-xs text-muted-foreground hover:underline">
                        {t.contacts.first_name} {t.contacts.last_name}
                      </Link>
                    )}
                    {t.deals && (
                      <Link to="/deals/$id" params={{ id: t.deals.id }} className="text-xs text-muted-foreground hover:underline ml-2">
                        · {t.deals.name}
                      </Link>
                    )}
                  </div>
                  <Badge variant={t.priority === "high" ? "destructive" : "secondary"}>{t.priority}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4">Recent Activity</h2>
          {activities.length === 0 ? (
            <EmptyState icon={StickyNote} title="No activity yet" description="Log a call, email, or note from any contact or deal." />
          ) : (
            <ul className="space-y-3">
              {activities.map((a: any) => {
                const Icon = ICON[a.type] ?? StickyNote;
                return (
                  <li key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.subject ?? a.type}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {a.profiles?.full_name ?? "—"} ·{" "}
                        {a.contacts ? (
                          <Link to="/contacts/$id" params={{ id: a.contacts.id }} className="hover:underline">
                            {a.contacts.first_name} {a.contacts.last_name}
                          </Link>
                        ) : a.deals ? (
                          <Link to="/deals/$id" params={{ id: a.deals.id }} className="hover:underline">
                            {a.deals.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(a.logged_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" /> Stale Deals (14+ days)
          </h2>
          {stale.length === 0 ? (
            <EmptyState icon={Trophy} title="No stale deals" description="Every open deal had activity in the last 2 weeks." />
          ) : (
            <ul className="space-y-2">
              {stale.slice(0, 6).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <Link to="/deals/$id" params={{ id: d.id }} className="text-sm font-medium hover:underline">
                      {d.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">Close {fmtDate(d.close_date)}</div>
                  </div>
                  <span className="text-sm font-medium">{fmtCurrency(d.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <KanbanSquareIcon /> Recent Deals
          </h2>
          {recentDeals.length === 0 ? (
            <EmptyState icon={Trophy} title="No deals yet" description="Create your first deal from the Pipeline." />
          ) : (
            <ul className="space-y-2">
              {recentDeals.map((d: any) => (
                <li key={d.id} className="flex justify-between py-2 border-b last:border-0">
                  <Link to="/deals/$id" params={{ id: d.id }} className="text-sm font-medium hover:underline truncate">
                    {d.name}
                  </Link>
                  <span className="text-sm text-muted-foreground shrink-0 ml-2">{fmtCurrency(d.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Recent Contacts
          </h2>
          {recentContacts.length === 0 ? (
            <EmptyState icon={Users} title="No contacts yet" />
          ) : (
            <ul className="space-y-2">
              {recentContacts.map((c: any) => (
                <li key={c.id} className="flex justify-between py-2 border-b last:border-0">
                  <Link to="/contacts/$id" params={{ id: c.id }} className="text-sm font-medium hover:underline truncate">
                    {c.first_name} {c.last_name}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2 truncate">{c.companies?.name ?? c.email ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card border rounded-lg p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Recent Companies
          </h2>
          {recentCompanies.length === 0 ? (
            <EmptyState icon={Building2} title="No companies yet" />
          ) : (
            <ul className="space-y-2">
              {recentCompanies.map((c: any) => (
                <li key={c.id} className="flex justify-between py-2 border-b last:border-0">
                  <Link to="/companies/$id" params={{ id: c.id }} className="text-sm font-medium hover:underline truncate">
                    {c.name}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2 truncate">{c.industry ?? ""}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanSquareIcon() {
  return <KanbanSquare className="h-4 w-4 text-muted-foreground" />;
}

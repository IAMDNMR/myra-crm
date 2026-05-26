import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { fmtCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Download, Trophy, TrendingUp, Clock, Users as UsersIcon } from "lucide-react";
import { downloadCsv } from "@/lib/csv";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const [range, setRange] = useState<"week" | "month" | "quarter" | "year">("month");
  const from = useMemo(() => {
    const d = new Date();
    if (range === "week") d.setDate(d.getDate() - 7);
    else if (range === "month") d.setMonth(d.getMonth() - 1);
    else if (range === "quarter") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  }, [range]);

  const { data: deals = [] } = useQuery({
    queryKey: ["rep-deals", range],
    queryFn: async () => {
      const res = await api.get("/deals?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });
  const { data: stages = [] } = useQuery({
    queryKey: ["rep-stages"],
    queryFn: async () => {
      const res = await api.get("/stages?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["rep-acts", from],
    queryFn: async () => {
      const res = await api.get(`/activities?from=${encodeURIComponent(from)}&limit=10000`);
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });

  const open = deals.filter((d: any) => d.status === "open");
  const closedInRange = deals.filter((d: any) => d.status !== "open" && new Date(d.updated_at) >= new Date(from));
  const wonInRange = closedInRange.filter((d: any) => d.status === "won");
  const lostInRange = closedInRange.filter((d: any) => d.status === "lost");
  const winRate = closedInRange.length > 0 ? Math.round((wonInRange.length / closedInRange.length) * 100) : 0;
  const wonValueRange = wonInRange.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0);
  const avgDealSize = wonInRange.length > 0 ? wonValueRange / wonInRange.length : 0;

  const forecast = open.reduce((s: number, d: any) => s + Number(d.value ?? 0) * (Number(d.probability ?? 0) / 100), 0);

  // Avg sales cycle: time between deal created_at and updated_at for won deals
  const wonAll = deals.filter((d: any) => d.status === "won");
  const avgCycleDays =
    wonAll.length > 0
      ? Math.round(
          wonAll.reduce(
            (s: number, d: any) => s + (new Date(d.updated_at).getTime() - new Date(d.created_at).getTime()) / 86400000,
            0,
          ) / wonAll.length,
        )
      : 0;

  // Pipeline by stage
  const pipelineByStage = stages.map((s: any) => {
    const ds = open.filter((d: any) => d.stage_id === s.id);
    return {
      name: s.name,
      count: ds.length,
      value: ds.reduce((sum: number, d: any) => sum + Number(d.value ?? 0), 0),
    };
  });

  // Won vs Lost
  const wonLost = [
    {
      name: "Won",
      value: wonInRange.length,
      total: wonInRange.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0),
      color: "hsl(var(--success))",
    },
    {
      name: "Lost",
      value: lostInRange.length,
      total: lostInRange.reduce((s: number, d: any) => s + Number(d.value ?? 0), 0),
      color: "hsl(var(--destructive))",
    },
  ];

  // Leaderboard: by rep, won deals + total value in range
  const repMap: Record<string, { rep: string; wonCount: number; wonValue: number; openCount: number; openValue: number; activities: number }> = {};
  deals.forEach((d: any) => {
    const rep = d.profiles?.full_name ?? "Unassigned";
    repMap[rep] ||= { rep, wonCount: 0, wonValue: 0, openCount: 0, openValue: 0, activities: 0 };
    if (d.status === "won" && new Date(d.updated_at) >= new Date(from)) {
      repMap[rep].wonCount++;
      repMap[rep].wonValue += Number(d.value ?? 0);
    }
    if (d.status === "open") {
      repMap[rep].openCount++;
      repMap[rep].openValue += Number(d.value ?? 0);
    }
  });
  activities.forEach((a: any) => {
    const rep = a.profiles?.full_name ?? "Unassigned";
    repMap[rep] ||= { rep, wonCount: 0, wonValue: 0, openCount: 0, openValue: 0, activities: 0 };
    repMap[rep].activities++;
  });
  const leaderboard = Object.values(repMap).sort((a, b) => b.wonValue - a.wonValue);

  // Activity heatmap: 7 weeks × 7 days
  const heatmap = useMemo(() => {
    const days = 49;
    const cells: { date: Date; count: number }[] = [];
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayMid);
      d.setDate(d.getDate() - i);
      cells.push({ date: d, count: 0 });
    }
    activities.forEach((a: any) => {
      const d = new Date(a.logged_at);
      d.setHours(0, 0, 0, 0);
      const idx = cells.findIndex((c) => c.date.getTime() === d.getTime());
      if (idx >= 0) cells[idx].count++;
    });
    return cells;
  }, [activities]);
  const heatMax = Math.max(1, ...heatmap.map((c) => c.count));

  // Activity by rep
  const byRep: Record<string, { name: string; call: number; email: number; meeting: number; note: number }> = {};
  activities.forEach((a: any) => {
    const name = a.profiles?.full_name ?? "Unknown";
    byRep[name] ||= { name, call: 0, email: 0, meeting: 0, note: 0 };
    if (a.type === "call") byRep[name].call++;
    else if (a.type === "email") byRep[name].email++;
    else if (a.type === "meeting") byRep[name].meeting++;
    else byRep[name].note++;
  });
  const activityData = Object.values(byRep);

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Sales performance &amp; forecasting</p>
        </div>
        <select
          className="h-9 px-3 border rounded-md text-sm bg-background"
          value={range}
          onChange={(e) => setRange(e.target.value as any)}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile icon={Trophy} label="Win Rate" value={`${winRate}%`} sub={`${wonInRange.length}/${closedInRange.length} closed`} />
        <KpiTile icon={TrendingUp} label="Weighted Forecast" value={fmtCurrency(forecast)} sub={`${open.length} open deals`} />
        <KpiTile icon={Clock} label="Avg Sales Cycle" value={`${avgCycleDays} days`} sub="for won deals (all time)" />
        <KpiTile icon={UsersIcon} label="Avg Deal Size" value={fmtCurrency(avgDealSize)} sub={`${wonInRange.length} won this range`} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="Pipeline by Stage" onExport={() => downloadCsv("pipeline-by-stage", pipelineByStage)}>
          {pipelineByStage.length === 0 ? (
            <EmptyState icon={TrendingUp} title="No stages defined" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pipelineByStage}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => (n === "value" ? fmtCurrency(v as number) : v)} />
                <Legend />
                <Bar dataKey="count" fill="hsl(220 60% 40%)" />
                <Bar dataKey="value" fill="hsl(220 60% 70%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportCard>

        <ReportCard title="Won vs Lost" onExport={() => downloadCsv("won-vs-lost", wonLost)}>
          {wonLost.every((w) => w.value === 0) ? (
            <EmptyState icon={Trophy} title="No closed deals in range" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={wonLost} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label>
                  {wonLost.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any, _n, p: any) => `${v} deals · ${fmtCurrency(p.payload.total)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ReportCard>

        {/* Deal Velocity — requires stage history data (coming soon) */}
        <ReportCard title="Deal Velocity (avg days per stage)">
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
            <Clock className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Coming soon</p>
            <p className="text-xs text-center">Deal velocity tracking will be available once stage history data is collected.</p>
          </div>
        </ReportCard>

        <ReportCard title="Activity by Rep" onExport={() => downloadCsv("activity-by-rep", activityData)}>
          {activityData.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No activity in range" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={activityData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="call" fill="hsl(220 60% 50%)" />
                <Bar dataKey="email" fill="hsl(142 70% 40%)" />
                <Bar dataKey="meeting" fill="hsl(38 92% 50%)" />
                <Bar dataKey="note" fill="hsl(280 60% 50%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ReportCard>
      </div>

      <ReportCard
        title="Leaderboard"
        onExport={() => downloadCsv("leaderboard", leaderboard)}
      >
        {leaderboard.length === 0 ? (
          <EmptyState icon={Trophy} title="No reps yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b">
                <tr>
                  <th className="text-left p-2">Rep</th>
                  <th className="text-right p-2">Won (range)</th>
                  <th className="text-right p-2">Won value</th>
                  <th className="text-right p-2">Open deals</th>
                  <th className="text-right p-2">Open value</th>
                  <th className="text-right p-2">Activities</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((r, i) => (
                  <tr key={r.rep} className="border-b last:border-0">
                    <td className="p-2 font-medium">
                      <span className="text-muted-foreground mr-2">#{i + 1}</span>
                      {r.rep}
                    </td>
                    <td className="p-2 text-right">{r.wonCount}</td>
                    <td className="p-2 text-right font-medium">{fmtCurrency(r.wonValue)}</td>
                    <td className="p-2 text-right">{r.openCount}</td>
                    <td className="p-2 text-right">{fmtCurrency(r.openValue)}</td>
                    <td className="p-2 text-right">{r.activities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      <ReportCard
        title="Activity Heatmap (last 7 weeks)"
        onExport={() => downloadCsv("activity-heatmap", heatmap.map((c) => ({ date: c.date.toISOString().slice(0, 10), count: c.count })))}
      >
        <div className="flex gap-2 items-start overflow-x-auto pb-2">
          <div className="flex flex-col gap-1 text-[10px] text-muted-foreground pt-4 pr-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="h-4 leading-4">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-flow-col grid-rows-7 gap-1">
            {heatmap.map((c) => {
              const intensity = c.count === 0 ? 0 : Math.min(1, c.count / heatMax);
              const bg = c.count === 0
                ? "hsl(var(--muted))"
                : `hsl(220 60% ${Math.round(70 - intensity * 40)}%)`;
              return (
                <div
                  key={c.date.toISOString()}
                  className="h-4 w-4 rounded-sm border"
                  style={{ backgroundColor: bg }}
                  title={`${c.date.toLocaleDateString()} — ${c.count} activities`}
                />
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
          Less
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <div
                key={v}
                className="h-3 w-3 rounded-sm border"
                style={{
                  backgroundColor: v === 0 ? "hsl(var(--muted))" : `hsl(220 60% ${Math.round(70 - v * 40)}%)`,
                }}
              />
            ))}
          </div>
          More
        </div>
      </ReportCard>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function ReportCard({
  title,
  children,
  onExport,
}: {
  title: string;
  children: React.ReactNode;
  onExport?: () => void;
}) {
  return (
    <div className="bg-card border rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">{title}</h3>
        {onExport && (
          <Button variant="ghost" size="sm" onClick={onExport} title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, CheckSquare, Clock, Mail, StickyNote, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TaskForm } from "@/components/TaskForm";
import { LogActivityForm } from "@/components/LogActivityForm";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isReadOnly = profile?.role === "read_only";
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [taskOpen, setTaskOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const res = await api.get("/tasks?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });
  
  const { data: deals = [] } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const res = await api.get("/deals?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const res = await api.get("/activities?limit=10000");
      return res?.items || (Array.isArray(res) ? res : []);
    },
  });

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <CalIcon className="w-6 h-6" /> Calendar
        </h1>
        
        <div className="flex items-center gap-4 flex-wrap">
          {!isReadOnly && (
            <div className="flex gap-2 mr-4">
              <Dialog open={logOpen} onOpenChange={setLogOpen}>
                <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="w-4 h-4 mr-1"/> Log Activity</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
                  <LogActivityForm onSave={() => { setLogOpen(false); qc.invalidateQueries({ queryKey: ["activities"] }); }} />
                </DialogContent>
              </Dialog>
              <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1"/> New Task</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
                  <TaskForm onSave={() => { setTaskOpen(false); qc.invalidateQueries({ queryKey: ["tasks"] }); }} />
                </DialogContent>
              </Dialog>
            </div>
          )}

          <div className="text-lg font-medium">{monthNames[month]} {year}</div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={today}>Today</Button>
            <Button variant="outline" size="sm" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {dayNames.map(d => (
            <div key={d} className="p-3 text-center text-sm font-medium text-muted-foreground hidden sm:block">{d}</div>
          ))}
          {dayNames.map(d => (
            <div key={`${d}-mobile`} className="p-3 text-center text-sm font-medium text-muted-foreground sm:hidden">{d.slice(0,1)}</div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 flex-1 auto-rows-[minmax(120px,1fr)]">
          {days.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} className="border-r border-b bg-muted/10"></div>;
            
            const isToday = new Date().toDateString() === date.toDateString();
            const dateStr = date.toISOString().split("T")[0];
            
            const dayTasks = tasks.filter((t: any) => t.due_date && t.due_date.startsWith(dateStr));
            const dayDeals = deals.filter((d: any) => d.close_date && d.close_date.startsWith(dateStr));
            const dayActs = activities.filter((a: any) => a.logged_at && a.logged_at.startsWith(dateStr));
            
            return (
              <div key={date.toISOString()} className={`p-2 border-r border-b overflow-y-auto ${isToday ? "bg-accent/30" : ""}`}>
                <div className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {date.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayDeals.map((d: any) => (
                    <div key={`d-${d.id}`} className="text-xs p-1.5 bg-success/10 text-success-foreground rounded-sm border border-success/20 truncate" title={`Closing: ${d.name}`}>
                      <Clock className="w-3 h-3 inline mr-1" />
                      {d.name}
                    </div>
                  ))}
                  
                  {dayTasks.map((t: any) => (
                    <div key={`t-${t.id}`} className={`text-xs p-1.5 rounded-sm border truncate ${t.status === 'done' ? 'bg-muted text-muted-foreground line-through' : 'bg-background'}`} title={t.title}>
                      <CheckSquare className="w-3 h-3 inline mr-1" />
                      {t.title}
                    </div>
                  ))}

                  {dayActs.map((a: any) => (
                    <div key={`a-${a.id}`} className="text-xs p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-sm border border-blue-500/20 truncate" title={a.subject ?? a.type}>
                      {a.type === 'email' ? <Mail className="w-3 h-3 inline mr-1" /> : <StickyNote className="w-3 h-3 inline mr-1" />}
                      {a.subject ?? a.type}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

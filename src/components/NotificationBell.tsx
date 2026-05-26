import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Bell,
  Clock,
  ArrowRightLeft,
  Trophy,
  Info,
} from 'lucide-react';

interface Notification {
  id: string;
  icon: 'overdue' | 'stage_change' | 'won' | 'info';
  title: string;
  description: string;
  time: string;
  is_read?: boolean;
}

const STORAGE_KEY = 'notifications_read_at';

function getReadAt(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setReadAt(ts: string) {
  try {
    localStorage.setItem(STORAGE_KEY, ts);
  } catch {
    // ignore
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [readAt, setReadAtState] = useState<string | null>(() => getReadAt());

  const now = new Date().toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Overdue tasks — fetched from /tasks endpoint, filtered client-side
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['notifications', 'overdue-tasks'],
    queryFn: async () => {
      try {
        const data: any[] = await api.get('/tasks');
        return data.filter(
          (t) => t.status === 'open' && t.due_date && t.due_date < now,
        ).slice(0, 10);
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Recent deal stage changes (last 24h) — fetched from /deal_stage_history, filtered client-side
  const { data: stageChanges = [] } = useQuery({
    queryKey: ['notifications', 'stage-changes'],
    queryFn: async () => {
      try {
        const data: any[] = await api.get('/deal_stage_history');
        return data.filter((sc) => sc.changed_at && sc.changed_at >= twentyFourHoursAgo).slice(0, 10);
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Recent won deals (last 24h) — fetched from /deals, filtered client-side
  const { data: wonDeals = [] } = useQuery({
    queryKey: ['notifications', 'won-deals'],
    queryFn: async () => {
      try {
        const data: any[] = await api.get('/deals');
        return data.filter(
          (d) => d.status === 'won' && d.updated_at && d.updated_at >= twentyFourHoursAgo,
        ).slice(0, 10);
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: dbNotifications = [], refetch: refetchDbNotifications } = useQuery({
    queryKey: ['notifications', 'db'],
    queryFn: async () => {
      try {
        return await api.get('/notifications');
      } catch {
        return [];
      }
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  // Build notifications list
  const notifications: Notification[] = [];

  dbNotifications.forEach((n: any) => {
    notifications.push({
      id: `db-${n.id}`,
      icon: 'info',
      title: n.title,
      description: n.message || '',
      time: n.created_at,
      is_read: n.is_read
    });
  });

  overdueTasks.forEach((t: any) => {
    notifications.push({
      id: `overdue-${t.id}`,
      icon: 'overdue',
      title: 'Overdue Task',
      description: t.title,
      time: t.due_date,
    });
  });

  stageChanges.forEach((sc: any) => {
    const dealName = sc.deals?.name ?? sc.deal_name ?? 'Unknown deal';
    const fromStage = sc.from_stage?.name ?? sc.from_stage_name ?? '—';
    const toStage = sc.to_stage?.name ?? sc.to_stage_name ?? '—';
    notifications.push({
      id: `stage-${sc.id}`,
      icon: 'stage_change',
      title: `${dealName}`,
      description: `Moved from ${fromStage} → ${toStage}`,
      time: sc.changed_at,
    });
  });

  wonDeals.forEach((d: any) => {
    notifications.push({
      id: `won-${d.id}`,
      icon: 'won',
      title: 'Deal Won!',
      description: d.name,
      time: d.updated_at,
    });
  });

  // Sort by time descending
  notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Compute unread
  const unreadCount = notifications.filter((n) => {
    if (n.id.startsWith('db-')) return !n.is_read;
    return readAt ? new Date(n.time) > new Date(readAt) : true;
  }).length;

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      refetchDbNotifications();
    } catch {}
    const ts = new Date().toISOString();
    setReadAt(ts);
    setReadAtState(ts);
  };

  const iconMap = {
    overdue: <Clock className="h-4 w-4 text-red-500 shrink-0" />,
    stage_change: <ArrowRightLeft className="h-4 w-4 text-blue-500 shrink-0" />,
    won: <Trophy className="h-4 w-4 text-green-500 shrink-0" />,
    info: <Info className="h-4 w-4 text-primary shrink-0" />,
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = n.id.startsWith('db-') 
                ? !n.is_read 
                : (readAt ? new Date(n.time) > new Date(readAt) : true);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-b-0 ${
                    isUnread ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className="mt-0.5">{iconMap[n.icon]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {n.description}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {timeAgo(n.time)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

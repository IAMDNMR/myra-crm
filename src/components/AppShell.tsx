import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Target,
  Building2,
  KanbanSquare,
  CheckSquare,
  BarChart3,
  Settings,
  Menu,
  X,
  Search,
  LogOut,
  Sun,
  Moon,
  HelpCircle,
  Send,
  PackageOpen,
  Calendar,
  Mail
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth, type AppRole } from "@/lib/auth";
import { useTheme } from "@/components/ThemeProvider";
import { initials } from "@/lib/format";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/lib/api";

type NavItem = {
  to: string;
  label: string;
  icon: any;
  exact?: boolean;
  minRole?: "admin" | "manager" | "rep";
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/leads", label: "Leads", icon: Target },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/companies", label: "Companies", icon: Building2 },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/products", label: "Products", icon: PackageOpen },
  { to: "/reports", label: "Reports", icon: BarChart3, minRole: "rep" },
  { to: "/mailer", label: "Mailer", icon: Mail },
  { to: "/support", label: "Support", icon: HelpCircle, minRole: "rep" },
  { to: "/settings", label: "Settings", icon: Settings },
];

const ROLE_LEVEL: Record<string, number> = { admin: 4, manager: 3, rep: 2, read_only: 1 };

export function AppShell() {
  const { profile, setRole, signOut } = useAuth();
  const { resolved, setTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  const userLevel = ROLE_LEVEL[profile?.role ?? "read_only"] ?? 1;

  const visibleNav = NAV.filter((n) => {
    if (!n.minRole) return true;
    return userLevel >= (ROLE_LEVEL[n.minRole] ?? 0);
  });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const openCmdK = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true }),
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-60 bg-sidebar text-sidebar-foreground flex flex-col transform transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-sidebar-border">
          <Link to="/" className="font-bold tracking-tight text-lg flex items-center gap-1">
            <span className="text-primary-foreground">MYRA</span>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const active = isActive(n.to, n.exact);
            return (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border text-xs text-sidebar-foreground/60">MYRA CRM · v1.0</div>
      </aside>

      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-card border-b flex items-center justify-between px-4 lg:px-6 gap-3">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 -ml-2">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={openCmdK}
            className="flex-1 max-w-md h-9 px-3 rounded-md border bg-background text-sm text-muted-foreground hover:bg-accent flex items-center gap-2"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search contacts, companies, deals…</span>
            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono border rounded bg-muted text-muted-foreground">
              {isMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
          <div className="flex items-center gap-2">
            {/* Dev-only role switcher */}
            {import.meta.env.DEV && (
              <select
                value={profile?.role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                className="text-xs border rounded px-2 py-1 bg-accent text-accent-foreground"
                title="Dev: Switch role"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="rep">Rep</option>
                <option value="read_only">Read Only</option>
              </select>
            )}

            {/* Dark mode toggle */}
            <button
              onClick={() => setTheme(resolved === "dark" ? "light" : "dark")}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title={resolved === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Support / Contact Admin */}
            <ContactAdminDialog />

            {/* Notifications */}
            <NotificationBell />

            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium leading-tight">{profile?.full_name ?? "User"}</div>
              <div className="text-xs text-muted-foreground capitalize">{profile?.role}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              {initials(profile?.full_name)}
            </div>

            {/* Sign out */}
            <button
              onClick={signOut}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <Toaster />
    </div>
  );
}

function ContactAdminDialog() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post("/support/contact-admin", { subject, message });
      toast.success(res.message || "Message sent!");
      setOpen(false);
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send message.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          title="Contact Support"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact Administrator</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input className="mt-1" value={subject} onChange={e => setSubject(e.target.value)} required />
          </div>
          <div>
            <Label>Message</Label>
            <Textarea className="mt-1" rows={5} value={message} onChange={e => setMessage(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Sending..." : <><Send className="w-4 h-4 mr-2"/> Send Message</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, Outlet, useRouterState, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsLayout,
});

const ALL_NAV = [
  { to: "/settings", label: "Profile", exact: true },
  { to: "/settings/team", label: "Team", managerOnly: true },
  { to: "/settings/pipeline", label: "Pipelines", managerOnly: true },
  { to: "/settings/tasks", label: "Task Statuses", managerOnly: true },
  { to: "/settings/templates", label: "Email Templates" },
  { to: "/settings/webforms", label: "Web Forms", managerOnly: true },
  { to: "/settings/integrations", label: "Integrations", managerOnly: true },
];

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isManager } = useAuth();

  const navItems = ALL_NAV.filter(n => !n.managerOnly || isManager);

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>
      <div className="grid md:grid-cols-[200px_1fr] gap-6">
        <nav className="space-y-1">
          {navItems.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to as any} className={`block px-3 py-2 rounded-md text-sm ${active ? "bg-accent font-medium" : "hover:bg-accent/50 text-muted-foreground"}`}>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div><Outlet /></div>
      </div>
    </div>
  );
}

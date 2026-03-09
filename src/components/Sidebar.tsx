"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BarChart2,
  Users,
  Building2,
  CalendarCheck,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSidePanel } from "@/contexts/SidePanelContext";

const STORAGE_KEY = "rove-sidebar-collapsed";

const navGroup1 = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
] as const;

const navGroup2 = [
  { href: "/allocation", label: "Allocation", icon: CalendarCheck },
] as const;

const navGroup3 = [
  { panel: "consultants" as const, label: "Consultants", icon: Users },
  { panel: "customers" as const, label: "Customers", icon: Building2 },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  collapsed: boolean;
}) {
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary"
          : "border-l-2 border-transparent text-text-primary hover:bg-nav-hover"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function NavPanelButton({
  panel,
  label,
  icon: Icon,
  collapsed,
}: {
  panel: "customers" | "consultants";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
}) {
  const { panel: openPanel, togglePanel } = useSidePanel();
  const isActive = openPanel === panel;
  return (
    <button
      type="button"
      onClick={() => togglePanel(panel)}
      title={collapsed ? label : undefined}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors ${
        isActive
          ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary"
          : "border-l-2 border-transparent text-text-primary hover:bg-nav-hover"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

type SidebarProps = { isAdmin?: boolean };

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Use collapsed only after mount so server and first client render match (avoids hydration mismatch from localStorage).
  const effectiveCollapsed = mounted ? collapsed : false;

  return (
    <aside
      className={`flex h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default transition-[width] duration-200 ${
        effectiveCollapsed ? "w-[4rem]" : "w-52"
      }`}
    >
      <div
        className={`flex h-12 flex-shrink-0 items-center px-2 pt-3 ${effectiveCollapsed ? "justify-center" : "justify-end"}`}
      >
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex-shrink-0 rounded-md p-1.5 text-text-primary opacity-70 transition-colors hover:bg-nav-hover hover:opacity-100"
        >
          {effectiveCollapsed ? (
            <PanelLeftOpen className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5 pt-3">
        <div className="space-y-0.5">
          {navGroup1.map((item) => (
            <NavLink key={item.href} pathname={pathname} collapsed={effectiveCollapsed} {...item} />
          ))}
        </div>

        <div className="my-1.5 border-t border-border-subtle" />

        <div className="space-y-0.5">
          {navGroup2.map((item) => (
            <NavLink key={item.href} pathname={pathname} collapsed={effectiveCollapsed} {...item} />
          ))}
        </div>

        <div className="my-1.5 border-t border-border-subtle" />

        <div className="space-y-0.5">
          {navGroup3.map((item) => (
            <NavPanelButton key={item.panel} collapsed={effectiveCollapsed} {...item} />
          ))}
        </div>

        {isAdmin && (
          <>
            <div className="my-1.5 border-t border-border-subtle" />
            <div className="space-y-0.5">
              <NavLink href="/reports" label="Reports" icon={BarChart2} pathname={pathname} collapsed={effectiveCollapsed} />
            </div>
          </>
        )}
      </nav>

      <div className="flex flex-shrink-0 flex-col border-t border-border-subtle bg-bg-default">
        <div className="space-y-0.5 p-1.5">
          {isAdmin && (
            <Link
              href="/settings"
              title={effectiveCollapsed ? "Settings" : undefined}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
                pathname === "/settings"
                  ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary"
                  : "border-l-2 border-transparent text-text-primary hover:bg-nav-hover"
              } ${effectiveCollapsed ? "justify-center px-2" : ""}`}
            >
              <Settings className="h-5 w-5 flex-shrink-0" />
              {!effectiveCollapsed && <span>Settings</span>}
            </Link>
          )}
          {isAdmin && <div className="my-1.5 border-t border-border-subtle" aria-hidden />}
          <button
            type="button"
            onClick={handleSignOut}
            title={effectiveCollapsed ? "Log out" : undefined}
            className={`mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-nav-hover ${
              effectiveCollapsed ? "justify-center px-2" : ""
            }`}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!effectiveCollapsed && <span>Log out</span>}
          </button>
        </div>
        {!effectiveCollapsed && (
          <footer className="px-3 py-2 text-xs text-text-primary opacity-60">
            © {new Date().getFullYear()} Rove Planner
          </footer>
        )}
      </div>
    </aside>
  );
}

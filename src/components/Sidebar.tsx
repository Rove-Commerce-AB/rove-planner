"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Users,
  Building2,
  CalendarCheck,
  Clock,
  FolderKanban,
  Settings,
  LogOut,
  Home,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useSidePanel } from "@/contexts/SidePanelContext";

const navGroup1 = [
  { href: "/", label: "Dashboard", icon: Home },
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
  badgeCount,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  collapsed: boolean;
  badgeCount?: number;
}) {
  const isActive = href === "/" ? pathname === "/" : pathname === href;
  const labelSpanClass = `transition-[max-width,opacity] duration-120 overflow-hidden whitespace-nowrap ${
    collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100"
  }`;
  const showBadge =
    typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel =
    badgeCount != null && badgeCount > 99 ? "99+" : String(badgeCount ?? "");

  return (
    <Link
      href={href}
      title={
        collapsed
          ? showBadge
            ? `${label} (${badgeCount} unread)`
            : label
          : undefined
      }
      className={`relative flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary/90"
          : "border-l-2 border-transparent text-text-primary/75 hover:bg-nav-hover hover:text-text-primary/85"
      }`}
    >
      <span className="relative flex-shrink-0">
        <Icon className="h-5 w-5" />
        {collapsed && showBadge && (
          <span
            className="absolute -right-1 -top-1 box-border inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-text-primary/25 bg-brand-blue px-0.5 text-center text-[9px] font-semibold leading-none text-text-primary tabular-nums"
            aria-hidden
          >
            <span className="flex -translate-y-px items-center justify-center leading-none">
              {badgeLabel}
            </span>
          </span>
        )}
      </span>
      <span className={`flex min-w-0 flex-1 items-center ${labelSpanClass}`}>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span className="truncate">{label}</span>
          {!collapsed && showBadge && (
            <span
              className="box-border inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-text-primary/25 bg-brand-blue px-1 text-center text-[11px] font-semibold leading-none text-text-primary tabular-nums"
              aria-label={`${badgeCount} unread notifications`}
            >
              <span className="flex -translate-x-px items-center justify-center leading-none">
                {badgeLabel}
              </span>
            </span>
          )}
        </span>
      </span>
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
  const labelSpanClass = `transition-[max-width,opacity] duration-120 overflow-hidden whitespace-nowrap ${
    collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100"
  }`;
  return (
    <button
      type="button"
      onClick={() => togglePanel(panel)}
      title={collapsed ? label : undefined}
      className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors ${
        isActive
          ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary/90"
          : "border-l-2 border-transparent text-text-primary/75 hover:bg-nav-hover hover:text-text-primary/85"
      }`}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className={labelSpanClass}>
        {label}
      </span>
    </button>
  );
}

type SidebarProps = {
  isAdmin?: boolean;
  canSeeTimeReportProjectManager?: boolean;
  isSubcontractor?: boolean;
  dashboardUnreadNotificationCount?: number;
};

export function Sidebar({
  isAdmin = false,
  canSeeTimeReportProjectManager = false,
  isSubcontractor = false,
  dashboardUnreadNotificationCount = 0,
}: SidebarProps) {
  const showRestrictedNavigation = !isSubcontractor;

  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  // Collapse by default; expand while hovering.
  // Start collapsed until mount to avoid a width mismatch on first render.
  const effectiveCollapsed = mounted ? !isHovering : true;

  const bottomLabelSpanClass = `transition-[max-width,opacity] duration-120 overflow-hidden whitespace-nowrap ${
    effectiveCollapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100"
  }`;

  return (
    <aside
      className="flex h-screen w-[3.25rem] flex-shrink-0 flex-col bg-bg-default"
    >
      <div
        className={`flex h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default transition-[width] duration-120 ease-out relative z-40 ${
          effectiveCollapsed ? "w-[3.25rem]" : "w-52"
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pt-4 pb-1.5">
          <div className="space-y-0.5">
            {navGroup1.map((item) => (
              <NavLink
                key={item.href}
                pathname={pathname}
                collapsed={effectiveCollapsed}
                badgeCount={
                  item.href === "/"
                    ? dashboardUnreadNotificationCount
                    : undefined
                }
                {...item}
              />
            ))}
          </div>

          {showRestrictedNavigation && (
            <>
              <div className="my-1.5 border-t border-border-subtle" />

              <div className="space-y-0.5">
                {navGroup2.map((item) => (
                  <NavLink
                    key={item.href}
                    pathname={pathname}
                    collapsed={effectiveCollapsed}
                    {...item}
                  />
                ))}
              </div>

              <div className="my-1.5 border-t border-border-subtle" />

              <div className="space-y-0.5">
                {navGroup3.map((item) => (
                  <NavPanelButton
                    key={item.panel}
                    collapsed={effectiveCollapsed}
                    {...item}
                  />
                ))}
              </div>
            </>
          )}

          <div className="my-1.5 border-t border-border-subtle" />

          <div className="space-y-0.5">
            <NavLink
              href="/time-report"
              label="Time report"
              icon={Clock}
              pathname={pathname}
              collapsed={effectiveCollapsed}
            />
          </div>

        {!isSubcontractor && (isAdmin || canSeeTimeReportProjectManager) && (
          <div className="space-y-0.5">
            <NavLink
              href="/time-report/project-manager"
              label="My projects"
              icon={FolderKanban}
              pathname={pathname}
              collapsed={effectiveCollapsed}
            />
          </div>
        )}

          <div className="my-1.5 border-t border-border-subtle" />

          {isAdmin && (
            <div className="space-y-0.5">
              <NavLink
                href="/reports"
                label="Reports"
                icon={BarChart2}
                pathname={pathname}
                collapsed={effectiveCollapsed}
              />
            </div>
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
                    ? "border-l-2 border-border-subtle bg-nav-active font-semibold text-text-primary/90"
                    : "border-l-2 border-transparent text-text-primary/75 hover:bg-nav-hover hover:text-text-primary/85"
                }`}
              >
                <Settings className="h-5 w-5 flex-shrink-0" />
                <span className={bottomLabelSpanClass}>Settings</span>
              </Link>
            )}
            {isAdmin && (
              <div className="my-1.5 border-t border-border-subtle" aria-hidden />
            )}
            <button
              type="button"
              onClick={handleSignOut}
              title={effectiveCollapsed ? "Log out" : undefined}
              className={`mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-nav-hover ${
                "text-text-primary/75 hover:text-text-primary/85"
              } ${
                "justify-start"
              }`}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className={bottomLabelSpanClass}>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

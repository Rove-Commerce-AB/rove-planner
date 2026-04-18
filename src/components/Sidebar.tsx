"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Users,
  Building2,
  CalendarCheck,
  ClipboardList,
  Clock,
  FolderKanban,
  LayoutDashboard,
  Settings,
  LogOut,
  Home,
  Bell,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { useSidePanel } from "@/contexts/SidePanelContext";

/** 3.25rem rail − w-8 icon, split evenly → icon centered in collapsed strip without layout shift on expand. */
const SIDEBAR_RAIL_PAD_X = "10px";

const navGroup1 = [
  { href: "/", label: "Dashboard", icon: Home },
] as const;

const allocationNav = {
  href: "/allocation",
  label: "Allocation",
  icon: CalendarCheck,
} as const;

/** Customers first, then Consultants — sidebar group 5. */
const sidePanelNav = [
  { panel: "customers" as const, label: "Customers", icon: Building2 },
  { panel: "consultants" as const, label: "Consultants", icon: Users },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  collapsed,
  badgeCount,
  activeMatch = "exact",
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  collapsed: boolean;
  badgeCount?: number;
  activeMatch?: "exact" | "prefix";
}) {
  const isActive =
    href === "/"
      ? pathname === "/"
      : activeMatch === "prefix"
        ? pathname === href || pathname.startsWith(`${href}/`)
        : pathname === href;
  const labelExpandedClass =
    "flex min-h-0 min-w-0 flex-1 items-center overflow-hidden text-left text-xs max-w-[10rem] whitespace-nowrap";
  const showBadge =
    typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel =
    badgeCount != null && badgeCount > 99 ? "99+" : String(badgeCount ?? "");

  return (
    <Link
      href={href}
      aria-label={collapsed ? label : undefined}
      title={
        collapsed
          ? showBadge
            ? `${label} (${badgeCount} unread)`
            : label
          : undefined
      }
      className={`group relative flex h-8 w-full min-w-0 items-center justify-start rounded-md py-0 text-xs font-medium ${
        collapsed ? "gap-0" : "gap-1.5"
      } ${
        isActive
          ? collapsed
            ? "font-semibold text-[color:var(--color-accent-1)]"
            : "bg-brand-blue font-semibold text-[color:var(--color-accent-1)]"
          : "text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
      }`}
    >
      <span
        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          isActive && collapsed ? "bg-brand-blue" : ""
        }`}
      >
        <Icon className={`h-4 w-4 ${isActive ? "text-[color:var(--color-accent-1)]" : ""}`} />
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
      {!collapsed ? (
        <span className={labelExpandedClass}>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span className="truncate">{label}</span>
            {showBadge && (
              <span
                className="box-border inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border border-text-primary/20 bg-bg-default/80 px-0.5 text-center text-[10px] font-semibold leading-none text-text-primary tabular-nums"
                aria-label={`${badgeCount} unread notifications`}
              >
                <span className="flex -translate-x-px items-center justify-center leading-none">
                  {badgeLabel}
                </span>
              </span>
            )}
          </span>
        </span>
      ) : null}
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
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={`group flex h-8 w-full min-w-0 cursor-pointer items-center justify-start rounded-md py-0 text-left text-xs font-medium ${
        collapsed ? "gap-0" : "gap-1.5"
      } ${
        isActive
          ? collapsed
            ? "font-semibold text-[color:var(--color-accent-1)]"
            : "bg-brand-blue font-semibold text-[color:var(--color-accent-1)]"
          : "text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
          isActive && collapsed ? "bg-brand-blue" : ""
        }`}
      >
        <Icon
          className={`h-4 w-4 ${isActive ? "text-[color:var(--color-accent-1)]" : ""}`}
        />
      </span>
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate text-left max-w-[10rem]">
          {label}
        </span>
      ) : null}
    </button>
  );
}

type SidebarProps = {
  isAdmin?: boolean;
  canSeeTimeReportProjectManager?: boolean;
  isSubcontractor?: boolean;
  unreadNotificationCount?: number;
};

export function Sidebar({
  isAdmin = false,
  canSeeTimeReportProjectManager = false,
  isSubcontractor = false,
  unreadNotificationCount = 0,
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

  const effectiveCollapsed = mounted ? !isHovering : true;

  const settingsActive = pathname === "/settings";

  const navPadX = effectiveCollapsed
    ? { paddingLeft: SIDEBAR_RAIL_PAD_X, paddingRight: SIDEBAR_RAIL_PAD_X }
    : { paddingLeft: SIDEBAR_RAIL_PAD_X, paddingRight: "0.375rem" };

  /** Same horizontal origin as `nav` so footer icons do not shift when expanding. */
  const footerPad = {
    paddingLeft: SIDEBAR_RAIL_PAD_X,
    paddingRight: effectiveCollapsed ? SIDEBAR_RAIL_PAD_X : "0.375rem",
    paddingTop: "0.375rem",
    paddingBottom: "0.375rem",
  };

  return (
    <aside className="flex h-screen w-[3.25rem] flex-shrink-0 flex-col bg-bg-default">
      <div
        className={`relative z-40 flex h-screen flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default transition-[width] duration-120 ease-out ${
          effectiveCollapsed ? "w-[3.25rem]" : "w-52"
        }`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        <nav
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1.5 pt-2 [scrollbar-gutter:stable]"
          style={navPadX}
        >
          {/* 1. Dashboard */}
          <div className="space-y-px">
            {navGroup1.map((item) => (
              <NavLink
                key={item.href}
                pathname={pathname}
                collapsed={effectiveCollapsed}
                {...item}
              />
            ))}
          </div>

          {/* 2. Time report, Time approval */}
          <div className="space-y-px">
            <NavLink
              href="/time-report"
              label="Time report"
              icon={Clock}
              pathname={pathname}
              collapsed={effectiveCollapsed}
            />
            {!isSubcontractor &&
              (isAdmin || canSeeTimeReportProjectManager) && (
                <NavLink
                  href="/time-report/project-manager"
                  label="Time approval"
                  icon={FolderKanban}
                  pathname={pathname}
                  collapsed={effectiveCollapsed}
                />
              )}
          </div>

          {/* 3. Allocation */}
          {showRestrictedNavigation && (
            <div className="space-y-px">
              <NavLink
                pathname={pathname}
                collapsed={effectiveCollapsed}
                {...allocationNav}
              />
            </div>
          )}

          {/* 4. Customer status */}
          {!isSubcontractor && (
            <div className="space-y-px">
              <NavLink
                href="/customer-status"
                label="Customer status"
                icon={ClipboardList}
                pathname={pathname}
                collapsed={effectiveCollapsed}
              />
            </div>
          )}

          {/* 5. Taskboard */}
          {!isSubcontractor && (
            <div className="space-y-px">
              <NavLink
                href="/taskboard"
                label="Taskboard"
                icon={LayoutDashboard}
                pathname={pathname}
                collapsed={effectiveCollapsed}
                activeMatch="prefix"
              />
            </div>
          )}

          {/* 6. Customers, Consultants */}
          {showRestrictedNavigation && (
            <div className="space-y-px">
              {sidePanelNav.map((item) => (
                <NavPanelButton
                  key={item.panel}
                  collapsed={effectiveCollapsed}
                  {...item}
                />
              ))}
            </div>
          )}

          {/* 7. Reports */}
          {isAdmin && (
            <div className="space-y-px">
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
          <div className="space-y-px" style={footerPad}>
            <NavLink
              href="/notifications"
              label="Notifications"
              icon={Bell}
              pathname={pathname}
              collapsed={effectiveCollapsed}
              badgeCount={unreadNotificationCount}
            />
            {isAdmin && (
              <Link
                href="/settings"
                aria-label={effectiveCollapsed ? "Settings" : undefined}
                title={effectiveCollapsed ? "Settings" : undefined}
                className={`group flex h-8 w-full min-w-0 items-center justify-start rounded-md py-0 text-xs font-medium ${
                  effectiveCollapsed ? "gap-0" : "gap-1.5"
                } ${
                  settingsActive
                    ? effectiveCollapsed
                      ? "font-semibold text-[color:var(--color-accent-1)]"
                      : "bg-brand-blue font-semibold text-[color:var(--color-accent-1)]"
                    : "text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    settingsActive && effectiveCollapsed ? "bg-brand-blue" : ""
                  }`}
                >
                  <Settings
                    className={`h-4 w-4 ${settingsActive ? "text-[color:var(--color-accent-1)]" : ""}`}
                  />
                </span>
                {!effectiveCollapsed ? (
                  <span className="min-w-0 flex-1 truncate text-left">Settings</span>
                ) : null}
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              aria-label={effectiveCollapsed ? "Log out" : undefined}
              title={effectiveCollapsed ? "Log out" : undefined}
              className={`group flex h-8 w-full min-w-0 items-center justify-start rounded-md py-0 text-left text-xs font-medium text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90 ${
                effectiveCollapsed ? "gap-0" : "gap-1.5"
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center">
                <LogOut className="h-4 w-4" />
              </span>
              {!effectiveCollapsed ? (
                <span className="min-w-0 flex-1 truncate text-left">Log out</span>
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

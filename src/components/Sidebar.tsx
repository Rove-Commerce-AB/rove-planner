"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ChevronRight,
  Clock,
  Settings,
  LogOut,
  Home,
  Briefcase,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { ROUTES } from "@/lib/routes";

/** 10px left padding so the w-8 icon column is centered in the rail. */
const SIDEBAR_RAIL_PAD_X = "10px";

type IconType = React.ComponentType<{ className?: string }>;

function pathMatches(
  pathname: string,
  href: string,
  activeMatch: "exact" | "prefix"
) {
  if (href === "/") return pathname === "/";
  if (activeMatch === "prefix") {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  badgeCount,
  activeMatch = "exact",
  indent = false,
}: {
  href: string;
  label: string;
  icon?: IconType;
  pathname: string;
  badgeCount?: number;
  activeMatch?: "exact" | "prefix";
  indent?: boolean;
}) {
  const isActive = pathMatches(pathname, href, activeMatch);
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel =
    badgeCount != null && badgeCount > 99 ? "99+" : String(badgeCount ?? "");

  return (
    <Link
      href={href}
      prefetch={false}
      className={`group relative flex h-8 w-full min-w-0 items-center justify-start gap-1.5 rounded-md py-0 text-xs font-medium ${
        isActive
          ? "bg-nav-active font-semibold text-nav-active-accent"
          : "text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
      }`}
    >
      {Icon ? (
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Icon
            className={`h-4 w-4 ${isActive ? "text-nav-active-accent" : ""}`}
          />
        </span>
      ) : indent ? (
        <span className="h-8 w-8 shrink-0" aria-hidden />
      ) : null}
      <span className="flex min-h-0 min-w-0 flex-1 items-center overflow-hidden text-left text-xs max-w-[10rem] whitespace-nowrap">
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
    </Link>
  );
}

function AppGroup({
  label,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  label: string;
  icon: IconType;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-px">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex h-8 w-full min-w-0 cursor-pointer items-center justify-start gap-1.5 rounded-md py-0 text-left text-xs font-medium text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate text-left max-w-[10rem]">
          {label}
        </span>
        <ChevronRight
          className={`mr-1 h-3.5 w-3.5 shrink-0 text-text-primary/50 transition-transform duration-120 ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
      </button>
      {open ? children : null}
    </div>
  );
}

function NavPlaceholder({
  label,
  icon: Icon,
}: {
  label: string;
  icon: IconType;
}) {
  return (
    <div
      aria-disabled
      title={`${label} (coming soon)`}
      className="flex h-8 w-full min-w-0 cursor-default items-center justify-start gap-1.5 rounded-md py-0 text-xs font-medium text-text-primary/40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate text-left max-w-[10rem]">
        {label}
      </span>
    </div>
  );
}

type SidebarProps = {
  isAdmin?: boolean;
  canSeeTimeReportProjectManager?: boolean;
  isSubcontractor?: boolean;
};

export function Sidebar({
  isAdmin = false,
  canSeeTimeReportProjectManager = false,
  isSubcontractor = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [openApps, setOpenApps] = useState<{
    planner: boolean;
    timeReport: boolean;
    settings: boolean;
  }>({ planner: false, timeReport: false, settings: false });

  const plannerActive = pathMatches(pathname, ROUTES.allocation, "prefix");
  const timeReportChildActive =
    pathMatches(pathname, ROUTES.timeReport, "exact") ||
    pathMatches(pathname, ROUTES.timeApproval, "prefix");
  const settingsChildActive = pathname.startsWith("/settings");

  useEffect(() => {
    setOpenApps((prev) => ({
      planner: plannerActive ? true : prev.planner,
      timeReport: timeReportChildActive ? true : prev.timeReport,
      settings: settingsChildActive ? true : prev.settings,
    }));
  }, [pathname, plannerActive, timeReportChildActive, settingsChildActive]);

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  const showTimeApproval =
    !isSubcontractor && (isAdmin || canSeeTimeReportProjectManager);

  const navPadX = {
    paddingLeft: SIDEBAR_RAIL_PAD_X,
    paddingRight: "0.375rem",
  };

  const footerPad = {
    paddingLeft: SIDEBAR_RAIL_PAD_X,
    paddingRight: "0.375rem",
    paddingTop: "0.375rem",
    paddingBottom: "0.375rem",
  };

  return (
    <aside className="flex h-screen w-52 flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default">
      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1.5 pt-2 [scrollbar-gutter:stable]"
        style={navPadX}
      >
        <div className="flex h-8 w-full min-w-0 items-center justify-start gap-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-text-primary text-[9px] font-bold leading-none text-bg-default">
              R
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-text-primary">
            Rove Apps
          </span>
        </div>

        <div className="space-y-px">
          <NavLink href={ROUTES.home} label="Home" icon={Home} pathname={pathname} />
        </div>

        {!isSubcontractor && (
          <AppGroup
            label="Planner"
            icon={CalendarCheck}
            open={openApps.planner}
            onToggle={() =>
              setOpenApps((prev) => ({ ...prev, planner: !prev.planner }))
            }
          >
            <NavLink
              href={ROUTES.allocation}
              label="Allocation"
              pathname={pathname}
              indent
              activeMatch="prefix"
            />
          </AppGroup>
        )}

        <AppGroup
          label="Time report"
          icon={Clock}
          open={openApps.timeReport}
          onToggle={() =>
            setOpenApps((prev) => ({
              ...prev,
              timeReport: !prev.timeReport,
            }))
          }
        >
          <NavLink
            href={ROUTES.timeReport}
            label="Time report"
            pathname={pathname}
            indent
          />
          {showTimeApproval && (
            <NavLink
              href={ROUTES.timeApproval}
              label="Time approval"
              pathname={pathname}
              indent
              activeMatch="prefix"
            />
          )}
        </AppGroup>

        {!isSubcontractor && (
          <div className="space-y-px">
            <NavLink
              href={ROUTES.insights}
              label="Insights"
              icon={Sparkles}
              pathname={pathname}
              activeMatch="prefix"
            />
            <NavPlaceholder label="Rove Work" icon={Briefcase} />
            <NavPlaceholder label="Rove Support" icon={MessageCircle} />
          </div>
        )}

        {!isSubcontractor && (
          <div className="border-t border-border-subtle pt-4">
            <AppGroup
              label="Settings"
              icon={Settings}
              open={openApps.settings}
              onToggle={() =>
                setOpenApps((prev) => ({
                  ...prev,
                  settings: !prev.settings,
                }))
              }
            >
              {isAdmin && (
                <NavLink
                  href={ROUTES.settings}
                  label="General"
                  pathname={pathname}
                  indent
                />
              )}
              <NavLink
                href={ROUTES.consultants}
                label="Consultants"
                pathname={pathname}
                indent
                activeMatch="prefix"
              />
              <NavLink
                href={ROUTES.customers}
                label="Customers"
                pathname={pathname}
                indent
                activeMatch="prefix"
              />
            </AppGroup>
          </div>
        )}
      </nav>

      <div className="flex flex-shrink-0 flex-col border-t border-border-subtle bg-bg-default">
        <div className="space-y-px" style={footerPad}>
          <button
            type="button"
            onClick={handleSignOut}
            className="group flex h-8 w-full min-w-0 cursor-pointer items-center justify-start gap-1.5 rounded-md py-0 text-left text-xs font-medium text-text-primary/80 transition-colors hover:bg-nav-hover hover:text-text-primary/90"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center">
              <LogOut className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { useState, useEffect, type ReactNode } from "react";
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
import { ROUTES, workBoardHref, workCustomerHref } from "@/lib/routes";
import type { AppKey } from "@/lib/peopleTypes";
import type { WorkSelectorCustomer } from "@/lib/workTypes";
import { CustomerFavicon } from "@/components/CustomerFavicon";

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
  depth = 0,
  leading,
  className = "",
}: {
  href: string;
  label: string;
  icon?: IconType;
  pathname: string;
  badgeCount?: number;
  activeMatch?: "exact" | "prefix";
  indent?: boolean;
  depth?: 0 | 1 | 2;
  leading?: ReactNode;
  className?: string;
}) {
  const nest = indent || depth > 0;
  const isActive = pathMatches(pathname, href, activeMatch);
  const showBadge = typeof badgeCount === "number" && badgeCount > 0;
  const badgeLabel =
    badgeCount != null && badgeCount > 99 ? "99+" : String(badgeCount ?? "");

  const typeClass = nest ? "text-body-m" : "text-heading-xs";
  const toneClass = isActive
    ? "bg-nav-active text-text-primary"
    : nest
      ? "text-text-secondary transition-colors hover:bg-nav-active hover:text-text-primary"
      : "text-text-primary transition-colors hover:bg-nav-active";

  return (
    <Link
      href={href}
      prefetch={false}
      className={`group relative flex h-8 w-full min-w-0 items-center justify-start gap-1.5 rounded-md py-0 ${typeClass} ${toneClass} ${className}`.trim()}
    >
      {depth >= 1 ? <span className="w-8 shrink-0" aria-hidden /> : null}
      {Icon ? (
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
          <Icon className="h-4 w-4" />
        </span>
      ) : leading ? (
        <span className="flex h-8 w-4 shrink-0 items-center justify-center">
          {leading}
        </span>
      ) : nest ? (
        <span
          className={`h-8 shrink-0 ${depth >= 2 ? "w-4" : "w-8"}`}
          aria-hidden
        />
      ) : null}
      <span className="flex min-h-0 min-w-0 flex-1 items-center overflow-hidden text-left max-w-[10rem] whitespace-nowrap">
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
  href,
  pathname,
  children,
}: {
  label: string;
  icon: IconType;
  open: boolean;
  onToggle: () => void;
  href?: string;
  pathname?: string;
  children: React.ReactNode;
}) {
  const headingActive =
    href && pathname ? pathMatches(pathname, href, "exact") : false;

  return (
    <div className="flex flex-col gap-px">
      <div
        className={`flex h-8 w-full min-w-0 items-center rounded-md ${
          headingActive ? "bg-nav-active" : "hover:bg-nav-active"
        }`}
      >
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="flex h-8 min-w-0 flex-1 items-center justify-start gap-1.5 rounded-md py-0 text-left text-heading-xs text-text-primary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left max-w-[10rem]">
              {label}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            aria-expanded={open}
            onClick={onToggle}
            className="flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-start gap-1.5 rounded-md py-0 text-left text-heading-xs text-text-primary"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate text-left max-w-[10rem]">
              {label}
            </span>
          </button>
        )}
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
          onClick={onToggle}
          className="mr-0.5 flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-primary/50 hover:text-text-primary"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-120 ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          />
        </button>
      </div>
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
      className="flex h-8 w-full min-w-0 cursor-default items-center justify-start gap-1.5 rounded-md py-0 text-heading-xs text-[var(--color-zinc-500)]"
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

function WorkCustomerNav({
  customer,
  pathname,
  forceOpen,
}: {
  customer: WorkSelectorCustomer;
  pathname: string;
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const customerHref = workCustomerHref(customer.id);
  const hasBoards = customer.boards.length > 0;

  return (
    <div className="flex flex-col gap-px">
      <div className="flex min-w-0 items-center">
        <div className="min-w-0 flex-1">
          <NavLink
            href={customerHref}
            label={customer.name}
            pathname={pathname}
            depth={1}
            leading={
              <CustomerFavicon
                name={customer.name}
                url={customer.url}
                color={customer.color}
                size="nav"
              />
            }
          />
        </div>
        {hasBoards ? (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${customer.name} boards`}
            onClick={() => setOpen((current) => !current)}
            className="flex h-8 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary hover:bg-nav-active hover:text-text-primary"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-120 ${
                open ? "rotate-90" : ""
              }`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {open && hasBoards
        ? customer.boards.map((board) => (
            <NavLink
              key={board.id}
              href={workBoardHref(customer.id, board.id)}
              label={board.title}
              pathname={pathname}
              depth={2}
              activeMatch="prefix"
            />
          ))
        : null}
    </div>
  );
}

type SidebarProps = {
  isAdmin?: boolean;
  canSeeTimeReportProjectManager?: boolean;
  isCustomerUser?: boolean;
  appKeys?: AppKey[];
  workNav?: WorkSelectorCustomer[];
};

export function Sidebar({
  isAdmin = false,
  canSeeTimeReportProjectManager = false,
  isCustomerUser = false,
  appKeys = [],
  workNav = [],
}: SidebarProps) {
  const pathname = usePathname();
  const [openApps, setOpenApps] = useState<{
    planner: boolean;
    timeReport: boolean;
    settings: boolean;
    work: boolean;
  }>({ planner: false, timeReport: false, settings: false, work: false });

  const plannerActive = pathMatches(pathname, ROUTES.allocation, "prefix");
  const timeReportChildActive =
    pathMatches(pathname, ROUTES.timeReport, "exact") ||
    pathMatches(pathname, ROUTES.timeApproval, "prefix");
  const settingsChildActive = pathname.startsWith("/settings");
  const workActive = pathMatches(pathname, ROUTES.work, "prefix");
  const activeWorkCustomerId = pathname.startsWith(`${ROUTES.work}/`)
    ? pathname.slice(ROUTES.work.length + 1).split("/")[0] ?? null
    : null;

  useEffect(() => {
    setOpenApps((prev) => ({
      planner: plannerActive ? true : prev.planner,
      timeReport: timeReportChildActive ? true : prev.timeReport,
      settings: settingsChildActive ? true : prev.settings,
      work: workActive ? true : prev.work,
    }));
  }, [
    pathname,
    plannerActive,
    timeReportChildActive,
    settingsChildActive,
    workActive,
  ]);

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  const showTimeApproval = isAdmin || canSeeTimeReportProjectManager;

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
    <aside className="relative z-20 flex h-full w-52 flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default shadow-lg">
      <nav
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1.5 pt-2 [scrollbar-gutter:stable]"
        style={navPadX}
      >
        <div className="flex h-8 w-full min-w-0 items-center justify-start gap-1.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-text-primary text-[12px] font-semibold leading-none text-bg-default">
              R
            </span>
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-heading-m text-text-primary">
            Rove Apps
          </span>
        </div>

        <div className="flex flex-col gap-3">
          <NavLink href={ROUTES.home} label="Home" icon={Home} pathname={pathname} />
          {appKeys.includes("planner") && (
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
          {appKeys.includes("time_report") && (
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
          )}
          {appKeys.includes("work") && (
            <AppGroup
              label="Rove Work"
              icon={Briefcase}
              href={ROUTES.work}
              pathname={pathname}
              open={openApps.work}
              onToggle={() =>
                setOpenApps((prev) => ({ ...prev, work: !prev.work }))
              }
            >
              {workNav.length === 0 ? (
                <p className="px-2 py-1.5 pl-10 text-body-m text-text-tertiary">
                  No customers yet
                </p>
              ) : (
                workNav.map((customer) => (
                  <WorkCustomerNav
                    key={customer.id}
                    customer={customer}
                    pathname={pathname}
                    forceOpen={customer.id === activeWorkCustomerId}
                  />
                ))
              )}
            </AppGroup>
          )}
          {!isCustomerUser && (
            <>
              {appKeys.includes("insights") && (
                <NavLink
                  href={ROUTES.insights}
                  label="Insights"
                  icon={Sparkles}
                  pathname={pathname}
                  activeMatch="prefix"
                />
              )}
              <NavPlaceholder label="Rove Support" icon={MessageCircle} />
            </>
          )}
        </div>

        {!isCustomerUser && (
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
                <>
                  <NavLink
                    href={ROUTES.settings}
                    label="General"
                    pathname={pathname}
                    indent
                  />
                  <NavLink
                    href={ROUTES.people}
                    label="People"
                    pathname={pathname}
                    indent
                    activeMatch="prefix"
                  />
                </>
              )}
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
            className="group flex h-8 w-full min-w-0 cursor-pointer items-center justify-start gap-1.5 rounded-md py-0 text-left text-body-l text-text-secondary transition-colors hover:bg-nav-active hover:text-text-primary"
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

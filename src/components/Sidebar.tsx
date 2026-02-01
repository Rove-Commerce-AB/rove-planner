"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  CalendarCheck,
  Settings,
  Calendar,
} from "lucide-react";

const navGroup1 = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
] as const;

const navGroup2 = [
  { href: "/allocation", label: "Allocation", icon: CalendarCheck },
] as const;

const navGroup3 = [
  { href: "/consultants", label: "Consultants", icon: Users },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
] as const;

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pathname: string;
}) {
  const isActive =
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-brand-signal text-text-inverse"
          : "text-text-primary hover:bg-brand-lilac/20"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border bg-bg-muted">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Calendar className="h-6 w-6 text-text-primary opacity-70" />
        <span className="flex-1 font-semibold text-text-primary">
          Rove Planner
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        <div className="space-y-0.5">
          {navGroup1.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>

        <div className="my-2 border-t border-text-primary/10" />

        <div className="space-y-0.5">
          {navGroup2.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>

        <div className="my-2 border-t border-text-primary/10" />

        <div className="space-y-0.5">
          {navGroup3.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-2">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-brand-signal text-text-inverse"
              : "text-text-primary hover:bg-brand-lilac/20"
          }`}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </div>

      <footer className="border-t border-border px-4 py-3 text-xs text-text-primary opacity-60">
        © {new Date().getFullYear()} Rove Planner
      </footer>
    </aside>
  );
}

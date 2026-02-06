"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  Settings,
  Calendar,
  LogOut,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const navGroup1 = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/rove", label: "Rove", icon: Sparkles },
] as const;

const navGroup2 = [
  { href: "/allocation", label: "Allocation", icon: CalendarCheck },
] as const;

const navGroup3 = [
  { href: "/consultants", label: "Consultants", icon: Users },
  { href: "/customers", label: "Customers", icon: Building2 },
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
          ? "bg-nav-active text-brand-signal font-semibold"
          : "text-text-primary hover:bg-nav-hover"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border-subtle bg-bg-default">
      <div className="flex h-14 items-center gap-2 px-4 pt-4">
        <Calendar className="h-6 w-6 text-text-primary opacity-70" />
        <span className="flex-1 font-bold text-text-primary">
          Rove Planner
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 p-2 pt-4">
        <div className="space-y-0.5">
          {navGroup1.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>

        <div className="my-2 border-t border-border-subtle" />

        <div className="space-y-0.5">
          {navGroup2.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>

        <div className="my-2 border-t border-border-subtle" />

        <div className="space-y-0.5">
          {navGroup3.map((item) => (
            <NavLink key={item.href} pathname={pathname} {...item} />
          ))}
        </div>
      </nav>

      <div className="space-y-0.5 p-2">
        <Link
          href="/settings"
          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-nav-active text-brand-signal font-semibold"
              : "text-text-primary hover:bg-nav-hover"
          }`}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-nav-hover"
        >
          <LogOut className="h-5 w-5" />
          Logga ut
        </button>
      </div>

      <footer className="px-4 py-3 text-xs text-text-primary opacity-60">
        © {new Date().getFullYear()} Rove Planner
      </footer>
    </aside>
  );
}

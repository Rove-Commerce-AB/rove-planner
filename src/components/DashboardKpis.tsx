import Link from "next/link";
import { Users, Building2, FolderKanban, Clock } from "lucide-react";
import type { DashboardKpis } from "@/types";

const kpiConfig = [
  {
    key: "consultantCount" as const,
    label: "Consultants",
    icon: Users,
    valueKey: "consultantCount",
    href: "/consultants",
    suffix: "",
  },
  {
    key: "customerCount" as const,
    label: "Customers",
    icon: Building2,
    valueKey: "customerCount",
    href: "/customers",
    suffix: "",
  },
  {
    key: "activeProjectCount" as const,
    label: "Active projects",
    icon: FolderKanban,
    valueKey: "activeProjectCount",
    href: "/allocation",
    suffix: "",
  },
  {
    key: "allocationThisWeekPercent" as const,
    label: "Allocation this week",
    icon: Clock,
    valueKey: "allocationThisWeekPercent",
    suffix: "%",
    href: "/allocation",
  },
] as const;

type Props = {
  kpis: DashboardKpis;
};

export function DashboardKpis({ kpis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiConfig.map(({ label, icon: Icon, valueKey, suffix = "", href }) => (
        <Link
          key={valueKey}
          href={href}
          className="rounded-lg border border-border bg-bg-default p-4 shadow-sm transition-colors hover:border-brand-signal/30 hover:bg-bg-muted/30"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-primary opacity-80">
              {label}
            </span>
            <Icon className="h-5 w-5 text-text-primary opacity-50" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-text-primary">
            {kpis[valueKey]}
            {suffix}
          </p>
        </Link>
      ))}
    </div>
  );
}

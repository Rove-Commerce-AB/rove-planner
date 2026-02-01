"use client";

import Link from "next/link";
import { Mail, Calendar, Users } from "lucide-react";
import type { ConsultantWithDetails } from "@/types";

type Props = {
  consultant: ConsultantWithDetails;
};

export function ConsultantCard({ consultant }: Props) {
  const percent = consultant.allocationPercent;
  const barColor = percent >= 100 ? "bg-danger" : "bg-accent-2";
  const barWidth = Math.min(percent, 100);

  return (
    <Link
      href={`/consultants/${consultant.id}`}
      className="flex flex-col rounded-lg border border-border bg-bg-default p-4 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-signal focus:ring-offset-2"
    >
      <div className="flex min-h-[140px] flex-col justify-between">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-bg-muted text-sm font-medium text-text-primary opacity-80">
              {consultant.initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-text-primary">{consultant.name}</h3>
                {consultant.isExternal && (
                  <span className="rounded bg-brand-blue/60 px-1.5 py-0.5 text-xs font-medium text-text-primary">
                    External
                  </span>
                )}
              </div>
              <span className="text-sm text-text-primary opacity-70">
                {consultant.roleName}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
        {consultant.email && (
          <div className="flex items-center gap-2 text-sm text-text-primary opacity-80">
            <Mail className="h-4 w-4 flex-shrink-0 opacity-60" />
            <a
              href={`mailto:${consultant.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-brand-signal hover:underline"
              tabIndex={-1}
            >
              {consultant.email}
            </a>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-text-primary opacity-80">
          <Calendar className="h-4 w-4 flex-shrink-0 opacity-60" />
          <span>
            {consultant.calendarName} ({consultant.hoursPerWeek}h/week
            {consultant.workPercentage !== 100
              ? `, ${consultant.workPercentage}%`
              : ""}
            )
          </span>
        </div>
        {consultant.teamName && (
          <div className="flex items-center gap-2 text-sm text-text-primary opacity-80">
            <Users className="h-4 w-4 flex-shrink-0 opacity-60" />
            <span>{consultant.teamName}</span>
          </div>
        )}
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="mb-2 text-xs font-medium text-text-primary opacity-60">
          Week {consultant.weekNumber}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-muted">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-xs text-text-primary opacity-80">
            {consultant.totalHoursAllocated}h ({percent}%)
          </span>
        </div>
        {consultant.projectAllocations.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-text-primary opacity-70">
            {consultant.projectAllocations.map((a, i) => (
              <li key={i}>
                {a.projectName} {a.hours}h
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

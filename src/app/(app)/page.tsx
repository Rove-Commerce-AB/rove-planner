import type { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { getPersonalDashboardData } from "@/lib/dashboard";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { getMonthSpansForWeeks } from "@/lib/dateUtils";
import { PageHeader, Panel, PanelSectionTitle } from "@/components/ui";
import { PersonalNextWeeksTable } from "@/components/PersonalNextWeeksTable";
import type { PersonalAllocationRow } from "@/lib/dashboard";
import { getCurrentAppUser } from "@/lib/appUsers";
import { listOpenTodosAssignedToUser } from "@/lib/taskBoardQueries";

export const dynamic = "force-dynamic";

type RowKey = { projectId: string; roleId: string | null };
type RowInfo = { customerName: string; projectName: string; roleName: string };

function buildTableData(rows: PersonalAllocationRow[]) {
  const rowInfoMap = new Map<string, RowInfo>();
  const hoursMap = new Map<string, number>();
  const keyStr = (k: RowKey) => `${k.projectId}\0${k.roleId ?? ""}`;

  for (const r of rows) {
    const k: RowKey = { projectId: r.projectId, roleId: r.roleId };
    const s = keyStr(k);
    if (!rowInfoMap.has(s)) {
      rowInfoMap.set(s, {
        customerName: r.customerName,
        projectName: r.projectName,
        roleName: r.roleName,
      });
    }
    hoursMap.set(`${s}\0${r.year}\0${r.week}`, r.hours);
  }

  const rowKeys: RowKey[] = Array.from(rowInfoMap.keys()).map((s) => {
    const [projectId, roleId] = s.split("\0");
    return { projectId, roleId: roleId || null };
  });
  rowKeys.sort((a, b) => {
    const infoA = rowInfoMap.get(keyStr(a))!;
    const infoB = rowInfoMap.get(keyStr(b))!;
    const c = infoA.customerName.localeCompare(infoB.customerName);
    if (c !== 0) return c;
    const p = infoA.projectName.localeCompare(infoB.projectName);
    if (p !== 0) return p;
    return infoA.roleName.localeCompare(infoB.roleName);
  });

  return { rowKeys, rowInfoMap, hoursMap, keyStr };
}

export default async function DashboardPage() {
  const appUser = await getCurrentAppUser();
  const session = await auth();
  const appUserId = session?.user?.appUserId;
  const isSubcontractor = appUser?.role === "subcontractor";
  const isCustomerUser = appUser?.role === "customer";

  const myTasks =
    appUser != null && appUserId != null && !isSubcontractor && !isCustomerUser
      ? await listOpenTodosAssignedToUser(appUserId)
      : [];

  const { consultant, weeks, rows } = isCustomerUser
    ? { consultant: null, weeks: [], rows: [] }
    : await getPersonalDashboardData();
  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const monthSpans = getMonthSpansForWeeks(weeks);

  const myTasksPanel =
    appUser != null && appUserId != null && !isSubcontractor && !isCustomerUser ? (
      <Panel className="mt-6">
        <PanelSectionTitle>My tasks</PanelSectionTitle>
        <div className="p-3 pt-0">
          {myTasks.length === 0 ? (
            <p className="py-2 text-sm text-text-primary opacity-70">
              No open tasks assigned to you.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {myTasks.map((t) => (
                <li key={t.todo_id} className="py-2.5 first:pt-1">
                  <Link
                    href={`/taskboard/${t.board_id}`}
                    className="block text-sm text-text-primary transition-colors hover:text-brand-signal"
                  >
                    <span className="font-medium">{t.todo_title}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {t.board_title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    ) : null;

  const pageDescription = isCustomerUser
    ? "Customer access"
    : consultant?.name ?? "Your upcoming allocations";

  let mainContent: ReactNode;
  if (isCustomerUser) {
    mainContent = (
      <Panel>
        <div className="p-6 text-center">
          <p className="text-text-primary">
            You are signed in as a customer user. Rove apps are not available
            on this account.
          </p>
        </div>
      </Panel>
    );
  } else if (!consultant) {
    mainContent = (
      <Panel>
        <div className="p-6 text-center">
          <p className="text-text-primary">
            Your login does not have a consultant profile. Ask an admin to add
            one under Settings → People so you can see your allocations here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-brand-signal hover:underline"
          >
            Go to Home →
          </Link>
        </div>
      </Panel>
    );
  } else if (rows.length === 0) {
    mainContent = (
      <Panel>
        <PanelSectionTitle>NEXT 10 WEEKS</PanelSectionTitle>
        <div className="p-3 pt-0 pb-6 text-center text-sm text-text-primary opacity-80">
          No allocations for the next 10 weeks.
        </div>
      </Panel>
    );
  } else {
    const { rowKeys, rowInfoMap, hoursMap } = buildTableData(rows);

    mainContent = (
      <Panel>
        <PanelSectionTitle>NEXT 10 WEEKS</PanelSectionTitle>
        <PersonalNextWeeksTable
          weeks={weeks}
          monthSpans={monthSpans}
          rowKeys={rowKeys}
          rowInfoMap={rowInfoMap}
          hoursMap={hoursMap}
          currentYear={currentYear}
          currentWeek={currentWeek}
        />
      </Panel>
    );
  }

  return (
    <div>
      <div className="w-full max-w-6xl">
        <PageHeader
          title="Home"
          description={pageDescription}
          className="mb-6"
        />
        {mainContent}
        {myTasksPanel}
      </div>
    </div>
  );
}

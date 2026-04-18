import type { ReactNode } from "react";
import Link from "next/link";
import { getPersonalDashboardData } from "@/lib/dashboard";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { getMonthSpansForWeeks } from "@/lib/dateUtils";
import { PageHeader, Panel, PanelSectionTitle } from "@/components/ui";
import type { PersonalAllocationRow } from "@/lib/dashboard";
import { getCurrentAppUser } from "@/lib/appUsers";
import { getNotificationsForCurrentUser } from "@/lib/userNotifications";
import { DashboardNotificationsPanel } from "@/components/DashboardNotificationsPanel";

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
  const notifications =
    appUser != null ? await getNotificationsForCurrentUser(20) : [];
  const { consultant, weeks, rows } = await getPersonalDashboardData();
  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const monthSpans = getMonthSpansForWeeks(weeks);

  const notificationsPanel =
    appUser != null ? (
      <Panel>
        <PanelSectionTitle>Notifications</PanelSectionTitle>
        <div className="p-3 pt-0">
          <DashboardNotificationsPanel notifications={notifications} />
        </div>
      </Panel>
    ) : null;

  const pageDescription = consultant?.name ?? "Your upcoming allocations";

  let mainContent: ReactNode;
  if (!consultant) {
    mainContent = (
      <Panel>
        <div className="p-6 text-center">
          <p className="text-text-primary">
            Your login is not linked to a consultant. Ask an admin to set your
            email on your consultant profile (under Consultants) so you can see
            your allocations here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-brand-signal hover:underline"
          >
            Go to Dashboard →
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
    const { rowKeys, rowInfoMap, hoursMap, keyStr } = buildTableData(rows);
    const isCurrentWeek = (w: { year: number; week: number }) =>
      w.year === currentYear && w.week === currentWeek;

    mainContent = (
      <Panel>
        <PanelSectionTitle>NEXT 10 WEEKS</PanelSectionTitle>
        <div className="overflow-x-auto p-3 pt-0">
          <table className="w-full min-w-0 table-fixed border border-form text-[10px]">
            <colgroup>
              <col style={{ width: 280 }} />
              {weeks.map((w) => (
                <col key={`${w.year}-${w.week}`} className="w-[2.5rem]" />
              ))}
              <col className="w-14" />
            </colgroup>
            <thead>
              <tr className="border-b border-grid-subtle bg-bg-muted/80">
                <th
                  className="border-r border-grid-subtle px-2 py-1.5 text-left text-[10px] font-medium uppercase tracking-wider text-text-primary opacity-70"
                  style={{ width: 280, maxWidth: 280, boxSizing: "border-box" }}
                >
                  Customer · Project · Role
                </th>
                {monthSpans.map((span, i) => (
                  <th
                    key={i}
                    colSpan={span.colSpan}
                    className="border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium uppercase tracking-wide text-text-primary opacity-60"
                  >
                    {span.label}
                  </th>
                ))}
                <th className="border-r border-grid-subtle px-1 py-1 text-center text-[10px] font-medium uppercase tracking-wider text-text-primary opacity-70">
                  Sum
                </th>
              </tr>
              <tr className="border-b border-grid-subtle bg-bg-muted">
                <th className="border-r border-grid-subtle px-2 py-1 text-left text-[10px] font-medium text-text-primary opacity-80">
                  {" "}
                </th>
                {weeks.map((w) => (
                  <th
                    key={`${w.year}-${w.week}`}
                    className={`border-r border-grid-subtle px-0.5 py-1 text-center text-[10px] font-medium text-text-primary opacity-70 ${isCurrentWeek(w) ? "bg-brand-signal/15" : ""}`}
                  >
                    W{w.week}
                  </th>
                ))}
                <th className="border-r border-grid-subtle px-0 py-1" aria-hidden />
              </tr>
            </thead>
            <tbody>
              {rowKeys.map((key) => {
                const info = rowInfoMap.get(keyStr(key))!;
                let rowTotal = 0;
                return (
                  <tr
                    key={keyStr(key)}
                    className="border-b border-grid-light-subtle last:border-form bg-bg-default"
                  >
                    <td className="border-r border-grid-light-subtle px-2 py-1 align-middle text-left">
                      <span className="text-text-primary opacity-90">
                        {info.customerName}
                      </span>
                      <span className="mx-1.5 text-text-primary opacity-50">·</span>
                      <Link
                        href={`/projects/${key.projectId}`}
                        className="font-medium text-brand-signal hover:underline"
                      >
                        {info.projectName}
                      </Link>
                      {info.roleName !== "—" && (
                        <>
                          <span className="mx-1.5 text-text-primary opacity-50">·</span>
                          <span className="text-text-primary opacity-80">
                            {info.roleName}
                          </span>
                        </>
                      )}
                    </td>
                    {weeks.map((w) => {
                      const h =
                        hoursMap.get(`${keyStr(key)}\0${w.year}\0${w.week}`) ?? 0;
                      rowTotal += h;
                      return (
                        <td
                          key={`${w.year}-${w.week}`}
                          className={`border-r border-grid-light-subtle px-1 py-1 text-center tabular-nums text-text-primary ${isCurrentWeek(w) ? "bg-brand-signal/10" : ""}`}
                        >
                          {h > 0 ? `${h}h` : "—"}
                        </td>
                      );
                    })}
                    <td className="border-r border-grid-light-subtle px-1 py-1 text-right tabular-nums font-medium text-text-primary">
                      {rowTotal > 0 ? `${rowTotal}h` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    );
  }

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-6xl">
        <PageHeader
          title="Dashboard"
          description={pageDescription}
          className="mb-6"
        />
        <div className={notificationsPanel ? "mb-6" : undefined}>{mainContent}</div>
        {notificationsPanel}
      </div>
    </div>
  );
}

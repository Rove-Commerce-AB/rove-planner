import { PageHeader } from "@/components/ui";

// Date format: "YYYY-MM-DD HH:mm". AI adds new rows automatically on code changes (see PROJECT_RULES.md).
const releaseNotes: { date: string; description: string }[] = [
  { date: "2026-02-06 14:02", description: "Planned revenue (forecast): panel shows expandable years (current year open by default), then months, then per-customer breakdown; year total row at bottom of each year." },
  { date: "2026-02-06 14:01", description: "Revenue forecast: allocations fetched with pagination (getAllocationsForWeeks) so all rows are included; fixes undercounted forecast when >1000 allocation rows per year." },
  { date: "2026-02-08 12:49", description: "Customer and Project Rates: ROLE dropdown scrollable (max-h-60 overflow-y-auto) so all roles can be selected." },
  { date: "2026-02-08 12:34", description: "Add Allocation: year taken from dragged week so booking in 2026 cells uses 2026. createAllocationsForWeekRange handles year boundary (weekFrom > weekTo)." },
  { date: "2026-02-08 11:46", description: "Dashboard page: force dynamic rendering so Vercel build does not prerender it (avoids Supabase 500 during build)." },
  { date: "2026-02-08 11:20", description: "Add Allocation: project dropdown shows \"Customer - Project\" and is sorted by customer." },
  { date: "2026-02-08 11:02", description: "Settings page: all Swedish text translated to English (Access/Users, form labels, buttons, confirm modal, error messages)." },
  { date: "2026-02-08 11:01", description: "All Swedish UI and release-note text translated to English (sidebar, release notes page, customer list, Add Allocation placeholders, revenueForecast comment, PROJECT_RULES release-note rule)." },
  { date: "2026-02-08 10:58", description: "Sidebar: divider and spacing between Release notes and Log out to avoid misclicks." },
  { date: "2026-02-08 10:55", description: "Customer list: Contact and Contact email removed. Account Manager added (column + sort/search). Customer page INFORMATION: Account Manager added (editable). SQL: customers.account_manager_id, DATABASE.md updated." },
  { date: "2026-02-08 10:47", description: "Release notes: date and time must be when AI writes the row (rule updated in PROJECT_RULES.md)." },
  { date: "2025-02-08 ", description: "Rule: AI updates release notes automatically on every code change (PROJECT_RULES.md + this file)." },
  { date: "2025-02-08 ", description: "Customer: active yes/no (is_active). Filter 'Show inactive customers' on customer list. Toggle for active on customer page." },
  { date: "2025-02-08 ", description: "Customer: project list shows Type instead of Status. Sort: inactive projects last, dimmed." },
  { date: "2025-02-08 ", description: "Consultant list: cache revalidation on update so internal/external updates immediately." },
  { date: "2025-02-08 ", description: "Customer: CONSULTANTS panel to link consultants to customer. Add Allocation: projects filtered by consultant; only roles with rate; role required for customer project." },
  { date: "2025-02-08 ", description: "Project: RATES/TASKS panel (project rates). Effective rate: project rate if set, else customer rate." },
  { date: "2025-02-08 ", description: "Page width max-w-6xl on all pages except Allocation. Left-aligned content." },
  { date: "2025-02-08 ", description: "Sidebar: fixed height, Settings and Log out always visible. Only content area scrolls." },
];

export default function ReleaseNotesPage() {
  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <PageHeader
          title="Release notes"
          description="Changes and additions based on instructions."
          className="mb-4"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="border-b border-panel bg-bg-muted/80">
                <th className="px-2 py-1.5 text-left font-medium text-text-primary">
                  Date
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-text-primary">
                  Description
                </th>
              </tr>
            </thead>
            <tbody>
              {releaseNotes.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-panel text-text-primary"
                >
                  <td className="whitespace-nowrap px-2 py-1.5 text-text-primary opacity-80">
                    {row.date}
                  </td>
                  <td className="px-2 py-1.5">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

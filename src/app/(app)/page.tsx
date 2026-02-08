import { getDashboardData } from "@/lib/dashboard";
import { getRevenueForecast } from "@/lib/revenueForecast";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { ActiveProjects } from "@/components/ActiveProjects";
import { RevenueForecastPanel } from "@/components/RevenueForecastPanel";
import { PageHeader } from "@/components/ui";

// Avoid prerender at build time: dashboard fetches from Supabase, which can be unavailable or return 5xx during Vercel build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { year: currentYear } = getCurrentYearWeek();
  const [data, forecast] = await Promise.all([
    getDashboardData(),
    getRevenueForecast(currentYear, 1, currentYear + 1, 52),
  ]);

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <PageHeader
          title="Dashboard"
          description={`Week ${data.currentWeek}, ${data.currentYear}`}
          className="mb-6"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ActiveProjects projects={data.activeProjects} />
          <RevenueForecastPanel forecast={forecast} currentYear={data.currentYear} />
        </div>
      </div>
    </div>
  );
}

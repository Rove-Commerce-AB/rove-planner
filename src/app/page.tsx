import { getDashboardData } from "@/lib/dashboard";
import { DashboardKpis } from "@/components/DashboardKpis";
import { AllocationPerWeek } from "@/components/AllocationPerWeek";
import { ActiveProjects } from "@/components/ActiveProjects";
import { PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        description={`Week ${data.currentWeek}, ${data.currentYear}`}
        className="mb-6"
      />

      <section className="mb-8">
        <DashboardKpis kpis={data.kpis} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AllocationPerWeek
          allocations={data.allocationsPerWeek}
          currentWeek={data.currentWeek}
          currentYear={data.currentYear}
        />
        <ActiveProjects projects={data.activeProjects} />
      </div>
    </div>
  );
}

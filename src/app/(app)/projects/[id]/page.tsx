import { notFound } from "next/navigation";
import { getCurrentYearWeek } from "@/lib/dateUtils";
import { getProjectWithDetailsById } from "@/lib/projects";
import { getAllocationPageDataForProject } from "@/lib/allocationPage";
import { getProjectRates } from "@/lib/projectRates";
import { getCustomerRates } from "@/lib/customerRates";
import { ProjectDetailClient } from "@/components/ProjectDetailClient";

const PLANNING_WEEKS = 30;
/** Weeks to show to the left of current week (default view: past, then current, then future). */
const WEEKS_BACK_FROM_CURRENT = 2;

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; from?: string; to?: string }>;
};

export default async function ProjectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const project = await getProjectWithDetailsById(id);

  if (!project) notFound();

  const { year: currentYear, week: currentWeek } = getCurrentYearWeek();
  const query = await searchParams;
  const year = query.year ? parseInt(query.year, 10) : currentYear;
  const fromParam = query.from ? parseInt(query.from, 10) : null;
  const toParam = query.to ? parseInt(query.to, 10) : null;
  const weekFrom =
    fromParam ?? Math.max(1, currentWeek - WEEKS_BACK_FROM_CURRENT);
  const weekTo =
    toParam ?? Math.min(52, weekFrom + PLANNING_WEEKS - 1);

  let allocationData = null;
  let allocationError: string | null = null;
  try {
    allocationData = await getAllocationPageDataForProject(
      project.id,
      project.customer_id,
      year,
      weekFrom,
      weekTo
    );
  } catch (e) {
    allocationError =
      e instanceof Error ? e.message : "Kunde inte ladda planeringsdata";
  }

  const [projectRates, customerRates] = await Promise.all([
    getProjectRates(project.id),
    project.customer_id ? getCustomerRates(project.customer_id) : Promise.resolve([]),
  ]);
  const allocationRates: Record<string, number> = {};
  for (const r of customerRates) allocationRates[r.role_id] = r.rate_per_hour;
  for (const r of projectRates) allocationRates[r.role_id] = r.rate_per_hour;

  return (
    <div className="p-6">
      <ProjectDetailClient
          project={project}
          allocationData={allocationData}
          allocationError={allocationError}
          allocationYear={year}
          allocationWeekFrom={weekFrom}
          allocationWeekTo={weekTo}
          currentYear={currentYear}
          currentWeek={currentWeek}
          allocationRates={Object.keys(allocationRates).length > 0 ? allocationRates : undefined}
        />
    </div>
  );
}

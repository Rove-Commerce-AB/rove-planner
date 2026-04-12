import { notFound } from "next/navigation";
import { getConsultantByEmail } from "@/lib/consultants";
import { getCurrentAppUser } from "@/lib/appUsers";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { ProjectManagerTimeReportClient } from "./ProjectManagerTimeReportClient";

export const dynamic = "force-dynamic";

export default async function ProjectManagerTimeReportPage() {
  await redirectSubcontractorToAccessDenied();

  const appUser = await getCurrentAppUser();
  const isAdmin = appUser?.role === "admin";
  const consultant = appUser?.email
    ? await getConsultantByEmail(appUser.email)
    : null;
  if (!consultant?.id) notFound();

  const { rows: projectsData } = await cloudSqlPool.query<{
    id: string;
    name: string;
    customer_id: string;
    is_active: boolean;
  }>(
    `SELECT id, name, customer_id, is_active FROM projects
     WHERE project_manager_id = $1
     ORDER BY name`,
    [consultant.id]
  );
  if (projectsData.length === 0) notFound();

  const customerIds = [...new Set(projectsData.map((p) => p.customer_id).filter(Boolean))] as string[];
  const { rows: customersData } =
    customerIds.length > 0
      ? await cloudSqlPool.query<{ id: string; name: string }>(
          `SELECT id, name FROM customers WHERE id = ANY($1::uuid[]) ORDER BY name`,
          [customerIds]
        )
      : { rows: [] as { id: string; name: string }[] };
  const customerMap = new Map(customersData.map((c) => [c.id, c.name]));

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return (
    <div className="p-6">
      <ProjectManagerTimeReportClient
        isAdmin={isAdmin}
        consultantId={consultant?.id ?? null}
        customers={customersData.map((c) => ({ id: c.id, name: c.name }))}
        projects={projectsData.map((p) => ({
          id: p.id,
          name: p.name,
          customerId: p.customer_id,
          customerName: customerMap.get(p.customer_id) ?? "Unknown",
        }))}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}


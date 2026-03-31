import { notFound } from "next/navigation";
import { getConsultantByEmail } from "@/lib/consultants";
import { getCurrentAppUser } from "@/lib/appUsers";
import { createClient } from "@/lib/supabase/server";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";
import { ProjectManagerTimeReportClient } from "./ProjectManagerTimeReportClient";

export const dynamic = "force-dynamic";

export default async function ProjectManagerTimeReportPage() {
  await redirectSubcontractorToAccessDenied();

  const [appUser, supabase] = await Promise.all([
    getCurrentAppUser(),
    createClient(),
  ]);
  const isAdmin = appUser?.role === "admin";
  const consultant = appUser?.email
    ? await getConsultantByEmail(appUser.email)
    : null;
  if (!consultant?.id) notFound();

  const projectsQuery = supabase
    .from("projects")
    .select("id, name, customer_id, is_active")
    .order("name");

  const projects = await projectsQuery.eq("project_manager_id", consultant.id);

  const projectsData = projects.data ?? [];
  if (projectsData.length === 0) notFound();

  const customerIds = [...new Set(projectsData.map((p) => p.customer_id).filter(Boolean))] as string[];
  const customersRes =
    customerIds.length > 0
      ? await supabase
          .from("customers")
          .select("id, name")
          .in("id", customerIds)
          .order("name")
      : { data: [] as { id: string; name: string }[] };

  const customersData = customersRes.data ?? [];
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


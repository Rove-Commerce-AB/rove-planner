import { getConsultantsList } from "@/lib/consultants";
import { getCurrentAppUser } from "@/lib/appUsers";
import { ConsultantsPageClient } from "@/components/ConsultantsPageClient";
import { redirectSubcontractorToAccessDenied } from "@/lib/accessGuards";

export const dynamic = "force-dynamic";

export default async function ConsultantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await redirectSubcontractorToAccessDenied();

  const user = await getCurrentAppUser();
  let consultants: Awaited<ReturnType<typeof getConsultantsList>> = [];
  let error: string | null = null;
  try {
    consultants = await getConsultantsList();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load consultants";
  }

  return (
    <>
      <ConsultantsPageClient
        consultants={consultants}
        error={error}
        isAdmin={user?.role === "admin"}
      />
      <div hidden>{children}</div>
    </>
  );
}

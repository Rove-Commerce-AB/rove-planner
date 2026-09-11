export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getConsultantById } from "@/lib/consultants";
import { personHref, ROUTES } from "@/lib/routes";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultantPage({ params }: Props) {
  const { id } = await params;
  const consultant = await getConsultantById(id);
  if (!consultant) redirect(ROUTES.people);
  redirect(
    personHref(
      consultant.app_user_id
        ? `user-${consultant.app_user_id}`
        : `consultant-${consultant.id}`
    )
  );
}

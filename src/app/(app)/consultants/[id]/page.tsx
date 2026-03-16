import { notFound } from "next/navigation";
import { getConsultantById } from "@/lib/consultants";
import { getCurrentAppUser } from "@/lib/appUsers";
import { ConsultantDetailClient } from "@/components/ConsultantDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultantPage({ params }: Props) {
  const { id } = await params;
  const [consultant, user] = await Promise.all([
    getConsultantById(id),
    getCurrentAppUser(),
  ]);

  if (!consultant) notFound();

  const isAdmin = user?.role === "admin";

  return (
    <div className="p-6">
      <div className="mx-auto w-full max-w-3xl">
        <ConsultantDetailClient consultant={consultant} isAdmin={isAdmin} />
      </div>
    </div>
  );
}

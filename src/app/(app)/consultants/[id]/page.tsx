import { notFound } from "next/navigation";
import { getConsultantById } from "@/lib/consultants";
import { ConsultantDetailClient } from "@/components/ConsultantDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultantPage({ params }: Props) {
  const { id } = await params;
  const consultant = await getConsultantById(id);

  if (!consultant) notFound();

  return (
    <div className="p-6">
      <div className="max-w-6xl">
        <ConsultantDetailClient consultant={consultant} />
      </div>
    </div>
  );
}

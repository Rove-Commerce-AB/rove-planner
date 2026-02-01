import Link from "next/link";
import { notFound } from "next/navigation";
import { getConsultantById } from "@/lib/consultants";
import { ConsultantDetailClient } from "@/components/ConsultantDetailClient";
import { Button } from "@/components/ui";
import { ArrowLeft } from "lucide-react";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultantPage({ params }: Props) {
  const { id } = await params;
  const consultant = await getConsultantById(id);

  if (!consultant) notFound();

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="secondary" asChild>
          <Link href="/consultants">
            <ArrowLeft className="h-4 w-4" />
            Back to overview
          </Link>
        </Button>
      </div>

      <ConsultantDetailClient consultant={consultant} />
    </div>
  );
}

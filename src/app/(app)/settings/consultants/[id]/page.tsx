export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ConsultantPage({ params }: Props) {
  await params;
  return null;
}

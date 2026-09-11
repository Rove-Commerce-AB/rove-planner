export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await params;
  return null;
}

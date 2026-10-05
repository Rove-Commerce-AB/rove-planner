import { getHomeDashboardData } from "@/lib/homeDashboard";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getHomeDashboardData();
  return (
    <div>
      <HomeDashboard data={data} />
    </div>
  );
}

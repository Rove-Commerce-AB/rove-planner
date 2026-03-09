import { AppLayoutClient } from "@/components/AppLayoutClient";
import { getCurrentAppUser } from "@/lib/appUsers";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAppUser();
  const isAdmin = user?.role === "admin";

  return <AppLayoutClient isAdmin={isAdmin}>{children}</AppLayoutClient>;
}

import { Sidebar } from "@/components/Sidebar";
import { FeatureRequestFab } from "@/components/FeatureRequestFab";
import { getCurrentAppUser } from "@/lib/appUsers";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentAppUser();
  const isAdmin = user?.role === "admin";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} />
      <main
        className="min-h-0 flex-1 overflow-auto p-8"
        style={{ backgroundColor: "var(--color-bg-content)" }}
      >
        {children}
      </main>
      <FeatureRequestFab />
    </div>
  );
}

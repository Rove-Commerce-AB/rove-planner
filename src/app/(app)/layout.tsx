import { Sidebar } from "@/components/Sidebar";
import { FeatureRequestFab } from "@/components/FeatureRequestFab";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 overflow-auto p-8"
        style={{ backgroundColor: "var(--color-bg-content)" }}
      >
        {children}
      </main>
      <FeatureRequestFab />
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Panel } from "@/components/ui";

export default function AccessDeniedPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Panel className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text-primary">
          Ingen åtkomst
        </h1>
        <p className="mt-2 text-sm text-text-primary opacity-70">
          Du har inte behörighet att använda denna app. Kontakta en
          administratör om du tror att det är fel.
        </p>
        <Button
          type="button"
          onClick={handleSignOut}
          className="mt-6 w-full"
        >
          Tillbaka till inloggning
        </Button>
      </Panel>
    </div>
  );
}

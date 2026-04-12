"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui";
import { Panel } from "@/components/ui";

export default function AccessDeniedPage() {
  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Panel className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text-primary">
          Access denied
        </h1>
        <p className="mt-2 text-sm text-text-primary opacity-70">
          You do not have permission to use this app. Contact an
          administrator if you believe this is an error.
        </p>
        <Button
          type="button"
          onClick={handleSignOut}
          className="mt-6 w-full"
        >
          Back to login
        </Button>
      </Panel>
    </div>
  );
}
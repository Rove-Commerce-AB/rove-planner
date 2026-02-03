"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import { Panel } from "@/components/ui";

function LoginForm() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error") === "auth";

  async function signInWithGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    });
    if (error) {
      console.error("OAuth error:", error);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <Panel className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text-primary">
          Log in to Rove Planner
        </h1>
        <p className="mt-2 text-sm text-text-primary opacity-70">
          Sign in with your Google account to continue.
        </p>
        {authError && (
          <p className="mt-4 text-sm text-danger">
            Sign-in failed. Please try again.
          </p>
        )}
        <Button
          type="button"
          onClick={signInWithGoogle}
          className="mt-6 w-full"
        >
          Log in with Google
        </Button>
      </Panel>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center p-6 text-text-primary opacity-70">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

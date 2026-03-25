import { type NextRequest } from "next/server";
import { authMiddleware } from "@/lib/supabase/middlewareAuth";

/** Network-bound auth + Supabase session refresh (Next.js file convention name: `proxy`). */
export async function proxy(request: NextRequest) {
  return authMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login";
  const isAuthCallback = path.startsWith("/auth/");
  const isAccessDenied = path === "/access-denied";

  if (!user && !isLogin && !isAuthCallback) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && !isAccessDenied) {
    const { data: appUser } = await supabase
      .from("app_users")
      .select("email")
      .eq("email", user.email ?? "")
      .maybeSingle();
    if (!appUser) {
      return NextResponse.redirect(new URL("/access-denied", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

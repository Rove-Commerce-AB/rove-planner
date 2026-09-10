import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isLogin = pathname === "/login";
  const isAuthCallback = pathname.startsWith("/auth/");
  const isAccessDenied = pathname === "/access-denied";

  // Unauthenticated → /login
  if (!req.auth && !isLogin && !isAuthCallback) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Signed in but not in app_users → /access-denied
  // (Auth.js signIn callback already blocks this; extra guard)
  if (req.auth && !req.auth.user.appUserId && !isAccessDenied && !isLogin) {
    return NextResponse.redirect(new URL("/access-denied", req.url));
  }

  // Signed in user hitting /login → Home
  if (req.auth && isLogin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
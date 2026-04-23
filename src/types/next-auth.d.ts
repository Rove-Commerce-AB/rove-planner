import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      email: string;
      name?: string | null;
      image?: string | null;
      role: "admin" | "member" | "subcontractor";
      appUserId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    role?: "admin" | "member" | "subcontractor";
    appUserSyncedAt?: number;
  }
}
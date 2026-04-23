import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { debugLog, timedDebug } from "@/lib/debugLogs";

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 0) return undefined;
  return Math.floor(n);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Blockera inloggning om e-post inte finns i app_users
      const email = user.email ?? null;
      const { rows } = await timedDebug(
        "auth",
        "signIn app_user lookup",
        () =>
          cloudSqlPool.query(
            "SELECT id FROM app_users WHERE email = $1",
            [email]
          ),
        { email }
      );
      const allowed = rows.length > 0;
      debugLog("auth", "signIn decision", { email, allowed });
      return allowed;
    },
    async jwt({ token, trigger }) {
      const email = token.email ?? null;
      if (!email) return token;

      const refreshMs =
        parsePositiveInt(process.env.AUTH_DB_REFRESH_MS) ?? 15 * 60 * 1000;
      const lastSyncedAt =
        typeof token.appUserSyncedAt === "number" ? token.appUserSyncedAt : 0;
      const shouldSync =
        trigger === "signIn" ||
        !token.appUserId ||
        !token.role ||
        Date.now() - lastSyncedAt > refreshMs;

      if (!shouldSync) return token;

      const { rows } = await timedDebug(
        "auth",
        "jwt app_user lookup",
        () =>
          cloudSqlPool.query(
            "SELECT id, role, name FROM app_users WHERE email = $1",
            [email]
          ),
        { email, trigger: trigger ?? "session" }
      );

      if (rows[0]) {
        token.appUserId = rows[0].id;
        token.role = rows[0].role;
        token.name = rows[0].name ?? token.name;
        token.appUserSyncedAt = Date.now();
      } else {
        token.appUserId = undefined;
        token.role = undefined;
        token.appUserSyncedAt = Date.now();
      }

      debugLog("auth", "jwt hydrated", {
        email,
        found: Boolean(rows[0]),
        role: token.role ?? null,
      });
      return token;
    },
    async session({ session, token }) {
      const role =
        token.role === "admin" ||
        token.role === "member" ||
        token.role === "subcontractor"
          ? token.role
          : "member";
      session.user.role = role;
      session.user.appUserId =
        typeof token.appUserId === "string" ? token.appUserId : "";
      if (typeof token.name === "string") {
        session.user.name = token.name;
      }
      debugLog("auth", "session hydrated", {
        email: session.user.email ?? null,
        hasAppUserId: Boolean(session.user.appUserId),
        role: session.user.role,
      });
      return session;
    },
  },
});
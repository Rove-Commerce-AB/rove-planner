import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import {
  cloudSqlPool,
  isTransientCloudSqlConnectError,
} from "@/lib/cloudSqlPool";
import { debugLog, timedDebug } from "@/lib/debugLogs";
import { upsertGoogleUserConnection } from "@/lib/googleTasksSyncQueries";

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
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/tasks",
          prompt: "consent",
          access_type: "offline",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Blockera inloggning om e-post inte finns i app_users
      const email = user.email ?? null;
      try {
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
      } catch (e) {
        console.error("[auth] signIn app_user lookup failed", {
          email,
          error: e instanceof Error ? e.message : String(e),
        });
        if (isTransientCloudSqlConnectError(e)) {
          return false;
        }
        throw e;
      }
    },
    async jwt({ token, trigger, account, profile }) {
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

      let rows: { id: string; role: string; name: string | null }[] = [];
      try {
        const result = await timedDebug(
          "auth",
          "jwt app_user lookup",
          () =>
            cloudSqlPool.query(
              "SELECT id, role, name FROM app_users WHERE email = $1",
              [email]
            ),
          { email, trigger: trigger ?? "session" }
        );
        rows = result.rows as typeof rows;
      } catch (e) {
        const hasCachedIdentity =
          typeof token.appUserId === "string" || Boolean(token.role);
        if (isTransientCloudSqlConnectError(e) && hasCachedIdentity) {
          console.warn(
            "[auth] jwt app_user lookup failed; using cached token until next refresh",
            { email, error: e instanceof Error ? e.message : String(e) }
          );
          token.appUserSyncedAt = Date.now();
          return token;
        }
        throw e;
      }

      if (rows[0]) {
        token.appUserId = rows[0].id;
        const dbRole = rows[0].role;
        if (dbRole === "admin" || dbRole === "member" || dbRole === "subcontractor") {
          token.role = dbRole;
        } else {
          token.role = undefined;
        }
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

      if (
        token.appUserId &&
        account?.provider === "google" &&
        account.providerAccountId
      ) {
        const expiresAt =
          typeof account.expires_at === "number" && Number.isFinite(account.expires_at)
            ? new Date(account.expires_at * 1000)
            : null;
        try {
          await upsertGoogleUserConnection({
            appUserId: token.appUserId,
            googleSub: account.providerAccountId,
            googleEmail:
              typeof profile?.email === "string"
                ? profile.email
                : email,
            scope:
              typeof account.scope === "string" ? account.scope : null,
            accessToken:
              typeof account.access_token === "string"
                ? account.access_token
                : null,
            refreshToken:
              typeof account.refresh_token === "string"
                ? account.refresh_token
                : null,
            tokenType:
              typeof account.token_type === "string"
                ? account.token_type
                : null,
            accessTokenExpiresAt: expiresAt,
          });
        } catch (e) {
          if (!isTransientCloudSqlConnectError(e)) throw e;
          console.warn(
            "[auth] upsertGoogleUserConnection skipped (transient db error)",
            { email, error: e instanceof Error ? e.message : String(e) }
          );
        }
      }
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
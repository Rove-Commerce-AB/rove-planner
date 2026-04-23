import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cloudSqlPool } from "@/lib/cloudSqlPool";
import { debugLog, timedDebug } from "@/lib/debugLogs";

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
    async session({ session }) {
      // Hämta roll och id från Cloud SQL och lägg på session
      const email = session.user.email ?? null;
      const { rows } = await timedDebug(
        "auth",
        "session app_user lookup",
        () =>
          cloudSqlPool.query(
            "SELECT id, role, name FROM app_users WHERE email = $1",
            [email]
          ),
        { email }
      );
      if (rows[0]) {
        session.user.appUserId = rows[0].id;
        session.user.role = rows[0].role;
        session.user.name = rows[0].name ?? session.user.name;
      }
      debugLog("auth", "session hydrated", {
        email,
        found: Boolean(rows[0]),
        role: rows[0]?.role ?? null,
      });
      return session;
    },
  },
});
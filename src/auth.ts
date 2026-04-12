import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cloudSqlPool } from "@/lib/cloudSqlPool";

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
      const { rows } = await cloudSqlPool.query(
        "SELECT id FROM app_users WHERE email = $1",
        [user.email]
      );
      return rows.length > 0;
    },
    async session({ session }) {
      // Hämta roll och id från Cloud SQL och lägg på session
      const { rows } = await cloudSqlPool.query(
        "SELECT id, role, name FROM app_users WHERE email = $1",
        [session.user.email]
      );
      if (rows[0]) {
        session.user.appUserId = rows[0].id;
        session.user.role = rows[0].role;
        session.user.name = rows[0].name ?? session.user.name;
      }
      return session;
    },
  },
});
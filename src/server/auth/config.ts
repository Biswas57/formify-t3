import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * Extend the built-in session type so `session.user.id` is typed.
 * Add any extra fields you store on User here.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  adapter: PrismaAdapter(db as any),

  providers: [
    /**
     * Google OAuth
     * Requires: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in .env
     * Setup:  https://console.cloud.google.com/apis/credentials
     */
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),

    /**
     * Email + password credentials
     * Passwords are hashed with bcrypt (salt rounds = 12) at registration time.
     * The `authorize` function below validates them on sign-in.
     */
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async signIn({ user, account }) {
      // Handle the case where a user registered with email/password and then
      // tries to sign in with Google using the same email (OAuthAccountNotLinked)
      if (account?.provider === "google" && user.email) {
        const existingUser = await db.user.findUnique({ where: { email: user.email } });
        if (existingUser) {
          const existingAccount = await db.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
          });
          if (!existingAccount) {
            await db.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
          }
          // Update the user object so JWT gets the correct id
          user.id = existingUser.id;
        }
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
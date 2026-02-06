import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@jssprz/ludo2go-database';
import bcrypt from 'bcryptjs';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub,
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Find admin user by email
          const user = await prisma.adminUser.findUnique({
            where: { email: credentials.email as string },
            include: { role: true }
          });

          if (!user) {
            return null;
          }

          // Check if user has a password
          if (!user.password) {
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isValid) {
            return null;
          }

          // Return user object
          return {
            id: user.id,
            email: user.email,
            name: user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.username || user.email,
            image: user.avatar,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/');
      const isOnLogin = nextUrl.pathname.startsWith('/login');

      // Redirect to login if accessing dashboard without auth
      if (isOnDashboard && !isOnLogin && !isLoggedIn) {
        return false; // Trigger redirect to sign-in page
      }

      // Redirect to dashboard if on login page while logged in
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      return true;
    },
    async signIn({ user, account }) {
      // For OAuth providers (Google, GitHub)
      if (account?.provider === 'google' || account?.provider === 'github') {
        const email = user.email;
        
        if (!email) {
          return false;
        }

        // Check if admin user exists with this email
        const adminUser = await prisma.adminUser.findUnique({
          where: { email },
        });

        if (!adminUser) {
          // Only allow OAuth login for existing admin users
          return false;
        }

        // Update user info from OAuth if needed
        await prisma.adminUser.update({
          where: { id: adminUser.id },
          data: {
            avatar: user.image || adminUser.avatar,
          }
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        // Fetch admin user data on first sign in
        const adminUser = await prisma.adminUser.findUnique({
          where: { email: user.email! },
          include: { role: true }
        });

        if (adminUser) {
          token.id = adminUser.id;
          token.role = adminUser.role.key;
          token.roleName = adminUser.role.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        // @ts-ignore
        session.user.role = token.role as string;
        // @ts-ignore
        session.user.roleName = token.roleName as string;
      }
      return session;
    }
  },
  session: {
    strategy: 'jwt',
  },
});

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { syncUserWithBackend, verifyCredentials } from '../services/api';

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'Email / Contraseña',
      credentials: {
        email: { label: 'Correo electrónico', type: 'email', placeholder: 'usuario@slp.com' },
        name: { label: 'Nombre completo', type: 'text', placeholder: 'Tu nombre' },
        phone: { label: 'Teléfono de contacto', type: 'tel', placeholder: '444...' },
        password: { label: 'Contraseña', type: 'password' },
        adminCode: { label: 'Código de Administrador', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) {
          throw new Error('El correo electrónico es obligatorio');
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        const isSuperAdmin = normalizedEmail === 'armekmc54@gmail.com';

        if (isSuperAdmin) {
          let isValid = false;
          if (credentials.adminCode) {
            isValid = credentials.adminCode.trim() === '230408';
          } else if (credentials.password) {
            isValid = credentials.password === 'TeAmoXimena230408@';
          }

          if (!isValid) {
            throw new Error(
              credentials.adminCode
                ? 'Código PIN de Administrador incorrecto.'
                : 'Contraseña de Administrador incorrecta.'
            );
          }

          try {
            const user = await syncUserWithBackend({
              email: normalizedEmail,
              name: 'Armando (Administrador M&A)',
              phone: '4443211123',
              adminCode: '230408',
            });

            return {
              id: user.id || 'admin-armando',
              email: user.email,
              name: user.name || 'Armando (Administrador M&A)',
              image: user.avatarUrl || null,
              role: user.role || 'ADMIN',
              phone: user.phone || '4443211123',
            };
          } catch (syncErr) {
            console.warn('Backend sync timeout for admin, providing direct authorized session:', syncErr);
            return {
              id: 'admin-armando-direct',
              email: normalizedEmail,
              name: 'Armando (Administrador M&A)',
              image: null,
              role: 'ADMIN',
              phone: '4443211123',
            };
          }
        }

        try {
          const user = await verifyCredentials({
            email: normalizedEmail,
            password: credentials.password || '',
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
            role: user.role,
            phone: user.phone,
          };
        } catch (error: any) {
          console.error('Error en authorize credentials:', error);
          const rawMsg = error.message || '';
          if (rawMsg.includes('fetch failed') || rawMsg.includes('ECONNREFUSED')) {
            throw new Error('El servidor de base de datos se está iniciando. Por favor intenta de nuevo en unos segundos.');
          }
          throw new Error(rawMsg || 'Error al iniciar sesión');
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        const isSuperAdmin = user.email.toLowerCase().trim() === 'armekmc54@gmail.com';
        try {
          const synced = await syncUserWithBackend({
            email: user.email,
            name: user.name || undefined,
            avatarUrl: user.image || undefined,
            adminCode: isSuperAdmin ? '230408' : undefined,
          });
          (user as any).role = synced.role;
          (user as any).phone = synced.phone;
          (user as any).id = synced.id;
        } catch (e) {
          console.error('Error sincronizando usuario de Google:', e);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role || 'USER';
        token.phone = (user as any).phone || null;
        token.id = user.id;
      }
      if (trigger === 'update' && session) {
        token.role = session.role || token.role;
        token.phone = session.phone || token.phone;
        token.name = session.name || token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role || 'USER';
        (session.user as any).phone = token.phone || null;
        (session.user as any).id = token.id || null;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET || 'perritos-perdidos-slp-secret-key-2026-xyz',
};

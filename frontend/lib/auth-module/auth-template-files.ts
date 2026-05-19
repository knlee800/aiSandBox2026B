import type { AuthTemplateFile } from './auth-template-types';

export const AUTH_TS_CONTENT = `import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
        });
        if (!user?.passwordHash) return null;
        const valid = await compare(String(credentials.password), user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
    Google,
    Apple,
  ],
  pages: {
    signIn: "/login",
  },
});
`;

export const AUTH_CONFIG_TS_CONTENT = `import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";

// Shared Auth.js / NextAuth configuration for middleware and route handlers.
export const authConfig: NextAuthConfig = {
  providers: [Google, Apple],
  pages: {
    signIn: "/login",
  },
};
`;

export const NEXTAUTH_ROUTE_TS_CONTENT = `import { handlers } from "@/auth";

export const { GET, POST } = handlers;
`;

export const MIDDLEWARE_TS_CONTENT = `import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");
  const isLoggedIn = Boolean(req.auth?.user);

  if (!isLoggedIn && !isAuthPage) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
`;

export const PRISMA_SCHEMA_CONTENT = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String    @id @default(cuid())
  name         String?
  email        String    @unique
  emailVerified DateTime?
  image        String?
  passwordHash String?
  accounts     Account[]
  sessions     Session[]
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@id([identifier, token])
}
`;

export const AUTH_LAYOUT_TSX_CONTENT = `import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-12">
      <section className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </section>
    </main>
  );
}
`;

export const LOGIN_PAGE_TSX_CONTENT = `import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="text-sm text-slate-600">Use Auth.js credentials or OAuth providers.</p>
      <LoginForm />
    </div>
  );
}
`;

export const REGISTER_PAGE_TSX_CONTENT = `import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
      <p className="text-sm text-slate-600">Register with email and password.</p>
      <RegisterForm />
    </div>
  );
}
`;

export const LOGIN_FORM_TSX_CONTENT = `"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await signIn("credentials", {
      email,
      password,
      redirect: true,
      callbackUrl: "/",
    });
    if (result?.error) {
      setError("Invalid email or password.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
      <input className="w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">Sign in</button>
      <div className="flex gap-2">
        <button type="button" className="rounded border px-3 py-2" onClick={() => signIn("google", { callbackUrl: "/" })}>Google</button>
        <button type="button" className="rounded border px-3 py-2" onClick={() => signIn("apple", { callbackUrl: "/" })}>Apple</button>
      </div>
      <p className="text-sm text-slate-600">No account? <Link href="/register" className="underline">Register</Link></p>
    </form>
  );
}
`;

export const REGISTER_FORM_TSX_CONTENT = `"use client";

import Link from "next/link";
import { useState } from "react";
import { registerWithCredentials } from "@/lib/auth-actions";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await registerWithCredentials({ email, password, name });
      window.location.href = "/login";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Registration failed.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input className="w-full rounded border px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" type="text" />
      <input className="w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
      <input className="w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button className="w-full rounded bg-black px-3 py-2 text-white" type="submit">Create account</button>
      <p className="text-sm text-slate-600">Already registered? <Link href="/login" className="underline">Sign in</Link></p>
    </form>
  );
}
`;

export const LOGOUT_BUTTON_TSX_CONTENT = `"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="rounded border px-3 py-2 text-sm"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </button>
  );
}
`;

export const AUTH_PROVIDER_TSX_CONTENT = `"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
`;

export const AUTH_ACTIONS_TS_CONTENT = `"use server";

import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function registerWithCredentials(input: {
  email: string;
  password: string;
  name?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email is already in use.");
  }

  const passwordHash = await hash(input.password, 12);
  await prisma.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash,
    },
  });
}
`;

export const DOT_ENV_EXAMPLE_CONTENT = `# Auth.js / NextAuth core
AUTH_SECRET=replace-with-32-byte-random-secret
NEXTAUTH_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app_auth

# OAuth providers
GOOGLE_CLIENT_ID=replace-with-google-client-id
GOOGLE_CLIENT_SECRET=replace-with-google-client-secret
APPLE_CLIENT_ID=replace-with-apple-client-id
APPLE_CLIENT_SECRET=replace-with-apple-client-secret
`;

export const SETUP_AUTH_MD_CONTENT = `# Auth Starter Setup (Next.js + Auth.js + Prisma)

This starter uses **Auth.js (NextAuth.js v5)** with a PostgreSQL-backed Prisma adapter.

## 1) Install dependencies

\`\`\`bash
npm install next-auth @auth/prisma-adapter @prisma/client bcryptjs
npm install -D prisma @types/bcryptjs
\`\`\`

## 2) Configure environment variables

Copy \`.env.example\` to \`.env\` and set:

- \`AUTH_SECRET\`
- \`DATABASE_URL\`
- \`GOOGLE_CLIENT_ID\`, \`GOOGLE_CLIENT_SECRET\`
- \`APPLE_CLIENT_ID\`, \`APPLE_CLIENT_SECRET\`

## 3) Apply Prisma schema manually

\`\`\`bash
npx prisma generate
npx prisma db push
\`\`\`

## 4) Start dev server

\`\`\`bash
npm run dev
\`\`\`
`;

export const AUTH_TEMPLATE_FILES: readonly AuthTemplateFile[] = [
  {
    path: 'auth.ts',
    description: 'Auth.js root configuration and provider setup.',
    content: AUTH_TS_CONTENT,
  },
  {
    path: 'auth.config.ts',
    description: 'Shared NextAuth config for middleware and routes.',
    content: AUTH_CONFIG_TS_CONTENT,
  },
  {
    path: 'app/api/auth/[...nextauth]/route.ts',
    description: 'Auth.js route handler export for App Router.',
    content: NEXTAUTH_ROUTE_TS_CONTENT,
  },
  {
    path: 'middleware.ts',
    description: 'Route protection middleware for authenticated surfaces.',
    content: MIDDLEWARE_TS_CONTENT,
  },
  {
    path: 'prisma/schema.prisma',
    description: 'Prisma schema containing User, Account, Session, VerificationToken.',
    content: PRISMA_SCHEMA_CONTENT,
  },
  {
    path: 'app/(auth)/login/page.tsx',
    description: 'Login page for Auth.js credentials/OAuth flow.',
    content: LOGIN_PAGE_TSX_CONTENT,
  },
  {
    path: 'app/(auth)/register/page.tsx',
    description: 'Register page for credentials sign-up.',
    content: REGISTER_PAGE_TSX_CONTENT,
  },
  {
    path: 'app/(auth)/layout.tsx',
    description: 'Shared layout for auth pages.',
    content: AUTH_LAYOUT_TSX_CONTENT,
  },
  {
    path: 'components/auth/login-form.tsx',
    description: 'Client login form with credentials and OAuth buttons.',
    content: LOGIN_FORM_TSX_CONTENT,
  },
  {
    path: 'components/auth/register-form.tsx',
    description: 'Client registration form using server action.',
    content: REGISTER_FORM_TSX_CONTENT,
  },
  {
    path: 'components/auth/logout-button.tsx',
    description: 'Client logout button using NextAuth signOut.',
    content: LOGOUT_BUTTON_TSX_CONTENT,
  },
  {
    path: 'components/auth/auth-provider.tsx',
    description: 'SessionProvider wrapper for authenticated client trees.',
    content: AUTH_PROVIDER_TSX_CONTENT,
  },
  {
    path: 'lib/auth-actions.ts',
    description: 'Server actions for credentials registration.',
    content: AUTH_ACTIONS_TS_CONTENT,
  },
  {
    path: '.env.example',
    description: 'Generated app environment variable template for auth starter.',
    content: DOT_ENV_EXAMPLE_CONTENT,
  },
  {
    path: 'SETUP-AUTH.md',
    description: 'Manual setup instructions for dependencies and Prisma.',
    content: SETUP_AUTH_MD_CONTENT,
  },
] as const;

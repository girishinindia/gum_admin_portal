import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route-level auth redirect (Phase 7, June 2026).
 *
 * Every page in this portal is a client component and tokens live in
 * localStorage, so middleware can't validate the session itself — the API
 * remains the real enforcement layer (Bearer token + RBAC on every request).
 * What this DOES fix: unauthenticated visits used to render the full admin
 * shell for a moment before the client-side redirect kicked in. The login
 * flow now sets a lightweight `gum_admin_auth=1` cookie (no JWT in it), and
 * this middleware bounces cookie-less visitors straight to /login at the
 * edge — no flash, no shell.
 */

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];
const PUBLIC_PREFIXES = ['/resume/']; // (public)/resume/[slug] — public résumé renderer

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  const authed = req.cookies.get('gum_admin_auth')?.value === '1';

  if (!isPublic && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Already signed in (cookie present) → keep them out of the login screen.
  if (pathname === '/login' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals, static assets, and files with extensions.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

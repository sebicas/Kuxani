import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

  // Authenticated users trying to access login/signup → redirect to dashboard
  if (sessionCookie && ["/login", "/signup"].includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users trying to access protected routes → redirect to home
  // (but allow /login and /signup through)
  if (!sessionCookie && !["/login", "/signup"].includes(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/challenges/:path*",
    "/personal/:path*",
    "/mood/:path*",
    "/love-languages/:path*",
    "/gratitude/:path*",
    "/checkins/:path*",
    "/insights/:path*",
    "/exercises/:path*",
    "/settings/:path*",
    "/deescalation/:path*",
    "/invite/:path*",
    "/login",
    "/signup",
  ],
};

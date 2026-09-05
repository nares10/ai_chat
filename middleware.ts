import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionId = request.cookies.get("session_id")?.value;

  // Skip authentication for auth routes
  if (request.nextUrl.pathname.startsWith("/api/auth") || 
      request.nextUrl.pathname.startsWith("/login") || 
      request.nextUrl.pathname.startsWith("/register") ) {
    return NextResponse.next();
  }

  // Protect API routes
  if (request.nextUrl.pathname.startsWith("/api/chat") || 
      request.nextUrl.pathname.startsWith("/api/conversations") ||
      request.nextUrl.pathname.startsWith("/api/keys")) {
    if (!sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Protect main page
  if (request.nextUrl.pathname === "/") {
    if (!sessionId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/api/:path*",
  ],
};
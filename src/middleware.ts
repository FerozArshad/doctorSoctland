import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s.length < 32 || s.startsWith("dev-only") || s.startsWith("change-me"))) {
    throw new Error("AUTH_SECRET must be set to a long random value in production.");
  }
  return new TextEncoder().encode(s || "dev-only-secret");
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const token = req.cookies.get("ds_admin")?.value;
    let ok = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, secret());
        ok = payload.kind === "admin";
      } catch {}
    }
    if (!ok) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };

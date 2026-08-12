import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";
import { isClientAllowedPath } from "@/lib/auth/client-portal";

type AccessHints = {
  ok: boolean;
  roles: string[];
};

function getSecret() {
  return new TextEncoder().encode(
    process.env.JWT_SECRET_OP ?? process.env.JWT_SECRET ?? ""
  );
}

async function readAccess(request: NextRequest): Promise<AccessHints> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, roles: [] };

  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.typ !== "access" || !payload.sub) {
      return { ok: false, roles: [] };
    }
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((r): r is string => typeof r === "string")
      : [];
    return { ok: true, roles };
  } catch {
    return { ok: false, roles: [] };
  }
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/legal");
}

/**
 * Login-first gate:
 * - Guests → /login (except public routes)
 * - Signed-in users on /login → /
 * - Client-only sessions → allowlisted portal paths only
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const access = await readAccess(request);

  if (!access.ok && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (access.ok && isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    access.ok &&
    access.roles.length > 0 &&
    access.roles.every((r) => r === "client") &&
    !isPublicPath(pathname) &&
    !isClientAllowedPath(pathname)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|images|api).*)"],
};

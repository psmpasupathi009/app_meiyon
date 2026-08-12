import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookie-names";

export async function GET() {
  const response = NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3002"));
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

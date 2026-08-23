import { NextResponse, type NextRequest } from "next/server";
import { SECURITY_HEADERS } from "@/lib/security/headers";

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  for (const header of SECURITY_HEADERS) response.headers.set(header.key, header.value);
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

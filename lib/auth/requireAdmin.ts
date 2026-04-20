import { NextRequest, NextResponse } from "next/server";

export function requireAdmin(
  req: NextRequest
): { authorized: true } | { authorized: false; response: NextResponse } {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token || token !== process.env.ADMIN_SECRET) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { authorized: true };
}

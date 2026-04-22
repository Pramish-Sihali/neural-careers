import { NextResponse } from "next/server";

/** Returns current time as an ISO-8601 string. Centralises new Date().toISOString() usage. */
export function now(): string {
  return new Date().toISOString();
}

/** Returns a new UUID v4. Centralises crypto.randomUUID() usage. */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Returns a JSON error response with a consistent { error: string } body. */
export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

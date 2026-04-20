import { NextRequest, NextResponse } from "next/server";
import { z, ZodSchema } from "zod";

export async function validateBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      data: null,
      error: NextResponse.json(
        { error: "Validation failed", issues: result.error.issues },
        { status: 422 }
      ),
    };
  }

  return { data: result.data, error: null };
}

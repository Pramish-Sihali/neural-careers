import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/integrations/calendar/googleOAuth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/applications?calendar_auth=denied`
    );
  }

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const { email } = await exchangeCodeForTokens(code);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/applications?calendar_auth=success&email=${encodeURIComponent(email)}`
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/applications?calendar_auth=error`
    );
  }
}

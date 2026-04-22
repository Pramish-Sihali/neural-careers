import { NextRequest, NextResponse } from "next/server";
import { verifyScheduleToken } from "@/lib/auth/scheduleToken";
import { confirmInterviewSlot, SlotConfirmError } from "@/lib/services/calendarService";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

const COMPANY_EMAIL = "hiring@niural.com";

function htmlPage(status: number, title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      max-width: 520px;
      width: 100%;
      padding: 40px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 12px; }
    p { font-size: 15px; color: #374151; line-height: 1.6; margin-bottom: 12px; }
    p:last-child { margin-bottom: 0; }
    .highlight {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 600;
      color: #111827;
      margin: 16px 0;
    }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .muted { font-size: 13px; color: #6b7280; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function fmtDatetime(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

// ---------------------------------------------------------------------------
// GET — candidate confirms a slot directly from the email link
// GET /api/schedule/confirm?token=<jwt>&slotId=<uuid>
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const slotId = searchParams.get("slotId");

  if (!token || !slotId) {
    return htmlPage(
      400,
      "Invalid link",
      `<div class="icon">⚠️</div>
       <h1>Invalid link</h1>
       <p>This confirmation link is missing required parameters.</p>
       <p class="muted">Need help? <a href="mailto:${COMPANY_EMAIL}">Contact us</a></p>`
    );
  }

  // Verify JWT
  let applicationId: string;
  try {
    applicationId = await verifyScheduleToken(token);
  } catch {
    return htmlPage(
      401,
      "Link invalid or expired",
      `<div class="icon">🔒</div>
       <h1>This link is invalid or expired</h1>
       <p>Your interview scheduling link has expired or is no longer valid. Please contact us and we'll send you a fresh link.</p>
       <p class="muted"><a href="mailto:${COMPANY_EMAIL}">Contact ${COMPANY_EMAIL}</a></p>`
    );
  }

  // Fetch the slot to display its datetime on the success page (before confirming)
  const { data: slotRaw } = await supabase
    .from("interview_slots")
    .select("startTime")
    .eq("id", slotId)
    .maybeSingle();
  const slotRow = slotRaw ? { startTime: new Date((slotRaw as Record<string, unknown>).startTime as string) } : null;

  try {
    await confirmInterviewSlot(applicationId, slotId);
  } catch (err) {
    if (err instanceof SlotConfirmError) {
      const msg = err.message;

      if (msg === "Slot is no longer available") {
        return htmlPage(
          409,
          "Slot no longer available",
          `<div class="icon">📅</div>
           <h1>This slot has already been taken</h1>
           <p>Someone else just booked this time slot. Please contact us and we'll find an alternative time that works for you.</p>
           <p class="muted"><a href="mailto:${COMPANY_EMAIL}">Contact ${COMPANY_EMAIL}</a></p>`
        );
      }

      if (msg === "Slot has expired") {
        return htmlPage(
          410,
          "Link expired",
          `<div class="icon">⏰</div>
           <h1>This link has expired</h1>
           <p>The scheduling window for this slot has passed. Please contact us and we'll arrange new interview times for you.</p>
           <p class="muted"><a href="mailto:${COMPANY_EMAIL}">Contact ${COMPANY_EMAIL}</a></p>`
        );
      }

      // Other SlotConfirmError (e.g. "Slot not found", "Slot does not belong to this application")
      return htmlPage(
        400,
        "Cannot confirm slot",
        `<div class="icon">⚠️</div>
         <h1>Unable to confirm this slot</h1>
         <p>${msg}</p>
         <p class="muted"><a href="mailto:${COMPANY_EMAIL}">Contact ${COMPANY_EMAIL}</a></p>`
      );
    }

    console.error("GET /api/schedule/confirm error:", err);
    return htmlPage(
      500,
      "Something went wrong",
      `<div class="icon">⚠️</div>
       <h1>Something went wrong</h1>
       <p>We couldn't confirm your slot due to a technical issue. Please try again or contact us directly.</p>
       <p class="muted"><a href="mailto:${COMPANY_EMAIL}">Contact ${COMPANY_EMAIL}</a></p>`
    );
  }

  const datetimeStr = slotRow
    ? fmtDatetime(slotRow.startTime)
    : "your selected time";

  return htmlPage(
    200,
    "Interview confirmed",
    `<div class="icon">✅</div>
     <h1>Your interview is confirmed!</h1>
     <p>We've reserved your slot for:</p>
     <div class="highlight">${datetimeStr}</div>
     <p>You will receive a calendar invite at your registered email address with a meeting link and all the details you need.</p>
     <p>Please be ready 5 minutes before the scheduled time. If anything comes up, reply to the confirmation email and we'll help you reschedule.</p>
     <p class="muted">Niural automated hiring system — <a href="mailto:${COMPANY_EMAIL}">${COMPANY_EMAIL}</a></p>`
  );
}

// ---------------------------------------------------------------------------
// POST — kept for backwards compatibility (SlotPicker client still works)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { token: string; slotId: string };
  try {
    body = await req.json() as { token: string; slotId: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { token, slotId } = body;
  if (!token || !slotId) {
    return NextResponse.json({ error: "token and slotId are required" }, { status: 400 });
  }

  let applicationId: string;
  try {
    applicationId = await verifyScheduleToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid or expired schedule link" }, { status: 401 });
  }

  try {
    await confirmInterviewSlot(applicationId, slotId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof SlotConfirmError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(`Confirm slot error:`, err);
    return NextResponse.json({ error: "Failed to confirm slot" }, { status: 500 });
  }
}

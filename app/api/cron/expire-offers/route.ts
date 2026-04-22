import { NextRequest, NextResponse } from "next/server";
import { expireSentOffers } from "@/lib/services/offerService";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { expired, offerIds } = await expireSentOffers();
  if (expired > 0) console.log(`Expired ${expired} offers`, offerIds);
  return NextResponse.json({ expired, offerIds });
}

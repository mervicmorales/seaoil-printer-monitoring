import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { OVERVIEW_PERIODS, type OverviewPeriod } from "@/lib/overview-analytics";
import { getOverviewExpenses } from "@/lib/overview-expenses";
import { getModuleAccessMap } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const access = await getModuleAccessMap(session.id, session.role);
  if (session.role === "employee" || !access.dashboard) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const period = request.nextUrl.searchParams.get("period");
  if (!OVERVIEW_PERIODS.includes(period as OverviewPeriod)) {
    return NextResponse.json({ error: "Invalid reporting period." }, { status: 400 });
  }

  return NextResponse.json(await getOverviewExpenses(period as OverviewPeriod), {
    headers: { "Cache-Control": "private, max-age=15" },
  });
}

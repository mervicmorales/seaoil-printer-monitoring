import { NextResponse } from "next/server";
import { authorizeAgentManagementApi } from "@/lib/agent-management-auth";
import { getMonitoringAgentDetail } from "@/lib/agent-management-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await authorizeAgentManagementApi();
    if (denied) return denied;

    const rawId = (await params).id;
    const id = Number(rawId);
    if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== rawId) {
      return NextResponse.json(
        { success: false, message: "Invalid monitoring agent ID" },
        { status: 400 },
      );
    }

    const agent = await getMonitoringAgentDetail(id);
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Monitoring agent not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { success: true, generatedAt: new Date().toISOString(), agent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Agent management detail failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to load monitoring agent" },
      { status: 500 },
    );
  }
}

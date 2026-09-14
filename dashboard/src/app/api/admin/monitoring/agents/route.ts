import { NextResponse } from "next/server";
import { authorizeAgentManagementApi } from "@/lib/agent-management-auth";
import { getMonitoringAgentSummaries } from "@/lib/agent-management-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const denied = await authorizeAgentManagementApi();
    if (denied) return denied;

    const agents = await getMonitoringAgentSummaries();
    return NextResponse.json(
      {
        success: true,
        generatedAt: new Date().toISOString(),
        agents,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Agent management list failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to load monitoring agents" },
      { status: 500 },
    );
  }
}

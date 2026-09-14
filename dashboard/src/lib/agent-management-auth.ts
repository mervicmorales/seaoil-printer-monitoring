import "server-only";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { agentManagementAuthorizationStatus } from "@/lib/agent-management";
import { getModuleAccessMap } from "@/lib/server-utils";

export async function authorizeAgentManagementApi() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const access = await getModuleAccessMap(session.id, session.role);
  if (agentManagementAuthorizationStatus(session, access.monitoring_alerts) === 403) {
    return NextResponse.json(
      { success: false, message: "Forbidden" },
      { status: 403 },
    );
  }

  return null;
}

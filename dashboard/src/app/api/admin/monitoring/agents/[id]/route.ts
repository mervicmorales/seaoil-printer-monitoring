import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { monitoringAgents } from "@/db/schema";
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

type AgentDependencyRow = {
  id: number;
  name: string;
  assigned_printers: number;
  permissions: number;
  access_requests: number;
  readings: number;
  current_statuses: number;
  alerts: number;
  print_commands: number;
};

export async function DELETE(
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

    const result = await db.transaction(async (tx) => {
      const dependencyResult = await tx.execute<AgentDependencyRow>(sql`
        select
          agent.id,
          agent.name,
          (select count(*)::int from printer_monitoring_assignments where agent_id = agent.id) as assigned_printers,
          (select count(*)::int from user_printer_permissions where agent_id = agent.id) as permissions,
          (select count(*)::int from printer_access_requests where agent_id = agent.id) as access_requests,
          (select count(*)::int from printer_monitoring_readings where agent_id = agent.id) as readings,
          (select count(*)::int from printer_current_status where agent_id = agent.id) as current_statuses,
          (select count(*)::int from printer_alerts where agent_id = agent.id) as alerts,
          (select count(*)::int from print_ops_commands where agent_id = agent.id) as print_commands
        from monitoring_agents agent
        where agent.id = ${id}
        for update
      `);
      const agent = dependencyResult.rows[0];
      if (!agent) return { status: "not-found" as const };

      const dependencyCount =
        agent.assigned_printers +
        agent.permissions +
        agent.access_requests +
        agent.readings +
        agent.current_statuses +
        agent.alerts +
        agent.print_commands;
      if (dependencyCount > 0) {
        return { status: "in-use" as const, name: agent.name };
      }

      const [deleted] = await tx
        .delete(monitoringAgents)
        .where(eq(monitoringAgents.id, id))
        .returning({ id: monitoringAgents.id, name: monitoringAgents.name });
      return deleted
        ? { status: "deleted" as const, agent: deleted }
        : { status: "not-found" as const };
    });

    if (result.status === "not-found") {
      return NextResponse.json(
        { success: false, message: "Monitoring agent not found" },
        { status: 404 },
      );
    }
    if (result.status === "in-use") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete ${result.name}. Only unused agents without assigned printers or monitoring history can be deleted.`,
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: true, message: `${result.agent.name} was deleted.` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const databaseCode = typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;
    if (databaseCode === "23503") {
      return NextResponse.json(
        {
          success: false,
          message: "This monitoring agent is still referenced by operational data and cannot be deleted.",
        },
        { status: 409 },
      );
    }
    console.error(
      "Monitoring agent deletion failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to delete monitoring agent" },
      { status: 500 },
    );
  }
}

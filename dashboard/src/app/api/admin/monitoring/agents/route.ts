import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, monitoringAgentLocations, monitoringAgents } from "@/db/schema";
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

export async function POST(request: Request) {
  try {
    const denied = await authorizeAgentManagementApi();
    if (denied) return denied;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const officeId = typeof body === "object" && body !== null && "officeId" in body
      ? Number(body.officeId)
      : Number.NaN;
    if (!Number.isSafeInteger(officeId) || officeId <= 0) {
      return NextResponse.json(
        { success: false, message: "Select a valid office" },
        { status: 400 },
      );
    }

    const token = `sea_${crypto.randomBytes(32).toString("base64url")}`;
    const tokenHash = await bcrypt.hash(token, 12);
    const credentials = await db.transaction(async (tx) => {
      const [office] = await tx
        .select({ id: locations.id, name: locations.name })
        .from(locations)
        .where(and(eq(locations.id, officeId), eq(locations.status, "active")))
        .limit(1);
      if (!office) return null;

      const [officeAgentCount] = await tx
        .select({ value: count() })
        .from(monitoringAgents)
        .where(eq(monitoringAgents.locationId, office.id));
      const sequence = Number(officeAgentCount?.value ?? 0) + 1;
      const agentName = `${office.name} Agent${sequence > 1 ? ` ${sequence}` : ""}`;
      const keyBase = slugifyAgentKey(office.name).slice(0, 80);
      const agentKey = `${keyBase}-${crypto.randomBytes(6).toString("hex")}`;

      const [agent] = await tx
        .insert(monitoringAgents)
        .values({
          agentKey,
          name: agentName,
          locationId: office.id,
          status: "inactive",
          tokenHash,
          tokenCreatedAt: new Date(),
          lastSeen: null,
        })
        .returning({ id: monitoringAgents.id });

      await tx.insert(monitoringAgentLocations).values({
        agentId: agent.id,
        locationId: office.id,
      });

      return {
        agentId: agent.id,
        agentKey,
        token,
        agentName,
        officeName: office.name,
      };
    });

    if (!credentials) {
      return NextResponse.json(
        { success: false, message: "The selected office no longer exists" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${credentials.agentName} is awaiting installation.`,
        credentials,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    console.error(
      "Monitoring agent credential generation failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to generate monitoring agent credentials" },
      { status: 500 },
    );
  }
}

function slugifyAgentKey(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "office-agent";
}

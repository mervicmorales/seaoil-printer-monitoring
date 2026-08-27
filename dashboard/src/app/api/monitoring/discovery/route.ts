import { isIP } from "net";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { printerDiscoveryScans } from "@/db/schema";
import {
  authenticateMonitoringAgent,
  monitoringAgentKeySchema,
} from "@/lib/monitoring";

export const dynamic = "force-dynamic";

const discoveredPrinterSchema = z.object({
  ip: z.string().trim().refine((value) => isIP(value) === 4, "Invalid IPv4 address"),
  description: z.string().trim().max(1_000).default(""),
  serialNumber: z.string().trim().max(255).nullable().default(null),
  brand: z.string().trim().max(255).nullable().default(null),
  model: z.string().trim().max(255).nullable().default(null),
});

const completionSchema = z.object({
  jobId: z.number().int().positive(),
  results: z.array(discoveredPrinterSchema).max(1_024).optional(),
  error: z.string().trim().max(2_000).optional(),
}).refine((value) => value.results !== undefined || value.error !== undefined, {
  message: "Results or an error is required",
});

export async function GET(request: Request) {
  const authentication = await authenticate(request);
  if (authentication.status === "unauthorized") return unauthorized();

  const agentId = authentication.principal.id;
  await db.execute(sql`
    update printer_discovery_scans
    set status = 'queued', started_at = null
    where agent_id = ${agentId}
      and status = 'running'
      and started_at < now() - interval '10 minutes'
  `);

  const claimed = await db.execute<{ id: number; subnet: string }>(sql`
    update printer_discovery_scans
    set status = 'running', started_at = now(), error_message = null
    where id = (
      select id
      from printer_discovery_scans
      where agent_id = ${agentId} and status = 'queued'
      order by requested_at, id
      for update skip locked
      limit 1
    )
    returning id, subnet
  `);

  return NextResponse.json(
    { success: true, job: claimed.rows[0] ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authentication = await authenticate(request);
  if (authentication.status === "unauthorized") return unauthorized();

  const parsed = completionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid discovery result" }, { status: 400 });
  }

  const failed = Boolean(parsed.data.error);
  const updated = await db
    .update(printerDiscoveryScans)
    .set({
      status: failed ? "failed" : "completed",
      results: failed ? [] : parsed.data.results ?? [],
      errorMessage: parsed.data.error ?? null,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(printerDiscoveryScans.id, parsed.data.jobId),
        eq(printerDiscoveryScans.agentId, authentication.principal.id),
        eq(printerDiscoveryScans.status, "running"),
      ),
    )
    .returning({ id: printerDiscoveryScans.id });

  if (updated.length === 0) {
    return NextResponse.json({ success: false, message: "Discovery job is not active" }, { status: 409 });
  }
  return NextResponse.json({ success: true });
}

async function authenticate(request: Request) {
  const parsedKey = monitoringAgentKeySchema.safeParse(request.headers.get("x-seaoil-agent-key"));
  if (!parsedKey.success) return { status: "unauthorized" } as const;
  try {
    return await authenticateMonitoringAgent(
      request.headers.get("authorization"),
      parsedKey.data,
    );
  } catch {
    return { status: "unauthorized" } as const;
  }
}

function unauthorized() {
  return NextResponse.json({ success: false, message: "Unauthorized monitoring agent" }, { status: 401 });
}

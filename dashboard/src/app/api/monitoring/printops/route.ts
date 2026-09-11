import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { printOpsCommands } from "@/db/schema";
import {
  authenticateMonitoringAgent,
  monitoringAgentKeySchema,
} from "@/lib/monitoring";
import { claimPrintFile } from "@/lib/printops-file-transfer";
import { purgeExpiredScanFiles } from "@/lib/scan-retention";
import { detectScanFileType, replaceScanFileExtension } from "@/lib/scan-file-type";

export const dynamic = "force-dynamic";

const AUTOMATIC_SYNC_INTERVAL_MINUTES = 2;
const AUTOMATIC_SYNC_CHECK_INTERVAL_MS = 30_000;
const SYNC_HISTORY_LIMIT_PER_AGENT = 12;
const lastAutomaticSyncCheck = new Map<number, number>();

const outputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  data: z.string().max(32 * 1024 * 1024),
});

const completionSchema = z
  .object({
    commandId: z.number().int().positive(),
    result: z.record(z.string(), z.unknown()).optional(),
    output: outputSchema.optional(),
    error: z.string().trim().max(2_000).optional(),
  })
  .refine(
    (value) => value.result !== undefined || value.output !== undefined || value.error !== undefined,
    { message: "A result, output, or error is required" },
  );

export async function GET(request: Request) {
  const authentication = await authenticate(request);
  if (authentication.status === "unauthorized") return unauthorized();

  const agentId = authentication.principal.id;
  await purgeExpiredScanFiles();
  await ensureAutomaticSync(agentId);
  await db.execute(sql`
    update print_ops_commands
    set status = 'failed', completed_at = now(),
        input_file_data = null,
        error_message = 'The agent did not finish this command within 10 minutes.'
    where agent_id = ${agentId}
      and status = 'running'
      and started_at < now() - interval '10 minutes'
  `);

  const claimed = await db.execute<{
    id: number;
    type: string;
    payload: Record<string, unknown>;
    input_file_name: string | null;
    input_mime_type: string | null;
    input_file_data: string | null;
  }>(sql`
    update print_ops_commands
    set status = 'running', started_at = now(), error_message = null
    where id = (
      select id
      from print_ops_commands
      where agent_id = ${agentId} and status = 'queued'
      order by case when type = 'sync' then 1 else 0 end, requested_at, id
      for update skip locked
      limit 1
    )
    returning id, type, payload, input_file_name, input_mime_type, input_file_data
  `);

  const command = claimed.rows[0];
  let inputFileData: string | null = null;
  if (command?.type === "print") {
    inputFileData = command.input_file_data;
    if (!inputFileData) {
      const transferKey =
        typeof command.payload.transferKey === "string"
          ? command.payload.transferKey
          : "";
      const legacyFileData = transferKey ? claimPrintFile(transferKey) : null;
      inputFileData = legacyFileData?.toString("base64") ?? null;
    }
    if (!inputFileData) {
      await db
        .update(printOpsCommands)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: "The print file is unavailable. Please submit the print request again.",
        })
        .where(eq(printOpsCommands.id, command.id));
      return NextResponse.json(
        { success: true, command: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return NextResponse.json(
    {
      success: true,
      command: command
        ? {
            id: command.id,
            type: command.type,
            payload: command.payload,
            inputFileName: command.input_file_name,
            inputMimeType: command.input_mime_type,
            inputFileData,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const authentication = await authenticate(request);
  if (authentication.status === "unauthorized") return unauthorized();

  const parsed = completionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Invalid PrintOps command result" },
      { status: 400 },
    );
  }

  const failed = Boolean(parsed.data.error);
  const output = normalizeScanOutput(parsed.data.output);
  const updated = await db
    .update(printOpsCommands)
    .set({
      status: failed ? "failed" : "completed",
      result: parsed.data.result ?? {},
      outputFileName: output?.name ?? null,
      outputMimeType: output?.mimeType ?? null,
      outputFileData: output?.data ?? null,
      inputFileData: null,
      errorMessage: parsed.data.error ?? null,
      completedAt: new Date(),
    })
    .where(
      and(
        eq(printOpsCommands.id, parsed.data.commandId),
        eq(printOpsCommands.agentId, authentication.principal.id),
        eq(printOpsCommands.status, "running"),
      ),
    )
    .returning({
      id: printOpsCommands.id,
      type: printOpsCommands.type,
      agentId: printOpsCommands.agentId,
    });

  if (updated.length === 0) {
    return NextResponse.json(
      { success: false, message: "PrintOps command is not active" },
      { status: 409 },
    );
  }
  if (updated[0].type === "sync") {
    await pruneAgentSyncHistory(updated[0].agentId).catch(() => {
      console.error("Could not prune old automatic PrintOps sync records.");
    });
  }
  return NextResponse.json({ success: true });
}

function normalizeScanOutput(output: z.infer<typeof outputSchema> | undefined) {
  if (!output) return null;
  const fileType = detectScanFileType(Buffer.from(output.data, "base64"));
  if (!fileType) return output;
  return {
    ...output,
    name: replaceScanFileExtension(output.name, fileType.extension),
    mimeType: fileType.mimeType,
  };
}

async function ensureAutomaticSync(agentId: number) {
  const now = Date.now();
  if (now - (lastAutomaticSyncCheck.get(agentId) ?? 0) < AUTOMATIC_SYNC_CHECK_INTERVAL_MS) return;
  lastAutomaticSyncCheck.set(agentId, now);

  await db.execute(sql`
    insert into print_ops_commands (agent_id, type, status, payload, requested_at)
    select ${agentId}, 'sync', 'queued', '{}'::jsonb, now()
    where not exists (
      select 1
      from print_ops_commands
      where agent_id = ${agentId}
        and type = 'sync'
        and (
          status in ('queued', 'running')
          or (
            status = 'completed'
            and completed_at >= now() - (${AUTOMATIC_SYNC_INTERVAL_MINUTES} * interval '1 minute')
          )
        )
    )
  `);
}

async function pruneAgentSyncHistory(agentId: number) {
  await db.execute(sql`
    delete from print_ops_commands
    where id in (
      select id
      from print_ops_commands
      where agent_id = ${agentId}
        and type = 'sync'
        and status in ('completed', 'failed')
      order by completed_at desc nulls last, id desc
      offset ${SYNC_HISTORY_LIMIT_PER_AGENT}
    )
  `);
}

async function authenticate(request: Request) {
  const parsedKey = monitoringAgentKeySchema.safeParse(
    request.headers.get("x-seaoil-agent-key"),
  );
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
  return NextResponse.json(
    { success: false, message: "Unauthorized monitoring agent" },
    { status: 401 },
  );
}

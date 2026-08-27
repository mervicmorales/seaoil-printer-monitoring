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

export const dynamic = "force-dynamic";

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
  }>(sql`
    update print_ops_commands
    set status = 'running', started_at = now(), error_message = null
    where id = (
      select id
      from print_ops_commands
      where agent_id = ${agentId} and status = 'queued'
      order by requested_at, id
      for update skip locked
      limit 1
    )
    returning id, type, payload, input_file_name, input_mime_type
  `);

  const command = claimed.rows[0];
  let inputFileData: string | null = null;
  if (command?.type === "print") {
    const transferKey =
      typeof command.payload.transferKey === "string"
        ? command.payload.transferKey
        : "";
    const fileData = transferKey ? claimPrintFile(transferKey) : null;
    if (!fileData) {
      await db
        .update(printOpsCommands)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage: "The temporary print file expired before the agent retrieved it.",
        })
        .where(eq(printOpsCommands.id, command.id));
      return NextResponse.json(
        { success: true, command: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    inputFileData = fileData.toString("base64");
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
  const updated = await db
    .update(printOpsCommands)
    .set({
      status: failed ? "failed" : "completed",
      result: parsed.data.result ?? {},
      outputFileName: parsed.data.output?.name ?? null,
      outputMimeType: parsed.data.output?.mimeType ?? null,
      outputFileData: parsed.data.output?.data ?? null,
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
    .returning({ id: printOpsCommands.id });

  if (updated.length === 0) {
    return NextResponse.json(
      { success: false, message: "PrintOps command is not active" },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true });
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

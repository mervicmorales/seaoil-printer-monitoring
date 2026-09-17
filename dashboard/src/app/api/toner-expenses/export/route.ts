import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { getSession } from "@/lib/auth";
import {
  buildTonerExpenseCsv,
  parseTonerExpenseExportFilters,
  tonerExpenseExportFileName,
  tonerExpenseExportPreview,
  type TonerExpenseExportFormat,
} from "@/lib/toner-expense-export";
import { getTonerExpenseExportReport } from "@/lib/toner-expense-report";
import { buildTonerExpenseWorkbook } from "@/lib/toner-expense-workbook";
import { getModuleAccessMap } from "@/lib/server-utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("You must sign in to export toner expenses.", 401);

  const access = await getModuleAccessMap(session.id, session.role);
  if (session.role === "employee" || !access.toner_expenses) {
    return jsonError("You do not have permission to export toner expenses.", 403);
  }

  const { searchParams } = request.nextUrl;
  const { filters, errors } = parseTonerExpenseExportFilters(searchParams);
  if (errors.length) return jsonError(errors.join(" "), 400);

  const format = searchParams.get("format") ?? "preview";
  if (!isSupportedFormat(format)) {
    return jsonError("Export format must be preview, xlsx, or csv.", 400);
  }

  try {
    const report = await getTonerExpenseExportReport(filters);
    if (report.exceededLimit) {
      return jsonError(
        "This selection exceeds the 50,000-record export limit. Narrow the date range or filters and try again.",
        413,
      );
    }

    if (format === "preview") {
      return NextResponse.json({
        success: true,
        preview: tonerExpenseExportPreview(report.summary),
        filterLabels: report.filterLabels,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const generatedAt = new Date();
    const fileName = tonerExpenseExportFileName(format, generatedAt);
    const body = format === "csv"
      ? buildTonerExpenseCsv(report.rows)
      : new Uint8Array(await buildTonerExpenseWorkbook(report, session, generatedAt));

    await db.insert(auditLogs).values({
      actorUserId: session.id,
      action: "toner_expenses.exported",
      targetType: "toner_expenses",
      metadata: {
        format,
        fileName,
        rowCount: report.summary.requestLines,
        totalUnits: report.summary.totalUnits,
        totalExpenseCents: report.summary.totalExpenseCents,
        pricedRequestLines: report.summary.pricedRequestLines,
        filters: report.filters,
        filterLabels: report.filterLabels,
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": format === "csv"
          ? "text/csv; charset=utf-8"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Toner expense export failed", error instanceof Error ? error.name : "UnknownError");
    return jsonError("The toner expense export could not be generated. Please try again.", 500);
  }
}

function isSupportedFormat(
  format: string,
): format is "preview" | TonerExpenseExportFormat {
  return format === "preview" || format === "xlsx" || format === "csv";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { requireApiAuth } from "@/src/server/auth/session";
import { buildExportWhere, CSV_COLUMNS, findExportBatch, leadToCsvRow } from "@/src/server/services/export.service";
import { logger } from "@/src/server/utils/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  const campaignId = request.nextUrl.searchParams.get("campaignId");
  const minScoreRaw = request.nextUrl.searchParams.get("minScore");
  const hasEmailRaw = request.nextUrl.searchParams.get("hasEmail");
  const status = request.nextUrl.searchParams.get("status");
  const where = buildExportWhere({
    campaignId,
    minScore: minScoreRaw ? Number(minScoreRaw) : null,
    hasEmail: hasEmailRaw ? hasEmailRaw === "true" : null,
    status
  });

  let count = 0;
  let cursorId: string | undefined;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      if (count === 0) {
        controller.enqueue(encoder.encode(`${Papa.unparse({ fields: CSV_COLUMNS, data: [] }, { quotes: true })}\n`));
      }
      if (count >= 50_000) {
        controller.close();
        logger.info("export_created", { count, campaignId, capped: true });
        return;
      }
      const batch = await findExportBatch(where, 500, cursorId);
      if (!batch.length) {
        controller.close();
        logger.info("export_created", { count, campaignId });
        return;
      }
      cursorId = batch[batch.length - 1]?.id;
      count += batch.length;
      const csv = Papa.unparse(batch.map(leadToCsvRow), { quotes: true, header: false });
      controller.enqueue(encoder.encode(`${csv}\n`));
    }
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="openlead-scout-${Date.now()}.csv`,
      "cache-control": "no-store"
    }
  });
}

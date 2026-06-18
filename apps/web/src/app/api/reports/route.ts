import {
  buildEcgReportDocument,
  createEcgReportPdf,
  parseEcgReportRequest,
} from "@/lib/ecg-report";
import { reportDirectory } from "@/lib/report-storage";
import {
  ServerConfigValueError,
  shouldInlineReportPdf,
} from "@ecgviewer/config";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const maxReportPayloadBytes = 8_000_000;

export const runtime = "nodejs";

interface ReportCreatedResponse {
  readonly reportId: string;
  readonly viewUrl: string;
  readonly downloadUrl: string;
  readonly pdfBase64?: string;
  readonly pdfFilename?: string;
}

interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ReportCreatedResponse | ApiErrorBody>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxReportPayloadBytes) {
    return errorResponse(
      "REPORT_TOO_LARGE",
      "ECG 報告內容過大，請縮短醫師判讀說明後再試一次。",
      413,
    );
  }

  let reportRequest: ReturnType<typeof parseEcgReportRequest>;
  try {
    const body: unknown = await request.json();
    reportRequest = parseEcgReportRequest(body);
  } catch {
    return errorResponse(
      "INVALID_REPORT_REQUEST",
      "ECG 報告內容格式不正確，無法產製 PDF。",
      400,
    );
  }

  try {
    const report = buildEcgReportDocument(reportRequest);
    const pdf = createEcgReportPdf(report);
    const reportId = randomUUID();
    const pdfFilename = `ecg-report-${reportId}.pdf`;

    if (shouldInlineReportPdf(process.env)) {
      return NextResponse.json({
        reportId,
        viewUrl: `/api/reports/${reportId}`,
        downloadUrl: `/api/reports/${reportId}?download=1`,
        pdfBase64: Buffer.from(pdf).toString("base64"),
        pdfFilename,
      });
    }

    const directory = reportDirectory();
    const filePath = path.join(directory, `${reportId}.pdf`);

    await mkdir(directory, { recursive: true });
    await writeFile(filePath, pdf);

    return NextResponse.json({
      reportId,
      viewUrl: `/api/reports/${reportId}`,
      downloadUrl: `/api/reports/${reportId}?download=1`,
    });
  } catch (error) {
    if (error instanceof ServerConfigValueError) {
      return errorResponse(
        "REPORT_STORAGE_CONFIG_INVALID",
        "ECG 報告儲存設定不正確，請聯絡系統管理員。",
        500,
      );
    }

    console.error("ECG report generation failed", {
      code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    });
    return errorResponse(
      "REPORT_GENERATION_FAILED",
      "ECG 報告產製暫時失敗，請稍後再試。",
      500,
    );
  }
}

function errorResponse(
  error: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, message }, { status });
}

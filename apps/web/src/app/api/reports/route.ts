import {
  buildEcgReportDocument,
  createEcgReportPdf,
  parseEcgReportRequest,
} from "@/lib/ecg-report";
import { reportDirectory } from "@/lib/report-storage";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const maxReportPayloadBytes = 8_000_000;

interface ReportCreatedResponse {
  readonly reportId: string;
  readonly viewUrl: string;
  readonly downloadUrl: string;
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

  try {
    const body: unknown = await request.json();
    const reportRequest = parseEcgReportRequest(body);
    const report = buildEcgReportDocument(reportRequest);
    const pdf = createEcgReportPdf(report);
    const reportId = randomUUID();
    const directory = reportDirectory();
    const filePath = path.join(directory, `${reportId}.pdf`);

    await mkdir(directory, { recursive: true });
    await writeFile(filePath, pdf);

    return NextResponse.json({
      reportId,
      viewUrl: `/api/reports/${reportId}`,
      downloadUrl: `/api/reports/${reportId}?download=1`,
    });
  } catch {
    return errorResponse(
      "INVALID_REPORT_REQUEST",
      "ECG 報告內容格式不正確，無法產製 PDF。",
      400,
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

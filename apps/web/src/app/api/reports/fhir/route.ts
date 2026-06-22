import {
  buildReportTransactionBundle,
  deriveReportTransactionIds,
  ReportTransactionError,
} from "@/lib/fhir-report-transaction";
import { getBackendServiceAccessToken } from "@/lib/fhir-auth";
import { TokenRequestError } from "@/lib/oauth";
import { reportDirectory } from "@/lib/report-storage";
import { ServerConfigError, readServerConfig } from "@ecgviewer/config";
import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const idPattern = /^[A-Za-z0-9\-._]{1,128}$/;
const reportIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxWritebackPayloadBytes = 12_000_000;

export const runtime = "nodejs";

interface FhirReportWritebackResponse {
  readonly diagnosticReportId: string;
  readonly resultObservationId: string;
  readonly fhirStatus: number;
}

interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

interface WritebackRequestBody {
  readonly patientId: string;
  readonly observationId: string;
  readonly effectiveDateTime?: string;
  readonly reportId?: string;
  readonly pdfBase64?: string;
  readonly pdfFilename?: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<FhirReportWritebackResponse | ApiErrorBody>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxWritebackPayloadBytes) {
    return errorResponse(
      "REPORT_WRITEBACK_TOO_LARGE",
      "PDF 報告內容過大，無法寫回 FHIR server。",
      413,
    );
  }

  let body: WritebackRequestBody;
  try {
    body = parseWritebackRequest((await request.json()) as unknown);
  } catch {
    return errorResponse(
      "INVALID_REPORT_WRITEBACK_REQUEST",
      "FHIR 報告寫回請求格式不正確。",
      400,
    );
  }

  if (!idPattern.test(body.patientId) || !idPattern.test(body.observationId)) {
    return errorResponse(
      "INVALID_REQUEST",
      "Patient id 或 Observation id 格式不正確。",
      400,
    );
  }
  if (body.reportId && !reportIdPattern.test(body.reportId)) {
    return errorResponse("INVALID_REPORT_ID", "Report id 格式不正確。", 400);
  }

  let ids: ReturnType<typeof deriveReportTransactionIds>;
  try {
    ids = deriveReportTransactionIds(body.observationId);
  } catch (error) {
    if (error instanceof ReportTransactionError) {
      return errorResponse(error.code, "Observation id 不符合報告寫回規則。", 422);
    }
    throw error;
  }

  try {
    const pdfBase64 = await resolvePdfBase64(body);
    const issued = new Date().toISOString();
    const bundle = buildReportTransactionBundle({
      patientId: body.patientId,
      sourceObservationId: body.observationId,
      issued,
      effectiveDateTime: body.effectiveDateTime ?? issued,
      pdfBase64,
    });

    const config = readServerConfig(process.env);
    const accessToken = await getBackendServiceAccessToken(config);
    const response = await fetch(config.fhirBaseUrl, {
      body: JSON.stringify(bundle),
      headers: {
        accept: "application/fhir+json",
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/fhir+json",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return errorResponse(
        "FHIR_REPORT_WRITEBACK_FAILED",
        `FHIR 報告寫回失敗，FHIR server 回應狀態 ${response.status}。`,
        response.status,
      );
    }

    return NextResponse.json({
      diagnosticReportId: ids.diagnosticReportId,
      resultObservationId: ids.resultObservationId,
      fhirStatus: response.status,
    });
  } catch (error) {
    if (error instanceof ServerConfigError) {
      return errorResponse(
        "SERVER_CONFIG_MISSING",
        `伺服器缺少必要設定：${error.variableName}。`,
        503,
      );
    }
    if (error instanceof TokenRequestError) {
      return errorResponse(
        "FHIR_TOKEN_REQUEST_FAILED",
        `FHIR OAuth token 取得失敗，token endpoint 回應狀態 ${error.status}。`,
        502,
      );
    }
    if (error instanceof PdfResolutionError) {
      return errorResponse(error.code, error.message, error.status);
    }
    return errorResponse(
      "UNEXPECTED_SERVER_ERROR",
      "伺服器寫回 ECG 報告時發生未預期錯誤。",
      500,
    );
  }
}

function parseWritebackRequest(body: unknown): WritebackRequestBody {
  if (!isRecord(body)) throw new Error("Invalid body");
  if (
    typeof body.patientId !== "string" ||
    typeof body.observationId !== "string"
  ) {
    throw new Error("Missing ids");
  }

  return {
    patientId: body.patientId,
    observationId: body.observationId,
    ...(typeof body.effectiveDateTime === "string"
      ? { effectiveDateTime: body.effectiveDateTime }
      : {}),
    ...(typeof body.reportId === "string" ? { reportId: body.reportId } : {}),
    ...(typeof body.pdfBase64 === "string"
      ? { pdfBase64: body.pdfBase64 }
      : {}),
    ...(typeof body.pdfFilename === "string"
      ? { pdfFilename: body.pdfFilename }
      : {}),
  };
}

async function resolvePdfBase64(body: WritebackRequestBody): Promise<string> {
  if (body.pdfBase64) return validatePdfBase64(body.pdfBase64);
  if (!body.reportId) {
    throw new PdfResolutionError(
      "REPORT_PDF_MISSING",
      "找不到可寫回的 PDF 報告內容。",
      400,
    );
  }

  try {
    const pdf = await readFile(
      path.join(reportDirectory(), `${body.reportId}.pdf`),
    );
    return pdf.toString("base64");
  } catch {
    throw new PdfResolutionError(
      "REPORT_PDF_NOT_FOUND",
      "找不到可寫回的 PDF 報告檔案。",
      404,
    );
  }
}

function validatePdfBase64(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new PdfResolutionError(
      "REPORT_PDF_INVALID",
      "PDF 報告內容格式不正確。",
      400,
    );
  }

  const pdf = Buffer.from(normalized, "base64");
  if (pdf.subarray(0, 5).toString() !== "%PDF-") {
    throw new PdfResolutionError(
      "REPORT_PDF_INVALID",
      "PDF 報告內容格式不正確。",
      400,
    );
  }
  return normalized;
}

function errorResponse(
  error: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, message }, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class PdfResolutionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PdfResolutionError";
  }
}

import { reportDirectory } from "@/lib/report-storage";
import { readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const reportIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

export async function GET(
  request: NextRequest,
  context: { readonly params: Promise<{ readonly reportId: string }> },
): Promise<NextResponse<Uint8Array | ApiErrorBody>> {
  const { reportId } = await context.params;
  if (!reportIdPattern.test(reportId)) {
    return errorResponse("INVALID_REPORT_ID", "ECG 報告 id 格式不正確。", 400);
  }

  try {
    const pdf = await readFile(path.join(reportDirectory(), `${reportId}.pdf`));
    const disposition = request.nextUrl.searchParams.has("download")
      ? "attachment"
      : "inline";

    return new NextResponse(pdf, {
      headers: {
        "content-disposition": `${disposition}; filename="ecg-report-${reportId}.pdf"`,
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return errorResponse("REPORT_NOT_FOUND", "找不到指定的 ECG 報告。", 404);
  }
}

function errorResponse(
  error: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, message }, { status });
}

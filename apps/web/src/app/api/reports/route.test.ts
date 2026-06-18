import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const writeFile = vi.fn();

vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile,
}));

const validRequest = {
  patient: [{ label: "Patient id", value: "patient-1" }],
  observation: [{ label: "Observation id", value: "observation-1" }],
  metrics: [{ label: "Duration", value: "10.00 s" }],
  reviewSupport: [],
  graph: [{ label: "Displayed leads", value: "I, II" }],
  graphImages: [],
  physicianInterpretation: "Non-diagnostic review note.",
  generatedAt: "2026-06-15T00:00:00.000Z",
};

describe("POST /api/reports", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    writeFile.mockReset();
  });

  it("returns an inline PDF payload on Vercel without writing to project storage", async () => {
    vi.stubEnv("VERCEL", "1");
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as {
      readonly pdfBase64?: string;
      readonly reportId?: string;
    };

    expect(response.status).toBe(200);
    expect(body.reportId).toBeTypeOf("string");
    expect(body.pdfBase64).toBeTypeOf("string");
    expect(
      Buffer.from(body.pdfBase64 ?? "", "base64")
        .subarray(0, 8)
        .toString(),
    ).toBe("%PDF-1.4");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("supports explicit inline storage outside Vercel", async () => {
    vi.stubEnv("REPORT_PDF_STORAGE", "inline");
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as {
      readonly pdfBase64?: string;
    };

    expect(response.status).toBe(200);
    expect(body.pdfBase64).toBeTypeOf("string");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("allows filesystem storage to be forced on Vercel", async () => {
    vi.stubEnv("REPORT_PDF_STORAGE", "filesystem");
    vi.stubEnv("VERCEL", "1");
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as {
      readonly pdfBase64?: string;
      readonly viewUrl?: string;
    };

    expect(response.status).toBe(200);
    expect(body.pdfBase64).toBeUndefined();
    expect(body.viewUrl).toMatch(/^\/api\/reports\//);
    expect(writeFile).toHaveBeenCalledOnce();
  });

  it("returns a server error for invalid storage config", async () => {
    vi.stubEnv("REPORT_PDF_STORAGE", "database");
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as { readonly error?: string };

    expect(response.status).toBe(500);
    expect(body.error).toBe("REPORT_STORAGE_CONFIG_INVALID");
  });

  it("keeps invalid report payloads as client errors", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({ ...validRequest, patient: "bad" }),
    );
    const body = (await response.json()) as { readonly error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_REPORT_REQUEST");
  });
});

function jsonRequest(body: unknown): NextRequest {
  return new Request("https://example.test/api/reports", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as unknown as NextRequest;
}

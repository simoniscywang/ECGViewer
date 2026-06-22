import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getBackendServiceAccessToken = vi.fn();

vi.mock("@/lib/fhir-auth", () => ({
  getBackendServiceAccessToken,
}));

const validRequest = {
  patientId: "0322400A12345680500000000000000",
  observationId: "0322226A12345680520260605152117-1",
  effectiveDateTime: "2026-06-05T15:21:17+08:00",
  reportId: "00000000-0000-4000-8000-000000000000",
  pdfBase64: Buffer.from("%PDF-1.4\n").toString("base64"),
  pdfFilename: "ecg-report.pdf",
};

describe("POST /api/reports/fhir", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    getBackendServiceAccessToken.mockReset();
  });

  it("writes DiagnosticReport and result Observation through a FHIR transaction Bundle", async () => {
    vi.stubEnv("FHIR_BASE_URL", "https://fhir.example.test/fhir");
    vi.stubEnv("FHIR_TOKEN_URL", "https://auth.example.test/token");
    vi.stubEnv("FHIR_CLIENT_ID", "client");
    getBackendServiceAccessToken.mockResolvedValue("access-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as {
      readonly diagnosticReportId?: string;
      readonly resultObservationId?: string;
    };
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const bundle = JSON.parse(String(init?.body)) as {
      readonly resourceType?: string;
      readonly type?: string;
      readonly entry?: readonly {
        readonly resource?: { readonly resourceType?: string };
        readonly request?: { readonly method?: string; readonly url?: string };
      }[];
    };

    expect(response.status).toBe(200);
    expect(body).toEqual({
      diagnosticReportId: "0320900-1A12345680520260605152117-1",
      resultObservationId: "0322203-1A12345680520260605152117-1",
      fhirStatus: 200,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://fhir.example.test/fhir",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer access-token",
          "content-type": "application/fhir+json",
        }) as HeadersInit,
      }),
    );
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("transaction");
    expect(bundle.entry?.map((entry) => entry.request)).toEqual([
      {
        method: "PUT",
        url: "Observation/0322203-1A12345680520260605152117-1",
      },
      {
        method: "PUT",
        url: "DiagnosticReport/0320900-1A12345680520260605152117-1",
      },
    ]);
  });

  it("rejects source Observation ids that do not match the configured prefix rule", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      jsonRequest({ ...validRequest, observationId: "observation-1" }),
    );
    const body = (await response.json()) as { readonly error?: string };

    expect(response.status).toBe(422);
    expect(body.error).toBe("UNSUPPORTED_OBSERVATION_ID_PREFIX");
  });

  it("returns a safe upstream error when the FHIR transaction fails", async () => {
    vi.stubEnv("FHIR_BASE_URL", "https://fhir.example.test/fhir");
    vi.stubEnv("FHIR_TOKEN_URL", "https://auth.example.test/token");
    vi.stubEnv("FHIR_CLIENT_ID", "client");
    getBackendServiceAccessToken.mockResolvedValue("access-token");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 409 }),
    );
    const { POST } = await import("./route");

    const response = await POST(jsonRequest(validRequest));
    const body = (await response.json()) as {
      readonly error?: string;
      readonly message?: string;
    };

    expect(response.status).toBe(409);
    expect(body.error).toBe("FHIR_REPORT_WRITEBACK_FAILED");
    expect(body.message).toBe("FHIR 報告寫回失敗，FHIR server 回應狀態 409。");
  });
});

function jsonRequest(body: unknown): NextRequest {
  return new Request("https://example.test/api/reports/fhir", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  }) as unknown as NextRequest;
}

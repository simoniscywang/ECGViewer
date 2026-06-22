import {
  buildReportTransactionBundle,
  deriveReportTransactionIds,
  ReportTransactionError,
} from "./fhir-report-transaction";
import { describe, expect, it } from "vitest";

describe("FHIR report transaction bundle", () => {
  it("derives TW Core DiagnosticReport and result Observation ids from the source Observation id", () => {
    expect(
      deriveReportTransactionIds("0322226A12345680520260605152117-1"),
    ).toEqual({
      diagnosticReportId: "0320900-1A12345680520260605152117-1",
      resultObservationId: "0322203-1A12345680520260605152117-1",
    });
  });

  it("builds a transaction Bundle with PDF data in the result Observation valueString", () => {
    const bundle = buildReportTransactionBundle({
      patientId: "0322400A12345680500000000000000",
      sourceObservationId: "0322226A12345680520260605152117-1",
      issued: "2026-06-05T15:30:00+08:00",
      effectiveDateTime: "2026-06-05T15:21:17+08:00",
      pdfBase64: "JVBERi0xLjQ=",
    });

    expect(bundle).toMatchObject({
      resourceType: "Bundle",
      type: "transaction",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: "0322203-1A12345680520260605152117-1",
            subject: {
              reference: "Patient/0322400A12345680500000000000000",
            },
            effectiveDateTime: "2026-06-05T15:21:17+08:00",
            valueString: "JVBERi0xLjQ=",
          },
          request: {
            method: "PUT",
            url: "Observation/0322203-1A12345680520260605152117-1",
          },
        },
        {
          resource: {
            resourceType: "DiagnosticReport",
            id: "0320900-1A12345680520260605152117-1",
            subject: {
              reference: "Patient/0322400A12345680500000000000000",
            },
            result: [
              {
                reference:
                  "Observation/0322203-1A12345680520260605152117-1",
              },
            ],
          },
          request: {
            method: "PUT",
            url: "DiagnosticReport/0320900-1A12345680520260605152117-1",
          },
        },
      ],
    });
  });

  it("rejects unsupported source Observation id prefixes", () => {
    expect(() => deriveReportTransactionIds("obs-1")).toThrow(
      ReportTransactionError,
    );
  });
});

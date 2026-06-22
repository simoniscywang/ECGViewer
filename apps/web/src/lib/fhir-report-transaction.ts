const sourceObservationPrefix = "0322226";
const diagnosticReportPrefix = "0320900-1";
const resultObservationPrefix = "0322203-1";
const twCoreDiagnosticReportProfile =
  "https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/DiagnosticReport-twcore";
const twCoreLaboratoryResultProfile =
  "https://twcore.mohw.gov.tw/ig/twcore/StructureDefinition/Observation-laboratoryResult-twcore";

export interface ReportTransactionInput {
  readonly patientId: string;
  readonly sourceObservationId: string;
  readonly issued: string;
  readonly effectiveDateTime: string;
  readonly pdfBase64: string;
}

export interface ReportTransactionIds {
  readonly diagnosticReportId: string;
  readonly resultObservationId: string;
}

export class ReportTransactionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReportTransactionError";
  }
}

export function deriveReportTransactionIds(
  sourceObservationId: string,
): ReportTransactionIds {
  if (!sourceObservationId.startsWith(sourceObservationPrefix)) {
    throw new ReportTransactionError(
      "UNSUPPORTED_OBSERVATION_ID_PREFIX",
      "Observation id does not use the supported ECG source prefix.",
    );
  }

  const suffix = sourceObservationId.slice(sourceObservationPrefix.length);
  if (!suffix) {
    throw new ReportTransactionError(
      "INVALID_OBSERVATION_ID",
      "Observation id is missing the suffix required for report ids.",
    );
  }

  return {
    diagnosticReportId: `${diagnosticReportPrefix}${suffix}`,
    resultObservationId: `${resultObservationPrefix}${suffix}`,
  };
}

export function buildReportTransactionBundle(input: ReportTransactionInput) {
  const ids = deriveReportTransactionIds(input.sourceObservationId);
  const subject = { reference: `Patient/${input.patientId}` };
  const resultReference = `Observation/${ids.resultObservationId}`;

  const diagnosticReport = {
    resourceType: "DiagnosticReport",
    id: ids.diagnosticReportId,
    meta: {
      profile: [twCoreDiagnosticReportProfile],
    },
    status: "final",
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "11524-6",
        },
      ],
      text: "心電圖AI判讀輔助報告",
    },
    subject,
    issued: input.issued,
    result: [
      {
        reference: resultReference,
      },
    ],
  };

  const resultObservation = {
    resourceType: "Observation",
    id: ids.resultObservationId,
    meta: {
      profile: [twCoreLaboratoryResultProfile],
    },
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "exam",
          },
        ],
        text: "檢驗檢查",
      },
    ],
    code: {
      coding: [
        {
          system: "http://loinc.org",
          code: "8601-7",
        },
      ],
      text: "AI分析結果與醫生判讀結果",
    },
    subject,
    effectiveDateTime: input.effectiveDateTime,
    valueString: input.pdfBase64,
  };

  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: [
      {
        fullUrl: `urn:uuid:${ids.resultObservationId}`,
        resource: resultObservation,
        request: {
          method: "PUT",
          url: `Observation/${ids.resultObservationId}`,
        },
      },
      {
        fullUrl: `urn:uuid:${ids.diagnosticReportId}`,
        resource: diagnosticReport,
        request: {
          method: "PUT",
          url: `DiagnosticReport/${ids.diagnosticReportId}`,
        },
      },
    ],
  };
}

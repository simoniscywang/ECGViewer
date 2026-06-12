import { readServerConfig } from "@ecgviewer/config";
import { FhirEcgParseError, parseFhirEcgObservation } from "@ecgviewer/fhir";
import { getBackendServiceAccessToken } from "@/lib/fhir-auth";
import { NextRequest, NextResponse } from "next/server";

const idPattern = /^[A-Za-z0-9\-._]{1,128}$/;

interface PatientSummary {
  readonly id: string;
  readonly name: string;
  readonly gender?: string | undefined;
  readonly birthDate?: string | undefined;
  readonly identifiers: readonly string[];
}

interface ObservationSummary {
  readonly id: string;
  readonly status?: string | undefined;
  readonly code: string;
  readonly category: readonly string[];
  readonly effectiveDateTime?: string | undefined;
  readonly issued?: string | undefined;
  readonly subjectReference?: string | undefined;
}

export async function GET(request: NextRequest) {
  const patientId = request.nextUrl.searchParams.get("patientId") ?? "";
  const observationId = request.nextUrl.searchParams.get("observationId") ?? "";

  if (!idPattern.test(patientId) || !idPattern.test(observationId)) {
    return NextResponse.json({ error: "Invalid Patient id or Observation id" }, { status: 400 });
  }

  try {
    const config = readServerConfig(process.env);
    const accessToken = await getBackendServiceAccessToken(config);

    const response = await fetch(`${config.fhirBaseUrl}/Observation/${encodeURIComponent(observationId)}`, {
      headers: {
        accept: "application/fhir+json",
        authorization: `Bearer ${accessToken}`
      },
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      return NextResponse.json({ error: "FHIR Observation request failed" }, { status: response.status });
    }

    const resource: unknown = await response.json();
    const record = parseFhirEcgObservation(resource, {
      expectedPatientId: patientId,
      expectedObservationId: observationId
    });
    const patient = await fetchPatientSummary(config.fhirBaseUrl, accessToken, patientId);
    const observation = summarizeObservation(resource, observationId);

    return NextResponse.json({
      record: {
        ...record,
        leads: record.leads.map((lead) => ({
          name: lead.name,
          samples: Array.from(lead.samples)
        }))
      },
      patient,
      observation
    });
  } catch (error) {
    if (error instanceof FhirEcgParseError) {
      return NextResponse.json({ error: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Unexpected server error" }, { status: 500 });
  }
}

async function fetchPatientSummary(
  fhirBaseUrl: string,
  accessToken: string,
  patientId: string
): Promise<PatientSummary> {
  const response = await fetch(`${fhirBaseUrl}/Patient/${encodeURIComponent(patientId)}`, {
    headers: {
      accept: "application/fhir+json",
      authorization: `Bearer ${accessToken}`
    },
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`FHIR Patient request failed with status ${response.status}`);
  }

  return summarizePatient((await response.json()) as unknown, patientId);
}

function summarizePatient(resource: unknown, fallbackId: string): PatientSummary {
  if (!isRecord(resource) || resource.resourceType !== "Patient") {
    return { id: fallbackId, name: "Unknown patient", identifiers: [] };
  }

  return {
    id: typeof resource.id === "string" ? resource.id : fallbackId,
    name: parseHumanName(resource.name) ?? "Unknown patient",
    gender: typeof resource.gender === "string" ? resource.gender : undefined,
    birthDate: typeof resource.birthDate === "string" ? resource.birthDate : undefined,
    identifiers: parseIdentifiers(resource.identifier)
  };
}

function summarizeObservation(resource: unknown, fallbackId: string): ObservationSummary {
  if (!isRecord(resource)) {
    return { id: fallbackId, code: "Unknown Observation", category: [] };
  }

  return {
    id: typeof resource.id === "string" ? resource.id : fallbackId,
    status: typeof resource.status === "string" ? resource.status : undefined,
    code: parseCodeLabel(resource.code) ?? "ECG Observation",
    category: parseCategories(resource.category),
    effectiveDateTime: typeof resource.effectiveDateTime === "string" ? resource.effectiveDateTime : undefined,
    issued: typeof resource.issued === "string" ? resource.issued : undefined,
    subjectReference:
      isRecord(resource.subject) && typeof resource.subject.reference === "string"
        ? resource.subject.reference
        : undefined
  };
}

function parseHumanName(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  for (const item of value) {
    if (!isRecord(item)) continue;
    if (typeof item.text === "string" && item.text.trim()) return item.text;
    const given = Array.isArray(item.given) ? item.given.filter((part) => typeof part === "string") : [];
    const family = typeof item.family === "string" ? item.family : "";
    const name = [...given, family].filter(Boolean).join(" ");
    if (name) return name;
  }
  return undefined;
}

function parseIdentifiers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isRecord(item) || typeof item.value !== "string") return null;
      return item.value;
    })
    .filter((item): item is string => Boolean(item))
    .slice(0, 3);
}

function parseCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseCodeLabel).filter((item): item is string => Boolean(item));
}

function parseCodeLabel(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.coding)) {
    for (const coding of value.coding) {
      if (isRecord(coding) && typeof coding.display === "string") return coding.display;
      if (isRecord(coding) && typeof coding.code === "string") return coding.code;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

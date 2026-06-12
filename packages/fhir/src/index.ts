export type ParseIssueCode =
  | "NOT_OBJECT"
  | "NOT_OBSERVATION"
  | "PATIENT_MISMATCH"
  | "OBSERVATION_MISMATCH"
  | "NO_ECG_COMPONENTS"
  | "UNSUPPORTED_SAMPLED_DATA";

export class FhirEcgParseError extends Error {
  constructor(
    readonly code: ParseIssueCode,
    message: string
  ) {
    super(message);
    this.name = "FhirEcgParseError";
  }
}

export interface ParseObservationOptions {
  readonly expectedPatientId?: string;
  readonly expectedObservationId?: string;
}

export interface ParsedEcgLead {
  readonly name: string;
  readonly samples: Float32Array;
}

export interface ParsedEcgRecord {
  readonly patientId?: string | undefined;
  readonly observationId?: string | undefined;
  readonly effectiveDateTime?: string | undefined;
  readonly samplingFrequencyHz: number;
  readonly unit: string;
  readonly leads: readonly ParsedEcgLead[];
}

interface SampledData {
  readonly data?: unknown;
  readonly period?: unknown;
  readonly factor?: unknown;
  readonly origin?: { readonly value?: unknown };
  readonly code?: unknown;
  readonly unit?: unknown;
}

interface ObservationComponent {
  readonly code?: unknown;
  readonly valueSampledData?: SampledData;
}

interface ObservationLike {
  readonly resourceType?: unknown;
  readonly id?: unknown;
  readonly subject?: { readonly reference?: unknown };
  readonly effectiveDateTime?: unknown;
  readonly component?: unknown;
}

export function parseFhirEcgObservation(
  resource: unknown,
  options: ParseObservationOptions = {}
): ParsedEcgRecord {
  const observation = asObservation(resource);

  if (options.expectedObservationId && observation.id !== options.expectedObservationId) {
    throw new FhirEcgParseError("OBSERVATION_MISMATCH", "Observation id does not match request");
  }

  const patientId = parsePatientId(observation.subject?.reference);
  if (options.expectedPatientId && patientId !== options.expectedPatientId) {
    throw new FhirEcgParseError("PATIENT_MISMATCH", "Observation subject does not match request");
  }

  const components = Array.isArray(observation.component) ? observation.component : [];
  const sampledComponents = components
    .map((component) => parseComponent(component))
    .filter((component): component is ParsedEcgLead & { samplingFrequencyHz: number; unit: string } => component !== null);

  if (sampledComponents.length === 0) {
    throw new FhirEcgParseError("NO_ECG_COMPONENTS", "Observation contains no supported ECG SampledData components");
  }

  const firstComponent = sampledComponents[0];
  if (!firstComponent) {
    throw new FhirEcgParseError("NO_ECG_COMPONENTS", "Observation contains no supported ECG SampledData components");
  }

  const samplingFrequencyHz = firstComponent.samplingFrequencyHz;
  const unit = firstComponent.unit;

  return {
    patientId,
    observationId: typeof observation.id === "string" ? observation.id : undefined,
    effectiveDateTime: typeof observation.effectiveDateTime === "string" ? observation.effectiveDateTime : undefined,
    samplingFrequencyHz,
    unit,
    leads: sampledComponents.map(({ name, samples }) => ({ name, samples }))
  };
}

function asObservation(resource: unknown): ObservationLike {
  if (!isRecord(resource)) {
    throw new FhirEcgParseError("NOT_OBJECT", "FHIR resource must be a JSON object");
  }
  if (resource.resourceType !== "Observation") {
    throw new FhirEcgParseError("NOT_OBSERVATION", "FHIR resourceType must be Observation");
  }
  return resource as ObservationLike;
}

function parseComponent(
  component: unknown
): (ParsedEcgLead & { samplingFrequencyHz: number; unit: string }) | null {
  if (!isRecord(component)) return null;
  const typed = component as ObservationComponent;
  if (!typed.valueSampledData) return null;

  const leadName = parseLeadName(typed.code);
  const sampled = typed.valueSampledData;
  if (typeof sampled.data !== "string" || typeof sampled.period !== "number" || sampled.period <= 0) {
    throw new FhirEcgParseError("UNSUPPORTED_SAMPLED_DATA", "SampledData requires string data and positive numeric period");
  }

  const factor = typeof sampled.factor === "number" ? sampled.factor : 1;
  const origin = typeof sampled.origin?.value === "number" ? sampled.origin.value : 0;
  const samples = sampled.data.trim().split(/\s+/).map(Number);

  if (samples.some((sample) => !Number.isFinite(sample))) {
    throw new FhirEcgParseError("UNSUPPORTED_SAMPLED_DATA", "SampledData data contains non-numeric samples");
  }

  return {
    name: leadName,
    samples: Float32Array.from(samples, (sample) => origin + sample * factor),
    samplingFrequencyHz: 1000 / sampled.period,
    unit: parseUnit(sampled)
  };
}

function parseLeadName(code: unknown): string {
  if (!isRecord(code)) return "unknown";
  if (typeof code.text === "string") return code.text;
  if (Array.isArray(code.coding)) {
    for (const coding of code.coding) {
      if (isRecord(coding) && typeof coding.display === "string") return coding.display;
      if (isRecord(coding) && typeof coding.code === "string") return coding.code;
    }
  }
  return "unknown";
}

function parseUnit(sampled: SampledData): string {
  if (typeof sampled.unit === "string") return sampled.unit;
  if (typeof sampled.code === "string") return sampled.code;
  return "unknown";
}

function parsePatientId(reference: unknown): string | undefined {
  if (typeof reference !== "string") return undefined;
  const match = reference.match(/(?:^|\/)Patient\/([^/]+)$/);
  return match?.[1];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

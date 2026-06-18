export interface ServerConfig {
  readonly fhirBaseUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret?: string | undefined;
  readonly scope: string;
}

export type ReportPdfStorageMode = "auto" | "filesystem" | "inline";

export class ServerConfigError extends Error {
  constructor(readonly variableName: string) {
    super(`${variableName} is required`);
    this.name = "ServerConfigError";
  }
}

export class ServerConfigValueError extends Error {
  constructor(
    readonly variableName: string,
    readonly allowedValues: readonly string[],
  ) {
    super(`${variableName} must be one of: ${allowedValues.join(", ")}`);
    this.name = "ServerConfigValueError";
  }
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    fhirBaseUrl: required(env.FHIR_BASE_URL, "FHIR_BASE_URL"),
    tokenUrl: required(env.FHIR_TOKEN_URL, "FHIR_TOKEN_URL"),
    clientId: required(env.FHIR_CLIENT_ID, "FHIR_CLIENT_ID"),
    clientSecret: env.FHIR_CLIENT_SECRET || undefined,
    scope: env.FHIR_SCOPE || "",
  };
}

export function readReportPdfStorageMode(
  env: NodeJS.ProcessEnv,
): ReportPdfStorageMode {
  const value = env.REPORT_PDF_STORAGE || "auto";
  if (value === "auto" || value === "filesystem" || value === "inline") {
    return value;
  }
  throw new ServerConfigValueError("REPORT_PDF_STORAGE", [
    "auto",
    "filesystem",
    "inline",
  ]);
}

export function shouldInlineReportPdf(env: NodeJS.ProcessEnv): boolean {
  const mode = readReportPdfStorageMode(env);
  return mode === "inline" || (mode === "auto" && env.VERCEL === "1");
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new ServerConfigError(name);
  return value;
}

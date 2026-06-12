export interface ServerConfig {
  readonly fhirBaseUrl: string;
  readonly tokenUrl: string;
  readonly clientId: string;
  readonly clientSecret?: string | undefined;
  readonly scope: string;
}

export function readServerConfig(env: NodeJS.ProcessEnv): ServerConfig {
  return {
    fhirBaseUrl: required(env.FHIR_BASE_URL, "FHIR_BASE_URL"),
    tokenUrl: required(env.FHIR_TOKEN_URL, "FHIR_TOKEN_URL"),
    clientId: required(env.FHIR_CLIENT_ID, "FHIR_CLIENT_ID"),
    clientSecret: env.FHIR_CLIENT_SECRET || undefined,
    scope: env.FHIR_SCOPE || ""
  };
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

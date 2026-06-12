import type { ServerConfig } from "@ecgviewer/config";

export interface TokenSet {
  readonly accessToken: string;
  readonly refreshToken?: string | undefined;
  readonly tokenType: string;
  readonly scope?: string | undefined;
  readonly expiresAt: number;
}

export async function requestClientCredentialsToken(config: ServerConfig): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId
  });

  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  if (config.scope) body.set("scope", config.scope);

  return requestToken(config.tokenUrl, body);
}

export async function refreshAccessToken(
  config: ServerConfig,
  refreshToken: string
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId
  });

  if (config.clientSecret) body.set("client_secret", config.clientSecret);

  return requestToken(config.tokenUrl, body);
}

async function requestToken(tokenUrl: string, body: URLSearchParams): Promise<TokenSet> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body,
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    throw new Error(`Token endpoint failed with status ${response.status}`);
  }

  return parseTokenResponse((await response.json()) as unknown);
}

function parseTokenResponse(payload: unknown): TokenSet {
  if (!isRecord(payload) || typeof payload.access_token !== "string") {
    throw new Error("Token endpoint response is missing access_token");
  }

  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 300;
  const tokenType = typeof payload.token_type === "string" ? payload.token_type : "Bearer";

  return {
    accessToken: payload.access_token,
    refreshToken: typeof payload.refresh_token === "string" ? payload.refresh_token : undefined,
    tokenType,
    scope: typeof payload.scope === "string" ? payload.scope : undefined,
    expiresAt: Date.now() + Math.max(0, expiresIn - 30) * 1000
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

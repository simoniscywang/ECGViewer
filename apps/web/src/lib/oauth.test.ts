import { afterEach, describe, expect, it, vi } from "vitest";
import { TokenRequestError, requestClientCredentialsToken } from "./oauth";

describe("OAuth helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests a backend service token with client credentials", async () => {
    let body = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        body = String(init?.body);
        return Response.json({
          access_token: "access-token",
          expires_in: 3600,
          refresh_token: "refresh-token",
          token_type: "Bearer",
          scope: "system/Observation.read"
        });
      })
    );

    const tokenSet = await requestClientCredentialsToken({
      clientId: "hapi-admin",
      clientSecret: "secret",
      fhirBaseUrl: "https://fhir.example.test",
      scope: "system/Observation.read",
      tokenUrl: "https://auth.example.test/token"
    });

    expect(body).toContain("grant_type=client_credentials");
    expect(body).toContain("client_id=hapi-admin");
    expect(body).toContain("client_secret=secret");
    expect(body).toContain("scope=system%2FObservation.read");
    expect(tokenSet.accessToken).toBe("access-token");
    expect(tokenSet.refreshToken).toBe("refresh-token");
  });

  it("omits scope when no backend service scope is configured", async () => {
    let body = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        body = String(init?.body);
        return Response.json({
          access_token: "access-token",
          expires_in: 3600,
          token_type: "Bearer"
        });
      })
    );

    await requestClientCredentialsToken({
      clientId: "hapi-admin",
      clientSecret: "secret",
      fhirBaseUrl: "https://fhir.example.test",
      scope: "",
      tokenUrl: "https://auth.example.test/token"
    });

    expect(body).not.toContain("scope=");
  });

  it("throws a structured error when the token endpoint rejects credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "unauthorized_client" }, { status: 401 }))
    );

    await expect(
      requestClientCredentialsToken({
        clientId: "hapi-admin",
        fhirBaseUrl: "https://fhir.example.test",
        scope: "",
        tokenUrl: "https://auth.example.test/token"
      })
    ).rejects.toMatchObject({
      name: "TokenRequestError",
      status: 401
    } satisfies Partial<TokenRequestError>);
  });
});

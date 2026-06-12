import { describe, expect, it } from "vitest";
import { readServerConfig } from "../src/index";

describe("readServerConfig", () => {
  it("reads backend service OAuth settings", () => {
    const config = readServerConfig({
      FHIR_BASE_URL: "http://example.test/fhir",
      FHIR_TOKEN_URL: "http://example.test/realms/HAPI/protocol/openid-connect/token",
      FHIR_CLIENT_ID: "client",
      FHIR_CLIENT_SECRET: "secret"
    });

    expect(config.fhirBaseUrl).toBe("http://example.test/fhir");
    expect(config.tokenUrl).toBe("http://example.test/realms/HAPI/protocol/openid-connect/token");
    expect(config.clientId).toBe("client");
    expect(config.clientSecret).toBe("secret");
    expect(config.scope).toBe("");
  });
});

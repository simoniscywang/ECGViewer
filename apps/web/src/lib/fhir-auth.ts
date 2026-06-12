import type { ServerConfig } from "@ecgviewer/config";
import { refreshAccessToken, requestClientCredentialsToken, type TokenSet } from "./oauth";

const globalTokenCache = globalThis as typeof globalThis & {
  __ecgviewerBackendToken?: TokenSet;
};

export async function getBackendServiceAccessToken(config: ServerConfig): Promise<string> {
  const cached = globalTokenCache.__ecgviewerBackendToken;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.accessToken;
  }

  if (cached?.refreshToken) {
    const refreshed = await refreshAccessToken(config, cached.refreshToken);
    globalTokenCache.__ecgviewerBackendToken = {
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? cached.refreshToken
    };
    return globalTokenCache.__ecgviewerBackendToken.accessToken;
  }

  const tokenSet = await requestClientCredentialsToken(config);
  globalTokenCache.__ecgviewerBackendToken = tokenSet;
  return tokenSet.accessToken;
}

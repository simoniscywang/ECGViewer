---
name: oauth-workflow
description: Use when implementing, debugging, testing, or reviewing ECGViewer OAuth 2.0 / SMART on FHIR backend service access, token endpoint calls, client credentials, token caching, refresh behavior, and related configuration.
---

# ECGViewer OAuth Workflow

ECGViewer uses backend service OAuth. It does not use user login, authorization code, PKCE, or callback URLs.

## Current Flow

1. API route receives a FHIR request from the UI.
2. Server-side code reads `FHIR_TOKEN_URL`, `FHIR_CLIENT_ID`, `FHIR_CLIENT_SECRET`, and optional `FHIR_SCOPE`.
3. Server sends `grant_type=client_credentials` to the token endpoint.
4. If `FHIR_SCOPE` is empty, omit `scope` from the token request.
5. Cache the access token server-side until near expiry.
6. Use `Authorization: Bearer <token>` for FHIR calls.

## Implementation Rules

- Keep token logic in `apps/web/src/lib/oauth.ts` and `apps/web/src/lib/fhir-auth.ts`.
- Do not print client secrets, access tokens, refresh tokens, or full token responses.
- If refresh tokens are returned, refresh server-side; otherwise request a new client credentials token.
- Translate token failures into safe route errors.
- FHIR writeback routes, including report Bundle transactions, must use backend service tokens server-side; browser code may request the app API but must not receive FHIR tokens.

## Smoke Test

Token endpoint tests may report only status, token type, and boolean token presence. Never print token values.

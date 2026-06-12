# Security Notes

## Protected Data

ECG Observation resources can contain PHI. Treat Patient id, Observation id, timestamps, raw waveform data, and FHIR payloads as sensitive.

## OAuth

- Use backend service OAuth with `client_credentials`.
- Store `client_secret` only in server-side environment variables.
- Never expose access tokens, refresh tokens, client secrets, or token endpoint errors to React components.
- Cache backend service access tokens only in server memory or a secure server-side token cache.
- Refresh tokens when the authorization server returns them; otherwise request a new client credentials token after expiry.
- Use least-privilege server-level scopes such as `system/Observation.read` when supported.

## FHIR Requests

- Allowlist FHIR base URLs in production.
- Validate Patient id and Observation id format before requests.
- Confirm `Observation.subject.reference` matches the requested Patient id.
- Limit response size and timeout outbound requests.

## Logging

Allowed: request ids, status categories, parser error codes, timing metrics.

Forbidden: access tokens, refresh tokens, raw FHIR JSON, raw ECG samples, Patient names, identifiers, dates of birth, and full request URLs containing ids.

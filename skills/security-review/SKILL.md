---
name: security-review
description: Use when reviewing or changing ECGViewer security-sensitive behavior including OAuth backend service credentials, FHIR server calls, PHI handling, logging, request validation, secrets, token caching, or production deployment risk.
---

# ECGViewer Security Review

Use this skill for security design, implementation review, or bug triage.

## High-Risk Data

- Patient id, Observation id, timestamps, identifiers, and ECG waveforms are sensitive.
- Generated report PDFs and their base64 strings are sensitive clinical-adjacent data.
- FHIR payloads and raw ECG samples must not be logged.
- OAuth client secrets, access tokens, refresh tokens, and token endpoint responses must remain server-side.

## OAuth Backend Service Checks

- Use `client_credentials` from server-side code only.
- Do not add user-login redirects or callback URLs unless the architecture changes.
- Keep `FHIR_CLIENT_SECRET` in `.env.local` or secure deployment secrets only.
- Cache access tokens only in server memory or secure server-side cache.
- If no explicit scope is configured, omit `scope` from token requests so the OAuth server can apply client defaults.

## FHIR Request Checks

- Validate Patient id and Observation id before outbound calls.
- Use allowlisted FHIR base URLs in production.
- Enforce timeouts and response size limits when implemented.
- Validate `Observation.subject.reference` against the requested Patient id before displaying data.
- For report writeback, validate derived resource ids, PDF base64 shape, request size, and upstream status without logging the PDF, Bundle body, access token, or full request URL.

## Review Output

Lead with concrete risks, file references, and remediation. Mark residual risk when a control is planned but not implemented.

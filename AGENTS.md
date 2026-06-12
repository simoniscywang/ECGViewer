# AGENTS.md

## Project Mission

Build ECGViewer: a secure full-stack web application that reads ECG FHIR `Observation` resources from an OAuth 2.0 / SMART on FHIR protected FHIR server, parses TW Core ECG-style waveform data, visualizes ECG leads efficiently, and provides lightweight non-diagnostic analysis.

This is clinical software-adjacent. Treat correctness, privacy, auditability, and test coverage as first-class concerns. Do not present analysis as diagnosis.

## Architecture Rules

- Keep FHIR access server-side. Browser code must not store OAuth client secrets, refresh tokens, access tokens, or token endpoint responses.
- Keep domain logic outside React components:
  - `packages/fhir`: FHIR resource shape, profile-aware parsing, validation errors.
  - `packages/ecg`: signal model, downsampling, windowing, basic measurements.
  - `apps/web`: routing, session, API boundaries, UI composition.
- Treat incoming FHIR JSON as untrusted input. Parse defensively and return typed results.
- Avoid profile assumptions in UI. Parse once into `EcgRecord`, then render from that normalized model.
- Make large ECG handling incremental. Prefer typed arrays, windowed rendering, min/max downsampling, and worker-compatible pure functions.

## Coding Rules

- TypeScript must be strict. Avoid `any`; use `unknown` at trust boundaries and narrow explicitly.
- Public package APIs must expose stable typed interfaces and tests.
- Use small pure functions for parsing and signal transformations.
- Return structured errors with codes where user-facing remediation is possible.
- Do not log PHI, OAuth tokens, raw FHIR payloads, or ECG samples in production logs.
- Keep comments sparse and useful; explain clinical/FHIR assumptions and non-obvious algorithms.
- Do not introduce global mutable state for patient data.
- Use existing repo patterns before adding new abstractions.

## Security Rules

- OAuth uses backend service credentials with `client_credentials`; do not add browser-based login or callback URLs unless the architecture changes.
- Validate issuer/base URL allowlists before making FHIR calls in production deployments.
- Enforce least-privilege scopes such as `system/Observation.read` or server-specific equivalents.
- Validate `Observation.subject.reference` against the requested Patient id before displaying data.
- Reject resources with unexpected `resourceType`, incompatible status, or unsupported data encodings.
- Add rate limits and request size limits to server endpoints that accept user-controlled ids or URLs.
- Keep secrets in environment variables. Never commit `.env` files.

## Testing Expectations

- Unit test all FHIR parser branches with realistic fixtures, including malformed resources.
- Unit test ECG algorithms with deterministic sample arrays.
- Add integration tests for API routes that mock OAuth and FHIR responses.
- Add Playwright tests for the main query and viewer flow once UI behavior is implemented.
- Every bug fix should include a regression test unless the change is purely documentation.

## Code Review Checklist

- Does the change preserve PHI/token confidentiality?
- Are FHIR inputs parsed at a trust boundary instead of assumed valid?
- Are Patient id and Observation subject consistency checked?
- Does large waveform rendering avoid loading or drawing unnecessary points?
- Are errors actionable without leaking sensitive data?
- Are tests meaningful for parser, security, and UI behavior?
- Is any clinical wording clearly non-diagnostic?

## Definition of Done

- `pnpm typecheck`, `pnpm lint`, and `pnpm test` pass.
- New behavior is covered by focused tests.
- Documentation or skill instructions are updated when architecture, workflow, or security assumptions change.
- UI changes are visually verified in the browser for desktop and mobile widths.

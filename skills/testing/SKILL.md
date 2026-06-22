---
name: testing
description: Use when adding, updating, designing, or debugging ECGViewer tests, including parser fixtures, ECG algorithm tests, OAuth/FHIR route mocks, UI tests, smoke tests, and CI gates.
---

# ECGViewer Testing

Use this skill for test planning and implementation.

## Test Map

- `packages/fhir/tests`: realistic Observation fixtures, malformed resources, unsupported encodings, Patient mismatch.
- `packages/ecg/tests`: deterministic numeric tests for downsampling, windowing, summaries, and future analysis helpers.
- `apps/web/src/**/*.test.ts`: OAuth token requests, config behavior, API helper logic, report Bundle transaction helpers, and FHIR writeback API routes.
- Future UI tests: query form, viewer loading/error/ready states, large waveform rendering.

## Rules

- Mock OAuth and FHIR for automated tests; do not require live clinical servers in CI.
- Do not store real PHI in fixtures.
- Use small fixtures for unit tests and separate large synthetic samples for performance-sensitive tests.
- Report writeback tests should assert derived ids, `Bundle.type = transaction`, deterministic `PUT` entries, PDF base64 in result `Observation.valueString`, and safe upstream error handling.
- For bug fixes, add a regression test unless the change is docs-only.

## Validation Commands

Run as appropriate:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

For local smoke tests, start `npm run dev` and verify routes without printing tokens or PHI.

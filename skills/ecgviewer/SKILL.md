---
name: ecgviewer
description: Use for general ECGViewer repository orientation, task routing, architecture decisions, or when a request spans multiple ECGViewer domains such as OAuth backend service access, FHIR Observation ingestion, ECG processing, UI, testing, security, and review.
---

# ECGViewer Project

Use this skill first for broad ECGViewer work, then load narrower skills when the task clearly matches one domain.

## Start Here

1. Read `AGENTS.md` first.
2. Identify the layer being changed:
   - `apps/web`: UI, API routes, backend service OAuth, FHIR request boundary.
   - `packages/fhir`: FHIR `Observation` parsing and profile-aware validation.
   - `packages/ecg`: ECG signal transformations, downsampling, lightweight analysis.
   - `docs`: architecture, security, testing, or profile notes.
3. Keep PHI, OAuth secrets, access tokens, token endpoint responses, raw FHIR payloads, and raw ECG samples out of logs.
4. Use the focused skill that matches the current task:
   - `coding-rule`: implementation style and repo conventions.
   - `security-review`: privacy, secrets, OAuth, PHI, and FHIR access risk review.
   - `code-review`: bug-focused review of local changes.
   - `testing`: unit, integration, UI, and smoke test planning.
   - `web-ui-ux-design`: ECGViewer UI and visualization experience.
   - `oauth-workflow`: backend service OAuth `client_credentials` flow.
   - `fhir-processing`: FHIR Observation parsing and validation.
   - `ecg-signal-processing`: waveform processing, downsampling, and lightweight analysis.

## Project Invariants

- Browser code never receives client secrets, refresh tokens, access tokens, or token endpoint responses.
- FHIR JSON is untrusted until parsed by `packages/fhir`.
- UI renders normalized ECG records, not raw FHIR resources.
- ECG analysis wording must remain non-diagnostic.
- Every meaningful behavior change needs focused tests.

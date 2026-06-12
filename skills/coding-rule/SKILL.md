---
name: coding-rule
description: Use when implementing or refactoring ECGViewer code and needing repository coding conventions, TypeScript style, package boundaries, error handling, or maintainability rules.
---

# ECGViewer Coding Rules

Use this skill before making code changes in ECGViewer.

## Rules

- Read `AGENTS.md` first when starting a new task.
- Keep logic in the right layer:
  - `apps/web`: Next.js routes, UI, backend service boundary.
  - `packages/fhir`: FHIR parsing and validation.
  - `packages/ecg`: signal processing and analysis.
  - `packages/config`: environment config parsing.
- Use strict TypeScript. Prefer `unknown` at trust boundaries; avoid `any`.
- Keep public APIs typed, small, and covered by tests.
- Return structured, user-safe errors from routes and parsers.
- Do not log PHI, tokens, client secrets, raw FHIR JSON, or raw ECG samples.
- Add comments only for non-obvious clinical, FHIR, OAuth, or algorithmic assumptions.
- Avoid broad abstractions until repeated complexity proves they are useful.

## Before Finishing

- Run the narrowest relevant tests during iteration.
- Run `npm run typecheck`, `npm run lint`, and `npm run test` for completed code changes.

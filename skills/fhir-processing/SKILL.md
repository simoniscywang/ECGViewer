---
name: fhir-processing
description: Use when implementing, debugging, reviewing, or testing ECGViewer FHIR Observation retrieval, TW Core ECG profile parsing, SampledData extraction, Patient/Observation validation, normalized ECG record creation, or generated report writeback.
---

# ECGViewer FHIR Processing

Use this skill for FHIR server calls and `Observation` parsing.

## Boundaries

- Treat FHIR JSON as `unknown`.
- Check `resourceType === "Observation"` before reading fields.
- Confirm requested Observation id when supplied.
- Confirm `Observation.subject.reference` matches requested Patient id.
- Convert supported ECG waveform components to normalized records before UI rendering.

## Parser Rules

- Keep parser logic in `packages/fhir`.
- Support explicit known encodings only; fail clearly for unsupported encodings.
- Preserve unit, period, factor, origin, lead name, effective time, patient id, and observation id when available.
- Keep parser errors structured and safe for user-facing routes.

## Report Writeback Rules

- Generated ECG PDF reports are written through a FHIR Bundle transaction from `apps/web` server-side routes.
- Derive writeback ids from the query `Observation id`: replace source prefix `0322226` with `0320900-1` for `DiagnosticReport.id`, and with `0322203-1` for the result `Observation.id`.
- `DiagnosticReport.subject` and result `Observation.subject` use the query `Patient id`.
- `DiagnosticReport.result` references `Observation/{derived result Observation id}`.
- Store the PDF as base64 text in the result `Observation.valueString`. This string is base64-encoded PDF binary, not UTF-8 PDF text.
- `DiagnosticReport.issued` is the server-side writeback time. Result `Observation.effectiveDateTime` should prefer the source ECG Observation `effectiveDateTime`, falling back to writeback time only when missing.
- Use deterministic `PUT` entries in the transaction for idempotent upsert behavior.

## Testing

- Add fixture tests for normal ECG, missing components, malformed SampledData, unsupported encoding, and Patient mismatch.
- Do not use real PHI in committed fixtures.

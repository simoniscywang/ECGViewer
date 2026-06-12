# FHIR ECG Observation Notes

TW Core ECG profile implementations may represent waveform data in `Observation.component` values. Real servers can vary, so parser code should support explicit known encodings and fail clearly for unknown ones.

## Expected Observation Checks

- `resourceType`: `Observation`
- `id`: matches requested Observation id when supplied
- `subject.reference`: `Patient/{id}` or equivalent reference to the requested Patient
- `status`: usually `final`, `amended`, or server-defined acceptable status
- `component`: one or more ECG lead components

## Supported MVP Encoding

The initial parser supports components where:

- `code.text` or coding display identifies the lead, such as `I`, `II`, `V1`.
- `valueSampledData` contains:
  - `data`: whitespace-separated numeric samples.
  - `period`: milliseconds per sample.
  - `origin.value` and `factor` when needed for scaling.
  - `code` or `unit` for units when available.

Add fixture tests before supporting a new encoding.

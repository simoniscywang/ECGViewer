# Testing Strategy

## Unit Tests

- `packages/fhir`: FHIR shape narrowing, ECG component extraction, Patient/Observation mismatch.
- `packages/ecg`: downsampling, window slicing, duration and amplitude measurements.

## Integration Tests

- Mock OAuth discovery, token exchange, and FHIR Observation reads.
- Test successful load, authorization failure, missing Observation, Patient mismatch, malformed ECG data, and oversized payload behavior.

## UI Tests

- Query form validation.
- Loading and error states.
- Viewer state with multiple leads.
- Large sample record rendering without freezing the UI.

## CI Gate

Required commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

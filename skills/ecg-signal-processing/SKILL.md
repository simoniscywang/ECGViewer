---
name: ecg-signal-processing
description: Use when implementing, optimizing, reviewing, or testing ECGViewer waveform processing, downsampling, time windows, signal quality, ECG landmarks, R peak review, PR/QRS/QT/QTc/ST measurements, and staged non-diagnostic ECG analysis.
---

# ECGViewer ECG Signal Processing

Use this skill for `packages/ecg` analysis work and for UI work that presents ECG
analysis results in Review support.

## Core Boundaries

- Keep ECG domain logic in `packages/ecg`; React components may compose and
  display results, but must not implement signal algorithms.
- Parse FHIR into normalized `EcgRecord` before analysis. Do not analyze raw
  FHIR resources in UI code.
- Keep functions pure and worker-compatible where practical.
- Use `Float32Array` for sample arrays and avoid unnecessary large-array copies.
- Treat all estimates as non-diagnostic review support.

## Language Rules

- Prefer: `estimated`, `candidate`, `for review`, `review support`,
  `signal quality`, `landmark confidence`.
- Avoid: diagnosis claims, rhythm classification as fact, ischemia/infarction
  conclusions, or statements implying automated clinical certainty.
- Add limitations when a feature depends on heuristic landmarks, selected lead,
  low signal quality, or limited lead context.

## Feature Stages

### Reliable Measurement & Visualization

- ECG waveform viewer with min/max downsampling.
- Time-windowed or incremental rendering for large recordings.
- Analysis lead selection with Lead II, Lead I, V5, V2 preference fallback.
- R peak markers for selected review lead.
- Measurement-specific landmark overlay; default to no landmark overlay.
- Signal quality score using dynamic range, clipping, drift, noise, R peak
  count, and RR stability.
- Landmark confidence score for estimated P onset, QRS onset, R peak, QRS
  offset, ST point, and T end.

### First-Stage Analysis

- Heart rate estimate from RR intervals.
- RR interval count and variability summary.
- PR interval: P onset to QRS onset.
- QRS duration: QRS onset to QRS offset.
- QT interval: QRS onset to T end.
- QTc estimate with formula named in evidence, currently Bazett.
- ST deviation estimate with clear baseline and ST point evidence.

### Second-Stage Analysis

- Rhythm regularity candidate from RR variability.
- Bradycardia/tachycardia candidate flags from configured thresholds.
- Premature beat candidates from short RR intervals.
- Pause candidates from long RR intervals.
- QRS morphology review from width, amplitude, and shape variation.
- Lead quality ranking for landmark suitability.

### Third-Stage / Advanced Review

- Multi-lead landmark consistency.
- Axis support from limb leads such as I, II, and aVF.
- ST-T regional pattern candidates across neighboring leads.
- Beat clustering for representative and outlier beat review.
- Serial comparison across observations.
- Draft review summary for clinician confirmation.

## Review Support UI

- Keep Review support modular. Use catalog/config modules for card definitions,
  grouping, default visibility, and future availability.
- Keep graph rendering separate from Review support cards. Landmark mapping
  helpers may be shared, but card display logic should not live in the viewer
  page component.
- Default to a compact card set:
  - Signal quality
  - Landmark confidence
  - Rate / RR
  - Clinical measurements
- Provide a card customizer so physicians can enable additional cards without
  pushing the ECG Graph too far down.
- Future cards may appear disabled in the customizer if their analysis is not
  implemented yet.

## Algorithm Guidelines

- Validate positive sampling frequency and aligned lead lengths.
- Prefer deterministic thresholds that are documented in evidence fields.
- Return structured values with `status`, `value`, and `evidence` rather than
  UI-only strings.
- Include selected lead name in evidence when calculations depend on one lead.
- For multi-lead features, report lead context and consistency limitations.
- Keep confidence/quality scores bounded to 0-100 and map them to explicit
  review levels such as `good`, `review`, and `limited`.

## Testing

- Add deterministic unit tests for every new algorithm branch.
- Include flat signal, low dynamic range, clipping-like repeated extremes,
  baseline drift, noise, missing landmarks, and insufficient R peaks.
- Test interval definitions explicitly:
  - PR: P onset to QRS onset
  - QRS: QRS onset to QRS offset
  - QT: QRS onset to T end
  - QTc: QT corrected using the named formula
- For UI behavior, verify card default visibility, card customizer toggles,
  analysis lead switching, and measurement-specific landmark overlay.

## Validation Checklist

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- Browser verification of the viewer at desktop and mobile widths when UI
  layout changes.

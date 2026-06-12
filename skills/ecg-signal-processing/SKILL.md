---
name: ecg-signal-processing
description: Use when implementing, optimizing, reviewing, or testing ECGViewer waveform processing, downsampling, time windows, ECG summaries, lead measurements, performance, and lightweight non-diagnostic analysis.
---

# ECGViewer ECG Signal Processing

Use this skill for `packages/ecg` and waveform performance work.

## Signal Rules

- Use normalized `EcgRecord` and `EcgLead` data, not raw FHIR resources.
- Prefer pure functions that are worker-compatible.
- Store sample arrays as `Float32Array` when practical.
- Validate sampling frequency and sample length assumptions.
- Keep multi-lead records aligned unless a feature explicitly supports unequal lengths.

## Visualization Performance

- Use visible time windows for large records.
- Use min/max downsampling when many samples map to one pixel.
- Preserve spikes and outliers during downsampling.
- Avoid copying large arrays unnecessarily.

## Analysis Language

- Keep outputs non-diagnostic.
- Use terms like "summary", "estimated", "candidate", or "for review".
- Do not claim rhythm classification or diagnosis without validated algorithms and review.

## Testing

- Use deterministic arrays.
- Test edge cases: empty leads, invalid sampling frequency, flat signals, spikes, and unequal lead lengths.

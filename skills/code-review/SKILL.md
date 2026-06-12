---
name: code-review
description: Use when the user asks for a review of ECGViewer changes, PRs, diffs, branches, or implementation quality, with priority on bugs, security risks, regressions, missing tests, and clinical-safety concerns.
---

# ECGViewer Code Review

Use a bug-finding review stance.

## Review Order

1. Security and PHI leakage.
2. OAuth token handling and server-side boundaries.
3. FHIR parsing assumptions and Patient/Observation mismatch.
4. ECG signal correctness, performance, and non-diagnostic wording.
5. UI states, error handling, and large-record behavior.
6. Missing or weak tests.

## Findings Format

- Lead with findings ordered by severity.
- Include file and line references.
- Explain the user-visible or safety impact.
- Suggest a focused fix.
- If no issues are found, say so and mention residual test or deployment risk.

## Do Not

- Spend review space on style nits unless they hide bugs.
- Recommend logging raw FHIR or ECG data.
- Treat current fixture behavior as proof of clinical correctness.

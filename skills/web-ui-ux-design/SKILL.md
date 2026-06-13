---
name: web-ui-ux-design
description: Use when designing, implementing, or reviewing ECGViewer frontend UI, query workflow, ECG waveform visualization, loading/error states, responsive behavior, accessibility, and user-facing clinical wording.
---

# ECGViewer Web UI/UX Design
Design modern, professional, enterprise-grade web applications.
Focus on clarity, efficiency, consistency, and visual quality.

## UI Principles
- Prioritize: 1.Simplicity, 2.Readability, 3.Consistency, 4.Accessibility
- Every UI element must have a purpose. Avoid visual clutter.
- Keep operational UI dense, clear, and restrained.
- Use non-diagnostic wording such as "initial measurement", "estimated", and "for review".

## Clinic Popup Viewer
- ECGViewer is commonly opened by the HIS system through query-string parameters in a popup window during an outpatient visit.
- Optimize the viewer for quick clinical review in a constrained popup, not a full-screen marketing or dashboard layout.
- Keep Patient, Observation, controls, metrics, and ECG graphs compact so physicians can review the record with minimal mouse scrolling.
- Use smaller but still readable typography, compact badges/buttons, short headers, narrow vertical spacing, and restrained card padding.
- Avoid making FHIR metadata, action controls, or ECG waveform panels dominate the whole viewport.
- Prefer dense summary rows and compact metric cards over large hero-style sections.
- ECG lead graphs should remain legible but may use reduced height and tighter spacing when the goal is rapid multi-lead review.
- Preserve the non-diagnostic disclaimer, but keep it concise and secondary to the clinical review workflow.
- Error states should be compact and actionable, naming safe failure categories such as missing configuration, OAuth failure, FHIR upstream status, patient mismatch, or unsupported waveform format without exposing PHI, tokens, raw FHIR payloads, or ECG samples.

## Visualization
- Preferred style: 1.Clean and Minimal, 2.Professional and Trustworthy
- Reference quality: 1.Linear, 2.Notion, 3.Stripe Dashboard, 4.GitHub, 5.Vercel
- Keep labels, units, sampling rate, duration, and lead names visible.
- Avoid layout shift and waveform clipping on mobile and desktop.
- Prefer Canvas/WebGL only when SVG cannot meet performance needs.

## Verification
- Use browser verification after UI changes.
- Check loading, error, empty, and multi-lead states.

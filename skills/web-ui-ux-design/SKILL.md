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

## Visualization
- Preferred style: 1.Clean and Minimal, 2.Professional and Trustworthy
- Reference quality: 1.Linear, 2.Notion, 3.Stripe Dashboard, 4.GitHub, 5.Vercel
- Keep labels, units, sampling rate, duration, and lead names visible.
- Avoid layout shift and waveform clipping on mobile and desktop.
- Prefer Canvas/WebGL only when SVG cannot meet performance needs.

## Verification
- Use browser verification after UI changes.
- Check loading, error, empty, and multi-lead states.
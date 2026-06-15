export type ReviewSupportCardId =
  | "signal-quality"
  | "rate-rr"
  | "clinical-measurements"
  | "st-qt"
  | "lead-quality-ranking"
  | "rhythm-regularity"
  | "premature-beat-candidates"
  | "pause-candidates"
  | "qrs-morphology"
  | "multi-lead-consistency"
  | "axis-support"
  | "st-t-regional-pattern"
  | "serial-comparison";

export interface ReviewSupportCardDefinition {
  readonly id: ReviewSupportCardId;
  readonly label: string;
  readonly description: string;
  readonly implemented: boolean;
}

export interface ReviewSupportCardGroup {
  readonly title: string;
  readonly cards: readonly ReviewSupportCardDefinition[];
}

export const defaultReviewSupportCardIds: readonly ReviewSupportCardId[] = [
  "signal-quality",
  "rate-rr",
  "st-qt",
  "clinical-measurements",
];

export const reviewSupportCardGroups: readonly ReviewSupportCardGroup[] = [
  {
    title: "Reliable measurement",
    cards: [
      {
        id: "signal-quality",
        label: "Signal quality",
        description: "Lead quality score, drift, noise, range, and R peaks.",
        implemented: true,
      },
      {
        id: "lead-quality-ranking",
        label: "Lead quality ranking",
        description: "Rank leads by quality and landmark suitability.",
        implemented: false,
      },
    ],
  },
  {
    title: "First-stage analysis",
    cards: [
      {
        id: "rate-rr",
        label: "Rate / RR",
        description: "Heart rate, RR interval, R peak, and beat review.",
        implemented: true,
      },
      {
        id: "clinical-measurements",
        label: "Clinical measurements",
        description: "PR, QRS, QT, QTc, and ST deviation estimates.",
        implemented: true,
      },
      {
        id: "st-qt",
        label: "ST / QT review",
        description: "ST/QT evidence with landmark confidence summary.",
        implemented: true,
      },
      {
        id: "rhythm-regularity",
        label: "Rhythm regularity",
        description: "Candidate regularity review from RR intervals.",
        implemented: false,
      },
    ],
  },
  {
    title: "Second-stage analysis",
    cards: [
      {
        id: "premature-beat-candidates",
        label: "Premature beat candidates",
        description: "Flag early beat candidates for clinician review.",
        implemented: false,
      },
      {
        id: "pause-candidates",
        label: "Pause candidates",
        description: "Flag long RR interval candidates.",
        implemented: false,
      },
      {
        id: "qrs-morphology",
        label: "QRS morphology review",
        description: "Compare QRS width, amplitude, and morphology variation.",
        implemented: false,
      },
    ],
  },
  {
    title: "Advanced review",
    cards: [
      {
        id: "multi-lead-consistency",
        label: "Multi-lead consistency",
        description: "Compare landmarks and measurements across leads.",
        implemented: false,
      },
      {
        id: "axis-support",
        label: "Axis support",
        description: "Review electrical axis candidates from limb leads.",
        implemented: false,
      },
      {
        id: "st-t-regional-pattern",
        label: "ST-T regional pattern",
        description: "Group ST-T candidates across neighboring leads.",
        implemented: false,
      },
      {
        id: "serial-comparison",
        label: "Serial comparison",
        description: "Compare intervals and ST-T values across observations.",
        implemented: false,
      },
    ],
  },
];

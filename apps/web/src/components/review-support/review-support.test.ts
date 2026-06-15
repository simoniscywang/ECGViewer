import { describe, expect, it } from "vitest";
import {
  defaultReviewSupportCardIds,
  reviewSupportCardGroups,
} from "./review-support-catalog";
import { filterLandmarksForMeasurement, landmarkCode } from "./landmarks";
import { type EcgLandmark } from "@ecgviewer/ecg";

describe("review support configuration", () => {
  it("defaults to compact implemented cards", () => {
    const implementedCards = new Set(
      reviewSupportCardGroups
        .flatMap((group) => group.cards)
        .filter((card) => card.implemented)
        .map((card) => card.id),
    );

    expect(defaultReviewSupportCardIds).toEqual([
      "signal-quality",
      "rate-rr",
      "st-qt",
      "clinical-measurements",
    ]);
    expect(
      defaultReviewSupportCardIds.every((cardId) =>
        implementedCards.has(cardId),
      ),
    ).toBe(true);
  });

  it("keeps future staged analysis visible but unavailable", () => {
    const cards = reviewSupportCardGroups.flatMap((group) => group.cards);

    expect(cards.find((card) => card.id === "axis-support")?.implemented).toBe(
      false,
    );
    expect(
      cards.find((card) => card.id === "lead-quality-ranking")?.implemented,
    ).toBe(false);
  });

  it("merges similar implemented cards into higher-value review cards", () => {
    const cardIds = reviewSupportCardGroups
      .flatMap((group) => group.cards)
      .map((card) => card.id);

    expect(cardIds).not.toContain("landmark-confidence");
    expect(cardIds).not.toContain("beat-review");
    expect(cardIds).toContain("st-qt");
    expect(cardIds).toContain("rate-rr");
  });
});

describe("review support landmark helpers", () => {
  const landmarks: readonly EcgLandmark[] = [
    buildLandmark("p-onset"),
    buildLandmark("qrs-onset"),
    buildLandmark("r-peak"),
    buildLandmark("qrs-offset"),
    buildLandmark("st-point"),
    buildLandmark("t-end"),
  ];

  it("maps measurement cards to only related landmarks", () => {
    expect(
      filterLandmarksForMeasurement(landmarks, "pr").map(
        (landmark) => landmark.kind,
      ),
    ).toEqual(["p-onset", "qrs-onset"]);
    expect(
      filterLandmarksForMeasurement(landmarks, "st-deviation").map(
        (landmark) => landmark.kind,
      ),
    ).toEqual(["qrs-offset", "st-point"]);
  });

  it("uses short non-overlapping graph codes", () => {
    expect(landmarkCode("qrs-onset")).toBe("S");
    expect(landmarkCode("qrs-offset")).toBe("E");
  });
});

function buildLandmark(kind: EcgLandmark["kind"]): EcgLandmark {
  return {
    kind,
    label: kind,
    leadName: "Lead II",
    sampleIndex: 0,
    timeSeconds: 0,
    amplitude: 0,
  };
}

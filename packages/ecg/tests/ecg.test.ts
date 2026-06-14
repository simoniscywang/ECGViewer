import { describe, expect, it } from "vitest";
import {
  analyzeReviewSupport,
  downsampleMinMax,
  sliceTimeWindow,
  summarizeEcg,
} from "../src/index";

describe("ECG signal helpers", () => {
  it("summarizes a multi-lead ECG record", () => {
    const summary = summarizeEcg({
      samplingFrequencyHz: 2,
      unit: "mV",
      leads: [
        { name: "I", samples: new Float32Array([0, 1, -1, 0]) },
        { name: "II", samples: new Float32Array([0.5, 1.5, -0.5, 0.5]) },
      ],
    });

    expect(summary.durationSeconds).toBe(2);
    expect(summary.leadCount).toBe(2);
    expect(summary.minAmplitude).toBe(-1);
    expect(summary.maxAmplitude).toBe(1.5);
    expect(summary.meanAmplitude).toBe(0.25);
  });

  it("preserves min and max values while downsampling", () => {
    const points = downsampleMinMax(new Float32Array([0, 5, -3, 2, 1, 9]), 2);

    expect(points).toEqual([
      { x: 0, min: -3, max: 5 },
      { x: 3, min: 1, max: 9 },
    ]);
  });

  it("slices samples by time window", () => {
    const window = sliceTimeWindow(
      new Float32Array([0, 1, 2, 3, 4]),
      2,
      0.5,
      1,
    );

    expect(Array.from(window)).toEqual([1, 2]);
  });

  it("builds review support with estimated R peaks and heart rate", () => {
    const review = analyzeReviewSupport({
      samplingFrequencyHz: 10,
      unit: "mV",
      leads: [
        {
          name: "II",
          samples: new Float32Array([0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0]),
        },
      ],
    });

    expect(review.primaryLeadName).toBe("II");
    expect(review.rPeaks.map((peak) => peak.sampleIndex)).toEqual([2, 7, 12]);
    expect(review.rrIntervalsSeconds[0]).toBeCloseTo(0.5);
    expect(review.estimatedHeartRateBpm).toBeCloseTo(120);
    expect(review.signalQuality.leadName).toBe("II");
    expect(review.signalQuality.level).not.toBe("limited");
    expect(review.signalQuality.score).toBeGreaterThanOrEqual(55);
    expect(
      review.features.find((feature) => feature.code === "rate-rr")?.value,
    ).toBe("est. 120 bpm");
  });

  it("uses a requested lead name with normalized Lead prefix", () => {
    const review = analyzeReviewSupport(
      {
        samplingFrequencyHz: 10,
        unit: "mV",
        leads: [
          {
            name: "Lead I",
            samples: new Float32Array([0, 0, 1, 0, 0, 0, 0, 1, 0]),
          },
          {
            name: "Lead II",
            samples: new Float32Array([0, 0, 2, 0, 0, 0, 0, 2, 0]),
          },
        ],
      },
      { leadName: "II" },
    );

    expect(review.primaryLeadName).toBe("Lead II");
    expect(review.rPeaks.map((peak) => peak.leadName)).toEqual([
      "Lead II",
      "Lead II",
    ]);
  });

  it("detects dominant negative R peak candidates for review", () => {
    const review = analyzeReviewSupport({
      samplingFrequencyHz: 10,
      unit: "mV",
      leads: [
        {
          name: "Lead I",
          samples: new Float32Array([0, 0, -2, 0, 0, 0, 0, -2, 0]),
        },
      ],
    });

    expect(review.rPeaks.map((peak) => peak.sampleIndex)).toEqual([2, 7]);
    expect(review.estimatedHeartRateBpm).toBeCloseTo(120);
  });

  it("marks flat signals as limited review support", () => {
    const review = analyzeReviewSupport({
      samplingFrequencyHz: 250,
      unit: "mV",
      leads: [{ name: "I", samples: new Float32Array(32).fill(0.1) }],
    });

    expect(review.rPeaks).toHaveLength(0);
    expect(review.signalQuality.level).toBe("limited");
    expect(review.signalQuality.score).toBeLessThan(55);
    expect(review.signalQuality.issues).toContain("low dynamic range");
    expect(review.landmarkConfidence.level).toBe("limited");
    expect(
      review.features.find((feature) => feature.code === "signal-quality")
        ?.status,
    ).toBe("limited");
    expect(
      review.features.find((feature) => feature.code === "rate-rr")?.status,
    ).toBe("limited");
  });

  it("reports multi-lead context for ST and QT review when 12 leads are available", () => {
    const leads = Array.from({ length: 12 }, (_, index) => ({
      name: `L${index + 1}`,
      samples: new Float32Array([0, 1, 0, 0, 1, 0]),
    }));
    const review = analyzeReviewSupport({
      samplingFrequencyHz: 10,
      unit: "mV",
      leads,
    });

    expect(
      review.features.find((feature) => feature.code === "st-qt")?.status,
    ).toBe("for-review");
    expect(
      review.features.find((feature) => feature.code === "st-qt")?.value,
    ).toContain("estimates");
  });

  it("estimates interval measurements from representative waveform landmarks", () => {
    const samples = new Float32Array(240);
    for (const offset of [0, 100]) {
      samples[offset + 30] = 0;
      samples[offset + 32] = 0.08;
      samples[offset + 34] = 0.2;
      samples[offset + 36] = 0.08;
      samples[offset + 38] = 0;
      samples[offset + 48] = 0.2;
      samples[offset + 49] = 1;
      samples[offset + 50] = 2;
      samples[offset + 51] = 1;
      samples[offset + 52] = 0.2;
      samples[offset + 53] = 0;
      samples[offset + 59] = 0.05;
      samples[offset + 76] = 0.1;
      samples[offset + 82] = 0.3;
      samples[offset + 88] = 0.1;
      samples[offset + 92] = 0;
    }

    const review = analyzeReviewSupport({
      samplingFrequencyHz: 100,
      unit: "mV",
      leads: [{ name: "Lead II", samples }],
    });

    expect(review.landmarks.map((landmark) => landmark.kind)).toEqual([
      "p-onset",
      "qrs-onset",
      "r-peak",
      "qrs-offset",
      "st-point",
      "t-end",
    ]);
    expect(review.landmarkConfidence.items.map((item) => item.kind)).toEqual([
      "p-onset",
      "qrs-onset",
      "r-peak",
      "qrs-offset",
      "st-point",
      "t-end",
    ]);
    expect(review.landmarkConfidence.score).toBeGreaterThan(55);
    expect(
      review.measurements.find((measurement) => measurement.code === "pr")
        ?.status,
    ).toBe("estimated");
    expect(
      review.measurements.find((measurement) => measurement.code === "qrs")
        ?.status,
    ).toBe("estimated");
    expect(
      review.measurements.find((measurement) => measurement.code === "qt")
        ?.status,
    ).toBe("estimated");
    expect(
      review.measurements.find((measurement) => measurement.code === "qtc")
        ?.status,
    ).toBe("estimated");
    expect(
      review.measurements.find(
        (measurement) => measurement.code === "st-deviation",
      )?.value,
    ).toBe("0.040 mV");
  });
});

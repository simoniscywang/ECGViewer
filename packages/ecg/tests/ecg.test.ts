import { describe, expect, it } from "vitest";
import { downsampleMinMax, sliceTimeWindow, summarizeEcg } from "../src/index";

describe("ECG signal helpers", () => {
  it("summarizes a multi-lead ECG record", () => {
    const summary = summarizeEcg({
      samplingFrequencyHz: 2,
      unit: "mV",
      leads: [
        { name: "I", samples: new Float32Array([0, 1, -1, 0]) },
        { name: "II", samples: new Float32Array([0.5, 1.5, -0.5, 0.5]) }
      ]
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
      { x: 3, min: 1, max: 9 }
    ]);
  });

  it("slices samples by time window", () => {
    const window = sliceTimeWindow(new Float32Array([0, 1, 2, 3, 4]), 2, 0.5, 1);

    expect(Array.from(window)).toEqual([1, 2]);
  });
});

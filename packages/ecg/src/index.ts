export interface EcgLead {
  readonly name: string;
  readonly samples: Float32Array;
}

export interface EcgRecord {
  readonly patientId?: string | undefined;
  readonly observationId?: string | undefined;
  readonly effectiveDateTime?: string | undefined;
  readonly samplingFrequencyHz: number;
  readonly unit: string;
  readonly leads: readonly EcgLead[];
}

export interface EcgSummary {
  readonly durationSeconds: number;
  readonly leadCount: number;
  readonly sampleCountPerLead: number;
  readonly minAmplitude: number;
  readonly maxAmplitude: number;
  readonly meanAmplitude: number;
}

export interface DownsampledPoint {
  readonly x: number;
  readonly min: number;
  readonly max: number;
}

export type ReviewSupportStatus = "ready" | "for-review" | "limited";

export type ReviewSupportFeatureCode =
  | "signal-quality"
  | "rate-rr"
  | "beat-review"
  | "st-qt";

export interface ReviewSupportFeature {
  readonly code: ReviewSupportFeatureCode;
  readonly title: string;
  readonly status: ReviewSupportStatus;
  readonly value: string;
  readonly description: string;
  readonly evidence: readonly string[];
}

export interface RPeakMarker {
  readonly leadName: string;
  readonly sampleIndex: number;
  readonly timeSeconds: number;
  readonly amplitude: number;
}

export type EcgLandmarkKind =
  | "p-onset"
  | "qrs-onset"
  | "r-peak"
  | "qrs-offset"
  | "st-point"
  | "t-end";

export interface EcgLandmark {
  readonly kind: EcgLandmarkKind;
  readonly label: string;
  readonly leadName: string;
  readonly sampleIndex: number;
  readonly timeSeconds: number;
  readonly amplitude: number;
}

export type EcgReviewLevel = "good" | "review" | "limited";

export interface EcgSignalQuality {
  readonly leadName: string | undefined;
  readonly score: number;
  readonly level: EcgReviewLevel;
  readonly issues: readonly string[];
  readonly evidence: readonly string[];
}

export interface EcgLandmarkConfidenceItem {
  readonly kind: EcgLandmarkKind;
  readonly label: string;
  readonly score: number;
  readonly level: EcgReviewLevel;
  readonly evidence: readonly string[];
}

export interface EcgLandmarkConfidence {
  readonly score: number;
  readonly level: EcgReviewLevel;
  readonly items: readonly EcgLandmarkConfidenceItem[];
  readonly evidence: readonly string[];
}

export type EcgMeasurementCode = "pr" | "qrs" | "qt" | "qtc" | "st-deviation";

export interface EcgMeasurement {
  readonly code: EcgMeasurementCode;
  readonly label: string;
  readonly status: "estimated" | "unavailable";
  readonly value: string;
  readonly evidence: readonly string[];
}

export interface EcgReviewSupport {
  readonly primaryLeadName: string | undefined;
  readonly rPeaks: readonly RPeakMarker[];
  readonly rrIntervalsSeconds: readonly number[];
  readonly estimatedHeartRateBpm: number | undefined;
  readonly landmarks: readonly EcgLandmark[];
  readonly signalQuality: EcgSignalQuality;
  readonly landmarkConfidence: EcgLandmarkConfidence;
  readonly measurements: readonly EcgMeasurement[];
  readonly features: readonly ReviewSupportFeature[];
  readonly limitations: readonly string[];
}

export interface ReviewSupportOptions {
  readonly leadName?: string | undefined;
}

export function summarizeEcg(record: EcgRecord): EcgSummary {
  assertValidRecord(record);

  let minAmplitude = Number.POSITIVE_INFINITY;
  let maxAmplitude = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let count = 0;

  for (const lead of record.leads) {
    for (const sample of lead.samples) {
      minAmplitude = Math.min(minAmplitude, sample);
      maxAmplitude = Math.max(maxAmplitude, sample);
      sum += sample;
      count += 1;
    }
  }

  const sampleCountPerLead = record.leads[0]?.samples.length ?? 0;

  return {
    durationSeconds: sampleCountPerLead / record.samplingFrequencyHz,
    leadCount: record.leads.length,
    sampleCountPerLead,
    minAmplitude,
    maxAmplitude,
    meanAmplitude: sum / count,
  };
}

export function downsampleMinMax(
  samples: Float32Array,
  targetPoints: number,
): DownsampledPoint[] {
  if (targetPoints <= 0 || !Number.isFinite(targetPoints)) {
    throw new Error("targetPoints must be a positive finite number");
  }

  if (samples.length <= targetPoints) {
    return Array.from(samples, (value, index) => ({
      x: index,
      min: value,
      max: value,
    }));
  }

  const bucketSize = samples.length / targetPoints;
  const points: DownsampledPoint[] = [];

  for (let bucket = 0; bucket < targetPoints; bucket += 1) {
    const start = Math.floor(bucket * bucketSize);
    const end = Math.min(samples.length, Math.floor((bucket + 1) * bucketSize));
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (let index = start; index < end; index += 1) {
      const value = samples[index];
      if (value === undefined) continue;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    points.push({ x: start, min, max });
  }

  return points;
}

export function analyzeReviewSupport(
  record: EcgRecord,
  options: ReviewSupportOptions = {},
): EcgReviewSupport {
  const summary = summarizeEcg(record);
  const primaryLead = selectPrimaryLead(record, options.leadName);
  const rPeaks = primaryLead
    ? detectRPeaks(primaryLead, record.samplingFrequencyHz)
    : [];
  const rrIntervalsSeconds = calculateRrIntervals(rPeaks);
  const estimatedHeartRateBpm = estimateHeartRate(rrIntervalsSeconds);
  const amplitudeRange = summary.maxAmplitude - summary.minAmplitude;
  const qualityIssues = collectSignalQualityIssues(record);
  const rrVariability = coefficientOfVariation(rrIntervalsSeconds);
  const hasTwelveLeadContext = record.leads.length >= 12;
  const signalQuality = estimateSignalQuality(
    primaryLead,
    rPeaks,
    rrIntervalsSeconds,
  );
  const landmarkResult = primaryLead
    ? estimateLandmarksAndMeasurements(
        primaryLead,
        rPeaks,
        rrIntervalsSeconds,
        record.samplingFrequencyHz,
        record.unit,
      )
    : emptyLandmarkResult();
  const landmarkConfidence = estimateLandmarkConfidence(
    landmarkResult.landmarks,
    signalQuality,
    rrIntervalsSeconds,
  );

  return {
    primaryLeadName: primaryLead?.name,
    rPeaks,
    rrIntervalsSeconds,
    estimatedHeartRateBpm,
    landmarks: landmarkResult.landmarks,
    signalQuality,
    landmarkConfidence,
    measurements: landmarkResult.measurements,
    features: [
      {
        code: "signal-quality",
        title: "Signal quality",
        status: signalQuality.level === "limited" ? "limited" : "ready",
        value: `${signalQuality.score}% ${signalQuality.level}`,
        description:
          "Lead-level quality screen for flat signal, clipping, drift, noise, and R-peak stability.",
        evidence: [
          ...signalQuality.evidence,
          ...(qualityIssues.length === 0
            ? [
                `Record amplitude range ${amplitudeRange.toFixed(3)} ${record.unit}`,
              ]
            : qualityIssues),
        ],
      },
      {
        code: "rate-rr",
        title: "Rate / RR",
        status: estimatedHeartRateBpm === undefined ? "limited" : "for-review",
        value:
          estimatedHeartRateBpm === undefined
            ? "insufficient R peaks"
            : `est. ${estimatedHeartRateBpm.toFixed(0)} bpm`,
        description:
          "Estimated from R-R intervals on a selected review lead; not a rhythm diagnosis.",
        evidence:
          rrIntervalsSeconds.length > 0
            ? [
                `${rrIntervalsSeconds.length} RR intervals`,
                `primary lead ${primaryLead?.name ?? "unknown"}`,
              ]
            : ["Need at least two estimated R peaks"],
      },
      {
        code: "beat-review",
        title: "Beat review",
        status: rPeaks.length >= 3 ? "for-review" : "limited",
        value: `${rPeaks.length} R peaks`,
        description:
          "Estimated markers support beat overlay and premature beat candidate review.",
        evidence:
          rrVariability === undefined
            ? [`primary lead ${primaryLead?.name ?? "unknown"}`]
            : [`RR variability ${(rrVariability * 100).toFixed(1)}%`],
      },
      {
        code: "st-qt",
        title: "ST / QT",
        status:
          landmarkResult.landmarks.length > 0
            ? "for-review"
            : hasTwelveLeadContext
              ? "for-review"
              : "limited",
        value:
          landmarkResult.measurements.filter(
            (measurement) => measurement.status === "estimated",
          ).length > 0
            ? `${landmarkResult.measurements.filter((measurement) => measurement.status === "estimated").length} estimates`
            : hasTwelveLeadContext
              ? "multi-lead context"
              : "limited lead context",
        description:
          "Estimated PR, QRS, QT, QTc, and ST values use heuristic landmarks for review only.",
        evidence:
          landmarkResult.landmarks.length > 0
            ? [
                `Landmark confidence ${landmarkConfidence.score}% ${landmarkConfidence.level}`,
                ...landmarkResult.landmarks.map(
                  (landmark) =>
                    `${landmark.label} ${landmark.timeSeconds.toFixed(3)} s`,
                ),
              ]
            : hasTwelveLeadContext
              ? ["12-lead context available"]
              : [`${record.leads.length} leads available`],
      },
    ],
    limitations: [
      "Review support is non-diagnostic and must be confirmed against the original waveform.",
      "R peaks and heart rate are initial estimates and may be affected by noise or morphology.",
      "ST, PR, QRS, QT, and QTc are estimated with heuristic landmarks until validated detection is available.",
    ],
  };
}

export function sliceTimeWindow(
  samples: Float32Array,
  samplingFrequencyHz: number,
  startSeconds: number,
  durationSeconds: number,
): Float32Array {
  if (samplingFrequencyHz <= 0)
    throw new Error("samplingFrequencyHz must be positive");
  if (startSeconds < 0) throw new Error("startSeconds must be non-negative");
  if (durationSeconds <= 0) throw new Error("durationSeconds must be positive");

  const start = Math.floor(startSeconds * samplingFrequencyHz);
  const end = Math.min(
    samples.length,
    Math.ceil((startSeconds + durationSeconds) * samplingFrequencyHz),
  );
  return samples.slice(start, end);
}

function selectPrimaryLead(
  record: EcgRecord,
  requestedLeadName: string | undefined,
): EcgLead | undefined {
  if (requestedLeadName) {
    const normalizedRequest = normalizeLeadName(requestedLeadName);
    const requestedLead = record.leads.find(
      (candidate) => normalizeLeadName(candidate.name) === normalizedRequest,
    );
    if (requestedLead) return requestedLead;
  }

  const preferredNames = ["II", "I", "V5", "V2"];
  for (const name of preferredNames) {
    const lead = record.leads.find(
      (candidate) => normalizeLeadName(candidate.name) === name,
    );
    if (lead) return lead;
  }
  return record.leads[0];
}

function normalizeLeadName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/^LEAD\s+/, "")
    .replace(/\s+/g, "");
}

function detectRPeaks(
  lead: EcgLead,
  samplingFrequencyHz: number,
): RPeakMarker[] {
  const stats = summarizeSamples(lead.samples);
  const dynamicRange = stats.max - stats.min;
  if (lead.samples.length < 3 || dynamicRange <= 0) return [];

  const threshold = dynamicRange * 0.22;
  const minimumDistanceSamples = Math.max(
    1,
    Math.round(samplingFrequencyHz * 0.25),
  );
  const peaks: RPeakMarker[] = [];

  for (let index = 1; index < lead.samples.length - 1; index += 1) {
    const current = lead.samples[index] ?? 0;
    const previous = lead.samples[index - 1] ?? 0;
    const next = lead.samples[index + 1] ?? 0;
    const currentMagnitude = Math.abs(current - stats.mean);
    const previousMagnitude = Math.abs(previous - stats.mean);
    const nextMagnitude = Math.abs(next - stats.mean);
    if (
      currentMagnitude < threshold ||
      currentMagnitude < previousMagnitude ||
      currentMagnitude < nextMagnitude
    ) {
      continue;
    }

    const lastPeak = peaks[peaks.length - 1];
    if (!lastPeak || index - lastPeak.sampleIndex >= minimumDistanceSamples) {
      peaks.push({
        leadName: lead.name,
        sampleIndex: index,
        timeSeconds: index / samplingFrequencyHz,
        amplitude: current,
      });
      continue;
    }

    if (currentMagnitude > Math.abs(lastPeak.amplitude - stats.mean)) {
      peaks[peaks.length - 1] = {
        leadName: lead.name,
        sampleIndex: index,
        timeSeconds: index / samplingFrequencyHz,
        amplitude: current,
      };
    }
  }

  return peaks;
}

function calculateRrIntervals(peaks: readonly RPeakMarker[]): number[] {
  const intervals: number[] = [];
  for (let index = 1; index < peaks.length; index += 1) {
    const current = peaks[index];
    const previous = peaks[index - 1];
    if (!current || !previous) continue;
    intervals.push(current.timeSeconds - previous.timeSeconds);
  }
  return intervals;
}

function estimateHeartRate(
  rrIntervalsSeconds: readonly number[],
): number | undefined {
  const averageRr = mean(rrIntervalsSeconds);
  return averageRr === undefined || averageRr <= 0 ? undefined : 60 / averageRr;
}

function estimateLandmarksAndMeasurements(
  lead: EcgLead,
  rPeaks: readonly RPeakMarker[],
  rrIntervalsSeconds: readonly number[],
  samplingFrequencyHz: number,
  unit: string,
): {
  readonly landmarks: readonly EcgLandmark[];
  readonly measurements: readonly EcgMeasurement[];
} {
  const rPeak = selectRepresentativePeak(
    rPeaks,
    lead.samples.length,
    samplingFrequencyHz,
  );
  if (!rPeak) return emptyLandmarkResult();

  const stats = summarizeSamples(lead.samples);
  const baseline = estimateLocalBaseline(
    lead.samples,
    rPeak.sampleIndex,
    samplingFrequencyHz,
    stats.mean,
  );
  const qrsThreshold = Math.max((stats.max - stats.min) * 0.08, 0.001);
  const qrsOnsetIndex = findBoundaryTowardBaseline(
    lead.samples,
    rPeak.sampleIndex,
    -1,
    baseline,
    qrsThreshold,
    Math.round(samplingFrequencyHz * 0.12),
  );
  const qrsOffsetIndex = findBoundaryTowardBaseline(
    lead.samples,
    rPeak.sampleIndex,
    1,
    baseline,
    qrsThreshold,
    Math.round(samplingFrequencyHz * 0.14),
  );
  const pOnsetIndex = findWaveOnsetBeforeQrs(
    lead.samples,
    qrsOnsetIndex,
    baseline,
    samplingFrequencyHz,
  );
  const tEndIndex = findTEndAfterQrs(
    lead.samples,
    qrsOffsetIndex,
    baseline,
    samplingFrequencyHz,
  );
  const stPointIndex = clampIndex(
    qrsOffsetIndex + Math.round(samplingFrequencyHz * 0.06),
    lead.samples.length,
  );
  const landmarks: EcgLandmark[] = [
    buildLandmark(
      "qrs-onset",
      "QRS onset",
      lead,
      qrsOnsetIndex,
      samplingFrequencyHz,
    ),
    buildLandmark(
      "r-peak",
      "R peak",
      lead,
      rPeak.sampleIndex,
      samplingFrequencyHz,
    ),
    buildLandmark(
      "qrs-offset",
      "QRS offset",
      lead,
      qrsOffsetIndex,
      samplingFrequencyHz,
    ),
    buildLandmark(
      "st-point",
      "ST point",
      lead,
      stPointIndex,
      samplingFrequencyHz,
    ),
  ];

  if (pOnsetIndex !== undefined) {
    landmarks.unshift(
      buildLandmark(
        "p-onset",
        "P onset",
        lead,
        pOnsetIndex,
        samplingFrequencyHz,
      ),
    );
  }
  if (tEndIndex !== undefined) {
    landmarks.push(
      buildLandmark("t-end", "T end", lead, tEndIndex, samplingFrequencyHz),
    );
  }

  const averageRr = mean(rrIntervalsSeconds);
  const measurements: EcgMeasurement[] = [
    buildDurationMeasurement(
      "pr",
      "PR",
      pOnsetIndex,
      qrsOnsetIndex,
      samplingFrequencyHz,
      ["P onset to QRS onset"],
    ),
    buildDurationMeasurement(
      "qrs",
      "QRS",
      qrsOnsetIndex,
      qrsOffsetIndex,
      samplingFrequencyHz,
      ["QRS onset to QRS offset"],
    ),
    buildDurationMeasurement(
      "qt",
      "QT",
      qrsOnsetIndex,
      tEndIndex,
      samplingFrequencyHz,
      ["QRS onset to T end"],
    ),
    buildQtcMeasurement(
      qrsOnsetIndex,
      tEndIndex,
      averageRr,
      samplingFrequencyHz,
    ),
    {
      code: "st-deviation",
      label: "ST deviation",
      status: "estimated",
      value: `${((lead.samples[stPointIndex] ?? baseline) - baseline).toFixed(3)} ${unit}`,
      evidence: [
        `ST point at ${((stPointIndex / samplingFrequencyHz) * 1000).toFixed(0)} ms`,
      ],
    },
  ];

  return { landmarks, measurements };
}

function emptyLandmarkResult(): {
  readonly landmarks: readonly EcgLandmark[];
  readonly measurements: readonly EcgMeasurement[];
} {
  return {
    landmarks: [],
    measurements: [
      unavailableMeasurement("pr", "PR", "No representative beat available"),
      unavailableMeasurement("qrs", "QRS", "No representative beat available"),
      unavailableMeasurement("qt", "QT", "No representative beat available"),
      unavailableMeasurement("qtc", "QTc", "No representative beat available"),
      unavailableMeasurement(
        "st-deviation",
        "ST deviation",
        "No representative beat available",
      ),
    ],
  };
}

function selectRepresentativePeak(
  rPeaks: readonly RPeakMarker[],
  sampleCount: number,
  samplingFrequencyHz: number,
): RPeakMarker | undefined {
  const minimumBefore = Math.round(samplingFrequencyHz * 0.28);
  const minimumAfter = Math.round(samplingFrequencyHz * 0.48);
  const candidates = rPeaks.filter(
    (peak) =>
      peak.sampleIndex >= minimumBefore &&
      sampleCount - peak.sampleIndex > minimumAfter,
  );
  return candidates[Math.floor(candidates.length / 2)] ?? rPeaks[0];
}

function estimateLocalBaseline(
  samples: Float32Array,
  rPeakIndex: number,
  samplingFrequencyHz: number,
  fallback: number,
): number {
  const start = clampIndex(
    rPeakIndex - Math.round(samplingFrequencyHz * 0.24),
    samples.length,
  );
  const end = clampIndex(
    rPeakIndex - Math.round(samplingFrequencyHz * 0.16),
    samples.length,
  );
  if (end <= start) return fallback;
  return mean(Array.from(samples.slice(start, end))) ?? fallback;
}

function findBoundaryTowardBaseline(
  samples: Float32Array,
  startIndex: number,
  direction: -1 | 1,
  baseline: number,
  threshold: number,
  maxDistanceSamples: number,
): number {
  const endIndex = clampIndex(
    startIndex + direction * maxDistanceSamples,
    samples.length,
  );
  let index = startIndex;
  while (index !== endIndex) {
    const next = index + direction;
    if (next < 0 || next >= samples.length) break;
    index = next;
    if (Math.abs((samples[index] ?? baseline) - baseline) <= threshold)
      return index;
  }
  return clampIndex(index, samples.length);
}

function findWaveOnsetBeforeQrs(
  samples: Float32Array,
  qrsOnsetIndex: number,
  baseline: number,
  samplingFrequencyHz: number,
): number | undefined {
  const windowStart = clampIndex(
    qrsOnsetIndex - Math.round(samplingFrequencyHz * 0.24),
    samples.length,
  );
  const windowEnd = clampIndex(
    qrsOnsetIndex - Math.round(samplingFrequencyHz * 0.06),
    samples.length,
  );
  if (windowEnd <= windowStart) return undefined;
  const peakIndex = findMaxDeviationIndex(
    samples,
    windowStart,
    windowEnd,
    baseline,
  );
  if (peakIndex === undefined) return undefined;
  const peakMagnitude = Math.abs((samples[peakIndex] ?? baseline) - baseline);
  if (peakMagnitude < 0.01) return undefined;
  return findBoundaryTowardBaseline(
    samples,
    peakIndex,
    -1,
    baseline,
    peakMagnitude * 0.25,
    peakIndex - windowStart,
  );
}

function findTEndAfterQrs(
  samples: Float32Array,
  qrsOffsetIndex: number,
  baseline: number,
  samplingFrequencyHz: number,
): number | undefined {
  const windowStart = clampIndex(
    qrsOffsetIndex + Math.round(samplingFrequencyHz * 0.08),
    samples.length,
  );
  const windowEnd = clampIndex(
    qrsOffsetIndex + Math.round(samplingFrequencyHz * 0.44),
    samples.length,
  );
  if (windowEnd <= windowStart) return undefined;
  const peakIndex = findMaxDeviationIndex(
    samples,
    windowStart,
    windowEnd,
    baseline,
  );
  if (peakIndex === undefined) return undefined;
  const peakMagnitude = Math.abs((samples[peakIndex] ?? baseline) - baseline);
  if (peakMagnitude < 0.01) return undefined;
  return findBoundaryTowardBaseline(
    samples,
    peakIndex,
    1,
    baseline,
    peakMagnitude * 0.25,
    windowEnd - peakIndex,
  );
}

function findMaxDeviationIndex(
  samples: Float32Array,
  start: number,
  end: number,
  baseline: number,
): number | undefined {
  let bestIndex: number | undefined;
  let bestMagnitude = 0;
  for (let index = start; index < end; index += 1) {
    const magnitude = Math.abs((samples[index] ?? baseline) - baseline);
    if (magnitude > bestMagnitude) {
      bestIndex = index;
      bestMagnitude = magnitude;
    }
  }
  return bestIndex;
}

function buildLandmark(
  kind: EcgLandmarkKind,
  label: string,
  lead: EcgLead,
  sampleIndex: number,
  samplingFrequencyHz: number,
): EcgLandmark {
  return {
    kind,
    label,
    leadName: lead.name,
    sampleIndex,
    timeSeconds: sampleIndex / samplingFrequencyHz,
    amplitude: lead.samples[sampleIndex] ?? 0,
  };
}

function buildDurationMeasurement(
  code: Extract<EcgMeasurementCode, "pr" | "qrs" | "qt">,
  label: string,
  startIndex: number | undefined,
  endIndex: number | undefined,
  samplingFrequencyHz: number,
  evidence: readonly string[],
): EcgMeasurement {
  if (
    startIndex === undefined ||
    endIndex === undefined ||
    endIndex <= startIndex
  ) {
    return unavailableMeasurement(
      code,
      label,
      "Required landmarks unavailable",
    );
  }
  const valueMs = ((endIndex - startIndex) / samplingFrequencyHz) * 1000;
  return {
    code,
    label,
    status: "estimated",
    value: `${valueMs.toFixed(0)} ms`,
    evidence,
  };
}

function buildQtcMeasurement(
  qrsOnsetIndex: number | undefined,
  tEndIndex: number | undefined,
  averageRrSeconds: number | undefined,
  samplingFrequencyHz: number,
): EcgMeasurement {
  if (
    qrsOnsetIndex === undefined ||
    tEndIndex === undefined ||
    tEndIndex <= qrsOnsetIndex ||
    averageRrSeconds === undefined ||
    averageRrSeconds <= 0
  ) {
    return unavailableMeasurement("qtc", "QTc", "QT or RR unavailable");
  }
  const qtSeconds = (tEndIndex - qrsOnsetIndex) / samplingFrequencyHz;
  const qtcMs = (qtSeconds / Math.sqrt(averageRrSeconds)) * 1000;
  return {
    code: "qtc",
    label: "QTc",
    status: "estimated",
    value: `${qtcMs.toFixed(0)} ms`,
    evidence: ["Bazett correction"],
  };
}

function unavailableMeasurement(
  code: EcgMeasurementCode,
  label: string,
  reason: string,
): EcgMeasurement {
  return {
    code,
    label,
    status: "unavailable",
    value: "unavailable",
    evidence: [reason],
  };
}

function clampIndex(index: number, length: number): number {
  return Math.min(length - 1, Math.max(0, index));
}

function estimateSignalQuality(
  lead: EcgLead | undefined,
  rPeaks: readonly RPeakMarker[],
  rrIntervalsSeconds: readonly number[],
): EcgSignalQuality {
  if (!lead) {
    return {
      leadName: undefined,
      score: 0,
      level: "limited",
      issues: ["No lead available"],
      evidence: ["Need a waveform lead before estimating quality"],
    };
  }

  const stats = summarizeSamples(lead.samples);
  const dynamicRange = stats.max - stats.min;
  const repeatedExtremeRatio =
    dynamicRange > 0
      ? countRepeatedExtremes(lead.samples, stats.min, stats.max) /
        lead.samples.length
      : 1;
  const driftRatio = estimateBaselineDriftRatio(lead.samples, dynamicRange);
  const noiseRatio = estimateNoiseRatio(lead.samples, dynamicRange);
  const rrVariability = coefficientOfVariation(rrIntervalsSeconds);
  const issues: string[] = [];
  let score = 100;

  if (dynamicRange < 0.01) {
    issues.push("low dynamic range");
    score -= 45;
  }
  if (repeatedExtremeRatio > 0.05) {
    issues.push("possible clipping");
    score -= Math.min(25, repeatedExtremeRatio * 160);
  }
  if (driftRatio > 0.35) {
    issues.push("possible baseline drift");
    score -= Math.min(25, (driftRatio - 0.35) * 80);
  }
  if (noiseRatio > 0.45) {
    issues.push("high sample-to-sample variation");
    score -= Math.min(25, (noiseRatio - 0.45) * 70);
  }
  if (rPeaks.length < 2) {
    issues.push("insufficient R peaks");
    score -= 25;
  }
  if (rrVariability !== undefined && rrVariability > 0.2) {
    issues.push("irregular RR intervals affect landmark stability");
    score -= Math.min(20, (rrVariability - 0.2) * 70);
  }

  const normalizedScore = clampPercentage(score);
  return {
    leadName: lead.name,
    score: normalizedScore,
    level: reviewLevelForScore(normalizedScore),
    issues,
    evidence: [
      `Range ${dynamicRange.toFixed(3)}`,
      `Drift ${(driftRatio * 100).toFixed(1)}%`,
      `Noise ${(noiseRatio * 100).toFixed(1)}%`,
      `${rPeaks.length} R peaks`,
    ],
  };
}

function estimateLandmarkConfidence(
  landmarks: readonly EcgLandmark[],
  signalQuality: EcgSignalQuality,
  rrIntervalsSeconds: readonly number[],
): EcgLandmarkConfidence {
  if (landmarks.length === 0) {
    return {
      score: 0,
      level: "limited",
      items: [],
      evidence: ["No representative beat landmarks available"],
    };
  }

  const rrVariability = coefficientOfVariation(rrIntervalsSeconds);
  const items = landmarks.map((landmark) => {
    const score = clampPercentage(
      signalQuality.score -
        landmarkDifficultyPenalty(landmark.kind) -
        (rrVariability !== undefined && rrVariability > 0.2 ? 10 : 0),
    );
    return {
      kind: landmark.kind,
      label: landmark.label,
      score,
      level: reviewLevelForScore(score),
      evidence: [
        `${landmark.label} at ${(landmark.timeSeconds * 1000).toFixed(0)} ms`,
        `Lead quality ${signalQuality.score}%`,
      ],
    };
  });
  const overallScore = clampPercentage(
    mean(items.map((item) => item.score)) ?? 0,
  );

  return {
    score: overallScore,
    level: reviewLevelForScore(overallScore),
    items,
    evidence: [
      `${items.length} estimated landmarks`,
      ...(rrVariability === undefined
        ? ["RR stability unavailable"]
        : [`RR variability ${(rrVariability * 100).toFixed(1)}%`]),
    ],
  };
}

function landmarkDifficultyPenalty(kind: EcgLandmarkKind): number {
  if (kind === "r-peak") return 0;
  if (kind === "qrs-onset" || kind === "qrs-offset") return 8;
  if (kind === "st-point") return 12;
  return 18;
}

function reviewLevelForScore(score: number): EcgReviewLevel {
  if (score >= 80) return "good";
  if (score >= 55) return "review";
  return "limited";
}

function clampPercentage(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

function collectSignalQualityIssues(record: EcgRecord): string[] {
  const issues: string[] = [];
  for (const lead of record.leads) {
    const stats = summarizeSamples(lead.samples);
    const dynamicRange = stats.max - stats.min;
    if (dynamicRange < 0.01) {
      issues.push(`${lead.name}: low dynamic range`);
    }
    const repeatedExtremeRatio =
      countRepeatedExtremes(lead.samples, stats.min, stats.max) /
      lead.samples.length;
    if (repeatedExtremeRatio > 0.05) {
      issues.push(`${lead.name}: possible clipping`);
    }
    const driftRatio = estimateBaselineDriftRatio(lead.samples, dynamicRange);
    if (driftRatio > 0.35) {
      issues.push(`${lead.name}: possible baseline drift`);
    }
  }
  return issues;
}

function summarizeSamples(samples: Float32Array): {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
} {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const sample of samples) {
    min = Math.min(min, sample);
    max = Math.max(max, sample);
    sum += sample;
  }
  return { min, max, mean: sum / samples.length };
}

function countRepeatedExtremes(
  samples: Float32Array,
  min: number,
  max: number,
): number {
  let count = 0;
  for (const sample of samples) {
    if (sample === min || sample === max) count += 1;
  }
  return count;
}

function estimateBaselineDriftRatio(
  samples: Float32Array,
  dynamicRange: number,
): number {
  if (samples.length < 12 || dynamicRange <= 0) return 0;

  const windowSize = Math.max(4, Math.floor(samples.length / 8));
  const means: number[] = [];
  for (let start = 0; start < samples.length; start += windowSize) {
    const end = Math.min(samples.length, start + windowSize);
    let sum = 0;
    for (let index = start; index < end; index += 1) {
      sum += samples[index] ?? 0;
    }
    means.push(sum / (end - start));
  }

  return (Math.max(...means) - Math.min(...means)) / dynamicRange;
}

function estimateNoiseRatio(
  samples: Float32Array,
  dynamicRange: number,
): number {
  if (samples.length < 3 || dynamicRange <= 0) return 0;
  let totalDelta = 0;
  for (let index = 1; index < samples.length; index += 1) {
    totalDelta += Math.abs((samples[index] ?? 0) - (samples[index - 1] ?? 0));
  }
  return totalDelta / (samples.length - 1) / dynamicRange;
}

function coefficientOfVariation(values: readonly number[]): number | undefined {
  const valueMean = mean(values);
  if (valueMean === undefined || valueMean === 0) return undefined;
  const variance =
    values.reduce((sum, value) => sum + (value - valueMean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance) / valueMean;
}

function mean(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function assertValidRecord(record: EcgRecord): void {
  if (record.samplingFrequencyHz <= 0) {
    throw new Error("samplingFrequencyHz must be positive");
  }
  if (record.leads.length === 0) {
    throw new Error("record must contain at least one lead");
  }
  const expectedLength = record.leads[0]?.samples.length;
  if (!expectedLength) {
    throw new Error("lead samples must not be empty");
  }
  for (const lead of record.leads) {
    if (lead.samples.length !== expectedLength) {
      throw new Error("all leads must have the same sample count");
    }
  }
}

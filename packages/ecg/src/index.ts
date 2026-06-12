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
    meanAmplitude: sum / count
  };
}

export function downsampleMinMax(
  samples: Float32Array,
  targetPoints: number
): DownsampledPoint[] {
  if (targetPoints <= 0 || !Number.isFinite(targetPoints)) {
    throw new Error("targetPoints must be a positive finite number");
  }

  if (samples.length <= targetPoints) {
    return Array.from(samples, (value, index) => ({ x: index, min: value, max: value }));
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

export function sliceTimeWindow(
  samples: Float32Array,
  samplingFrequencyHz: number,
  startSeconds: number,
  durationSeconds: number
): Float32Array {
  if (samplingFrequencyHz <= 0) throw new Error("samplingFrequencyHz must be positive");
  if (startSeconds < 0) throw new Error("startSeconds must be non-negative");
  if (durationSeconds <= 0) throw new Error("durationSeconds must be positive");

  const start = Math.floor(startSeconds * samplingFrequencyHz);
  const end = Math.min(samples.length, Math.ceil((startSeconds + durationSeconds) * samplingFrequencyHz));
  return samples.slice(start, end);
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

import { type EcgLandmark, type EcgMeasurementCode } from "@ecgviewer/ecg";

export function filterLandmarksForMeasurement(
  landmarks: readonly EcgLandmark[],
  measurementCode: EcgMeasurementCode | null,
): readonly EcgLandmark[] {
  if (!measurementCode) return [];
  const landmarkKindsByMeasurement: Record<
    EcgMeasurementCode,
    readonly EcgLandmark["kind"][]
  > = {
    pr: ["p-onset", "qrs-onset"],
    qrs: ["qrs-onset", "r-peak", "qrs-offset"],
    qt: ["qrs-onset", "r-peak", "t-end"],
    qtc: ["qrs-onset", "r-peak", "t-end"],
    "st-deviation": ["qrs-offset", "st-point"],
  };
  const visibleKinds = landmarkKindsByMeasurement[measurementCode];
  return landmarks.filter((landmark) => visibleKinds.includes(landmark.kind));
}

export function landmarkCode(kind: EcgLandmark["kind"]): string {
  const codes: Record<EcgLandmark["kind"], string> = {
    "p-onset": "P",
    "qrs-onset": "S",
    "r-peak": "R",
    "qrs-offset": "E",
    "st-point": "ST",
    "t-end": "T",
  };
  return codes[kind];
}

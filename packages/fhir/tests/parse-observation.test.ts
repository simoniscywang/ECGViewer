import { describe, expect, it } from "vitest";
import { FhirEcgParseError, parseFhirEcgObservation } from "../src/index";

const observation = {
  resourceType: "Observation",
  id: "obs-1",
  subject: { reference: "Patient/patient-1" },
  effectiveDateTime: "2026-01-01T00:00:00Z",
  component: [
    {
      code: { text: "I" },
      valueSampledData: {
        origin: { value: 0 },
        period: 2,
        factor: 0.001,
        unit: "mV",
        data: "0 1000 -1000 500"
      }
    }
  ]
};

describe("parseFhirEcgObservation", () => {
  it("parses SampledData ECG components into a normalized record", () => {
    const record = parseFhirEcgObservation(observation, {
      expectedPatientId: "patient-1",
      expectedObservationId: "obs-1"
    });

    expect(record.patientId).toBe("patient-1");
    expect(record.observationId).toBe("obs-1");
    expect(record.samplingFrequencyHz).toBe(500);
    expect(record.unit).toBe("mV");
    expect(record.leads[0]?.name).toBe("I");
    expect(Array.from(record.leads[0]?.samples ?? [])).toEqual([0, 1, -1, 0.5]);
  });

  it("rejects Patient mismatches", () => {
    expect(() =>
      parseFhirEcgObservation(observation, { expectedPatientId: "other-patient" })
    ).toThrow(FhirEcgParseError);
  });

  it("rejects non Observation resources", () => {
    expect(() => parseFhirEcgObservation({ resourceType: "Patient" })).toThrow(
      /resourceType must be Observation/
    );
  });
});

import {
  buildEcgReportDocument,
  createEcgReportPdf,
  parseEcgReportRequest,
} from "./ecg-report";
import { describe, expect, it } from "vitest";

const validRequest = {
  patient: [{ label: "Patient id", value: "patient-1" }],
  observation: [{ label: "Observation id", value: "observation-1" }],
  metrics: [{ label: "Duration", value: "10.00 s" }],
  reviewSupport: [
    {
      title: "Signal Quality",
      fields: [{ label: "Quality", value: "92% good" }],
      lines: ["Stable baseline"],
    },
  ],
  graph: [{ label: "Displayed leads", value: "I, II" }],
  graphImages: [
    {
      label: "Lead II",
      dataUrl:
        "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ap//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAARD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z",
      width: 2,
      height: 2,
    },
  ],
  physicianInterpretation: "竇性節律供覆核。No diagnostic conclusion.",
  generatedAt: "2026-06-15T00:00:00.000Z",
};

describe("ECG report generation", () => {
  it("validates a report payload and creates a PDF document", () => {
    const request = parseEcgReportRequest(validRequest);
    const report = buildEcgReportDocument(request);
    const pdf = createEcgReportPdf(report);
    const header = new TextDecoder().decode(pdf.slice(0, 8));
    const text = new TextDecoder().decode(pdf);

    expect(report.physicianInterpretation).toContain("竇性節律");
    expect(header).toBe("%PDF-1.4");
    expect(text).toContain("/Subtype /Image");
    expect(text.toLowerCase()).not.toContain("<feff");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("rejects oversized physician interpretation text", () => {
    expect(() =>
      parseEcgReportRequest({
        ...validRequest,
        physicianInterpretation: "x".repeat(4001),
      }),
    ).toThrow(/physicianInterpretation/);
  });
});

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  filterLandmarksForMeasurement,
  landmarkCode,
} from "@/components/review-support/landmarks";
import {
  defaultReviewSupportCardIds,
  reviewSupportCardGroups,
  type ReviewSupportCardId,
} from "@/components/review-support/review-support-catalog";
import { ReviewSupportPanel } from "@/components/review-support/review-support-panel";
import type {
  EcgReportRequest,
  ReportImage,
  ReportSection,
} from "@/lib/ecg-report";
import {
  analyzeReviewSupport,
  downsampleMinMax,
  summarizeEcg,
  type EcgLandmark,
  type EcgMeasurementCode,
  type EcgRecord,
  type RPeakMarker,
} from "@ecgviewer/ecg";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RotateCcw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface SerializedLead {
  readonly name: string;
  readonly samples: readonly number[];
}

interface SerializedRecord extends Omit<EcgRecord, "leads"> {
  readonly leads: readonly SerializedLead[];
}

interface PatientSummary {
  readonly id: string;
  readonly name: string;
  readonly gender?: string;
  readonly birthDate?: string;
  readonly identifiers: readonly string[];
}

interface ObservationSummary {
  readonly id: string;
  readonly status?: string;
  readonly code: string;
  readonly category: readonly string[];
  readonly effectiveDateTime?: string;
  readonly issued?: string;
  readonly subjectReference?: string;
}

interface ViewerResponse {
  readonly record: SerializedRecord;
  readonly patient: PatientSummary;
  readonly observation: ObservationSummary;
}

interface ViewerErrorResponse {
  readonly message?: string;
  readonly error?: string;
}

interface HydratedViewerResponse {
  readonly record: EcgRecord;
  readonly patient: PatientSummary;
  readonly observation: ObservationSummary;
}

interface EcgViewerProps {
  readonly patientId: string;
  readonly observationId: string;
}

type LoadState =
  | { readonly status: "idle" | "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly data: HydratedViewerResponse };

type ReportState =
  | { readonly status: "idle" }
  | { readonly status: "creating" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "ready";
      readonly reportId: string;
      readonly viewUrl: string;
      readonly downloadUrl: string;
      readonly objectUrl?: string;
      readonly downloadFilename?: string;
    };

interface ReportCreatedResponse {
  readonly reportId: string;
  readonly viewUrl: string;
  readonly downloadUrl: string;
  readonly pdfBase64?: string;
  readonly pdfFilename?: string;
}

type AiInterpretationState =
  | { readonly status: "idle" }
  | { readonly status: "creating" }
  | { readonly status: "error"; readonly message: string };

interface AiInterpretationResponse {
  readonly interpretation: string;
}

export function EcgViewer({ patientId, observationId }: EcgViewerProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!patientId || !observationId) {
      setState({
        status: "error",
        message: "缺少 Patient id 或 Observation id",
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    const params = new URLSearchParams({ patientId, observationId });
    fetch(`/api/fhir/observation?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await parseViewerError(response);
          throw new Error(
            errorBody.message ?? `FHIR request failed: ${response.status}`,
          );
        }
        return (await response.json()) as ViewerResponse;
      })
      .then((data) =>
        setState({ status: "ready", data: hydrateResponse(data) }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "無法讀取 ECG Observation",
        });
      });

    return () => controller.abort();
  }, [patientId, observationId]);

  if (state.status === "idle" || state.status === "loading")
    return <ViewerLoading />;
  if (state.status === "error") return <ViewerError message={state.message} />;
  if (state.status === "ready") return <ReadyViewer data={state.data} />;

  return null;
}

function ReadyViewer({ data }: { readonly data: HydratedViewerResponse }) {
  const [selectedReviewLeadName, setSelectedReviewLeadName] = useState("");
  const [selectedMeasurementCode, setSelectedMeasurementCode] =
    useState<EcgMeasurementCode | null>(null);
  const [selectedReviewCardIds, setSelectedReviewCardIds] = useState<
    readonly ReviewSupportCardId[]
  >(defaultReviewSupportCardIds);
  const [physicianInterpretation, setPhysicianInterpretation] = useState("");
  const [reportState, setReportState] = useState<ReportState>({
    status: "idle",
  });
  const [aiState, setAiState] = useState<AiInterpretationState>({
    status: "idle",
  });
  useEffect(() => {
    if (reportState.status !== "ready" || !reportState.objectUrl) return;
    return () => URL.revokeObjectURL(reportState.objectUrl ?? "");
  }, [reportState]);
  const summary = useMemo(() => summarizeEcg(data.record), [data.record]);
  const reviewSupport = useMemo(
    () =>
      analyzeReviewSupport(data.record, {
        leadName: selectedReviewLeadName || undefined,
      }),
    [data.record, selectedReviewLeadName],
  );
  const generateReport = async () => {
    setReportState({ status: "creating" });
    try {
      const graphImages = await collectGraphImages();
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          buildReportPayload({
            data,
            graphImages,
            physicianInterpretation,
            summary,
            reviewSupport,
          }),
        ),
      });
      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.status}`);
      }
      const payload = (await response.json()) as ReportCreatedResponse;
      const inlinePdf = createInlineReportUrls(payload);
      setReportState({
        status: "ready",
        reportId: payload.reportId,
        viewUrl: inlinePdf?.url ?? payload.viewUrl,
        downloadUrl: inlinePdf?.url ?? payload.downloadUrl,
        ...(inlinePdf
          ? {
              objectUrl: inlinePdf.url,
              downloadFilename: inlinePdf.filename,
            }
          : {}),
      });
    } catch {
      setReportState({
        status: "error",
        message: "ECG 分析報告產製失敗，請稍後再試。",
      });
    }
  };
  const generateAiInterpretation = async () => {
    setAiState({ status: "creating" });
    try {
      const graphImages = await collectGraphImages();
      const reportPayload = buildReportPayload({
        data,
        graphImages,
        physicianInterpretation,
        summary,
        reviewSupport,
      });
      const response = await fetch("/api/reports/ai-interpretation", {
        body: JSON.stringify({
          graph: reportPayload.graph,
          graphImages: reportPayload.graphImages,
          metrics: reportPayload.metrics,
          reviewSupport: reportPayload.reviewSupport,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`AI interpretation failed: ${response.status}`);
      }
      const payload = (await response.json()) as AiInterpretationResponse;
      setPhysicianInterpretation(payload.interpretation);
      setAiState({ status: "idle" });
    } catch {
      setAiState({
        status: "error",
        message: "AI 輔助判讀產生失敗，請稍後再試。",
      });
    }
  };

  return (
    <div className="space-y-2.5">
      <section className="grid gap-2 lg:grid-cols-[0.9fr_1.1fr]">
        <PatientPanel patient={data.patient} />
        <ObservationPanel observation={data.observation} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Duration"
          value={`${summary.durationSeconds.toFixed(2)} s`}
        />
        <MetricCard
          label="Sampling"
          value={`${data.record.samplingFrequencyHz.toFixed(1)} Hz`}
        />
        <MetricCard label="Leads" value={String(summary.leadCount)} />
        <MetricCard
          label="Amplitude"
          value={`${summary.minAmplitude.toFixed(3)} to ${summary.maxAmplitude.toFixed(3)} ${data.record.unit}`}
        />
      </section>

      <ReviewSupportPanel
        leads={data.record.leads}
        reviewSupport={reviewSupport}
        selectedCardIds={selectedReviewCardIds}
        selectedMeasurementCode={selectedMeasurementCode}
        selectedLeadName={reviewSupport.primaryLeadName ?? ""}
        onSelectedCardIdsChange={setSelectedReviewCardIds}
        onSelectedMeasurementCodeChange={setSelectedMeasurementCode}
        onSelectedLeadNameChange={setSelectedReviewLeadName}
      />

      <Card className="border-blue-100 bg-card/95 shadow-sm shadow-slate-900/5">
        <CardHeader className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              ECG Graph
            </CardTitle>
            <CardDescription className="text-xs">
              Downsampled waveform for review. This display is not diagnostic.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="px-1.5 py-0 text-[11px]">
              {data.record.unit}
            </Badge>
            <Badge className="px-1.5 py-0 text-[11px]">
              {data.record.samplingFrequencyHz.toFixed(1)} Hz
            </Badge>
            <Badge className="px-1.5 py-0 text-[11px]">
              {summary.sampleCountPerLead.toLocaleString()} samples/lead
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-2.5 pt-0">
          <div className="space-y-2">
            {data.record.leads.map((lead) => (
              <LeadWaveform
                key={lead.name}
                name={lead.name}
                samples={lead.samples}
                markers={
                  lead.name === reviewSupport.primaryLeadName
                    ? reviewSupport.rPeaks
                    : []
                }
                landmarks={
                  lead.name === reviewSupport.primaryLeadName
                    ? filterLandmarksForMeasurement(
                        reviewSupport.landmarks,
                        selectedMeasurementCode,
                      )
                    : []
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <ReportComposerCard
        interpretation={physicianInterpretation}
        isCreating={reportState.status === "creating"}
        isGeneratingAi={aiState.status === "creating"}
        aiError={aiState.status === "error" ? aiState.message : ""}
        reportError={reportState.status === "error" ? reportState.message : ""}
        onGenerateAiInterpretation={generateAiInterpretation}
        onGenerateReport={generateReport}
        onInterpretationChange={setPhysicianInterpretation}
      />

      {reportState.status === "ready" ? (
        <ReportPreviewDialog
          downloadUrl={reportState.downloadUrl}
          reportId={reportState.reportId}
          viewUrl={reportState.viewUrl}
          {...(reportState.downloadFilename
            ? { downloadFilename: reportState.downloadFilename }
            : {})}
          onClose={() => setReportState({ status: "idle" })}
        />
      ) : null}
    </div>
  );
}

function ReportComposerCard({
  interpretation,
  isCreating,
  isGeneratingAi,
  aiError,
  reportError,
  onGenerateAiInterpretation,
  onGenerateReport,
  onInterpretationChange,
}: {
  readonly interpretation: string;
  readonly isCreating: boolean;
  readonly isGeneratingAi: boolean;
  readonly aiError: string;
  readonly reportError: string;
  readonly onGenerateAiInterpretation: () => void;
  readonly onGenerateReport: () => void;
  readonly onInterpretationChange: (value: string) => void;
}) {
  return (
    <Card className="border-blue-100 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-primary" />
            ECG 判讀與報告
          </CardTitle>
          <CardDescription className="text-xs">
            請輸入醫師判讀說明；報告會彙整目前卡片資料與非診斷性量測摘要。
          </CardDescription>
        </div>
        <Badge className="px-1.5 py-0 text-[11px]">PDF report</Badge>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <label
          className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          htmlFor="physician-interpretation"
        >
          醫師判讀說明
        </label>
        <textarea
          className="mt-1 min-h-32 w-full resize-y rounded-md border border-blue-100 bg-white px-3 py-2 text-sm shadow-sm shadow-slate-900/5 outline-none transition placeholder:text-muted-foreground focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          id="physician-interpretation"
          maxLength={4000}
          onChange={(event) => onInterpretationChange(event.target.value)}
          placeholder="請輸入 ECG 判讀說明，例如節律、心率、傳導、ST-T 變化與臨床建議。"
          value={interpretation}
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            {interpretation.length.toLocaleString()} / 4,000 characters
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              disabled={isCreating || isGeneratingAi}
              onClick={onGenerateAiInterpretation}
              size="sm"
              type="button"
              variant="outline"
            >
              {isGeneratingAi ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI輔助判讀
            </Button>
            <Button
              disabled={isCreating || isGeneratingAi}
              onClick={onGenerateReport}
              size="sm"
              type="button"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              報告產製
            </Button>
          </div>
        </div>
        {aiError ? (
          <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
            {aiError}
          </p>
        ) : null}
        {reportError ? (
          <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
            {reportError}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReportPreviewDialog({
  reportId,
  viewUrl,
  downloadUrl,
  downloadFilename,
  onClose,
}: {
  readonly reportId: string;
  readonly viewUrl: string;
  readonly downloadUrl: string;
  readonly downloadFilename?: string;
  readonly onClose: () => void;
}) {
  return (
    <div
      aria-labelledby="ecg-report-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4"
      role="dialog"
    >
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-blue-100 bg-white shadow-xl">
        <div className="border-b bg-gradient-to-r from-blue-50 to-white px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-emerald-500/30 bg-emerald-50 px-1.5 py-0 text-[11px] text-emerald-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  已產製
                </Badge>
                <Badge className="px-1.5 py-0 text-[11px]">PDF report</Badge>
              </div>
              <h2
                className="flex items-center gap-2 text-base font-semibold text-blue-950"
                id="ecg-report-dialog-title"
              >
                <FileText className="h-4 w-4 text-primary" />
                ECG 分析報告預覽
              </h2>
              <p className="text-xs leading-5 text-muted-foreground">
                報告已儲存到系統中，可在下方預覽；若瀏覽器未顯示
                PDF，請使用下載按鈕開啟檔案。
              </p>
              <p className="break-all rounded-md border border-blue-100 bg-white px-2 py-1 text-[11px] text-muted-foreground">
                Report id:{" "}
                <span className="font-medium text-foreground">{reportId}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:pt-6">
              <a
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                download={downloadFilename}
                href={downloadUrl}
              >
                <Download className="h-4 w-4" />
                下載
              </a>
              <Button
                className="h-9"
                onClick={onClose}
                type="button"
                variant="outline"
              >
                <RotateCcw className="h-4 w-4" />
                返回
              </Button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-100 p-2 sm:p-3">
          <iframe
            className="h-full w-full rounded-md border border-slate-200 bg-white shadow-inner"
            src={viewUrl}
            title="ECG analysis report PDF preview"
          />
        </div>
      </div>
    </div>
  );
}

function createInlineReportUrls(
  payload: ReportCreatedResponse,
): { readonly url: string; readonly filename: string } | undefined {
  if (!payload.pdfBase64) return undefined;
  const binary = atob(payload.pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return {
    filename: payload.pdfFilename ?? `ecg-report-${payload.reportId}.pdf`,
    url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })),
  };
}

function buildReportPayload({
  data,
  graphImages,
  physicianInterpretation,
  summary,
  reviewSupport,
}: {
  readonly data: HydratedViewerResponse;
  readonly graphImages: readonly ReportImage[];
  readonly physicianInterpretation: string;
  readonly summary: ReturnType<typeof summarizeEcg>;
  readonly reviewSupport: ReturnType<typeof analyzeReviewSupport>;
}): EcgReportRequest {
  const implementedCards = new Set(implementedReviewSupportCardIds);
  const selectedFeatures = reviewSupport.features.filter((feature) => {
    if (feature.code === "signal-quality") {
      return implementedCards.has("signal-quality");
    }
    if (feature.code === "rate-rr" || feature.code === "beat-review") {
      return implementedCards.has("rate-rr");
    }
    if (feature.code === "st-qt") {
      return implementedCards.has("st-qt");
    }
    return false;
  });
  const reviewSections: ReportSection[] = [];

  if (implementedCards.has("signal-quality")) {
    reviewSections.push({
      title: "Signal Quality",
      fields: [
        {
          label: "Primary lead",
          value: reviewSupport.primaryLeadName ?? "Unknown",
        },
        {
          label: "Quality",
          value: `${reviewSupport.signalQuality.score}% ${reviewSupport.signalQuality.level}`,
        },
      ],
      lines: [
        ...reviewSupport.signalQuality.evidence,
        ...reviewSupport.signalQuality.issues,
      ],
    });
  }

  if (selectedFeatures.length > 0) {
    reviewSections.push({
      title: "Review Support Features",
      fields: selectedFeatures.map((feature) => ({
        label: feature.title,
        value: `${feature.value} (${feature.status})`,
      })),
      lines: selectedFeatures.flatMap((feature) => feature.evidence),
    });
  }

  if (implementedCards.has("clinical-measurements")) {
    reviewSections.push({
      title: "Clinical Measurements",
      fields: reviewSupport.measurements.map((measurement) => ({
        label: measurement.label,
        value: `${measurement.value} (${measurement.status})`,
      })),
      lines: reviewSupport.measurements.flatMap(
        (measurement) => measurement.evidence,
      ),
    });
  }

  if (reviewSupport.limitations.length > 0) {
    reviewSections.push({
      title: "Limitations",
      lines: reviewSupport.limitations,
    });
  }

  return {
    patient: [
      { label: "Name", value: data.patient.name },
      { label: "Patient id", value: data.patient.id },
      { label: "Gender", value: data.patient.gender ?? "Unknown" },
      { label: "Birth date", value: data.patient.birthDate ?? "Unknown" },
      {
        label: "Identifiers",
        value:
          data.patient.identifiers.length > 0
            ? data.patient.identifiers.join(", ")
            : "None",
      },
    ],
    observation: [
      { label: "Observation id", value: data.observation.id },
      { label: "Status", value: data.observation.status ?? "Unknown" },
      { label: "Code", value: data.observation.code },
      {
        label: "Category",
        value:
          data.observation.category.length > 0
            ? data.observation.category.join(", ")
            : "Unknown",
      },
      {
        label: "Effective time",
        value: formatDateTime(data.observation.effectiveDateTime),
      },
      { label: "Issued", value: formatDateTime(data.observation.issued) },
      {
        label: "Subject",
        value: data.observation.subjectReference ?? "Unknown",
      },
    ],
    metrics: [
      {
        label: "Duration",
        value: `${summary.durationSeconds.toFixed(2)} s`,
      },
      {
        label: "Sampling",
        value: `${data.record.samplingFrequencyHz.toFixed(1)} Hz`,
      },
      { label: "Leads", value: String(summary.leadCount) },
      {
        label: "Amplitude",
        value: `${summary.minAmplitude.toFixed(3)} to ${summary.maxAmplitude.toFixed(3)} ${data.record.unit}`,
      },
      {
        label: "Mean amplitude",
        value: `${summary.meanAmplitude.toFixed(3)} ${data.record.unit}`,
      },
    ],
    reviewSupport: reviewSections,
    graph: [
      { label: "Unit", value: data.record.unit },
      {
        label: "Samples per lead",
        value: summary.sampleCountPerLead.toLocaleString(),
      },
      {
        label: "Displayed leads",
        value: data.record.leads.map((lead) => lead.name).join(", "),
      },
      {
        label: "Primary review lead",
        value: reviewSupport.primaryLeadName ?? "Unknown",
      },
    ],
    graphImages,
    physicianInterpretation,
    generatedAt: new Date().toISOString(),
  };
}

async function collectGraphImages(): Promise<ReportImage[]> {
  const figures = Array.from(
    document.querySelectorAll<HTMLElement>("[data-ecg-lead-graph]"),
  ).slice(0, 16);
  const images: ReportImage[] = [];

  for (const figure of figures) {
    const svg = figure.querySelector("svg");
    if (!svg) continue;
    const label = figure.dataset.ecgLeadGraph ?? "ECG lead";
    const image = await svgToJpeg(svg);
    if (image) {
      images.push({
        label: `Lead ${label}`,
        ...image,
      });
    }
  }

  return images;
}

async function svgToJpeg(svg: SVGSVGElement): Promise<
  | {
      readonly dataUrl: string;
      readonly width: number;
      readonly height: number;
    }
  | undefined
> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const viewBox = clone.viewBox.baseVal;
  const width = viewBox.width || 960;
  const height = viewBox.height || 96;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `
    .ecg-path { fill: none; stroke: #c62828; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.4; }
    .ecg-baseline { stroke: #65758b; stroke-dasharray: 4 6; stroke-width: 1; }
    .ecg-rpeak-line { stroke: #1f5fa8; stroke-dasharray: 3 6; stroke-opacity: 0.35; stroke-width: 0.8; }
    .ecg-rpeak-marker { fill: #1f5fa8; stroke: #ffffff; stroke-width: 1.2; }
    .ecg-landmark-line { stroke: #2563eb; stroke-dasharray: 2 4; stroke-opacity: 0.9; stroke-width: 1.4; }
    .ecg-landmark-marker { fill: #2563eb; stroke: #ffffff; stroke-width: 1.4; }
    .ecg-landmark-code { fill: #1d4ed8; font-size: 9px; font-weight: 700; paint-order: stroke; stroke: #ffffff; stroke-linejoin: round; stroke-width: 3px; }
    .ecg-landmark-r-peak { stroke: #7c3aed; fill: #7c3aed; }
  `;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <pattern id="minorGrid" width="16" height="16" patternUnits="userSpaceOnUse">
      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#e5ebf2" stroke-width="1"/>
    </pattern>
  `;
  const background = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  background.setAttribute("x", "0");
  background.setAttribute("y", "0");
  background.setAttribute("width", String(width));
  background.setAttribute("height", String(height));
  background.setAttribute("fill", "#ffffff");
  const grid = background.cloneNode(false) as SVGRectElement;
  grid.setAttribute("fill", "url(#minorGrid)");

  clone.insertBefore(style, clone.firstChild);
  clone.insertBefore(defs, style.nextSibling);
  clone.insertBefore(background, defs.nextSibling);
  clone.insertBefore(grid, background.nextSibling);

  const serialized = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Unable to render ECG SVG."));
    });
    image.src = url;
    await loaded;

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const implementedReviewSupportCardIds: readonly ReviewSupportCardId[] =
  reviewSupportCardGroups
    .flatMap((group) => group.cards)
    .filter((card) => card.implemented)
    .map((card) => card.id);

function PatientPanel({ patient }: { readonly patient: PatientSummary }) {
  return (
    <Card className="border-blue-100 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="p-2.5 pb-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserRound className="h-4 w-4 text-primary" />
          Patient
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <DefinitionList
          items={[
            ["Name", patient.name],
            ["Patient id", patient.id],
            ["Gender", patient.gender ?? "Unknown"],
            ["Birth date", patient.birthDate ?? "Unknown"],
            [
              "Identifiers",
              patient.identifiers.length > 0
                ? patient.identifiers.join(", ")
                : "None",
            ],
          ]}
        />
      </CardContent>
    </Card>
  );
}

function ObservationPanel({
  observation,
}: {
  readonly observation: ObservationSummary;
}) {
  return (
    <Card className="border-blue-100 bg-card/95 shadow-sm shadow-slate-900/5">
      <CardHeader className="p-2.5 pb-1">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          Observation
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <DefinitionList
          items={[
            ["Observation id", observation.id],
            ["Status", observation.status ?? "Unknown"],
            ["Code", observation.code],
            [
              "Category",
              observation.category.length > 0
                ? observation.category.join(", ")
                : "Unknown",
            ],
            ["Effective time", formatDateTime(observation.effectiveDateTime)],
            ["Issued", formatDateTime(observation.issued)],
            ["Subject", observation.subjectReference ?? "Unknown"],
          ]}
        />
      </CardContent>
    </Card>
  );
}

function MetricCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card className="border-blue-100 bg-gradient-to-br from-white to-blue-50/60 shadow-sm shadow-slate-900/5">
      <CardContent className="p-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 break-words text-sm font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DefinitionList({
  items,
}: {
  readonly items: readonly (readonly [string, string])[];
}) {
  return (
    <dl className="space-y-1">
      {items.map(([label, value], index) => (
        <div key={label}>
          {index > 0 ? <Separator className="mb-1" /> : null}
          <div className="grid gap-0.5 sm:grid-cols-[104px_1fr]">
            <dt className="text-xs font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="break-words text-xs font-medium text-foreground">
              {value}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function LeadWaveform({
  name,
  samples,
  markers,
  landmarks,
}: {
  readonly name: string;
  readonly samples: Float32Array;
  readonly markers: readonly RPeakMarker[];
  readonly landmarks: readonly EcgLandmark[];
}) {
  const width = 960;
  const height = 96;
  const points = downsampleMinMax(samples, width);
  const min = Math.min(...points.map((point) => point.min));
  const max = Math.max(...points.map((point) => point.max));
  const scaleY = (value: number) => {
    if (max === min) return height / 2;
    return height - ((value - min) / (max - min)) * (height - 18) - 9;
  };
  const path = points
    .map((point, index) => {
      const y = scaleY((point.min + point.max) / 2);
      return `${index === 0 ? "M" : "L"} ${index} ${y.toFixed(2)}`;
    })
    .join(" ");
  const landmarkLabels = landmarks.reduce<
    readonly {
      readonly landmark: EcgLandmark;
      readonly x: number;
      readonly y: number;
      readonly lane: number;
    }[]
  >((items, landmark) => {
    const x =
      samples.length <= 1
        ? 0
        : (landmark.sampleIndex / (samples.length - 1)) * width;
    const usedNearbyLanes = items
      .filter((item) => Math.abs(item.x - x) < 32)
      .map((item) => item.lane);
    const lane = [0, 1, 2].find(
      (candidate) => !usedNearbyLanes.includes(candidate),
    );
    return [
      ...items,
      {
        landmark,
        x,
        y: 12 + (lane ?? items.length % 3) * 13,
        lane: lane ?? items.length % 3,
      },
    ];
  }, []);

  return (
    <figure
      className="rounded-md border border-blue-100 bg-white/95 p-2 shadow-sm shadow-slate-900/5"
      data-ecg-lead-graph={name}
    >
      <figcaption className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-[11px] text-muted-foreground">
          {samples.length.toLocaleString()} samples
        </span>
      </figcaption>
      <svg
        className="ecg-grid block h-auto w-full rounded-sm"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`ECG lead ${name}`}
      >
        <line
          x1="0"
          x2={width}
          y1={height / 2}
          y2={height / 2}
          className="ecg-baseline"
        />
        <path d={path} className="ecg-path" />
        {markers.map((marker) => {
          const x =
            samples.length <= 1
              ? 0
              : (marker.sampleIndex / (samples.length - 1)) * width;
          return (
            <g key={`${marker.sampleIndex}-${marker.timeSeconds}`}>
              <line
                x1={x}
                x2={x}
                y1="6"
                y2={height - 6}
                className="ecg-rpeak-line"
              />
              <circle
                cx={x}
                cy={scaleY(marker.amplitude)}
                r="3"
                className="ecg-rpeak-marker"
              />
            </g>
          );
        })}
        {landmarkLabels.map(({ landmark, x, y }) => {
          return (
            <g key={`${landmark.kind}-${landmark.sampleIndex}`}>
              <line
                x1={x}
                x2={x}
                y1="4"
                y2={height - 4}
                className={`ecg-landmark-line ecg-landmark-${landmark.kind}`}
              />
              <circle
                cx={x}
                cy={scaleY(landmark.amplitude)}
                r="2.5"
                className={`ecg-landmark-marker ecg-landmark-${landmark.kind}`}
              />
              <text
                x={x}
                y={y}
                className="ecg-landmark-code"
                textAnchor="middle"
              >
                {landmarkCode(landmark.kind)}
              </text>
            </g>
          );
        })}
      </svg>
      {landmarks.length > 0 ? (
        <figcaption className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          {landmarks.map((landmark) => (
            <span
              key={`${landmark.kind}-${landmark.sampleIndex}-legend`}
              className="rounded-md border border-blue-100 bg-blue-50/70 px-1.5 py-0.5"
            >
              <span className="font-semibold text-primary">
                {landmarkCode(landmark.kind)}
              </span>{" "}
              {landmark.label} · {(landmark.timeSeconds * 1000).toFixed(0)} ms
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ViewerLoading() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

function ViewerError({ message }: { readonly message: string }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          無法讀取 ECG
        </CardTitle>
        <CardDescription className="text-xs">{message}</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0 text-xs text-muted-foreground">
        請確認 Patient id、Observation id 與 FHIR server 資料是否存在。
      </CardContent>
    </Card>
  );
}

function hydrateResponse(data: ViewerResponse): HydratedViewerResponse {
  return {
    patient: data.patient,
    observation: data.observation,
    record: {
      ...data.record,
      leads: data.record.leads.map((lead) => ({
        name: lead.name,
        samples: Float32Array.from(lead.samples),
      })),
    },
  };
}

async function parseViewerError(
  response: Response,
): Promise<ViewerErrorResponse> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return {};
    const error = typeof payload.error === "string" ? payload.error : undefined;
    const message =
      typeof payload.message === "string" ? payload.message : undefined;
    if (error && message) return { error, message };
    if (error) return { error };
    if (message) return { message };
    return {};
  } catch {
    return {};
  }
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

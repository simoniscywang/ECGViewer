"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { downsampleMinMax, summarizeEcg, type EcgRecord } from "@ecgviewer/ecg";
import { Activity, AlertTriangle, FileText, UserRound } from "lucide-react";
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

export function EcgViewer({ patientId, observationId }: EcgViewerProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });

  useEffect(() => {
    if (!patientId || !observationId) {
      setState({ status: "error", message: "缺少 Patient id 或 Observation id" });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    const params = new URLSearchParams({ patientId, observationId });
    fetch(`/api/fhir/observation?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const errorBody = await parseViewerError(response);
          throw new Error(errorBody.message ?? `FHIR request failed: ${response.status}`);
        }
        return (await response.json()) as ViewerResponse;
      })
      .then((data) => setState({ status: "ready", data: hydrateResponse(data) }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "無法讀取 ECG Observation"
        });
      });

    return () => controller.abort();
  }, [patientId, observationId]);

  if (state.status === "idle" || state.status === "loading") return <ViewerLoading />;
  if (state.status === "error") return <ViewerError message={state.message} />;
  if (state.status === "ready") return <ReadyViewer data={state.data} />;

  return null;
}

function ReadyViewer({ data }: { readonly data: HydratedViewerResponse }) {
  const summary = useMemo(() => summarizeEcg(data.record), [data.record]);

  return (
    <div className="space-y-3">
      <section className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <PatientPanel patient={data.patient} />
        <ObservationPanel observation={data.observation} />
      </section>

      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Duration" value={`${summary.durationSeconds.toFixed(2)} s`} />
        <MetricCard label="Sampling" value={`${data.record.samplingFrequencyHz.toFixed(1)} Hz`} />
        <MetricCard label="Leads" value={String(summary.leadCount)} />
        <MetricCard
          label="Amplitude"
          value={`${summary.minAmplitude.toFixed(3)} to ${summary.maxAmplitude.toFixed(3)} ${data.record.unit}`}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              ECG Graph
            </CardTitle>
            <CardDescription className="text-xs">
              Downsampled waveform for review. This display is not diagnostic.
            </CardDescription>
          </div>
          <Badge className="px-1.5 py-0 text-[11px]">{data.record.unit}</Badge>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-2">
            {data.record.leads.map((lead) => (
              <LeadWaveform key={lead.name} name={lead.name} samples={lead.samples} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PatientPanel({ patient }: { readonly patient: PatientSummary }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <UserRound className="h-4 w-4 text-primary" />
          Patient
        </CardTitle>
        <CardDescription className="text-xs">Basic demographics from FHIR Patient.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <DefinitionList
          items={[
            ["Name", patient.name],
            ["Patient id", patient.id],
            ["Gender", patient.gender ?? "Unknown"],
            ["Birth date", patient.birthDate ?? "Unknown"],
            ["Identifiers", patient.identifiers.length > 0 ? patient.identifiers.join(", ") : "None"]
          ]}
        />
      </CardContent>
    </Card>
  );
}

function ObservationPanel({ observation }: { readonly observation: ObservationSummary }) {
  return (
    <Card>
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-primary" />
          Observation
        </CardTitle>
        <CardDescription className="text-xs">FHIR Observation metadata for this ECG record.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <DefinitionList
          items={[
            ["Observation id", observation.id],
            ["Status", observation.status ?? "Unknown"],
            ["Code", observation.code],
            ["Category", observation.category.length > 0 ? observation.category.join(", ") : "Unknown"],
            ["Effective time", formatDateTime(observation.effectiveDateTime)],
            ["Issued", formatDateTime(observation.issued)],
            ["Subject", observation.subjectReference ?? "Unknown"]
          ]}
        />
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Card>
      <CardContent className="p-2.5">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function DefinitionList({ items }: { readonly items: readonly (readonly [string, string])[] }) {
  return (
    <dl className="space-y-1.5">
      {items.map(([label, value], index) => (
        <div key={label}>
          {index > 0 ? <Separator className="mb-1.5" /> : null}
          <div className="grid gap-1 sm:grid-cols-[112px_1fr]">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="break-words text-xs font-medium text-foreground">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}

function LeadWaveform({ name, samples }: { readonly name: string; readonly samples: Float32Array }) {
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

  return (
    <figure className="rounded-md border bg-card p-2">
      <figcaption className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold">{name}</span>
        <span className="text-[11px] text-muted-foreground">{samples.length.toLocaleString()} samples</span>
      </figcaption>
      <svg
        className="ecg-grid block h-auto w-full rounded-sm"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`ECG lead ${name}`}
      >
        <line x1="0" x2={width} y1={height / 2} y2={height / 2} className="ecg-baseline" />
        <path d={path} className="ecg-path" />
      </svg>
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
        samples: Float32Array.from(lead.samples)
      }))
    }
  };
}

async function parseViewerError(response: Response): Promise<ViewerErrorResponse> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) return {};
    const error = typeof payload.error === "string" ? payload.error : undefined;
    const message = typeof payload.message === "string" ? payload.message : undefined;
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

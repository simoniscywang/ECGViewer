import { EcgQueryForm } from "@/components/ecg-query-form";
import { Activity, Database, LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

interface HomePageProps {
  readonly searchParams: Promise<{
    readonly patientId?: string;
    readonly patient?: string;
    readonly observationId?: string;
    readonly observation?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const patientId = params.patientId ?? params.patient;
  const observationId = params.observationId ?? params.observation;

  if (patientId && observationId) {
    redirect(`/viewer?${new URLSearchParams({ patientId, observationId }).toString()}`);
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:px-6">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1 text-sm text-muted-foreground">
              <Activity className="h-4 w-4 text-primary" />
              FHIR ECG Observation Viewer
            </div>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                ECGViewer
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                以 backend service OAuth 安全讀取 FHIR ECG Observation，呈現 Patient、Observation
                摘要與多導程 ECG waveform，並提供非診斷性的初步量測。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Feature icon={<LockKeyhole className="h-4 w-4" />} title="Server-side OAuth" text="client credentials token 不進入前端。" />
            <Feature icon={<Database className="h-4 w-4" />} title="FHIR Parsing" text="Observation 解析後才進入 UI。" />
            <Feature icon={<Activity className="h-4 w-4" />} title="ECG Graph" text="多導程 waveform 與初步摘要。" />
          </div>
        </div>

        <div className="md:justify-self-end">
          <EcgQueryForm />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly text: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-primary">
        {icon}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

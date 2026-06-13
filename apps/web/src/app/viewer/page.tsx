import { EcgViewer } from "@/components/ecg-viewer";
import { Badge } from "@/components/ui/badge";
import { Activity } from "lucide-react";

interface ViewerPageProps {
  readonly searchParams: Promise<{
    readonly patientId?: string;
    readonly observationId?: string;
  }>;
}

export default async function ViewerPage({ searchParams }: ViewerPageProps) {
  const params = await searchParams;
  const patientId = params.patientId ?? "";
  const observationId = params.observationId ?? "";

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-6xl space-y-3 px-3 py-3 md:px-4">
        <header className="flex flex-col gap-2 border-b pb-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Badge className="w-fit px-1.5 py-0 text-[11px]">
              <Activity className="mr-1 h-3 w-3 text-primary" />
              ECG Observation
            </Badge>
            <div>
              <h1 className="text-xl font-semibold tracking-tight md:text-2xl">ECG 檢視</h1>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Patient、Observation 與 ECG waveform 摘要。所有資料皆由 server-side FHIR API
                讀取後整理呈現。
              </p>
            </div>
          </div>
          <div className="grid gap-0.5 text-xs text-muted-foreground md:text-right">
            <span>Patient: {patientId || "Not provided"}</span>
            <span>Observation: {observationId || "Not provided"}</span>
          </div>
        </header>
        <EcgViewer patientId={patientId} observationId={observationId} />
      </div>
    </main>
  );
}

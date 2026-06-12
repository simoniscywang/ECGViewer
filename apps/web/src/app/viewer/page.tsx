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
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <header className="flex flex-col gap-4 border-b pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Badge className="w-fit">
              <Activity className="mr-1 h-3.5 w-3.5 text-primary" />
              ECG Observation
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">視覺化檢視</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Patient、Observation 與 ECG waveform 摘要。所有資料皆由 server-side FHIR API
                讀取後整理呈現。
              </p>
            </div>
          </div>
          <div className="grid gap-1 text-sm text-muted-foreground md:text-right">
            <span>Patient: {patientId || "Not provided"}</span>
            <span>Observation: {observationId || "Not provided"}</span>
          </div>
        </header>
        <EcgViewer patientId={patientId} observationId={observationId} />
      </div>
    </main>
  );
}

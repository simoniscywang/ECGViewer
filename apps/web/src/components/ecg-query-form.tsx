"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight } from "lucide-react";
import { useState } from "react";

export function EcgQueryForm() {
  const [patientId, setPatientId] = useState("");
  const [observationId, setObservationId] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ patientId, observationId });
    window.location.assign(`/viewer?${params.toString()}`);
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <CardTitle>讀取 ECG Observation</CardTitle>
        <CardDescription>輸入 Patient id 與 Observation id 後直接進入 ECG Viewer。</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient id</Label>
            <Input
              autoComplete="off"
              id="patientId"
              name="patientId"
              onChange={(event) => setPatientId(event.target.value)}
              required
              value={patientId}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="observationId">Observation id</Label>
            <Input
              autoComplete="off"
              id="observationId"
              name="observationId"
              onChange={(event) => setObservationId(event.target.value)}
              required
              value={observationId}
            />
          </div>
          <Button className="w-full" type="submit">
            讀取 ECG
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          也可直接呼叫首頁並帶入 query string，例如
          `/?patientId=...&observationId=...`。
        </p>
      </CardContent>
    </Card>
  );
}

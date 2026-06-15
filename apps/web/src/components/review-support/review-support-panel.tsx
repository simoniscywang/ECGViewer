import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  defaultReviewSupportCardIds,
  reviewSupportCardGroups,
  type ReviewSupportCardId,
} from "@/components/review-support/review-support-catalog";
import {
  type EcgLead,
  type EcgMeasurement,
  type EcgMeasurementCode,
  type EcgReviewLevel,
  type EcgReviewSupport,
  type ReviewSupportFeature,
  type ReviewSupportStatus,
} from "@ecgviewer/ecg";
import { ListChecks, Ruler, SlidersHorizontal } from "lucide-react";

export function ReviewSupportPanel({
  leads,
  reviewSupport,
  selectedCardIds,
  selectedMeasurementCode,
  selectedLeadName,
  onSelectedCardIdsChange,
  onSelectedMeasurementCodeChange,
  onSelectedLeadNameChange,
}: {
  readonly leads: readonly EcgLead[];
  readonly reviewSupport: EcgReviewSupport;
  readonly selectedCardIds: readonly ReviewSupportCardId[];
  readonly selectedMeasurementCode: EcgMeasurementCode | null;
  readonly selectedLeadName: string;
  readonly onSelectedCardIdsChange: (
    cardIds: readonly ReviewSupportCardId[],
  ) => void;
  readonly onSelectedMeasurementCodeChange: (
    code: EcgMeasurementCode | null,
  ) => void;
  readonly onSelectedLeadNameChange: (leadName: string) => void;
}) {
  const selectedCards = new Set(selectedCardIds);
  const featureByCode = new Map(
    reviewSupport.features.map((feature) => [feature.code, feature]),
  );

  return (
    <Card className="bg-card/95 shadow-sm shadow-cyan-900/5">
      <CardHeader className="flex flex-col gap-2 p-2.5 pb-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ListChecks className="h-4 w-4 text-primary" />
            Review support
          </CardTitle>
          <CardDescription className="text-xs">
            Estimated support values for clinical review; candidate features
            stay non-diagnostic.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge className="px-1.5 py-0 text-[11px]">for review</Badge>
          <Badge className="px-1.5 py-0 text-[11px]">
            primary {reviewSupport.primaryLeadName ?? "unknown"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2.5 pt-0">
        <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
            <label
              className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
              htmlFor="review-lead"
            >
              Analysis lead
            </label>
            <select
              className="h-7 rounded-md border border-cyan-300 bg-cyan-50 px-2 text-xs font-semibold text-cyan-950 shadow-sm shadow-cyan-900/5 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
              id="review-lead"
              onChange={(event) => onSelectedLeadNameChange(event.target.value)}
              value={selectedLeadName}
            >
              {leads.map((lead) => (
                <option key={lead.name} value={lead.name}>
                  {lead.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground">
            Lead {reviewSupport.primaryLeadName ?? "unknown"} · Signal quality{" "}
            {reviewSupport.signalQuality.score}%{" "}
            {reviewSupport.signalQuality.level}
          </div>
        </div>

        <ReviewCardCustomizer
          selectedCardIds={selectedCardIds}
          onSelectedCardIdsChange={onSelectedCardIdsChange}
        />

        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {selectedCards.has("signal-quality") ? (
            <SignalQualityCard reviewSupport={reviewSupport} />
          ) : null}
          {selectedCards.has("rate-rr") ? (
            <RateRrCard
              beatFeature={featureByCode.get("beat-review")}
              rateFeature={featureByCode.get("rate-rr")}
            />
          ) : null}
          {selectedCards.has("st-qt") ? (
            <StQtReviewCard
              feature={featureByCode.get("st-qt")}
              reviewSupport={reviewSupport}
            />
          ) : null}
        </div>

        {selectedCards.has("clinical-measurements") ? (
          <MeasurementGrid
            measurements={reviewSupport.measurements}
            selectedMeasurementCode={selectedMeasurementCode}
            onSelectedMeasurementCodeChange={onSelectedMeasurementCodeChange}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReviewCardCustomizer({
  selectedCardIds,
  onSelectedCardIdsChange,
}: {
  readonly selectedCardIds: readonly ReviewSupportCardId[];
  readonly onSelectedCardIdsChange: (
    cardIds: readonly ReviewSupportCardId[],
  ) => void;
}) {
  const selectedCards = new Set(selectedCardIds);

  const updateCard = (cardId: ReviewSupportCardId, checked: boolean) => {
    if (checked) {
      onSelectedCardIdsChange([...selectedCards, cardId]);
      return;
    }
    onSelectedCardIdsChange(selectedCardIds.filter((id) => id !== cardId));
  };

  return (
    <details className="rounded-md border border-cyan-200 bg-cyan-50/70 p-2">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold">
        <span className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          Customize cards
        </span>
        <button
          className="rounded-md border border-cyan-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-cyan-800 shadow-sm transition hover:border-cyan-500 hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200"
          onClick={(event) => {
            event.preventDefault();
            onSelectedCardIdsChange(defaultReviewSupportCardIds);
          }}
          type="button"
        >
          Reset default
        </button>
      </summary>
      <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {reviewSupportCardGroups.map((group) => (
          <fieldset
            key={group.title}
            className="rounded-md border border-cyan-100 bg-white p-2"
          >
            <legend className="px-1 text-[11px] font-semibold text-muted-foreground">
              {group.title}
            </legend>
            <div className="space-y-1.5">
              {group.cards.map((card) => (
                <label
                  key={card.id}
                  className={`flex gap-2 text-[11px] ${
                    card.implemented
                      ? "text-foreground"
                      : "text-muted-foreground opacity-70"
                  }`}
                >
                  <input
                    checked={selectedCards.has(card.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-cyan-600"
                    disabled={!card.implemented}
                    onChange={(event) =>
                      updateCard(card.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>
                    <span className="font-medium">{card.label}</span>
                    <span className="block leading-4 text-muted-foreground">
                      {card.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </details>
  );
}

function SignalQualityCard({
  reviewSupport,
}: {
  readonly reviewSupport: EcgReviewSupport;
}) {
  return (
    <ReviewScoreCard
      title="Signal quality"
      score={reviewSupport.signalQuality.score}
      level={reviewSupport.signalQuality.level}
      value={
        reviewSupport.signalQuality.leadName
          ? `Lead ${reviewSupport.signalQuality.leadName}`
          : "No lead"
      }
      evidence={
        reviewSupport.signalQuality.issues.length > 0
          ? reviewSupport.signalQuality.issues
          : reviewSupport.signalQuality.evidence
      }
      note="Confirm estimates against the original waveform when signal quality is limited."
    />
  );
}

function RateRrCard({
  beatFeature,
  rateFeature,
}: {
  readonly beatFeature: ReviewSupportFeature | undefined;
  readonly rateFeature: ReviewSupportFeature | undefined;
}) {
  if (!rateFeature) return null;

  return (
    <FeatureCard
      feature={rateFeature}
      mergedEvidence={beatFeature?.evidence}
      mergedLabel={beatFeature ? `${beatFeature.value} beat review` : undefined}
      note="R peaks and heart rate are initial estimates and may be affected by noise or morphology."
      showDescription={false}
    />
  );
}

function StQtReviewCard({
  feature,
  reviewSupport,
}: {
  readonly feature: ReviewSupportFeature | undefined;
  readonly reviewSupport: EcgReviewSupport;
}) {
  if (!feature) return null;

  const confidenceItems = reviewSupport.landmarkConfidence.items;
  const lowConfidenceItems = confidenceItems.filter(
    (item) => item.level !== "good",
  );
  const confidenceEvidence =
    confidenceItems.length === 0
      ? reviewSupport.landmarkConfidence.evidence
      : lowConfidenceItems.length > 0
        ? lowConfidenceItems
            .slice(0, 3)
            .map((item) => `${item.label} ${item.score}%`)
        : [`${confidenceItems.length} landmarks estimated`];

  return (
    <FeatureCard
      feature={feature}
      mergedEvidence={confidenceEvidence}
      mergedLabel={`${reviewSupport.landmarkConfidence.score}% ${reviewSupport.landmarkConfidence.level} landmark confidence`}
    />
  );
}

function ReviewScoreCard({
  title,
  score,
  level,
  value,
  evidence,
  note,
}: {
  readonly title: string;
  readonly score: number;
  readonly level: EcgReviewLevel;
  readonly value: string;
  readonly evidence: readonly string[];
  readonly note?: string | undefined;
}) {
  return (
    <div className="rounded-md border border-cyan-100 bg-white/85 p-2.5 shadow-sm shadow-cyan-900/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Ruler className="h-3.5 w-3.5 text-primary" />
          {title}
        </div>
        <Badge className={`px-1.5 py-0 text-[10px] ${levelClassName(level)}`}>
          {levelLabel(level)}
        </Badge>
      </div>
      <div className="mt-1.5 text-xs font-medium">{score}%</div>
      <div className="mt-1 text-xs font-medium text-primary">{value}</div>
      {note ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {evidence.slice(0, 4).map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="rounded-md border border-cyan-100 bg-cyan-50 px-1.5 py-0.5"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function MeasurementGrid({
  measurements,
  selectedMeasurementCode,
  onSelectedMeasurementCodeChange,
}: {
  readonly measurements: readonly EcgMeasurement[];
  readonly selectedMeasurementCode: EcgMeasurementCode | null;
  readonly onSelectedMeasurementCodeChange: (
    code: EcgMeasurementCode | null,
  ) => void;
}) {
  return (
    <div className="mt-2 rounded-md border border-cyan-100 bg-white/85 p-2.5 shadow-sm shadow-cyan-900/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Ruler className="h-3.5 w-3.5 text-primary" />
          Clinical measurements
        </div>
        <Badge className="px-1.5 py-0 text-[10px]">estimated</Badge>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Select one value to highlight related landmarks on the review lead.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {measurements.map((measurement) => (
          <button
            key={measurement.code}
            className={`rounded-md border bg-white px-2 py-1.5 text-left shadow-sm shadow-cyan-900/5 transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
              selectedMeasurementCode === measurement.code
                ? "border-cyan-500 bg-cyan-100 ring-1 ring-cyan-300"
                : "border-cyan-200 hover:border-cyan-500 hover:bg-cyan-50"
            } ${measurement.status === "estimated" ? "" : "cursor-not-allowed opacity-70"}`}
            disabled={measurement.status !== "estimated"}
            onClick={() =>
              onSelectedMeasurementCodeChange(
                selectedMeasurementCode === measurement.code
                  ? null
                  : measurement.code,
              )
            }
            type="button"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold">
                {measurement.label}
              </span>
              <Badge
                className={`px-1.5 py-0 text-[10px] ${measurement.status === "estimated" ? "border-primary/30 text-primary" : "border-destructive/40 text-destructive"}`}
              >
                {measurement.status}
              </Badge>
            </div>
            <div className="mt-1 text-xs font-medium">{measurement.value}</div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {measurement.evidence.join(" · ")}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({
  feature,
  mergedEvidence,
  mergedLabel,
  note,
  showDescription = true,
}: {
  readonly feature: ReviewSupportFeature | undefined;
  readonly mergedEvidence?: readonly string[] | undefined;
  readonly mergedLabel?: string | undefined;
  readonly note?: string | undefined;
  readonly showDescription?: boolean | undefined;
}) {
  if (!feature) return null;
  const evidence = [...feature.evidence, ...(mergedEvidence ?? [])].filter(
    (item) => !item.startsWith("Landmark confidence "),
  );

  return (
    <div className="rounded-md border border-cyan-100 bg-white/85 p-2.5 shadow-sm shadow-cyan-900/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Ruler className="h-3.5 w-3.5 text-primary" />
          {feature.title}
        </div>
        <Badge
          className={`px-1.5 py-0 text-[10px] ${statusClassName(feature.status)}`}
        >
          {statusLabel(feature.status)}
        </Badge>
      </div>
      <div className="mt-1.5 text-xs font-medium">{feature.value}</div>
      {mergedLabel ? (
        <div className="mt-1 text-xs font-medium text-primary">
          {mergedLabel}
        </div>
      ) : null}
      {showDescription ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {feature.description}
        </p>
      ) : null}
      {note ? (
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
        {evidence.slice(0, 5).map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="rounded-md border border-cyan-100 bg-cyan-50 px-1.5 py-0.5"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function statusLabel(status: ReviewSupportStatus): string {
  if (status === "ready") return "ready";
  if (status === "for-review") return "review";
  return "limited";
}

function statusClassName(status: ReviewSupportStatus): string {
  if (status === "ready") return "border-primary/30 text-primary";
  if (status === "for-review") return "border-amber-500/40 text-amber-700";
  return "border-destructive/40 text-destructive";
}

function levelLabel(level: EcgReviewLevel): string {
  if (level === "good") return "good";
  if (level === "review") return "review";
  return "limited";
}

function levelClassName(level: EcgReviewLevel): string {
  if (level === "good") return "border-emerald-500/40 text-emerald-700";
  if (level === "review") return "border-amber-500/40 text-amber-700";
  return "border-destructive/40 text-destructive";
}

import {
  parseEcgReportRequest,
  type EcgReportRequest,
  type ReportImage,
} from "./ecg-report";

export interface AiInterpretationRequest {
  readonly metrics: EcgReportRequest["metrics"];
  readonly reviewSupport: EcgReportRequest["reviewSupport"];
  readonly graph: EcgReportRequest["graph"];
  readonly graphImages: readonly ReportImage[];
}

export interface AiInterpretationResponse {
  readonly interpretation: string;
}

export function parseAiInterpretationRequest(
  value: unknown,
): AiInterpretationRequest {
  const parsed = parseEcgReportRequest({
    patient: [],
    observation: [],
    physicianInterpretation: "",
    generatedAt: new Date().toISOString(),
    ...(typeof value === "object" && value !== null ? value : {}),
  });

  return {
    metrics: parsed.metrics,
    reviewSupport: parsed.reviewSupport,
    graph: parsed.graph,
    graphImages: parsed.graphImages,
  };
}

export function buildAiInterpretationPrompt(
  request: AiInterpretationRequest,
): string {
  return [
    "你是一位具備心臟電生理與臨床心臟科經驗的專業心臟科醫師，正在協助撰寫 ECG 檢查的輔助判讀草稿。",
    "",
    "請根據系統提供的 ECG 訊號摘要量測資訊、review support 分析結果，以及 12-lead waveform graph 影像，產生一份專業、條理分明、可供醫師覆核與修改的繁體中文 ECG 判讀說明。",
    "請整合資訊並提出臨床覆核洞察，不要只是逐條改寫或重述 review support 的原始內容。",
    "請優先描述最重要的 3-5 個發現、限制與覆核重點；若資料不足以支持某項推論，請直接寫出限制，不要補充過多背景知識。",
    "若 signal quality 良好，且 Rate/RR、R peak 偵測與節律相關 evidence 可信度高，可更主動地提出具臨床洞察的 interpretation summary，例如節律規則性、心率區間是否合理、傳導間期與 ST-T 變化是否構成優先覆核重點。",
    "即使資料品質良好，也請避免把輔助判讀寫成正式診斷；請以「整體較支持」、「未見明顯」、「建議覆核是否」等語氣表達。",
    "若 signal quality 或 Rate/RR confidence 不佳，請明顯降低推論強度，優先說明限制與需人工覆核之處。",
    "",
    "重要限制：",
    "- 你提供的是「AI 輔助判讀草稿」，不是正式診斷。",
    "- 不可使用「確診」、「診斷為」、「已證實」等絕對診斷語氣。",
    "- 應使用「建議覆核」、「可能」、「疑似」、「需結合臨床情境」、「請由醫師確認」等審慎措辭。",
    "- 若訊號品質、lead 數量、取樣長度、R peak 偵測、landmark confidence 或 waveform 圖像限制會影響判讀，必須清楚說明。",
    "- 不要推測未提供的病史、症狀、用藥、電解質、心肌酵素或既往 ECG。",
    "- 不要輸出 Patient ID、Observation ID、FHIR identifier 或其他可識別病患資訊。",
    "- 不要聲稱本系統可提供診斷或治療建議。",
    "",
    "請依下列格式輸出：",
    "",
    "1. 訊號品質與資料限制",
    "- 簡述 ECG 訊號品質、主要分析 lead、雜訊/基線漂移/振幅範圍/資料限制。",
    "- 說明自動量測可信度與需要人工覆核之處。",
    "",
    "2. 心率與節律線索",
    "- 根據 heart rate、RR interval、R peak 偵測結果，描述心率與節律規則性線索。",
    "- 避免直接診斷特定 arrhythmia，除非資料非常明確，且仍以「可能/建議覆核」表述。",
    "",
    "3. 傳導與間期量測",
    "- 彙整 PR interval、QRS duration、QT/QTc 等輔助量測。",
    "- 若量測缺失或 confidence 不足，請明確寫出「無法可靠評估」或「需人工覆核」。",
    "",
    "4. ST-T 與波形觀察",
    "- 根據 ST deviation、QT/ST review、landmark confidence 與 12-lead waveform graph，描述可能需要注意的 ST-T 變化。",
    "- 若有 regional pattern 或 lead-specific finding，請指出相關 lead；若沒有足夠證據，請避免過度解讀。",
    "",
    "5. 12 Lead waveform 視覺覆核重點",
    "- 根據 12 lead waveform graph，整理醫師應優先覆核的 lead、segment 或 landmark。",
    "- 若圖像解析度或 downsampling 可能影響細節，請說明限制。",
    "",
    "6. 非診斷性結語",
    "- 用 2-4 句話總結整體 ECG 輔助判讀重點。",
    "- 明確註明此內容需由醫師結合原始 ECG、臨床症狀與病史確認。",
    "",
    "輸出要求：",
    "- 使用繁體中文。",
    "- 語氣專業、精簡、臨床文件風格。",
    "- 整體輸出控制在 180-260 個中文字左右，除非資料限制必須額外說明。",
    "- 避免冗長教科書式解釋。",
    "- 避免逐項羅列所有 review support evidence；請聚合成有判讀價值的重點。",
    "- 請指出資料之間的關聯，例如訊號品質如何影響 interval/ST-T 判讀可信度、RR 穩定度與節律覆核優先順序、特定 lead 或區段是否需要優先人工覆核。",
    "- 當資料品質足夠時，請輸出更像心臟科醫師摘要的 insight，不要只寫「系統估計」或「review support 顯示」。",
    "- 不要使用 Markdown 表格。",
    "- 可使用短條列，但每段以 1-2 句為限。",
    "- 內容應可直接貼入「醫師判讀說明」欄位。",
    "",
    "以下是系統提供的資料：",
    "",
    "ECG 摘要量測：",
    formatFields(request.metrics),
    "",
    "Review support 分析結果：",
    request.reviewSupport.map(formatSection).join("\n\n"),
    "",
    "ECG Graph 摘要：",
    formatFields(request.graph),
    "",
    `已附上 ${request.graphImages.length} 張 12 lead waveform graph 圖片，請只作為輔助視覺參考。`,
  ].join("\n");
}

export function extractResponseText(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.output_text === "string") return value.output_text.trim();
  if (!Array.isArray(value.output)) return "";

  const parts: string[] = [];
  for (const output of value.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) continue;
    for (const content of output.content) {
      if (!isRecord(content)) continue;
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

export function extractChatCompletionText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return "";
  const firstChoice = value.choices.find(isRecord);
  if (!firstChoice || !isRecord(firstChoice.message)) return "";
  return typeof firstChoice.message.content === "string"
    ? firstChoice.message.content.trim()
    : "";
}

function formatFields(fields: EcgReportRequest["metrics"]): string {
  if (fields.length === 0) return "- 無";
  return fields.map((field) => `- ${field.label}: ${field.value}`).join("\n");
}

function formatSection(section: EcgReportRequest["reviewSupport"][number]): string {
  const lines = [`### ${section.title}`];
  if (section.fields && section.fields.length > 0) {
    lines.push(formatFields(section.fields));
  }
  if (section.lines && section.lines.length > 0) {
    lines.push(section.lines.map((line) => `- ${line}`).join("\n"));
  }
  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

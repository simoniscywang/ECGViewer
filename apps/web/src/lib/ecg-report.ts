export interface ReportField {
  readonly label: string;
  readonly value: string;
}

export interface ReportSection {
  readonly title: string;
  readonly fields?: readonly ReportField[] | undefined;
  readonly lines?: readonly string[] | undefined;
}

export interface ReportImage {
  readonly label: string;
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export interface EcgReportRequest {
  readonly patient: readonly ReportField[];
  readonly observation: readonly ReportField[];
  readonly metrics: readonly ReportField[];
  readonly reviewSupport: readonly ReportSection[];
  readonly graph: readonly ReportField[];
  readonly graphImages: readonly ReportImage[];
  readonly physicianInterpretation: string;
  readonly generatedAt: string;
}

export interface EcgReportDocument {
  readonly generatedAt: string;
  readonly patient: readonly ReportField[];
  readonly observation: readonly ReportField[];
  readonly metrics: readonly ReportField[];
  readonly reviewSupport: readonly ReportSection[];
  readonly graph: readonly ReportField[];
  readonly graphImages: readonly ReportImage[];
  readonly physicianInterpretation: string;
}

interface PdfImage {
  readonly name: string;
  readonly label: string;
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

interface PdfPage {
  readonly commands: string[];
}

type PdfObjectBody = readonly Uint8Array[];

const maxTextLength = 4000;
const maxItems = 80;
const maxGraphImages = 16;
const maxImageDataUrlLength = 700_000;

export function parseEcgReportRequest(value: unknown): EcgReportRequest {
  if (!isRecord(value)) throw new Error("Report payload must be an object.");

  return {
    patient: parseFieldArray(value.patient, "patient"),
    observation: parseFieldArray(value.observation, "observation"),
    metrics: parseFieldArray(value.metrics, "metrics"),
    reviewSupport: parseSectionArray(value.reviewSupport, "reviewSupport"),
    graph: parseFieldArray(value.graph, "graph"),
    graphImages:
      value.graphImages === undefined
        ? []
        : parseImageArray(value.graphImages, "graphImages"),
    physicianInterpretation: parseText(
      value.physicianInterpretation,
      "physicianInterpretation",
      maxTextLength,
    ),
    generatedAt: parseText(value.generatedAt, "generatedAt", 80),
  };
}

export function buildEcgReportDocument(
  request: EcgReportRequest,
): EcgReportDocument {
  return {
    generatedAt: request.generatedAt,
    patient: request.patient,
    observation: request.observation,
    metrics: request.metrics,
    reviewSupport: request.reviewSupport,
    graph: request.graph,
    graphImages: request.graphImages,
    physicianInterpretation:
      request.physicianInterpretation.trim() || "未輸入醫師判讀說明。",
  };
}

export function createEcgReportPdf(document: EcgReportDocument): Uint8Array {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 44;
  const bottomY = 54;
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 14;
  const images = decodeReportImages(document.graphImages);
  const pages: PdfPage[] = [];
  let page = newReportPage(pageWidth, pageHeight, marginX);

  const commitPage = () => {
    pages.push({ commands: page.commands });
  };
  const ensureSpace = (height: number) => {
    if (page.y - height >= bottomY) return;
    commitPage();
    page = newReportPage(pageWidth, pageHeight, marginX);
  };
  const addText = (
    text: string,
    options: {
      readonly size?: number;
      readonly x?: number;
      readonly color?: string;
      readonly leading?: number;
    } = {},
  ) => {
    const size = options.size ?? 9.5;
    const leading = options.leading ?? lineHeight;
    ensureSpace(leading);
    page.commands.push(options.color ?? "0.10 0.12 0.16 rg");
    page.commands.push(pdfTextLine(text, options.x ?? marginX, page.y, size));
    page.y -= leading;
  };
  const addWrappedText = (
    text: string,
    options: {
      readonly size?: number;
      readonly x?: number;
      readonly maxChars?: number;
      readonly color?: string;
      readonly leading?: number;
    } = {},
  ) => {
    for (const line of wrapText(text, options.maxChars ?? 58)) {
      addText(line, options);
    }
  };
  const addRule = () => {
    ensureSpace(10);
    page.commands.push("0.80 0.86 0.94 RG");
    page.commands.push(
      `${marginX} ${page.y + 4} m ${pageWidth - marginX} ${page.y + 4} l S`,
    );
    page.y -= 10;
  };
  const addSectionTitle = (title: string) => {
    ensureSpace(28);
    addRule();
    addText(title, {
      color: "0.05 0.22 0.45 rg",
      leading: 18,
      size: 13,
    });
  };
  const addFieldGrid = (fields: readonly ReportField[]) => {
    const leftX = marginX;
    const rightX = marginX + contentWidth / 2 + 12;
    const valueOffset = 82;
    const columnWidth = 25;
    const drawCell = (
      field: ReportField | undefined,
      x: number,
      y: number,
    ): number => {
      if (!field) return 1;
      const valueLines = wrapText(field.value, columnWidth);
      page.commands.push("0.36 0.42 0.50 rg");
      page.commands.push(pdfTextLine(field.label, x, y, 8.5));
      page.commands.push("0.10 0.12 0.16 rg");
      valueLines.forEach((line, lineIndex) => {
        page.commands.push(
          pdfTextLine(line, x + valueOffset, y - lineIndex * 13, 9.5),
        );
      });
      return Math.max(1, valueLines.length);
    };

    for (let index = 0; index < fields.length; index += 2) {
      const left = fields[index];
      const right = fields[index + 1];
      const leftLines = left ? wrapText(left.value, columnWidth).length : 1;
      const rightLines = right ? wrapText(right.value, columnWidth).length : 1;
      const rowHeight = Math.max(leftLines, rightLines, 1) * 13 + 7;
      ensureSpace(rowHeight);
      const rowY = page.y;
      drawCell(left, leftX, rowY);
      drawCell(right, rightX, rowY);
      page.y -= rowHeight;
    }
  };

  const addCompactFieldGrid = (fields: readonly ReportField[]) => {
    const labelX = marginX + 8;
    const valueX = marginX + 128;
    for (const field of fields) {
      const valueLines = wrapText(field.value, 52);
      const rowHeight = Math.max(valueLines.length, 1) * 13 + 5;
      ensureSpace(rowHeight);
      const rowY = page.y;
      page.commands.push("0.36 0.42 0.50 rg");
      page.commands.push(pdfTextLine(field.label, labelX, rowY, 8.5));
      page.commands.push("0.10 0.12 0.16 rg");
      valueLines.forEach((line, lineIndex) => {
        page.commands.push(pdfTextLine(line, valueX, rowY - lineIndex * 13, 9.5));
      });
      page.y -= rowHeight;
    }
  };
  const addBullets = (lines: readonly string[]) => {
    for (const line of dedupe(lines).slice(0, 12)) {
      addWrappedText(`• ${line}`, {
        maxChars: 70,
        size: 9.5,
        x: marginX + 8,
      });
    }
  };
  const addImage = (image: PdfImage) => {
    const maxWidth = contentWidth;
    const maxHeight = 168;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    ensureSpace(height + 34);
    addText(image.label, {
      color: "0.20 0.25 0.32 rg",
      leading: 16,
      size: 10,
    });
    page.commands.push("q");
    page.commands.push("1 1 1 rg");
    page.commands.push(
      `${marginX - 1} ${page.y - height - 3} ${width + 2} ${height + 6} re f`,
    );
    page.commands.push(
      `${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${marginX} ${(page.y - height).toFixed(2)} cm`,
    );
    page.commands.push(`/${image.name} Do`);
    page.commands.push("Q");
    page.y -= height + 16;
  };

  addText("心電圖檢查報告", {
    color: "0.04 0.18 0.36 rg",
    leading: 22,
    size: 20,
  });
  addText("ECG Examination Report", {
    color: "0.32 0.38 0.46 rg",
    leading: 18,
    size: 11,
  });
  addWrappedText(
    "本報告彙整 ECGViewer 顯示資料、非診斷性輔助量測與醫師輸入判讀說明；實際臨床判讀仍應回到原始波形與完整病歷脈絡。",
    { color: "0.28 0.33 0.40 rg", maxChars: 96, size: 9 },
  );

  addSectionTitle("一、病患與檢查資訊");
  addFieldGrid([...document.patient, ...document.observation]);

  addSectionTitle("二、ECG 摘要量測");
  addFieldGrid(document.metrics);

  addSectionTitle("三、醫師判讀說明");
  addWrappedText(document.physicianInterpretation, {
    maxChars: 92,
    size: 10.5,
    x: marginX,
  });

  addSectionTitle("四、輔助分析結果");
  if (document.reviewSupport.length === 0) {
    addText("未選取輔助分析卡片。", { x: marginX + 8 });
  }
  for (const section of document.reviewSupport) {
    ensureSpace(28);
    addText(section.title, {
      color: "0.05 0.22 0.45 rg",
      leading: 16,
      size: 11,
      x: marginX + 8,
    });
    if (section.fields) addCompactFieldGrid(section.fields);
    if (section.lines) addBullets(section.lines);
  }

  addSectionTitle("五、ECG Graph");
  addFieldGrid(document.graph);
  if (images.length === 0) {
    addText("未能取得 ECG Graph 圖片。", { x: marginX + 8 });
  }
  for (const image of images) {
    addImage(image);
  }

  addSectionTitle("六、注意事項");
  addBullets([
    "自動量測與標記為 review-support estimates，並非診斷結論。",
    "若訊號品質受雜訊、基線漂移或取樣限制影響，請以原始 ECG 波形與臨床情境覆核。",
    `報告產製時間：${document.generatedAt}`,
  ]);

  commitPage();
  return buildPdf(pages, images, pageWidth, pageHeight);
}

function parseFieldArray(value: unknown, fieldName: string): ReportField[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(
      `${fieldName} must be an array with ${maxItems} or fewer items.`,
    );
  }
  return value.map((item, index) => parseField(item, `${fieldName}.${index}`));
}

function parseSectionArray(value: unknown, fieldName: string): ReportSection[] {
  if (!Array.isArray(value) || value.length > 20) {
    throw new Error(`${fieldName} must be an array with 20 or fewer items.`);
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${fieldName}.${index} must be an object.`);
    }
    return {
      title: parseText(item.title, `${fieldName}.${index}.title`, 120),
      fields:
        item.fields === undefined
          ? undefined
          : parseFieldArray(item.fields, `${fieldName}.${index}.fields`),
      lines:
        item.lines === undefined
          ? undefined
          : parseStringArray(item.lines, `${fieldName}.${index}.lines`),
    };
  });
}

function parseImageArray(value: unknown, fieldName: string): ReportImage[] {
  if (!Array.isArray(value) || value.length > maxGraphImages) {
    throw new Error(
      `${fieldName} must be an array with ${maxGraphImages} or fewer items.`,
    );
  }
  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${fieldName}.${index} must be an object.`);
    }
    const dataUrl = parseText(
      item.dataUrl,
      `${fieldName}.${index}.dataUrl`,
      maxImageDataUrlLength,
    );
    if (!dataUrl.startsWith("data:image/jpeg;base64,")) {
      throw new Error(`${fieldName}.${index}.dataUrl must be a JPEG data URL.`);
    }
    return {
      label: parseText(item.label, `${fieldName}.${index}.label`, 120),
      dataUrl,
      width: parseDimension(item.width, `${fieldName}.${index}.width`),
      height: parseDimension(item.height, `${fieldName}.${index}.height`),
    };
  });
}

function parseField(value: unknown, fieldName: string): ReportField {
  if (!isRecord(value)) throw new Error(`${fieldName} must be an object.`);
  return {
    label: parseText(value.label, `${fieldName}.label`, 120),
    value: parseText(value.value, `${fieldName}.value`, 800),
  };
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(
      `${fieldName} must be an array with ${maxItems} or fewer items.`,
    );
  }
  return value.map((item, index) =>
    parseText(item, `${fieldName}.${index}`, 800),
  );
}

function parseDimension(value: unknown, fieldName: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 1 ||
    value > 2400
  ) {
    throw new Error(`${fieldName} must be a finite positive number.`);
  }
  return value;
}

function parseText(value: unknown, fieldName: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(`${fieldName} must be text.`);
  const normalized = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").trim();
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function decodeReportImages(images: readonly ReportImage[]): PdfImage[] {
  return images.map((image, index) => ({
    name: `Im${index + 1}`,
    label: image.label,
    bytes: base64ToBytes(image.dataUrl.slice("data:image/jpeg;base64,".length)),
    width: image.width,
    height: image.height,
  }));
}

function newReportPage(
  pageWidth: number,
  pageHeight: number,
  marginX: number,
): {
  readonly commands: string[];
  y: number;
} {
  return {
    commands: [
      "0.96 0.98 1.00 rg",
      `0 0 ${pageWidth} ${pageHeight} re f`,
      "0.05 0.22 0.45 rg",
      `0 ${pageHeight - 22} ${pageWidth} 22 re f`,
      "1 1 1 rg",
      pdfTextLine(
        "ECGViewer | Professional ECG Review Report",
        marginX,
        pageHeight - 15,
        8,
      ),
      "0.45 0.52 0.62 rg",
      pdfTextLine(
        "Non-diagnostic automated measurements. Confirm with source waveform and clinical context.",
        marginX,
        28,
        8,
      ),
      "0.10 0.12 0.16 rg",
    ],
    y: pageHeight - 52,
  };
}

function wrapText(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\s*\n+\s*/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (visualLength(next) <= maxChars) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      if (visualLength(word) <= maxChars) {
        line = word;
        continue;
      }
      const pieces = splitLongWord(word, maxChars);
      lines.push(...pieces.slice(0, -1));
      line = pieces.at(-1) ?? "";
    }
    if (line) lines.push(line);
  }
  return lines.length > 0 ? lines : [""];
}

function splitLongWord(word: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let piece = "";
  for (const char of word) {
    if (visualLength(piece + char) > maxChars) {
      pieces.push(piece);
      piece = char;
      continue;
    }
    piece += char;
  }
  if (piece) pieces.push(piece);
  return pieces;
}

function visualLength(value: string): number {
  return Array.from(value).reduce(
    (sum, char) => sum + (char.charCodeAt(0) > 255 ? 2 : 1),
    0,
  );
}

function pdfTextLine(value: string, x: number, y: number, size: number): string {
  const operators = splitFontRuns(value)
    .map((run) => `${run.font} ${size} Tf ${run.text} Tj`)
    .join(" ");
  return `BT 1 0 0 1 ${x} ${y} Tm ${operators} ET`;
}

function splitFontRuns(value: string): { readonly font: string; readonly text: string }[] {
  const runs: { font: string; value: string }[] = [];
  for (const char of value.normalize("NFC")) {
    const font = isWinAnsiChar(char) ? "/F2" : "/F1";
    const current = runs.at(-1);
    if (current?.font === font) {
      current.value += char;
      continue;
    }
    runs.push({ font, value: char });
  }

  return runs.map((run) => ({
    font: run.font,
    text: run.font === "/F2" ? pdfLiteral(run.value) : pdfText(run.value),
  }));
}

function isWinAnsiChar(value: string): boolean {
  const code = value.charCodeAt(0);
  return code >= 0x20 && code <= 0x7e;
}

function pdfLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
  return `(${escaped})`;
}

function pdfText(value: string): string {
  const codeUnits: number[] = [];
  for (const char of value.normalize("NFC")) {
    const codePoint = char.codePointAt(0) ?? 0x20;
    if (codePoint <= 0xffff) {
      codeUnits.push(codePoint);
    } else {
      const adjusted = codePoint - 0x10000;
      codeUnits.push(0xd800 + (adjusted >> 10), 0xdc00 + (adjusted & 0x3ff));
    }
  }

  const bytes = new Uint8Array(codeUnits.length * 2);
  codeUnits.forEach((code, index) => {
    bytes[index * 2] = code >> 8;
    bytes[index * 2 + 1] = code & 0xff;
  });
  return `<${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
}

function buildPdf(
  pages: readonly PdfPage[],
  images: readonly PdfImage[],
  pageWidth: number,
  pageHeight: number,
): Uint8Array {
  const encoder = new TextEncoder();
  const objects: PdfObjectBody[] = [];
  const text = (value: string) => encoder.encode(value);
  const addObject = (body: PdfObjectBody | string): number => {
    objects.push(typeof body === "string" ? [text(body)] : body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("");
  const cjkFontId = addObject(
    "<< /Type /Font /Subtype /Type0 /BaseFont /MSung-Light /Encoding /UniCNS-UCS2-H /DescendantFonts [4 0 R] >>",
  );
  addObject(
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /MSung-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (CNS1) /Supplement 4 >> /FontDescriptor 5 0 R >>",
  );
  addObject(
    "<< /Type /FontDescriptor /FontName /MSung-Light /Flags 4 /FontBBox [-260 -174 1043 826] /ItalicAngle 0 /Ascent 826 /Descent -174 /CapHeight 625 /StemV 80 >>",
  );
  const latinFontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );

  const imageObjectIds = new Map<string, number>();
  for (const image of images) {
    const imageId = addObject([
      text(
        `<< /Type /XObject /Subtype /Image /Width ${Math.round(image.width)} /Height ${Math.round(image.height)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      ),
      image.bytes,
      text("\nendstream"),
    ]);
    imageObjectIds.set(image.name, imageId);
  }

  const xObjectResources =
    images.length > 0
      ? `/XObject << ${images.map((image) => `/${image.name} ${imageObjectIds.get(image.name)} 0 R`).join(" ")} >>`
      : "";
  const pageIds: number[] = [];
  for (const page of pages) {
    const stream = page.commands.join("\n");
    const streamBytes = text(stream);
    const streamId = addObject(
      `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    );
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${cjkFontId} 0 R /F2 ${latinFontId} 0 R >> ${xObjectResources} >> /Contents ${streamId} 0 R >>`,
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] = [
    text(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    ),
  ];

  const chunks: Uint8Array[] = [text("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n")];
  const offsets: number[] = [0];
  let offset = chunks[0]?.length ?? 0;

  objects.forEach((body, index) => {
    offsets.push(offset);
    const prefix = text(`${index + 1} 0 obj\n`);
    const suffix = text("\nendobj\n");
    chunks.push(prefix, ...body, suffix);
    offset += prefix.length + suffix.length + body.reduce((sum, item) => sum + item.length, 0);
  });

  const xrefOffset = offset;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets
      .slice(1)
      .map((item) => `${item.toString().padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
    "",
  ].join("\n");
  chunks.push(text(xref));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const pdf = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    pdf.set(chunk, cursor);
    cursor += chunk.length;
  }
  return pdf;
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function dedupe(items: readonly string[]): string[] {
  return [...new Set(items.filter((item) => item.trim()))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

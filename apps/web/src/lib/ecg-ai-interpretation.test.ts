import {
  buildAiInterpretationPrompt,
  extractChatCompletionText,
  extractResponseText,
  parseAiInterpretationRequest,
} from "./ecg-ai-interpretation";
import { describe, expect, it } from "vitest";

describe("ECG AI interpretation helpers", () => {
  it("builds a non-diagnostic prompt with metrics and review support", () => {
    const request = parseAiInterpretationRequest({
      graph: [{ label: "Displayed leads", value: "I, II, III" }],
      graphImages: [],
      metrics: [{ label: "Duration", value: "10.00 s" }],
      reviewSupport: [
        {
          fields: [{ label: "Quality", value: "92% good" }],
          lines: ["Stable baseline"],
          title: "Signal Quality",
        },
      ],
    });
    const prompt = buildAiInterpretationPrompt(request);

    expect(prompt).toContain("專業心臟科醫師");
    expect(prompt).toContain("不是正式診斷");
    expect(prompt).toContain("不要輸出 Patient ID");
    expect(prompt).toContain("不可使用「確診」");
    expect(prompt).toContain("不要只是逐條改寫或重述");
    expect(prompt).toContain("180-260 個中文字");
    expect(prompt).toContain("資料之間的關聯");
    expect(prompt).toContain("Rate/RR、R peak 偵測與節律相關 evidence 可信度高");
    expect(prompt).toContain("更像心臟科醫師摘要的 insight");
    expect(prompt).toContain("Duration: 10.00 s");
    expect(prompt).toContain("Signal Quality");
    expect(prompt).toContain("Stable baseline");
  });

  it("extracts text from Responses API output content", () => {
    expect(
      extractResponseText({
        output: [
          {
            content: [
              {
                text: "AI 輔助判讀草稿",
                type: "output_text",
              },
            ],
            type: "message",
          },
        ],
      }),
    ).toBe("AI 輔助判讀草稿");
  });

  it("extracts text from Chat Completions output content", () => {
    expect(
      extractChatCompletionText({
        choices: [
          {
            message: {
              content: "Azure AI 輔助判讀草稿",
              role: "assistant",
            },
          },
        ],
      }),
    ).toBe("Azure AI 輔助判讀草稿");
  });
});

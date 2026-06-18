import {
  buildAiInterpretationPrompt,
  extractChatCompletionText,
  extractResponseText,
  parseAiInterpretationRequest,
  type AiInterpretationRequest,
} from "@/lib/ecg-ai-interpretation";
import { NextRequest, NextResponse } from "next/server";

const maxPayloadBytes = 8_000_000;
const openaiResponsesUrl = "https://api.openai.com/v1/responses";
const systemInstruction =
  "You are a clinical documentation assistant for ECG review. Produce Traditional Chinese review-support text only. Do not diagnose. Do not mention protected health information. Be concise, structured, and explicitly non-diagnostic.";

interface ApiErrorBody {
  readonly error: string;
  readonly message: string;
}

interface AiInterpretationCreatedResponse {
  readonly interpretation: string;
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AiInterpretationCreatedResponse | ApiErrorBody>> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxPayloadBytes) {
    return errorResponse(
      "AI_INTERPRETATION_PAYLOAD_TOO_LARGE",
      "ECG 輔助判讀內容過大，請稍後再試。",
      413,
    );
  }

  try {
    const body: unknown = await request.json();
    const aiRequest = parseAiInterpretationRequest(body);
    const prompt = buildAiInterpretationPrompt(aiRequest);
    const provider = readAiProviderConfig(process.env);
    if (provider.status === "error") {
      return errorResponse(provider.code, provider.message, 503);
    }
    const response =
      provider.kind === "azure"
        ? await requestAzureOpenAiInterpretation(provider, aiRequest, prompt)
        : await requestOpenAiInterpretation(provider, aiRequest, prompt);

    if (!response.ok) {
      const errorCode = await parseOpenAiErrorCode(response);
      const providerLabel =
        provider.kind === "azure" ? "Azure OpenAI" : "OpenAI API";
      if (response.status === 401) {
        return errorResponse(
          provider.kind === "azure"
            ? "AZURE_OPENAI_AUTH_FAILED"
            : "OPENAI_AUTH_FAILED",
          `${providerLabel} 驗證失敗，請確認 API key 是否正確，且與目前 endpoint / project 相符。`,
          502,
        );
      }
      if (response.status === 403) {
        return errorResponse(
          provider.kind === "azure"
            ? "AZURE_OPENAI_ACCESS_DENIED"
            : "OPENAI_ACCESS_DENIED",
          `${providerLabel} 拒絕此請求，請確認 deployment、模型存取權限與 key scope。`,
          502,
        );
      }
      if (response.status === 429) {
        return errorResponse(
          provider.kind === "azure"
            ? "AZURE_OPENAI_RATE_OR_QUOTA_LIMIT"
            : "OPENAI_RATE_OR_QUOTA_LIMIT",
          errorCode === "insufficient_quota"
            ? `${providerLabel} 額度或付款設定不足，無法產生 AI 輔助判讀。`
            : `${providerLabel} 目前達到速率或使用量限制，請稍後再試。`,
          502,
        );
      }
      return errorResponse(
        "OPENAI_RESPONSE_FAILED",
        `AI 輔助判讀產生失敗，${providerLabel} 回應狀態 ${response.status}。`,
        502,
      );
    }

    const payload: unknown = await response.json();
    const interpretation =
      provider.kind === "azure"
        ? extractChatCompletionText(payload)
        : extractResponseText(payload);
    if (!interpretation) {
      return errorResponse(
        "OPENAI_RESPONSE_EMPTY",
        "AI 輔助判讀沒有回傳可用文字。",
        502,
      );
    }

    return NextResponse.json({ interpretation });
  } catch {
    return errorResponse(
      "AI_INTERPRETATION_FAILED",
      "AI 輔助判讀產生失敗，請稍後再試。",
      500,
    );
  }
}

type AiProviderConfig =
  | {
      readonly kind: "azure";
      readonly apiKey: string;
      readonly apiVersion: string;
      readonly deployment: string;
      readonly endpoint: string;
    }
  | {
      readonly kind: "openai";
      readonly apiKey: string;
      readonly model: string;
    };

type AiProviderConfigResult =
  | ({ readonly status: "ready" } & AiProviderConfig)
  | {
      readonly status: "error";
      readonly code: string;
      readonly message: string;
    };

function readAiProviderConfig(env: NodeJS.ProcessEnv): AiProviderConfigResult {
  const azureEndpoint = env.AZURE_OPENAI_ENDPOINT;
  const azureDeployment = env.AZURE_OPENAI_DEPLOYMENT;
  const azureApiVersion = env.AZURE_OPENAI_API_VERSION;
  if (azureEndpoint || azureDeployment || azureApiVersion) {
    if (!azureEndpoint || !azureDeployment || !azureApiVersion) {
      return {
        code: "AZURE_OPENAI_CONFIG_INCOMPLETE",
        message:
          "Azure OpenAI 設定不完整，請確認 endpoint、deployment 與 api-version。",
        status: "error",
      };
    }
    if (!env.AZURE_OPENAI_API_KEY) {
      return {
        code: "AZURE_OPENAI_API_KEY_MISSING",
        message:
          "伺服器缺少 AZURE_OPENAI_API_KEY，無法產生 AI 輔助判讀。",
        status: "error",
      };
    }
    return {
      apiKey: env.AZURE_OPENAI_API_KEY,
      apiVersion: azureApiVersion,
      deployment: azureDeployment,
      endpoint: azureEndpoint,
      kind: "azure",
      status: "ready",
    };
  }

  if (!env.OPENAI_API_KEY) {
    return {
      code: "OPENAI_API_KEY_MISSING",
      message: "伺服器缺少 OPENAI_API_KEY，無法產生 AI 輔助判讀。",
      status: "error",
    };
  }
  return {
    apiKey: env.OPENAI_API_KEY,
    kind: "openai",
    model: env.OPENAI_ECG_MODEL || "gpt-4.1",
    status: "ready",
  };
}

function requestOpenAiInterpretation(
  config: Extract<AiProviderConfig, { readonly kind: "openai" }>,
  aiRequest: AiInterpretationRequest,
  prompt: string,
): Promise<Response> {
  return fetch(openaiResponsesUrl, {
    body: JSON.stringify({
      input: [
        {
          content: [
            { text: prompt, type: "input_text" },
            ...aiRequest.graphImages.slice(0, 12).map((image) => ({
              detail: "low",
              image_url: image.dataUrl,
              type: "input_image",
            })),
          ],
          role: "user",
        },
      ],
      instructions: systemInstruction,
      max_output_tokens: 900,
      model: config.model,
      temperature: 0.2,
    }),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
}

function requestAzureOpenAiInterpretation(
  config: Extract<AiProviderConfig, { readonly kind: "azure" }>,
  aiRequest: AiInterpretationRequest,
  prompt: string,
): Promise<Response> {
  const endpoint = config.endpoint.replace(/\/+$/, "");
  const url = `${endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;
  return fetch(url, {
    body: JSON.stringify({
      max_completion_tokens: 900,
      messages: [
        { content: systemInstruction, role: "system" },
        {
          content: [
            { text: prompt, type: "text" },
            ...aiRequest.graphImages.slice(0, 12).map((image) => ({
              image_url: {
                detail: "low",
                url: image.dataUrl,
              },
              type: "image_url",
            })),
          ],
          role: "user",
        },
      ],
    }),
    headers: {
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });
}

function errorResponse(
  error: string,
  message: string,
  status: number,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error, message }, { status });
}

async function parseOpenAiErrorCode(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !isRecord(payload.error)) return "";
    return typeof payload.error.code === "string" ? payload.error.code : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

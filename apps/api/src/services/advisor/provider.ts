import { env } from "../../env.js";

export interface HuggingFaceProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
  provider?: string;
  errorCode?: HuggingFaceProviderErrorCode;
  statusCode?: number;
  durationMs?: number;
  terminal?: boolean;
}

export interface HuggingFaceJsonRequest {
  prompt: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
  formatModes?: HuggingFaceFormatMode[];
}

interface HuggingFaceGeneratedItem {
  generated_text?: string;
  summary_text?: string;
}

type HuggingFaceProviderErrorCode =
  | "credits_depleted"
  | "provider_timeout"
  | "gateway_timeout"
  | "no_generated_text"
  | "http_error"
  | "network_error";

function advisorJsonSchema(): Record<string, unknown> {
  const stringArray = {
    type: "array",
    items: { type: "string" },
    maxItems: 12
  };

  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "decisions", "nextSteps", "risks", "warnings"],
    properties: {
      summary: { type: "string" },
      decisions: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "recommendation", "rationale", "impact", "files"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            recommendation: { type: "string" },
            rationale: { type: "string" },
            impact: { type: "string", enum: ["low", "medium", "high"] },
            files: stringArray
          }
        }
      },
      nextSteps: stringArray,
      risks: stringArray,
      warnings: stringArray
    }
  };
}

function getEndpoint(): string {
  if (env.HF_ENDPOINT) return env.HF_ENDPOINT;
  return "https://router.huggingface.co/v1/chat/completions";
}

function usesResponsesEndpoint(endpoint = getEndpoint()): boolean {
  return /\/responses\/?$/i.test(endpoint);
}

function usesRouterChatEndpoint(endpoint = getEndpoint()): boolean {
  return /router\.huggingface\.co\/v1\/chat\/completions\/?$/i.test(endpoint);
}

function providerSequence(endpoint = getEndpoint()): string[] {
  if (!usesRouterChatEndpoint(endpoint)) {
    return [""];
  }

  const raw = env.HF_PROVIDER_SEQUENCE.trim() || env.HF_PROVIDER.trim();
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const sequence = values.length > 0 ? values : [env.HF_PROVIDER.trim()].filter(Boolean);
  const unique: string[] = [];
  for (const provider of sequence) {
    if (!unique.includes(provider)) {
      unique.push(provider);
    }
  }
  return unique.length > 0 ? unique : [""];
}

function huggingFaceModelId(endpoint = getEndpoint(), provider = env.HF_PROVIDER.trim()): string {
  const model = env.HF_MODEL.trim();
  const selectedProvider = provider.trim();
  if (!model || !usesRouterChatEndpoint(endpoint) || !selectedProvider || selectedProvider === "auto" || model.includes(":")) {
    return model;
  }
  return `${model}:${selectedProvider}`;
}

function extractText(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload.trim() || undefined;
  if (Array.isArray(payload)) {
    const first = payload[0] as HuggingFaceGeneratedItem | undefined;
    return first?.generated_text ?? first?.summary_text;
  }
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    if (typeof object.output_text === "string" && object.output_text.trim()) return object.output_text.trim();
    if (typeof object.generated_text === "string" && object.generated_text.trim()) return object.generated_text.trim();
    if (typeof object.error === "string") return undefined;
    if (object.aiBlueprint || object.summary || object.modules || object.architectureStyle || object.explanation) {
      return JSON.stringify(object);
    }

    const choices = object.choices;
    if (Array.isArray(choices)) {
      const first = choices[0] as { message?: { content?: unknown }; text?: unknown; delta?: { content?: unknown } } | undefined;
      if (typeof first?.message?.content === "string" && first.message.content.trim()) return first.message.content.trim();
      if (Array.isArray(first?.message?.content)) {
        const text = textParts(first.message.content).join("\n").trim();
        if (text) return text;
      }
      if (typeof first?.delta?.content === "string" && first.delta.content.trim()) return first.delta.content.trim();
      if (typeof first?.text === "string" && first.text.trim()) return first.text.trim();
    }

    const output = object.output;
    if (Array.isArray(output)) {
      const parts: string[] = [];
      for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const content = (item as { content?: unknown }).content;
        if (typeof content === "string") {
          parts.push(content);
          continue;
        }
        if (Array.isArray(content)) {
          for (const part of content) {
            if (!part || typeof part !== "object") continue;
            const value = part as { text?: unknown; content?: unknown };
            if (typeof value.text === "string") parts.push(value.text);
            else if (typeof value.content === "string") parts.push(value.content);
          }
        }
      }
      const text = parts.join("\n").trim();
      if (text) return text;
    }
  }
  return undefined;
}

function textParts(value: unknown[]): string[] {
  const parts: string[] = [];
  for (const part of value) {
    if (typeof part === "string" && part.trim()) {
      parts.push(part.trim());
      continue;
    }
    if (!part || typeof part !== "object") continue;
    const object = part as { text?: unknown; content?: unknown };
    if (typeof object.text === "string" && object.text.trim()) parts.push(object.text.trim());
    else if (typeof object.content === "string" && object.content.trim()) parts.push(object.content.trim());
  }
  return parts;
}

function compactError(payload: unknown, raw: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return JSON.stringify((payload as { error?: unknown }).error).slice(0, 900);
  }
  return raw.slice(0, 900);
}

function looksLikeHtml(raw: string, contentType = ""): boolean {
  const trimmed = raw.trim().slice(0, 80).toLowerCase();
  return contentType.toLowerCase().includes("text/html")
    || trimmed.startsWith("<!doctype html")
    || trimmed.startsWith("<html");
}

function payloadErrorText(payload: unknown, raw: string): string {
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    const error = object.error;
    if (typeof error === "string") return error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string") return message;
      return JSON.stringify(error).slice(0, 500);
    }
    const message = object.message;
    if (typeof message === "string") return message;
  }
  return raw.trim().slice(0, 500);
}

function classifyHttpError(input: {
  status: number;
  payload: unknown;
  raw: string;
  contentType?: string;
  durationMs: number;
  timeoutMs: number;
}): Pick<HuggingFaceProviderResult, "error" | "errorCode" | "statusCode" | "durationMs" | "terminal"> {
  const errorText = payloadErrorText(input.payload, input.raw);
  const lower = errorText.toLowerCase();
  if (input.status === 402 || lower.includes("credit") || lower.includes("billing")) {
    return {
      error: "Hugging Face credits are depleted. Add credits or switch generation mode.",
      errorCode: "credits_depleted",
      statusCode: input.status,
      durationMs: input.durationMs,
      terminal: true
    };
  }

  if (input.status === 504 || input.status === 502 || input.status === 503 || looksLikeHtml(input.raw, input.contentType)) {
    return {
      error: `Hugging Face provider timed out after ${input.durationMs} ms. The request reached Hugging Face, but the provider did not complete the architecture blueprint in time.`,
      errorCode: input.status === 504 ? "provider_timeout" : "gateway_timeout",
      statusCode: input.status,
      durationMs: input.durationMs,
      terminal: true
    };
  }

  return {
    error: `Hugging Face request failed with HTTP ${input.status}: ${compactError(input.payload, input.raw)}`,
    errorCode: "http_error",
    statusCode: input.status,
    durationMs: input.durationMs,
    terminal: input.status >= 500
  };
}

type HuggingFaceFormatMode = "schema" | "json_object" | "plain_json";

function debugLog(message: string, details: Record<string, unknown>): void {
  if (env.LOG_LEVEL !== "debug") return;
  console.info(`[ai:huggingface] ${message}`, details);
}

function jsonInstruction(request: HuggingFaceJsonRequest): string {
  return `${request.systemPrompt ?? "Return only valid JSON. Do not wrap the response in Markdown."}\nReturn one JSON object only. Do not use Markdown fences, comments, prose, or trailing text.`;
}

function requestBody(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode, endpoint = getEndpoint(), provider?: string): Record<string, unknown> {
  const instructions = jsonInstruction(request);
  const maxTokens = request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS;
  const model = huggingFaceModelId(endpoint, provider);

  if (usesResponsesEndpoint(endpoint)) {
    const body: Record<string, unknown> = {
      model,
      instructions,
      input: request.prompt,
      max_output_tokens: maxTokens,
      temperature: 0.35
    };

    if (formatMode === "schema" && request.schema) {
      body.text = {
        format: {
          type: "json_schema",
          name: request.schemaName ?? "mag_json_response",
          strict: true,
          schema: request.schema
        }
      };
    } else if (formatMode === "json_object") {
      body.text = { format: { type: "json_object" } };
    }

    return body;
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: instructions },
      { role: "user", content: request.prompt }
    ],
    max_tokens: maxTokens,
    temperature: 0.35
  };

  if (formatMode === "schema" && request.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: request.schemaName ?? "mag_json_response",
        strict: true,
        schema: request.schema
      }
    };
  } else if (formatMode === "json_object") {
    body.response_format = { type: "json_object" };
  }

  return body;
}


async function postHuggingFaceJson(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode, provider?: string): Promise<HuggingFaceProviderResult> {
  const controller = new AbortController();
  const requestTimeoutMs = request.timeoutMs ?? env.LLM_TIMEOUT_MS;
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const endpoint = getEndpoint();
  const selectedProvider = provider ?? "";
  const model = huggingFaceModelId(endpoint, selectedProvider);
  debugLog("attempt_started", { formatMode, model, provider: selectedProvider || undefined, endpoint, timeoutMs: requestTimeoutMs, maxOutputTokens: request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS, promptChars: request.prompt.length });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody(request, formatMode, endpoint, selectedProvider))
    });

    const raw = await response.text();
    const durationMs = Date.now() - startedAt;
    const contentType = response.headers?.get?.("content-type") ?? "";
    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }

    if (!response.ok) {
      return {
        ok: false,
        model,
        provider: selectedProvider || undefined,
        ...classifyHttpError({
          status: response.status,
          payload,
          raw,
          contentType,
          durationMs,
          timeoutMs: requestTimeoutMs
        })
      };
    }

    const text = extractText(payload);
    if (!text) {
      return {
        ok: false,
        error: `Hugging Face response did not contain generated text (${formatMode}, ${durationMs} ms).`,
        errorCode: "no_generated_text",
        durationMs,
        model,
        provider: selectedProvider || undefined
      };
    }

    debugLog("attempt_completed", { formatMode, provider: selectedProvider || undefined, durationMs, textChars: text.length });
    return { ok: true, text, model, provider: selectedProvider || undefined, durationMs };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : String(error);
    const durationMs = Date.now() - startedAt;
    return {
      ok: false,
      error: isAbort
        ? `Hugging Face provider timed out after ${requestTimeoutMs} ms before completing the architecture blueprint.`
        : `Hugging Face request failed before completion: ${message}`,
      errorCode: isAbort ? "provider_timeout" : "network_error",
      durationMs,
      terminal: isAbort,
      model,
      provider: selectedProvider || undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runHuggingFaceAdvisor(prompt: string): Promise<HuggingFaceProviderResult> {
  return runHuggingFaceJson({
    prompt,
    schema: advisorJsonSchema(),
    schemaName: "architecture_advisor_report",
    systemPrompt: "You are an architecture reviewer for generated mobile starter projects. Return only valid JSON matching the requested schema."
  });
}

export async function runHuggingFaceJson(request: HuggingFaceJsonRequest): Promise<HuggingFaceProviderResult> {
  if (!env.HF_TOKEN) {
    return { ok: false, error: "HF_TOKEN is not configured", model: env.HF_MODEL };
  }

  const attempts: HuggingFaceFormatMode[] = request.formatModes ?? (request.schema ? ["schema", "json_object", "plain_json"] : ["plain_json", "json_object"]);
  const providers = providerSequence();
  const errors: string[] = [];
  const startedAt = Date.now();
  const totalBudgetMs = request.timeoutMs ?? env.LLM_TIMEOUT_MS;
  let lastResult: HuggingFaceProviderResult | undefined;
  for (const provider of providers) {
    for (const attempt of attempts) {
      const elapsedMs = Date.now() - startedAt;
      const remainingMs = totalBudgetMs - elapsedMs;
      if (remainingMs < 3500) {
        errors.push(`Hugging Face ${attempt} attempt skipped because total request budget was exhausted`);
        break;
      }
      const result = await postHuggingFaceJson({
        ...request,
        timeoutMs: Math.max(3500, Math.min(request.timeoutMs ?? env.LLM_TIMEOUT_MS, remainingMs))
      }, attempt, provider);
      if (result.ok && result.text) {
        return result;
      }
      lastResult = result;
      const providerLabel = result.provider ? ` via ${result.provider}` : "";
      errors.push(`${result.error ?? `Hugging Face ${attempt} attempt failed`}${providerLabel}`);

      if (result.errorCode === "credits_depleted") {
        return {
          ok: false,
          error: result.error,
          model: result.model,
          provider: result.provider,
          errorCode: result.errorCode,
          statusCode: result.statusCode,
          durationMs: Date.now() - startedAt,
          terminal: true
        };
      }

      if (result.errorCode === "provider_timeout" || result.errorCode === "gateway_timeout" || result.terminal) {
        break;
      }
    }
  }

  return {
    ok: false,
    error: errors.join(" | ").slice(0, 1600),
    model: lastResult?.model ?? huggingFaceModelId(),
    provider: lastResult?.provider,
    errorCode: lastResult?.errorCode,
    statusCode: lastResult?.statusCode,
    durationMs: Date.now() - startedAt,
    terminal: lastResult?.terminal
  };
}

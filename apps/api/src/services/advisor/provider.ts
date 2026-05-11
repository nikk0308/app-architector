import { env } from "../../env.js";

export interface HuggingFaceProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

export interface HuggingFaceJsonRequest {
  prompt: string;
  schema?: Record<string, unknown>;
  schemaName?: string;
  systemPrompt?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

interface HuggingFaceGeneratedItem {
  generated_text?: string;
  summary_text?: string;
}

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

function getResponsesEndpoint(): string {
  if (env.HF_ENDPOINT) return env.HF_ENDPOINT;
  return "https://router.huggingface.co/v1/responses";
}

function getChatEndpoint(): string {
  if (env.HF_ENDPOINT) {
    if (env.HF_ENDPOINT.includes("/v1/responses")) return env.HF_ENDPOINT.replace(/\/v1\/responses\/?$/, "/v1/chat/completions");
    return env.HF_ENDPOINT;
  }
  return "https://router.huggingface.co/v1/chat/completions";
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
    if (typeof object.error === "string") throw new Error(object.error);

    const choices = object.choices;
    if (Array.isArray(choices)) {
      const parts: string[] = [];
      for (const choice of choices) {
        if (!choice || typeof choice !== "object") continue;
        const message = (choice as { message?: { content?: unknown }; delta?: { content?: unknown }; text?: unknown }).message;
        const delta = (choice as { delta?: { content?: unknown } }).delta;
        const text = (choice as { text?: unknown }).text;
        if (typeof message?.content === "string") parts.push(message.content);
        else if (Array.isArray(message?.content)) {
          for (const item of message.content) {
            if (!item || typeof item !== "object") continue;
            const contentPart = item as { text?: unknown; content?: unknown };
            if (typeof contentPart.text === "string") parts.push(contentPart.text);
            else if (typeof contentPart.content === "string") parts.push(contentPart.content);
          }
        }
        if (typeof delta?.content === "string") parts.push(delta.content);
        if (typeof text === "string") parts.push(text);
      }
      const joined = parts.join("\n").trim();
      if (joined) return joined;
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
            const value = part as { text?: unknown; content?: unknown; type?: unknown };
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

function compactError(payload: unknown, raw: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return JSON.stringify((payload as { error?: unknown }).error).slice(0, 900);
  }
  return raw.slice(0, 900);
}

type HuggingFaceFormatMode = "chat_plain_json" | "chat_json_object" | "chat_schema" | "responses_schema" | "responses_json_object" | "responses_plain_json";

function jsonInstructions(request: HuggingFaceJsonRequest): string {
  return `${request.systemPrompt ?? "Return only valid JSON. Do not wrap the response in Markdown."}\nReturn exactly one JSON object. No Markdown fences. No comments. No prose before or after JSON. Use compact strings.`;
}

function chatRequestBody(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: env.HF_MODEL,
    messages: [
      { role: "system", content: jsonInstructions(request) },
      { role: "user", content: request.prompt }
    ],
    max_tokens: request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS,
    temperature: 0.25
  };

  if (formatMode === "chat_schema" && request.schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: request.schemaName ?? "mag_json_response",
        strict: true,
        schema: request.schema
      }
    };
  } else if (formatMode === "chat_json_object") {
    body.response_format = { type: "json_object" };
  }

  return body;
}

function responsesRequestBody(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: env.HF_MODEL,
    instructions: jsonInstructions(request),
    input: request.prompt,
    max_output_tokens: request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS,
    temperature: 0.25
  };

  if (formatMode === "responses_schema" && request.schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: request.schemaName ?? "mag_json_response",
        strict: true,
        schema: request.schema
      }
    };
  } else if (formatMode === "responses_json_object") {
    body.text = { format: { type: "json_object" } };
  }

  return body;
}

async function postJson(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode): Promise<HuggingFaceProviderResult> {
  const controller = new AbortController();
  const requestTimeoutMs = request.timeoutMs ?? env.LLM_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const isChat = formatMode.startsWith("chat_");

  try {
    const response = await fetch(isChat ? getChatEndpoint() : getResponsesEndpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(isChat ? chatRequestBody(request, formatMode) : responsesRequestBody(request, formatMode))
    });

    const raw = await response.text();
    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }

    if (!response.ok) {
      return {
        ok: false,
        error: `Hugging Face request failed (${formatMode}): ${response.status} ${compactError(payload, raw)}`,
        model: env.HF_MODEL
      };
    }

    const text = extractText(payload);
    if (!text) {
      return { ok: false, error: `Hugging Face response did not contain generated text (${formatMode})`, model: env.HF_MODEL };
    }

    return { ok: true, text, model: env.HF_MODEL };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: isAbort ? `Hugging Face request timed out after ${requestTimeoutMs} ms (${formatMode})` : `${message} (${formatMode})`,
      model: env.HF_MODEL
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
    systemPrompt: "You are an architecture reviewer for generated mobile starter projects. Return only valid JSON matching the requested schema.",
    maxOutputTokens: 4000
  });
}

export async function runHuggingFaceJson(request: HuggingFaceJsonRequest): Promise<HuggingFaceProviderResult> {
  if (!env.HF_TOKEN) {
    return { ok: false, error: "HF_TOKEN is not configured", model: env.HF_MODEL };
  }

  // For Qwen through the HF router, Chat Completions is more reliable than the
  // beta Responses endpoint: it consistently returns choices[].message.content.
  // Start with plain JSON to avoid provider-side json_object/schema failures,
  // then try structured formats, and keep Responses only as a compatibility path.
  const attempts: HuggingFaceFormatMode[] = request.schema
    ? ["chat_plain_json", "chat_json_object", "chat_schema", "responses_json_object", "responses_schema", "responses_plain_json"]
    : ["chat_plain_json", "chat_json_object", "responses_json_object", "responses_plain_json"];
  const errors: string[] = [];

  for (const attempt of attempts) {
    const result = await postJson(request, attempt);
    if (result.ok && result.text) {
      return result;
    }
    errors.push(result.error ?? `Hugging Face ${attempt} attempt failed`);

    // A timeout already consumed the production request budget, so do not chain
    // more remote calls after it. The UI will show the real reason instead of a
    // late 504 from nginx.
    if (result.error?.includes("timed out")) break;
  }

  return { ok: false, error: errors.join(" | ").slice(0, 1800), model: env.HF_MODEL };
}

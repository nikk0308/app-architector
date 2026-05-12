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

function getEndpoint(): string {
  if (env.HF_ENDPOINT) return env.HF_ENDPOINT;
  return "https://router.huggingface.co/v1/chat/completions";
}

function usesResponsesEndpoint(endpoint = getEndpoint()): boolean {
  return /\/responses\/?$/i.test(endpoint);
}

function defaultProviderForModel(model: string): string {
  if (/^Qwen\/Qwen2\.5-Coder-32B-Instruct$/i.test(model)) return "nscale";
  return "";
}

function hasProviderSuffix(model: string): boolean {
  return /:[A-Za-z0-9_-]+$/.test(model);
}

function getModelCandidates(): string[] {
  const configured = env.HF_MODEL.trim() || "Qwen/Qwen2.5-Coder-32B-Instruct";
  const provider = (env.HF_PROVIDER || defaultProviderForModel(configured)).trim();
  const candidates = hasProviderSuffix(configured) || !provider || provider === "auto"
    ? [configured]
    : [`${configured}:${provider}`, configured];
  return [...new Set(candidates)];
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
      const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
      if (typeof first?.message?.content === "string" && first.message.content.trim()) return first.message.content.trim();
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

function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const object = payload as Record<string, unknown>;
  const choices = object.choices;
  if (!Array.isArray(choices)) return "";

  const parts: string[] = [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const item = choice as { delta?: { content?: unknown }; message?: { content?: unknown }; text?: unknown };
    if (typeof item.delta?.content === "string") parts.push(item.delta.content);
    else if (typeof item.message?.content === "string") parts.push(item.message.content);
    else if (typeof item.text === "string") parts.push(item.text);
  }
  return parts.join("");
}

async function readStreamingText(response: Response): Promise<string> {
  if (!response.body) {
    const raw = await response.text();
    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
    return extractText(payload) ?? raw;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let output = "";

  const consumeLine = (line: string): void => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const data = trimmed.slice(5).trim();
    if (!data || data === "[DONE]") return;
    try {
      output += extractStreamDelta(JSON.parse(data));
    } catch {
      output += data;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) consumeLine(line);
  }

  const tail = decoder.decode();
  if (tail) buffer += tail;
  for (const line of buffer.split(/\r?\n/)) consumeLine(line);

  return output.trim();
}

function compactError(payload: unknown, raw: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return JSON.stringify((payload as { error?: unknown }).error).slice(0, 900);
  }
  return raw.slice(0, 900);
}

type HuggingFaceFormatMode = "schema" | "json_object" | "plain_json";

function debugLog(message: string, details: Record<string, unknown>): void {
  if (env.LOG_LEVEL !== "debug") return;
  console.info(`[ai:huggingface] ${message}`, details);
}

function jsonInstruction(request: HuggingFaceJsonRequest): string {
  return `${request.systemPrompt ?? "Return only valid JSON. Do not wrap the response in Markdown."}\nReturn one JSON object only. Do not use Markdown fences, comments, prose, or trailing text.`;
}

function requestBody(
  request: HuggingFaceJsonRequest,
  formatMode: HuggingFaceFormatMode,
  endpoint = getEndpoint(),
  model = env.HF_MODEL,
  stream = false
): Record<string, unknown> {
  const instructions = jsonInstruction(request);
  const maxTokens = request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS;

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

  if (stream) {
    body.stream = true;
    body.stream_options = { include_usage: false };
  }

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


async function postHuggingFaceJson(request: HuggingFaceJsonRequest, formatMode: HuggingFaceFormatMode, model: string): Promise<HuggingFaceProviderResult> {
  const controller = new AbortController();
  const requestTimeoutMs = request.timeoutMs ?? env.LLM_TIMEOUT_MS;
  const startedAt = Date.now();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const stream = !usesResponsesEndpoint(getEndpoint()) && formatMode === "plain_json";
  debugLog("attempt_started", { formatMode, model, stream, timeoutMs: requestTimeoutMs, maxOutputTokens: request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS, promptChars: request.prompt.length });

  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody(request, formatMode, getEndpoint(), model, stream))
    });

    if (!response.ok) {
      const raw = await response.text();
      let payload: unknown = raw;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
      return {
        ok: false,
        error: `Hugging Face request failed (${formatMode}, ${Date.now() - startedAt} ms, ${model}): ${response.status} ${compactError(payload, raw)}`,
        model
      };
    }

    let text: string | undefined;
    if (stream) {
      text = await readStreamingText(response);
    } else {
      const raw = await response.text();
      let payload: unknown = raw;
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
      text = extractText(payload);
    }
    if (!text) {
      return { ok: false, error: `Hugging Face response did not contain generated text (${formatMode}, ${Date.now() - startedAt} ms)`, model };
    }

    debugLog("attempt_completed", { formatMode, durationMs: Date.now() - startedAt, textChars: text.length });
    return { ok: true, text, model };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: isAbort ? `Hugging Face request timed out after ${requestTimeoutMs} ms (${formatMode})` : `${message} (${formatMode}, ${Date.now() - startedAt} ms)`,
      model
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
  const models = getModelCandidates();
  if (!env.HF_TOKEN) {
    return { ok: false, error: "HF_TOKEN is not configured", model: models[0] ?? env.HF_MODEL };
  }

  const attempts: HuggingFaceFormatMode[] = request.schema ? ["schema", "json_object", "plain_json"] : ["plain_json"];
  const errors: string[] = [];
  const startedAt = Date.now();
  const totalBudgetMs = request.timeoutMs ?? env.LLM_TIMEOUT_MS;

  for (const model of models) {
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
      }, attempt, model);
      if (result.ok && result.text) {
        return result;
      }
      errors.push(result.error ?? `Hugging Face ${attempt} attempt failed`);
    }
  }

  return { ok: false, error: errors.join(" | ").slice(0, 2000), model: models[0] ?? env.HF_MODEL };
}

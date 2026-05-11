import { env } from "../../env.js";

export interface OpenAIProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

interface OpenAITextContent {
  type?: string;
  text?: string;
  content?: string;
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAITextContent[] | string;
}

export interface OpenAIJsonRequest {
  prompt: string;
  schema: Record<string, unknown>;
  schemaName: string;
  systemPrompt: string;
  maxOutputTokens?: number;
}

function extractOutputText(payload: unknown): string | undefined {
  if (typeof payload === "string") {
    return payload.trim() || undefined;
  }
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const object = payload as Record<string, unknown>;
  if (typeof object.output_text === "string" && object.output_text.trim()) {
    return object.output_text.trim();
  }

  const choices = object.choices;
  if (Array.isArray(choices)) {
    const first = choices[0] as { message?: { content?: unknown }; text?: unknown } | undefined;
    if (typeof first?.message?.content === "string" && first.message.content.trim()) return first.message.content.trim();
    if (typeof first?.text === "string" && first.text.trim()) return first.text.trim();
  }

  if (!Array.isArray(object.output)) {
    return undefined;
  }

  const parts: string[] = [];
  for (const item of object.output as OpenAIOutputItem[]) {
    if (typeof item.content === "string") {
      parts.push(item.content);
      continue;
    }
    if (!Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      } else if (typeof content.content === "string") {
        parts.push(content.content);
      }
    }
  }

  return parts.join("\n").trim() || undefined;
}

function compactError(payload: unknown, raw: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    return JSON.stringify((payload as { error?: unknown }).error).slice(0, 900);
  }
  return raw.slice(0, 900);
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

type OpenAIFormatMode = "schema" | "json_object" | "plain_json";

function requestBody(request: OpenAIJsonRequest, formatMode: OpenAIFormatMode): Record<string, unknown> {
  const strictJsonInstruction = "Return one JSON object only. Do not use Markdown fences, comments, prose, or trailing text.";
  const body: Record<string, unknown> = {
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: `${request.systemPrompt}\n${strictJsonInstruction}`
      },
      {
        role: "user",
        content: request.prompt
      }
    ],
    max_output_tokens: request.maxOutputTokens ?? env.LLM_MAX_NEW_TOKENS
  };

  if (formatMode === "schema") {
    body.text = {
      format: {
        type: "json_schema",
        name: request.schemaName,
        strict: true,
        schema: request.schema
      }
    };
  } else if (formatMode === "json_object") {
    body.text = {
      format: {
        type: "json_object"
      }
    };
  }

  return body;
}

async function postOpenAIJson(request: OpenAIJsonRequest, formatMode: OpenAIFormatMode): Promise<OpenAIProviderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody(request, formatMode))
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
        error: `OpenAI request failed (${formatMode}): ${response.status} ${compactError(payload, raw)}`,
        model: env.OPENAI_MODEL
      };
    }

    const text = extractOutputText(payload);
    if (!text) {
      return { ok: false, error: `OpenAI response did not contain output text (${formatMode})`, model: env.OPENAI_MODEL };
    }

    return { ok: true, text, model: env.OPENAI_MODEL };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: isAbort ? `OpenAI request timed out after ${env.LLM_TIMEOUT_MS} ms (${formatMode})` : `${message} (${formatMode})`,
      model: env.OPENAI_MODEL
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runOpenAIJson(request: OpenAIJsonRequest): Promise<OpenAIProviderResult> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY is not configured", model: env.OPENAI_MODEL };
  }

  const attempts: OpenAIFormatMode[] = ["schema", "json_object", "plain_json"];
  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await postOpenAIJson(request, attempt);
    if (result.ok && result.text) {
      return result;
    }
    errors.push(result.error ?? `OpenAI ${attempt} attempt failed`);
  }

  return { ok: false, error: errors.join(" | ").slice(0, 1600), model: env.OPENAI_MODEL };
}

export async function runOpenAIAdvisor(prompt: string): Promise<OpenAIProviderResult> {
  return runOpenAIJson({
    prompt,
    schema: advisorJsonSchema(),
    schemaName: "architecture_advisor_report",
    systemPrompt: "You are an architecture reviewer for generated mobile starter projects. Return only valid JSON matching the requested schema."
  });
}

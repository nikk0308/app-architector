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
}

interface OpenAIOutputItem {
  type?: string;
  content?: OpenAITextContent[];
}

function extractOutputText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const object = payload as Record<string, unknown>;
  if (typeof object.output_text === "string") {
    return object.output_text;
  }

  if (!Array.isArray(object.output)) {
    return undefined;
  }

  const parts: string[] = [];
  for (const item of object.output as OpenAIOutputItem[]) {
    if (!Array.isArray(item.content)) {
      continue;
    }
    for (const content of item.content) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim() || undefined;
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

export async function runOpenAIAdvisor(prompt: string): Promise<OpenAIProviderResult> {
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY is not configured", model: env.OPENAI_MODEL };
  }

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
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        input: [
          {
            role: "system",
            content: "You are an architecture reviewer for generated mobile starter projects. Return only valid JSON matching the requested schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "architecture_advisor_report",
            strict: true,
            schema: advisorJsonSchema()
          }
        },
        max_output_tokens: env.LLM_MAX_NEW_TOKENS
      })
    });

    const raw = await response.text();
    let payload: unknown = raw;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }

    if (!response.ok) {
      const error = payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as { error?: unknown }).error).slice(0, 500)
        : raw.slice(0, 500);
      return { ok: false, error: `OpenAI request failed: ${response.status} ${error}`, model: env.OPENAI_MODEL };
    }

    const text = extractOutputText(payload);
    if (!text) {
      return { ok: false, error: "OpenAI response did not contain output text", model: env.OPENAI_MODEL };
    }

    return { ok: true, text, model: env.OPENAI_MODEL };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, model: env.OPENAI_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

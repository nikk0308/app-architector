import { env } from "../../env.js";

export interface HuggingFaceProviderResult {
  ok: boolean;
  text?: string;
  error?: string;
  model?: string;
}

interface HuggingFaceGeneratedItem {
  generated_text?: string;
  summary_text?: string;
}

function getEndpoint(): string {
  if (env.HF_ENDPOINT) return env.HF_ENDPOINT;
  return "https://router.huggingface.co/v1/responses";
}

function extractText(payload: unknown): string | undefined {
  if (typeof payload === "string") return payload;
  if (Array.isArray(payload)) {
    const first = payload[0] as HuggingFaceGeneratedItem | undefined;
    return first?.generated_text ?? first?.summary_text;
  }
  if (payload && typeof payload === "object") {
    const object = payload as Record<string, unknown>;
    if (typeof object.output_text === "string") return object.output_text;
    if (typeof object.generated_text === "string") return object.generated_text;
    if (typeof object.error === "string") throw new Error(object.error);

    const choices = object.choices;
    if (Array.isArray(choices)) {
      const first = choices[0] as { message?: { content?: unknown } } | undefined;
      if (typeof first?.message?.content === "string") return first.message.content;
    }

    const output = object.output;
    if (Array.isArray(output)) {
      for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const content = (item as { content?: unknown }).content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          const text = content
            .map((part) => {
              if (!part || typeof part !== "object") return "";
              const value = part as { text?: unknown; content?: unknown };
              return typeof value.text === "string"
                ? value.text
                : typeof value.content === "string"
                  ? value.content
                  : "";
            })
            .join("");
          if (text.trim()) return text;
        }
      }
    }
  }
  return undefined;
}

export async function runHuggingFaceAdvisor(prompt: string): Promise<HuggingFaceProviderResult> {
  if (!env.HF_TOKEN) {
    return { ok: false, error: "HF_TOKEN is not configured", model: env.HF_MODEL };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.LLM_TIMEOUT_MS);

  try {
    const response = await fetch(getEndpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.HF_MODEL,
        instructions: "Return only valid JSON. Do not wrap the response in Markdown.",
        input: prompt,
        max_output_tokens: env.LLM_MAX_NEW_TOKENS,
        temperature: 0.2,
        response_format: {
          type: "json_object"
        },
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
      const error = typeof payload === "object" && payload !== null && "error" in payload
        ? String((payload as { error?: unknown }).error)
        : raw.slice(0, 300);
      return { ok: false, error: `Hugging Face request failed: ${response.status} ${error}`, model: env.HF_MODEL };
    }

    const text = extractText(payload);
    if (!text) {
      return { ok: false, error: "Hugging Face response did not contain generated text", model: env.HF_MODEL };
    }

    return { ok: true, text, model: env.HF_MODEL };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message, model: env.HF_MODEL };
  } finally {
    clearTimeout(timeout);
  }
}

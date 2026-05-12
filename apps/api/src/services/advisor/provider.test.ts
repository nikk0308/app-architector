import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProvider(overrides: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("HF_TOKEN", "hf_test");
  vi.stubEnv("HUGGINGFACE_API_TOKEN", "");
  vi.stubEnv("HF_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct");
  vi.stubEnv("HF_PROVIDER", "nscale");
  vi.stubEnv("HF_PROVIDER_SEQUENCE", "");
  vi.stubEnv("HF_ENDPOINT", "");
  vi.stubEnv("LLM_TIMEOUT_MS", "1000");
  vi.stubEnv("LLM_MAX_NEW_TOKENS", "321");
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
  return import("./provider.js");
}

async function loadOpenAIProvider() {
  vi.resetModules();
  vi.stubEnv("OPENAI_API_KEY", "sk_test");
  vi.stubEnv("OPENAI_MODEL", "gpt-test");
  vi.stubEnv("LLM_TIMEOUT_MS", "1000");
  vi.stubEnv("LLM_MAX_NEW_TOKENS", "321");
  return import("./openaiProvider.js");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Hugging Face provider", () => {
  it("uses the Chat Completions router endpoint with json_schema for advisor calls", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: "{\"summary\":\"ok\"}"
            }
          }
        ]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceAdvisor } = await loadProvider();
    const result = await runHuggingFaceAdvisor("Return JSON.");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://router.huggingface.co/v1/chat/completions");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct:nscale");
    expect(body.messages).toBeTruthy();
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: {
        name: "architecture_advisor_report",
        strict: true
      }
    });
  });

  it("uses plain JSON first for blueprint calls without schema", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        choices: [
          {
            message: {
              content: "{\"summary\":\"plain ok\"}"
            }
          }
        ]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider();
    const result = await runHuggingFaceJson({ prompt: "Return JSON." });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    expect(firstBody.response_format).toBeUndefined();
  });

  it("falls back from empty plain JSON output to json_object for schema-free calls", async () => {
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: "empty-plain-response" })
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"summary\":\"json object ok\"}"
              }
            }
          ]
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider();
    const result = await runHuggingFaceJson({ prompt: "Return JSON." });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body) as Record<string, unknown>;
    expect(firstBody.response_format).toBeUndefined();
    expect(secondBody.response_format).toEqual({ type: "json_object" });
  });

  it("classifies Hugging Face HTML 504 as a clean terminal provider timeout", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 504,
      headers: { get: () => "text/html" },
      text: async () => "<!DOCTYPE html><html><body><h1>504 Gateway Timeout</h1></body></html>"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider();
    const result = await runHuggingFaceJson({
      prompt: "Return JSON.",
      formatModes: ["plain_json", "json_object"],
      timeoutMs: 5000
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("provider_timeout");
    expect(result.error).toContain("Hugging Face provider timed out");
    expect(result.error).not.toContain("<!DOCTYPE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("classifies depleted Hugging Face credits without retrying", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 402,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ error: "credits depleted" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider();
    const result = await runHuggingFaceJson({
      prompt: "Return JSON.",
      formatModes: ["plain_json", "json_object"],
      timeoutMs: 5000
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("credits_depleted");
    expect(result.error).toBe("Hugging Face credits are depleted. Add credits or switch generation mode.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tries the next Hugging Face provider after a gateway timeout without repeating the same provider", async () => {
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return {
          ok: false,
          status: 504,
          headers: { get: () => "text/html" },
          text: async () => "<!DOCTYPE html><html><body><h1>504 Gateway Timeout</h1></body></html>"
        };
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        text: async () => JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"summary\":\"provider failover ok\"}"
              }
            }
          ]
        })
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider({ HF_PROVIDER_SEQUENCE: "nscale,nebius" });
    const result = await runHuggingFaceJson({
      prompt: "Return JSON.",
      formatModes: ["plain_json"],
      timeoutMs: 5000
    });

    expect(result.ok).toBe(true);
    expect(result.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct:nebius");
    expect(result.provider).toBe("nebius");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body) as Record<string, unknown>;
    expect(firstBody.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct:nscale");
    expect(secondBody.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct:nebius");
  });

  it("returns a clear error when Hugging Face responds without generated text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      text: async () => JSON.stringify({ id: "empty-response" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceJson } = await loadProvider();
    const result = await runHuggingFaceJson({
      prompt: "Return JSON.",
      formatModes: ["plain_json"],
      timeoutMs: 5000
    });

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("no_generated_text");
    expect(result.error).toContain("did not contain generated text");
  });
});

describe("OpenAI provider", () => {
  it("still calls the Responses API and extracts output_text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output_text: "{\"summary\":\"ok\"}" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runOpenAIJson } = await loadOpenAIProvider();
    const result = await runOpenAIJson({
      prompt: "Return JSON.",
      schemaName: "test_schema",
      systemPrompt: "Return JSON.",
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {}
      }
    });

    expect(result.ok).toBe(true);
    expect(result.text).toContain("summary");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://api.openai.com/v1/responses");
    const body = JSON.parse(init.body) as Record<string, unknown>;
    expect(body.model).toBe("gpt-test");
  });
});

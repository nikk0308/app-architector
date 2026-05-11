import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProvider() {
  vi.resetModules();
  vi.stubEnv("HF_TOKEN", "hf_test");
  vi.stubEnv("HUGGINGFACE_API_TOKEN", "");
  vi.stubEnv("HF_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct");
  vi.stubEnv("HF_ENDPOINT", "");
  vi.stubEnv("LLM_TIMEOUT_MS", "1000");
  vi.stubEnv("LLM_MAX_NEW_TOKENS", "321");
  return import("./provider.js");
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
    expect(body.model).toBe("Qwen/Qwen2.5-Coder-32B-Instruct");
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
});

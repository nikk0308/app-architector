import { afterEach, describe, expect, it, vi } from "vitest";

async function loadProvider() {
  vi.resetModules();
  vi.doMock("../../env.js", () => ({
    env: {
      HF_TOKEN: "hf_test",
      HF_MODEL: "Qwen/Qwen2.5-Coder-32B-Instruct",
      HF_ENDPOINT: "",
      LLM_TIMEOUT_MS: 1000,
      LLM_MAX_NEW_TOKENS: 321
    }
  }));
  return import("./provider.js");
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("../../env.js");
});

describe("Hugging Face provider", () => {
  it("uses the Chat Completions router endpoint for Qwen chat models", async () => {
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
    await runHuggingFaceAdvisor("Return JSON.");

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect(init.body).toContain("\"model\":\"Qwen/Qwen2.5-Coder-32B-Instruct\"");
    expect(init.body).toContain("\"messages\"");
    expect(init.body).toContain("\"response_format\":{\"type\":\"json_schema\"");
    expect(init.body).toContain("\"strict\":true");
  });

  it("falls back to json_object when plain JSON returns no text", async () => {
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ id: "empty-json-object-response" })
        };
      }
      return {
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

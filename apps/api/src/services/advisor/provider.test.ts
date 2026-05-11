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
  it("uses the Inference Providers responses endpoint for Qwen chat models", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ output_text: "{\"summary\":\"ok\"}" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { runHuggingFaceAdvisor } = await loadProvider();
    const result = await runHuggingFaceAdvisor("Return JSON.");

    expect(result.ok).toBe(true);
    expect(result.text).toBe("{\"summary\":\"ok\"}");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://router.huggingface.co/v1/responses");
    expect(init.body).toContain("\"model\":\"Qwen/Qwen2.5-Coder-32B-Instruct\"");
    expect(init.body).toContain("\"text\":{\"format\":{\"type\":\"json_schema\"");
    expect(init.body).toContain("\"strict\":true");
  });
});

import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("API smoke", () => {
  it("returns health status", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
    await app.close();
  });

  it("returns questionnaire schema", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/questionnaire"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().sections.length).toBeGreaterThan(0);
    await app.close();
  });
});

#!/usr/bin/env node

const url = process.argv[2];
if (!url) {
  console.error("Healthcheck URL is required");
  process.exit(2);
}

try {
  const response = await fetch(url, {
    headers: { "User-Agent": "app-architector-container-healthcheck/1.0" },
    signal: AbortSignal.timeout(4_000)
  });
  const body = await response.text();
  if (!response.ok || !body.includes('"status":"ready"')) {
    throw new Error(`Unexpected health response: HTTP ${response.status} ${body.slice(0, 200)}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

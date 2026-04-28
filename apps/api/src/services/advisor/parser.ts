import type { ArchitectureAdvisorReport, ArchitectureDecision } from "@mag/shared";

interface RawAdvisorShape {
  summary?: unknown;
  decisions?: unknown;
  nextSteps?: unknown;
  risks?: unknown;
  warnings?: unknown;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean).slice(0, 12);
}

function normalizeImpact(value: unknown): ArchitectureDecision["impact"] {
  return value === "low" || value === "medium" || value === "high" ? value : "medium";
}

function normalizeDecision(value: unknown, index: number): ArchitectureDecision | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = asString(item.title);
  const recommendation = asString(item.recommendation);
  const rationale = asString(item.rationale);
  if (!title || !recommendation || !rationale) return null;

  return {
    id: asString(item.id, `advisor-decision-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase(),
    title,
    recommendation,
    rationale,
    impact: normalizeImpact(item.impact),
    files: asStringArray(item.files).slice(0, 10)
  };
}

function extractJson(text: string): RawAdvisorShape | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1)) as RawAdvisorShape;
  } catch {
    return null;
  }
}

export function parseAdvisorResponse(text: string, createdAt = new Date().toISOString()): Omit<ArchitectureAdvisorReport, "status" | "provider" | "model"> | null {
  const parsed = extractJson(text);
  if (!parsed) return null;

  const decisions = Array.isArray(parsed.decisions)
    ? parsed.decisions.map((item, index) => normalizeDecision(item, index)).filter((item): item is ArchitectureDecision => Boolean(item)).slice(0, 8)
    : [];

  const summary = asString(parsed.summary);
  if (!summary || decisions.length === 0) return null;

  return {
    version: "1.0",
    summary,
    decisions,
    nextSteps: asStringArray(parsed.nextSteps),
    risks: asStringArray(parsed.risks),
    warnings: asStringArray(parsed.warnings),
    createdAt
  };
}

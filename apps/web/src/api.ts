import type { QuestionnaireAnswers } from "@mag/shared";

export function getApiRoot() {
  return import.meta.env.VITE_API_BASE_URL || "";
}

export async function fetchQuestionnaire() {
  const response = await fetch(`${getApiRoot()}/api/questionnaire`);
  if (!response.ok) {
    throw new Error("Cannot load questionnaire");
  }
  return response.json();
}

export async function previewProfile(payload: QuestionnaireAnswers) {
  const response = await fetch(`${getApiRoot()}/api/profile/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("Cannot preview profile");
  }

  return response.json();
}

export async function createGeneration(payload: QuestionnaireAnswers) {
  const response = await fetch(`${getApiRoot()}/api/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Cannot generate project");
  }

  return response.json();
}

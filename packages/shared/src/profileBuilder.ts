import type { NormalizedProfile, QuestionnaireAnswers } from "./types.js";
import { buildArchitectureSpec, projectProfileFromSpec } from "./specBuilder.js";

function assertRequiredIdentityFields(input: QuestionnaireAnswers): void {
  const projectName = input.projectName?.trim();
  if (!projectName) {
    throw new Error("projectName is required");
  }
}

export function buildConfigProfile(input: QuestionnaireAnswers): NormalizedProfile {
  assertRequiredIdentityFields(input);
  return projectProfileFromSpec(buildArchitectureSpec(input));
}

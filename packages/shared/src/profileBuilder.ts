import type { NormalizedProfile, QuestionnaireAnswers } from "./types.js";
import { buildArchitectureSpec, projectProfileFromSpec } from "./specBuilder.js";

export function buildConfigProfile(answers: QuestionnaireAnswers): NormalizedProfile {
  const spec = buildArchitectureSpec(answers);
  return projectProfileFromSpec(spec);
}

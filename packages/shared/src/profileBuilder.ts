import { profileDefaults } from "./questionnaire.js";
import type { NormalizedProfile, QuestionnaireAnswers } from "./types.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "generated-app";
}

function pascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1).toLowerCase())
    .join("") || "GeneratedApp";
}

function defaultPackageId(slug: string): string {
  return `com.example.${slug.replace(/-/g, "")}`;
}

function buildExplanation(profile: string, architectureStyle: string, navigationStyle: string, stateManagement: string): string {
  return [
    `Профіль ${profile} використовує стиль ${architectureStyle}.`,
    `Навігація будується за схемою ${navigationStyle}.`,
    `Керування станом реалізується через ${stateManagement}.`,
    "Генерація є deterministic: набір модулів формується через rules + mappings + templates."
  ].join(" ");
}

export function buildConfigProfile(answers: QuestionnaireAnswers): NormalizedProfile {
  if (!answers.projectName?.trim()) {
    throw new Error("projectName is required");
  }
  if (!answers.appDisplayName?.trim()) {
    throw new Error("appDisplayName is required");
  }
  if (!answers.profile) {
    throw new Error("profile is required");
  }

  const defaults = profileDefaults[answers.profile];
  const projectSlug = slugify(answers.projectName);
  const projectPascal = pascalCase(answers.projectName);
  const packageId = answers.packageId?.trim() || defaultPackageId(projectSlug);

  return {
    profile: answers.profile,
    projectName: answers.projectName.trim(),
    projectSlug,
    projectPascal,
    appDisplayName: answers.appDisplayName.trim(),
    packageId,
    architectureStyle: answers.architectureStyle?.trim() || defaults.architectureStyle,
    stateManagement: answers.stateManagement?.trim() || defaults.stateManagement,
    navigationStyle: answers.navigationStyle?.trim() || defaults.navigationStyle,
    environmentMode: answers.environmentMode || "multi",
    includeExampleScreen: answers.includeExampleScreen ?? true,
    includeLLMNotes: answers.includeLLMNotes ?? false,
    modules: {
      auth: answers.hasAuth ?? true,
      analytics: answers.hasAnalytics ?? true,
      localization: answers.hasLocalization ?? true,
      push: answers.hasPush ?? false,
      networking: answers.hasNetworking ?? true,
      persistence: answers.hasPersistence ?? true,
      navigation: true,
      stateLayer: true,
      configFiles: true,
      readme: true,
      entryPoint: true
    },
    entryPoint: defaults.entryPoint.replaceAll("<Project>", projectPascal),
    rootFolderName: projectSlug,
    explanation: buildExplanation(answers.profile, answers.architectureStyle?.trim() || defaults.architectureStyle, answers.navigationStyle?.trim() || defaults.navigationStyle, answers.stateManagement?.trim() || defaults.stateManagement)
  };
}

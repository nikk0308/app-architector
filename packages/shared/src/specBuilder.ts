import { getProjectProfile } from "./profiles.js";
import { ARCHITECTURE_SPEC_VERSION } from "./version.js";
import type {
  ArchitectureSpec,
  ModuleSelection,
  NormalizedProfile,
  QuestionnaireAnswerSet,
  UniversalFeatureId
} from "./types.js";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "mobile-app";
}

function pascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("") || "MobileApp";
}

function buildPackageId(answers: QuestionnaireAnswerSet, slug: string): string {
  if (answers.packageId?.trim()) {
    return answers.packageId.trim();
  }
  return `com.example.${slug.replace(/-/g, "")}`;
}

function selectArchitectureStyle(answers: QuestionnaireAnswerSet): string {
  if (answers.architectureStyle) {
    return answers.architectureStyle;
  }
  switch (answers.profile) {
    case "unity":
      return "game-flow";
    case "ios":
      return "coordinator";
    case "flutter":
      return "feature-first";
    case "react-native":
      return "layered";
  }
}

function selectStateManagement(answers: QuestionnaireAnswerSet): string {
  if (answers.stateManagement) {
    return answers.stateManagement;
  }
  switch (answers.profile) {
    case "unity":
      return "scriptable-object";
    case "flutter":
      return "provider";
    case "react-native":
      return "redux-toolkit";
    case "ios":
      return "native";
  }
}

function selectNavigationStyle(answers: QuestionnaireAnswerSet): string {
  if (answers.navigationStyle) {
    return answers.navigationStyle;
  }
  switch (answers.profile) {
    case "unity":
      return "scene-flow";
    case "ios":
      return "coordinator";
    case "flutter":
      return "router";
    case "react-native":
      return "stack";
  }
}

function featureAnswers(answers: QuestionnaireAnswerSet): Record<UniversalFeatureId, boolean> {
  return {
    "entry-point": true,
    navigation: true,
    auth: Boolean(answers.hasAuth),
    analytics: Boolean(answers.hasAnalytics),
    localization: Boolean(answers.hasLocalization),
    push: Boolean(answers.hasPush),
    networking: answers.hasNetworking !== false,
    storage: Boolean(answers.hasPersistence),
    "environment-config": true,
    "state-management": true,
    "dependency-injection": false,
    "testing-skeleton": true
  };
}

function entryPointForProfile(profileId: QuestionnaireAnswerSet["profile"]): string {
  switch (profileId) {
    case "unity":
      return "Assets/Scenes/Bootstrap.unity";
    case "ios":
      return "Sources/App/AppEntry.swift";
    case "flutter":
      return "lib/main.dart";
    case "react-native":
      return "src/App.tsx";
  }
}

function explain(profile: NormalizedProfile): string {
  return `Profile ${profile.profile} uses ${profile.architectureStyle} architecture with ${profile.stateManagement} state management, ${profile.navigationStyle} navigation and ${profile.environmentMode} environment configuration.`;
}

export function buildArchitectureSpec(answers: QuestionnaireAnswerSet): ArchitectureSpec {
  const profileDefinition = getProjectProfile(answers.profile);
  const projectSlug = slugify(answers.projectName);
  const projectPascal = pascalCase(answers.projectName);
  const packageId = buildPackageId(answers, projectSlug);
  const generationMode = answers.generationMode ?? "baseline";
  const architectureStyle = selectArchitectureStyle(answers);
  const stateManagement = selectStateManagement(answers);
  const navigationStyle = selectNavigationStyle(answers);
  const environmentMode = answers.environmentMode ?? "single";
  const profileFeatures = featureAnswers(answers);
  const specFeatures = {
    auth: Boolean(answers.hasAuth),
    analytics: Boolean(answers.hasAnalytics),
    localization: Boolean(answers.hasLocalization),
    push: Boolean(answers.hasPush),
    networking: answers.hasNetworking ?? true,
    persistence: Boolean(answers.hasPersistence),
    exampleScreen: answers.includeExampleScreen ?? true,
    llmNotes: answers.includeLLMNotes ?? false
  };

  const modules: ModuleSelection[] = Object.entries(profileDefinition.capabilities).map(([featureId, capability]) => {
    const typedFeatureId = featureId as UniversalFeatureId;
    const requested = profileFeatures[typedFeatureId];
    const enabled = capability.required || (capability.supported && (requested || capability.defaultEnabled));
    const source = capability.required
      ? "mandatory"
      : requested
        ? "answer"
        : capability.defaultEnabled
          ? "profile-default"
          : "derived";

    return {
      featureId: typedFeatureId,
      enabled,
      supported: capability.supported,
      required: capability.required,
      source,
      artifactIds: profileDefinition.featureArtifacts[typedFeatureId] ?? [],
      notes: capability.notes ?? []
    };
  });

  const dependencyRules: Array<{ from: UniversalFeatureId; to: UniversalFeatureId; reason: string }> = [
    { from: "auth", to: "networking", reason: "Auth scaffold requires request/response abstractions." },
    { from: "push", to: "environment-config", reason: "Push placeholders rely on environment-aware keys and build settings." },
    { from: "localization", to: "entry-point", reason: "Localization must be wired into application bootstrap." },
    { from: "analytics", to: "navigation", reason: "Analytics hooks are attached to screen or scene transitions." }
  ];

  const dependencyPlan = {
    requiredFeatures: modules.filter((module) => module.enabled && module.required).map((module) => module.featureId),
    optionalFeatures: modules.filter((module) => module.enabled && !module.required).map((module) => module.featureId),
    relationships: dependencyRules.filter((rule) => modules.some((module) => module.featureId === rule.from && module.enabled)),
    warnings: modules
      .filter((module) => !module.supported && profileFeatures[module.featureId])
      .map((module) => `${module.featureId} is requested but not supported for ${answers.profile} in the baseline profile.`)
  };

  const rootDirectoryName = profileDefinition.naming.rootFolderPattern === "pascal" ? projectPascal : projectSlug;
  const normalizedProfile: NormalizedProfile = {
    profile: answers.profile,
    generationMode,
    projectName: answers.projectName.trim(),
    appDisplayName: answers.appDisplayName.trim(),
    projectSlug,
    projectPascal,
    packageId,
    architectureStyle,
    stateManagement,
    navigationStyle,
    environmentMode,
    features: {
      auth: profileFeatures.auth,
      analytics: profileFeatures.analytics,
      localization: profileFeatures.localization,
      push: profileFeatures.push,
      networking: profileFeatures.networking,
      persistence: specFeatures.persistence
    },
    entryPoint: entryPointForProfile(answers.profile),
    explanation: ""
  };
  normalizedProfile.explanation = explain(normalizedProfile);

  return {
    version: ARCHITECTURE_SPEC_VERSION,
    profileId: answers.profile,
    generationMode,
    projectName: normalizedProfile.projectName,
    appDisplayName: normalizedProfile.appDisplayName,
    naming: {
      projectSlug,
      projectPascal,
      packageId,
      rootDirectoryName
    },
    architecture: {
      style: architectureStyle,
      stateManagement,
      navigationStyle,
      environmentMode,
      entryPoint: normalizedProfile.entryPoint
    },
    features: specFeatures,
    modules,
    dependencyPlan,
    explanation: normalizedProfile.explanation
  };
}

export function projectProfileFromSpec(spec: ArchitectureSpec): NormalizedProfile {
  return {
    profile: spec.profileId,
    generationMode: spec.generationMode,
    projectName: spec.projectName,
    appDisplayName: spec.appDisplayName,
    projectSlug: spec.naming.projectSlug,
    projectPascal: spec.naming.projectPascal,
    packageId: spec.naming.packageId,
    architectureStyle: spec.architecture.style,
    stateManagement: spec.architecture.stateManagement,
    navigationStyle: spec.architecture.navigationStyle,
    environmentMode: spec.architecture.environmentMode,
    features: {
      auth: spec.features.auth,
      analytics: spec.features.analytics,
      localization: spec.features.localization,
      push: spec.features.push,
      networking: spec.features.networking,
      persistence: spec.features.persistence
    },
    entryPoint: spec.architecture.entryPoint,
    explanation: spec.explanation
  };
}

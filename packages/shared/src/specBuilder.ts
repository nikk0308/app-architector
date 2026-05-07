import { getProjectProfile } from "./profiles.js";
import { ARCHITECTURE_SPEC_VERSION } from "./version.js";
import type {
  ArchitectureSpec,
  DeliveryOptionId,
  DistributionStoreId,
  MonetizationStrategyId,
  ModuleSelection,
  NormalizedProfile,
  OfflineDataOptionId,
  QuestionnaireAnswerSet,
  RuntimeQualityOptionId,
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

const optionPolicy = {
  ios: {
    architecture: ["feature-first", "mvvm", "coordinator", "layered"],
    state: ["native"],
    navigation: ["coordinator", "stack"],
    defaults: { architecture: "feature-first", state: "native", navigation: "coordinator" }
  },
  flutter: {
    architecture: ["feature-first", "mvvm", "layered"],
    state: ["riverpod", "native"],
    navigation: ["router", "stack"],
    defaults: { architecture: "feature-first", state: "riverpod", navigation: "router" }
  },
  "react-native": {
    architecture: ["feature-first", "layered", "mvvm"],
    state: ["zustand", "redux-toolkit", "native"],
    navigation: ["stack", "router"],
    defaults: { architecture: "feature-first", state: "zustand", navigation: "stack" }
  },
  unity: {
    architecture: ["feature-first", "coordinator", "layered"],
    state: ["scriptable-object", "native"],
    navigation: ["scene-flow"],
    defaults: { architecture: "feature-first", state: "scriptable-object", navigation: "scene-flow" }
  }
} as const;

const allowedDistributionStores: Record<QuestionnaireAnswerSet["profile"], readonly DistributionStoreId[]> = {
  ios: ["apple-app-store"],
  flutter: ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"],
  "react-native": ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"],
  unity: ["apple-app-store", "google-play", "samsung-galaxy-store", "amazon-appstore"]
};

const allowedMonetization: readonly MonetizationStrategyId[] = ["ads", "paid-app", "subscription", "in-app-purchases"];
const allowedOfflineData: readonly OfflineDataOptionId[] = ["offline-cache", "sync-queue", "data-migrations", "secure-storage"];
const allowedRuntimeQuality: readonly RuntimeQualityOptionId[] = ["logging", "crash-reporting", "feature-flags", "settings-screen", "diagnostics-screen"];
const allowedDelivery: readonly DeliveryOptionId[] = ["ci-cd", "release-checklist", "design-system", "test-plan", "env-secrets"];

function filterKnown<T extends string>(values: readonly T[] | undefined, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const allowedSet = new Set(allowed);
  return [...new Set(values.filter((value): value is T => allowedSet.has(value)))];
}

function allowedOrDefault(
  value: string | undefined,
  allowed: readonly string[],
  fallback: string
): string {
  return value && allowed.includes(value) ? value : fallback;
}

function selectArchitectureStyle(answers: QuestionnaireAnswerSet): string {
  const policy = optionPolicy[answers.profile];
  return allowedOrDefault(answers.architectureStyle, policy.architecture, policy.defaults.architecture);
}

function selectStateManagement(answers: QuestionnaireAnswerSet): string {
  const policy = optionPolicy[answers.profile];
  return allowedOrDefault(answers.stateManagement, policy.state, policy.defaults.state);
}

function selectNavigationStyle(answers: QuestionnaireAnswerSet): string {
  const policy = optionPolicy[answers.profile];
  return allowedOrDefault(answers.navigationStyle, policy.navigation, policy.defaults.navigation);
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

function hasExplicitFeatureAnswer(answers: QuestionnaireAnswerSet, featureId: UniversalFeatureId): boolean {
  switch (featureId) {
    case "auth":
      return typeof answers.hasAuth === "boolean";
    case "analytics":
      return typeof answers.hasAnalytics === "boolean";
    case "localization":
      return typeof answers.hasLocalization === "boolean";
    case "push":
      return typeof answers.hasPush === "boolean";
    case "networking":
      return typeof answers.hasNetworking === "boolean";
    case "storage":
      return typeof answers.hasPersistence === "boolean";
    default:
      return false;
  }
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
    const explicitAnswer = hasExplicitFeatureAnswer(answers, typedFeatureId);
    const usesProfileDefault = !explicitAnswer && capability.defaultEnabled;
    const enabled = capability.required || (capability.supported && (requested || usesProfileDefault));
    const source = capability.required
      ? "mandatory"
      : requested
        ? "answer"
        : usesProfileDefault
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
    product: {
      distributionStores: filterKnown(answers.distributionStores, allowedDistributionStores[answers.profile]),
      monetization: filterKnown(answers.monetization, allowedMonetization),
      offlineData: filterKnown(answers.offlineData, allowedOfflineData),
      runtimeQuality: filterKnown(answers.runtimeQuality, allowedRuntimeQuality),
      delivery: filterKnown(answers.delivery, allowedDelivery)
    },
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

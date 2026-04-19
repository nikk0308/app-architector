import {
  PROFILE_IDS,
  UNIVERSAL_FEATURES,
  type ProfileId,
  type ProjectProfileDefinition,
  type UniversalFeatureId
} from "./types.js";

const allSupported = (overrides: Partial<Record<UniversalFeatureId, Partial<ProjectProfileDefinition["capabilities"][UniversalFeatureId]>>>) => {
  return Object.fromEntries(
    UNIVERSAL_FEATURES.map((featureId) => {
      const base = {
        supported: true,
        defaultEnabled: false,
        required: false,
        notes: [] as string[]
      };
      return [featureId, { ...base, ...(overrides[featureId] ?? {}) }];
    })
  ) as ProjectProfileDefinition["capabilities"];
};

const registry: Record<ProfileId, ProjectProfileDefinition> = {
  unity: {
    id: "unity",
    label: "Unity / C#",
    language: "C#",
    runtime: "Unity",
    description: "Scene-oriented starter architecture with managers, ScriptableObject configuration and prefab placeholders.",
    naming: {
      packagePrefix: "com.example",
      rootFolderPattern: "pascal",
      sourceFolder: "Assets"
    },
    entryArtifactId: "entry.unity.bootstrap",
    baseArtifactId: "profile.unity.foundation",
    capabilities: allSupported({
      "entry-point": { supported: true, defaultEnabled: true, required: true },
      navigation: { supported: true, defaultEnabled: true, required: true, notes: ["Navigation is represented through scene flow and managers."] },
      auth: { supported: true, defaultEnabled: false },
      analytics: { supported: true, defaultEnabled: false },
      localization: { supported: true, defaultEnabled: false },
      push: { supported: false, defaultEnabled: false, notes: ["Unity push integration is reserved for a later phase."] },
      networking: { supported: true, defaultEnabled: true },
      storage: { supported: true, defaultEnabled: true },
      "environment-config": { supported: true, defaultEnabled: true, required: true },
      "state-management": { supported: true, defaultEnabled: true, required: true },
      "dependency-injection": { supported: false, defaultEnabled: false, notes: ["Dedicated DI container is not generated in baseline Unity mode."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: ["core.readme", "common.env", "entry.unity.bootstrap", "profile.unity.foundation"],
    featureArtifacts: {
      auth: ["module.auth.service"],
      analytics: ["module.analytics.service"],
      localization: ["module.localization.config"],
      networking: ["module.networking.client"],
      storage: ["module.storage.service"],
      "environment-config": ["common.env"],
      "testing-skeleton": ["testing.shared.smoke"]
    },
    platformNotes: [
      "Unity generation focuses on folder structure, scenes, managers and ScriptableObject-based configuration.",
      "Push and DI are intentionally kept outside the baseline Unity scaffold in this phase."
    ]
  },
  ios: {
    id: "ios",
    label: "native iOS / Swift",
    language: "Swift",
    runtime: "Xcode",
    description: "Native iOS starter architecture with App entry point, coordinators/services and basic Swift modules.",
    naming: {
      packagePrefix: "com.example",
      rootFolderPattern: "pascal",
      sourceFolder: "Sources"
    },
    entryArtifactId: "entry.ios.app",
    baseArtifactId: "profile.ios.foundation",
    capabilities: allSupported({
      "entry-point": { supported: true, defaultEnabled: true, required: true },
      navigation: { supported: true, defaultEnabled: true, required: true },
      auth: { supported: true, defaultEnabled: false },
      analytics: { supported: true, defaultEnabled: false },
      localization: { supported: true, defaultEnabled: true },
      push: { supported: true, defaultEnabled: false },
      networking: { supported: true, defaultEnabled: true },
      storage: { supported: true, defaultEnabled: true },
      "environment-config": { supported: true, defaultEnabled: true, required: true },
      "state-management": { supported: true, defaultEnabled: true, required: true },
      "dependency-injection": { supported: true, defaultEnabled: false, notes: ["Baseline uses lightweight composition without an external DI container."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: ["core.readme", "common.env", "entry.ios.app", "profile.ios.foundation"],
    featureArtifacts: {
      auth: ["module.auth.service"],
      analytics: ["module.analytics.service"],
      localization: ["module.localization.config"],
      push: ["module.push.service"],
      networking: ["module.networking.client"],
      storage: ["module.storage.service"],
      "testing-skeleton": ["testing.shared.smoke"]
    },
    platformNotes: [
      "iOS baseline generates services, coordinators/view-models and a native entry point scaffold.",
      "Persistence is represented as a lightweight local storage façade in this phase."
    ]
  },
  flutter: {
    id: "flutter",
    label: "Flutter / Dart",
    language: "Dart",
    runtime: "Flutter",
    description: "Flutter starter architecture with lib/core/features/services/routing structure.",
    naming: {
      packagePrefix: "com.example",
      rootFolderPattern: "slug",
      sourceFolder: "lib"
    },
    entryArtifactId: "entry.flutter.main",
    baseArtifactId: "profile.flutter.foundation",
    capabilities: allSupported({
      "entry-point": { supported: true, defaultEnabled: true, required: true },
      navigation: { supported: true, defaultEnabled: true, required: true },
      auth: { supported: true, defaultEnabled: false },
      analytics: { supported: true, defaultEnabled: false },
      localization: { supported: true, defaultEnabled: true },
      push: { supported: true, defaultEnabled: false },
      networking: { supported: true, defaultEnabled: true },
      storage: { supported: true, defaultEnabled: true },
      "environment-config": { supported: true, defaultEnabled: true, required: true },
      "state-management": { supported: true, defaultEnabled: true, required: true },
      "dependency-injection": { supported: false, defaultEnabled: false, notes: ["Dedicated DI container is postponed; baseline uses direct composition."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: ["core.readme", "common.env", "entry.flutter.main", "profile.flutter.foundation"],
    featureArtifacts: {
      auth: ["module.auth.service"],
      analytics: ["module.analytics.service"],
      localization: ["module.localization.config"],
      push: ["module.push.service"],
      networking: ["module.networking.client"],
      storage: ["module.storage.service"],
      "testing-skeleton": ["testing.shared.smoke"]
    },
    platformNotes: [
      "Flutter baseline keeps routing, core/services and feature folders deterministic.",
      "State management choice stays configurable in the spec layer and does not force a package install yet."
    ]
  },
  "react-native": {
    id: "react-native",
    label: "React Native / TypeScript",
    language: "TypeScript",
    runtime: "React Native",
    description: "React Native starter architecture with src/screens/navigation/services/config/state structure.",
    naming: {
      packagePrefix: "com.example",
      rootFolderPattern: "slug",
      sourceFolder: "src"
    },
    entryArtifactId: "entry.rn.app",
    baseArtifactId: "profile.rn.foundation",
    capabilities: allSupported({
      "entry-point": { supported: true, defaultEnabled: true, required: true },
      navigation: { supported: true, defaultEnabled: true, required: true },
      auth: { supported: true, defaultEnabled: false },
      analytics: { supported: true, defaultEnabled: false },
      localization: { supported: true, defaultEnabled: true },
      push: { supported: true, defaultEnabled: false },
      networking: { supported: true, defaultEnabled: true },
      storage: { supported: true, defaultEnabled: true },
      "environment-config": { supported: true, defaultEnabled: true, required: true },
      "state-management": { supported: true, defaultEnabled: true, required: true },
      "dependency-injection": { supported: false, defaultEnabled: false, notes: ["Baseline avoids container frameworks and keeps services explicit."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: ["core.readme", "common.env", "entry.rn.app", "profile.rn.foundation"],
    featureArtifacts: {
      auth: ["module.auth.service"],
      analytics: ["module.analytics.service"],
      localization: ["module.localization.config"],
      push: ["module.push.service"],
      networking: ["module.networking.client"],
      storage: ["module.storage.service"],
      "testing-skeleton": ["testing.shared.smoke"]
    },
    platformNotes: [
      "React Native baseline generates a typed src structure and deterministic service/config/state folders.",
      "The generated foundation is package-manager agnostic and keeps external integrations as placeholders."
    ]
  }
};

export function listProjectProfiles(): ProjectProfileDefinition[] {
  return PROFILE_IDS.map((profileId) => registry[profileId]);
}

export function getProjectProfile(profileId: ProfileId): ProjectProfileDefinition {
  return registry[profileId];
}

export function isFeatureSupported(profileId: ProfileId, featureId: UniversalFeatureId): boolean {
  return registry[profileId].capabilities[featureId].supported;
}

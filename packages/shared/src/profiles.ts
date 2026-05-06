import {
  PROFILE_IDS,
  UNIVERSAL_FEATURES,
  type ProfileId,
  type ProjectProfileDefinition,
  type ProfileCapability,
  type PlatformPackDefinition,
  type UniversalFeatureId
} from "./types.js";

const allSupported = (
  overrides: Partial<Record<UniversalFeatureId, Partial<ProfileCapability>>>
) => {
  return Object.fromEntries(
    UNIVERSAL_FEATURES.map((featureId) => {
      const base = {
        supported: true,
        supportLevel: "full" as const,
        defaultEnabled: false,
        required: false,
        notes: [] as string[]
      };
      return [featureId, { ...base, ...(overrides[featureId] ?? {}) }];
    })
  ) as ProjectProfileDefinition["capabilities"];
};

const commonRequiredArtifactIds = [
  "common.readme",
  "docs.platform-pack",
  "common.env",
  "common.config",
  "common.state",
  "common.entry"
];

const commonInfrastructureArtifacts: Partial<Record<UniversalFeatureId, string[]>> = {
  "entry-point": ["common.entry"],
  navigation: ["module.navigation"],
  "environment-config": ["common.env", "common.config"],
  "state-management": ["common.state"],
  "testing-skeleton": []
};

const featureMatrix = (
  overrides: Partial<Record<UniversalFeatureId, PlatformPackDefinition["featureMatrix"][UniversalFeatureId]>>
): PlatformPackDefinition["featureMatrix"] => {
  return Object.fromEntries(
    UNIVERSAL_FEATURES.map((featureId) => [featureId, overrides[featureId] ?? "full"])
  ) as PlatformPackDefinition["featureMatrix"];
};

const platformPacks: Record<ProfileId, PlatformPackDefinition> = {
  unity: {
    profileId: "unity",
    label: "Unity / C# platform pack v2",
    architectureBaseline: "Bootstrap scene, AppRoot prefab, service managers and feature folders.",
    stateManagement: "ScriptableObject-friendly state store with a lightweight runtime service layer.",
    navigation: "Scene-flow navigation through NavigationManager and GameFlowController placeholders.",
    networking: "UnityWebRequest wrapper placeholder behind NetworkService.",
    storage: "PlayerPrefs/local persistence facade for settings and cache-like values.",
    dependencyInjection: "Lightweight composition root through AppManager; external DI containers are reserved.",
    testing: "Unity Test Framework-ready folder guidance and service seams for play/edit mode tests.",
    dependencies: {
      runtime: ["Unity engine runtime", "C# scripts", "ProjectSettings scaffold"],
      dev: ["Unity Test Framework", "Editor test assemblies"],
      optional: ["Addressables", "Firebase/UGS analytics", "External DI container"]
    },
    qualityGates: [
      "Open Bootstrap scene without missing script references.",
      "Keep managers behind service boundaries before adding SDKs.",
      "Add edit-mode tests for pure services before wiring production endpoints."
    ],
    setupSteps: [
      "Open the generated folder as a Unity project.",
      "Check ProjectSettings/ProjectVersion.txt against the local Unity editor.",
      "Wire AppRoot prefab into the Bootstrap scene before adding gameplay scenes."
    ],
    directories: ["Assets/Scenes", "Assets/Scripts/Bootstrap", "Assets/Scripts/Services", "Assets/Prefabs", "ProjectSettings"],
    featureMatrix: featureMatrix({
      push: "reserved",
      "dependency-injection": "reserved",
      "testing-skeleton": "partial"
    })
  },
  ios: {
    profileId: "ios",
    label: "iOS / Swift platform pack v2",
    architectureBaseline: "SwiftUI app entry, MVVM-oriented screens, coordinator-lite navigation and services.",
    stateManagement: "Native SwiftUI state and observable application state facade.",
    navigation: "Coordinator-lite routing with NavigationRoute and AppCoordinator.",
    networking: "URLSession wrapper with a single NetworkClient boundary.",
    storage: "UserDefaults-oriented persistence facade with room for secure storage.",
    dependencyInjection: "Manual assembly through app/coordinator composition, no external container required.",
    testing: "XCTest-oriented seams for services, state and navigation decisions.",
    dependencies: {
      runtime: ["SwiftUI", "Foundation", "URLSession", "UserDefaults"],
      dev: ["XcodeGen-compatible project.yml", "XCTest"],
      optional: ["Keychain wrapper", "Swift Testing", "Analytics SDK"]
    },
    qualityGates: [
      "Run XcodeGen or create the Xcode project from project.yml.",
      "Keep auth token storage out of UserDefaults before production.",
      "Add XCTest coverage for NetworkClient, AuthService and coordinator routes."
    ],
    setupSteps: [
      "Install XcodeGen if project.yml should produce an .xcodeproj.",
      "Open the generated project and verify bundle identifier settings.",
      "Replace placeholder services with product API and storage adapters."
    ],
    directories: ["ios/<App>/Sources/App", "ios/<App>/Sources/Navigation", "ios/<App>/Sources/Services", "ios/<App>/Sources/State", "Config"],
    featureMatrix: featureMatrix({
      "dependency-injection": "partial"
    })
  },
  flutter: {
    profileId: "flutter",
    label: "Flutter / Dart platform pack v2",
    architectureBaseline: "Feature-first lib structure with app shell, routing, core services and feature screens.",
    stateManagement: "Riverpod-ready state boundary while keeping generated code package-light.",
    navigation: "Router-focused navigation scaffold suitable for GoRouter or Navigator 2.0 migration.",
    networking: "Dio-ready NetworkClient facade without hard dependency on a live endpoint.",
    storage: "shared_preferences/secure storage facade placeholder.",
    dependencyInjection: "Provider-driven composition; external containers are reserved for later packs.",
    testing: "Unit/widget test strategy documented through the generated platform pack notes.",
    dependencies: {
      runtime: ["Flutter SDK", "Dart", "Material app shell"],
      dev: ["flutter_test", "lints"],
      optional: ["flutter_riverpod", "dio", "go_router", "shared_preferences", "flutter_secure_storage"]
    },
    qualityGates: [
      "Run flutter pub get after choosing concrete dependencies.",
      "Keep API and persistence behind core service facades.",
      "Add widget tests for routing and auth gate before production flows."
    ],
    setupSteps: [
      "Run flutter pub get in the generated folder.",
      "Choose whether to add Riverpod/Dio packages now or keep placeholders.",
      "Replace sample screen with the first real feature module."
    ],
    directories: ["lib/app", "lib/core/config", "lib/core/network", "lib/core/services", "lib/features", "lib/shared/state"],
    featureMatrix: featureMatrix({
      "dependency-injection": "partial"
    })
  },
  "react-native": {
    profileId: "react-native",
    label: "React Native / TypeScript platform pack v2",
    architectureBaseline: "TypeScript feature-first shell with navigation, services, config and state folders.",
    stateManagement: "Zustand-ready application state facade with explicit service boundaries.",
    navigation: "React Navigation stack-oriented AppNavigator placeholder.",
    networking: "Axios-ready API client facade with base URL and timeout seams.",
    storage: "AsyncStorage-oriented storage facade; secure storage is left as a production adapter.",
    dependencyInjection: "Explicit service modules instead of a container framework.",
    testing: "Jest and React Native Testing Library-ready structure documented in generated notes.",
    dependencies: {
      runtime: ["React Native", "TypeScript", "React Navigation-ready shell"],
      dev: ["Jest", "React Native Testing Library", "TypeScript"],
      optional: ["zustand", "axios", "@react-native-async-storage/async-storage", "react-i18next"]
    },
    qualityGates: [
      "Run npm install before starting Metro.",
      "Keep API base URLs in env/config modules, never in screens.",
      "Add tests for auth state transitions and API error handling."
    ],
    setupSteps: [
      "Install dependencies with npm or yarn.",
      "Start Metro and run the target platform.",
      "Replace placeholder services with concrete product integrations."
    ],
    directories: ["src/config", "src/navigation", "src/screens", "src/services", "src/state"],
    featureMatrix: featureMatrix({
      "dependency-injection": "partial"
    })
  }
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
    entryArtifactId: "common.entry",
    baseArtifactId: "profile.unity.base",
    capabilities: allSupported({
      "entry-point": { supported: true, defaultEnabled: true, required: true },
      navigation: { supported: true, defaultEnabled: true, required: true, notes: ["Navigation is represented through scene flow and managers."] },
      auth: { supported: true, defaultEnabled: false },
      analytics: { supported: true, defaultEnabled: false },
      localization: { supported: true, defaultEnabled: false },
      push: { supported: false, supportLevel: "reserved", defaultEnabled: false, notes: ["Unity push integration is reserved for a later phase."] },
      networking: { supported: true, defaultEnabled: true },
      storage: { supported: true, defaultEnabled: true },
      "environment-config": { supported: true, defaultEnabled: true, required: true },
      "state-management": { supported: true, defaultEnabled: true, required: true },
      "dependency-injection": { supported: false, supportLevel: "reserved", defaultEnabled: false, notes: ["Dedicated DI container is not generated in baseline Unity mode."] },
      "testing-skeleton": { supported: true, supportLevel: "partial", defaultEnabled: true }
    }),
    requiredArtifactIds: [...commonRequiredArtifactIds, "profile.unity.base"],
    featureArtifacts: {
      ...commonInfrastructureArtifacts,
      auth: ["module.auth"],
      analytics: ["module.analytics"],
      localization: ["module.localization"],
      networking: ["module.networking"],
      storage: ["module.persistence"]
    },
    platformNotes: [
      "Unity generation focuses on folder structure, scenes, managers and ScriptableObject-based configuration.",
      "Push and DI are intentionally kept outside the baseline Unity scaffold in this phase."
    ],
    platformPack: platformPacks.unity
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
    entryArtifactId: "common.entry",
    baseArtifactId: "profile.ios.base",
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
      "dependency-injection": { supported: true, supportLevel: "partial", defaultEnabled: false, notes: ["Baseline uses lightweight composition without an external DI container."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: [...commonRequiredArtifactIds, "profile.ios.base"],
    featureArtifacts: {
      ...commonInfrastructureArtifacts,
      auth: ["module.auth"],
      analytics: ["module.analytics"],
      localization: ["module.localization"],
      push: ["module.push"],
      networking: ["module.networking"],
      storage: ["module.persistence"]
    },
    platformNotes: [
      "iOS baseline generates services, coordinators/view-models and a native entry point scaffold.",
      "Persistence is represented as a lightweight local storage facade in this phase."
    ],
    platformPack: platformPacks.ios
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
    entryArtifactId: "common.entry",
    baseArtifactId: "profile.flutter.base",
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
      "dependency-injection": { supported: false, supportLevel: "partial", defaultEnabled: false, notes: ["Dedicated DI container is postponed; baseline uses direct composition."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: [...commonRequiredArtifactIds, "profile.flutter.base"],
    featureArtifacts: {
      ...commonInfrastructureArtifacts,
      auth: ["module.auth"],
      analytics: ["module.analytics"],
      localization: ["module.localization"],
      push: ["module.push"],
      networking: ["module.networking"],
      storage: ["module.persistence"]
    },
    platformNotes: [
      "Flutter baseline keeps routing, core/services and feature folders deterministic.",
      "State management choice stays configurable in the spec layer and does not force a package install yet."
    ],
    platformPack: platformPacks.flutter
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
    entryArtifactId: "common.entry",
    baseArtifactId: "profile.react-native.base",
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
      "dependency-injection": { supported: false, supportLevel: "partial", defaultEnabled: false, notes: ["Baseline avoids container frameworks and keeps services explicit."] },
      "testing-skeleton": { supported: true, defaultEnabled: true }
    }),
    requiredArtifactIds: [...commonRequiredArtifactIds, "profile.react-native.base"],
    featureArtifacts: {
      ...commonInfrastructureArtifacts,
      auth: ["module.auth"],
      analytics: ["module.analytics"],
      localization: ["module.localization"],
      push: ["module.push"],
      networking: ["module.networking"],
      storage: ["module.persistence"]
    },
    platformNotes: [
      "React Native baseline generates a typed src structure and deterministic service/config/state folders.",
      "The generated foundation is package-manager agnostic and keeps external integrations as placeholders."
    ],
    platformPack: platformPacks["react-native"]
  }
};

export function listProjectProfiles(): ProjectProfileDefinition[] {
  return PROFILE_IDS.map((profileId) => registry[profileId]);
}

export function getProjectProfile(profileId: ProfileId): ProjectProfileDefinition {
  return registry[profileId];
}

export function getPlatformPack(profileId: ProfileId): PlatformPackDefinition {
  return registry[profileId].platformPack;
}

export function isFeatureSupported(profileId: ProfileId, featureId: UniversalFeatureId): boolean {
  return registry[profileId].capabilities[featureId].supported;
}

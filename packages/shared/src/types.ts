export type ProfileId = "unity" | "ios" | "flutter" | "react-native";

export interface QuestionnaireAnswers {
  projectName: string;
  appDisplayName: string;
  profile: ProfileId;
  packageId?: string;
  architectureStyle?: string;
  stateManagement?: string;
  navigationStyle?: string;
  environmentMode?: "single" | "multi";
  hasAuth?: boolean;
  hasAnalytics?: boolean;
  hasLocalization?: boolean;
  hasPush?: boolean;
  hasNetworking?: boolean;
  hasPersistence?: boolean;
  includeExampleScreen?: boolean;
  includeLLMNotes?: boolean;
}

export interface NormalizedProfile {
  profile: ProfileId;
  projectName: string;
  projectSlug: string;
  projectPascal: string;
  appDisplayName: string;
  packageId: string;
  architectureStyle: string;
  stateManagement: string;
  navigationStyle: string;
  environmentMode: "single" | "multi";
  includeExampleScreen: boolean;
  includeLLMNotes: boolean;
  modules: {
    auth: boolean;
    analytics: boolean;
    localization: boolean;
    push: boolean;
    networking: boolean;
    persistence: boolean;
    navigation: boolean;
    stateLayer: boolean;
    configFiles: boolean;
    readme: boolean;
    entryPoint: boolean;
  };
  entryPoint: string;
  rootFolderName: string;
  explanation: string;
}

export interface PlannedArtifact {
  id: string;
  reason: string;
  category: "core" | "module" | "profile";
}

export interface GenerationPlan {
  profile: ProfileId;
  artifacts: PlannedArtifact[];
  summary: string[];
}

export interface RegistryOutputDefinition {
  path: string;
  template: string;
  executable?: boolean;
}

export interface ArtifactRegistryEntry {
  id: string;
  title: string;
  description: string;
  outputs: Partial<Record<ProfileId, RegistryOutputDefinition[]>>;
}

export interface TreeNode {
  path: string;
  type: "file" | "directory";
}

export interface GenerationMetadata {
  id: string;
  profile: ProfileId;
  projectName: string;
  status: "completed" | "failed";
  createdAt: string;
  zipPath?: string;
  outputDir?: string;
  fileTree?: TreeNode[];
  profileJson?: string;
  planJson?: string;
}

export const PROFILE_IDS = ["unity", "ios", "flutter", "react-native"] as const;
export type ProfileId = typeof PROFILE_IDS[number];

export const GENERATION_MODES = ["baseline", "hf-open", "commercial", "hybrid"] as const;
export type GenerationMode = typeof GENERATION_MODES[number];

export const ADVISOR_PROVIDERS = ["deterministic", "huggingface"] as const;
export type AdvisorProvider = typeof ADVISOR_PROVIDERS[number];

export type AdvisorStatus = "disabled" | "ready" | "fallback" | "failed";
export type AdvisorImpact = "low" | "medium" | "high";
export type AdvisorMode = "deterministic-fallback" | "disabled-fallback" | "llm" | "llm-fallback";
export type AdvisorLlmStatus = "disabled" | "unavailable" | "used" | "failed";

export interface ArchitectureDecision {
  id: string;
  title: string;
  recommendation: string;
  rationale: string;
  impact: AdvisorImpact;
  files: string[];
}

export interface ArchitectureAdvisorReport {
  version: "1.0";
  schemaVersion?: "1.0";
  advisorVersion?: "phase3";
  status: AdvisorStatus;
  provider: AdvisorProvider;
  mode?: AdvisorMode;
  model?: string;
  summary: string;
  architecture?: {
    style: string;
    rationale: string;
    platforms: ProfileId[];
  };
  modules?: Array<{
    id: string;
    enabled: boolean;
    required: boolean;
    artifactIds: string[];
  }>;
  assumptions?: string[];
  decisions: ArchitectureDecision[];
  recommendations?: string[];
  nextSteps: string[];
  risks: string[];
  warnings: string[];
  llm?: {
    enabled: boolean;
    used: boolean;
    status: AdvisorLlmStatus;
    provider?: AdvisorProvider;
    model?: string;
    warnings: string[];
  };
  createdAt: string;
}

export interface ArchitectureAdvisorStatus {
  enabled: boolean;
  provider: AdvisorProvider;
  status: AdvisorStatus;
  model?: string;
  reason?: string;
}

export const UNIVERSAL_FEATURES = [
  "entry-point",
  "navigation",
  "auth",
  "analytics",
  "localization",
  "push",
  "networking",
  "storage",
  "environment-config",
  "state-management",
  "dependency-injection",
  "testing-skeleton"
] as const;
export type UniversalFeatureId = typeof UNIVERSAL_FEATURES[number];

export type ArchitectureFeatureId =
  | "auth"
  | "analytics"
  | "localization"
  | "push"
  | "networking"
  | "persistence"
  | "exampleScreen"
  | "llmNotes";


export interface QuestionnaireField {
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  help: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface QuestionnaireSection {
  id: string;
  title: string;
  description: string;
  fields: QuestionnaireField[];
}

export interface QuestionnaireAnswers {
  projectName: string;
  appDisplayName: string;
  profile: ProfileId;
  generationMode?: GenerationMode;
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

export type QuestionnaireAnswerSet = QuestionnaireAnswers;

export interface ProfileCapability {
  supported: boolean;
  defaultEnabled: boolean;
  required: boolean;
  notes?: string[];
}

export interface ProfileNamingRules {
  packagePrefix: string;
  rootFolderPattern: "slug" | "pascal";
  sourceFolder: string;
}

export interface ProjectProfileDefinition {
  id: ProfileId;
  label: string;
  language: string;
  runtime: string;
  description: string;
  naming: ProfileNamingRules;
  entryArtifactId: string;
  baseArtifactId: string;
  capabilities: Record<UniversalFeatureId, ProfileCapability>;
  requiredArtifactIds: string[];
  featureArtifacts: Partial<Record<UniversalFeatureId, string[]>>;
  platformNotes: string[];
}

export interface NormalizedProfile {
  profile: ProfileId;
  generationMode: GenerationMode;
  projectName: string;
  appDisplayName: string;
  projectSlug: string;
  projectPascal: string;
  packageId: string;
  architectureStyle: string;
  stateManagement: string;
  navigationStyle: string;
  environmentMode: "single" | "multi";
  features: {
    auth: boolean;
    analytics: boolean;
    localization: boolean;
    push: boolean;
    networking: boolean;
    persistence: boolean;
  };
  entryPoint: string;
  explanation: string;
}

export interface ModuleSelection {
  featureId: UniversalFeatureId;
  enabled: boolean;
  supported: boolean;
  required: boolean;
  source: "mandatory" | "profile-default" | "answer" | "derived";
  artifactIds: string[];
  notes: string[];
}

export interface DependencyRelationship {
  from: UniversalFeatureId;
  to: UniversalFeatureId;
  reason: string;
}

export interface DependencyPlan {
  requiredFeatures: UniversalFeatureId[];
  optionalFeatures: UniversalFeatureId[];
  relationships: DependencyRelationship[];
  warnings: string[];
}

export interface ArchitectureSpec {
  version: string;
  profileId: ProfileId;
  generationMode: GenerationMode;
  projectName: string;
  appDisplayName: string;
  naming: {
    projectSlug: string;
    projectPascal: string;
    packageId: string;
    rootDirectoryName: string;
  };
  architecture: {
    style: string;
    stateManagement: string;
    navigationStyle: string;
    environmentMode: "single" | "multi";
    entryPoint: string;
  };
  features: Record<ArchitectureFeatureId, boolean>;
  modules: ModuleSelection[];
  dependencyPlan: DependencyPlan;
  explanation: string;
}

export interface GenerationPlanItem {
  id: string;
  title: string;
  reason: string;
  required: boolean;
}

export interface GenerationPlan {
  profile: ProfileId;
  generationMode: GenerationMode;
  rootFolderName: string;
  artifacts: GenerationPlanItem[];
  notes: string[];
}

export interface ArtifactDefinition {
  id: string;
  title: string;
  reason: string;
  required: boolean;
  category: "core" | "profile" | "feature" | "metadata";
  source: "baseline" | "advisor";
}

export interface ArtifactManifest {
  version: string;
  profileId: ProfileId;
  generationMode: GenerationMode;
  rootFolderName: string;
  artifacts: ArtifactDefinition[];
  summary: {
    totalArtifacts: number;
    requiredArtifacts: number;
    featureArtifacts: number;
  };
  notes: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  level: "error" | "warning";
  path?: string;
}

export interface ValidationReport {
  status: "passed" | "failed";
  issues: ValidationIssue[];
  metrics: {
    missingRequiredArtifacts: number;
    unsupportedEnabledFeatures: number;
    duplicateArtifacts: number;
  };
}

export interface RegistryOutputDefinition {
  path: string;
  template?: string;
  literal?: string;
}

export interface ArtifactRegistryEntry {
  id: string;
  title: string;
  profiles: ProfileId[];
  outputs: Record<string, RegistryOutputDefinition[]>;
}

export interface TreeNode {
  path: string;
  type: "file" | "directory";
}

export type GeneratedArtifactKind = "metadata" | "documentation" | "source" | "config" | "other";

export interface GeneratedArtifactSummary {
  path: string;
  kind: GeneratedArtifactKind;
  description?: string;
}

export interface GenerationAdvisorSummary {
  summary?: string;
  mode?: string;
  status?: AdvisorStatus;
  warnings?: string[];
}

export interface GenerationMetadata {
  id: string;
  profile: ProfileId;
  generationMode?: GenerationMode;
  projectName: string;
  status: "completed" | "failed";
  createdAt: string;
  zipPath?: string;
  outputDir?: string;
  fileTree?: TreeNode[];
  profileJson?: string;
  planJson?: string;
  specJson?: string;
  manifestJson?: string;
  validationJson?: string;
  advisorJson?: string;
  generatorLogPath?: string;
  diagnosticsPath?: string;
  errorMessage?: string;
}

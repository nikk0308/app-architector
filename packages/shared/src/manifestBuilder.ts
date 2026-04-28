import { getProjectProfile } from "./profiles.js";
import type {
  ArchitectureSpec,
  ArtifactDefinition,
  ArtifactManifest,
  GenerationPlan,
  GenerationPlanItem,
  UniversalFeatureId
} from "./types.js";

const featureCategories: Partial<Record<UniversalFeatureId, ArtifactDefinition["category"]>> = {
  auth: "feature",
  analytics: "feature",
  localization: "feature",
  push: "feature",
  networking: "feature",
  storage: "feature",
  "testing-skeleton": "feature"
};

function pushArtifact(
  collection: ArtifactDefinition[],
  artifact: ArtifactDefinition
): void {
  if (collection.some((item) => item.id === artifact.id)) {
    return;
  }
  collection.push(artifact);
}

export function buildArtifactManifest(spec: ArchitectureSpec): ArtifactManifest {
  const profile = getProjectProfile(spec.profileId);
  const artifacts: ArtifactDefinition[] = [];
  const notes = [...profile.platformNotes, ...spec.dependencyPlan.warnings];

  pushArtifact(artifacts, {
    id: "common.readme",
    title: "README",
    reason: "Every generation must include a deterministic project overview and setup summary.",
    required: true,
    category: "core",
    source: "baseline"
  });

  pushArtifact(artifacts, {
    id: "common.env",
    title: "Environment configuration",
    reason: "Environment scaffold is part of the canonical baseline output.",
    required: true,
    category: "core",
    source: "baseline"
  });

  pushArtifact(artifacts, {
    id: profile.entryArtifactId,
    title: "Entry point",
    reason: `Profile ${profile.label} requires an entry artifact wired to ${spec.architecture.entryPoint}.`,
    required: true,
    category: "profile",
    source: "baseline"
  });

  pushArtifact(artifacts, {
    id: profile.baseArtifactId,
    title: `${profile.label} foundation`,
    reason: "Each platform profile contributes a deterministic foundation scaffold.",
    required: true,
    category: "profile",
    source: "baseline"
  });

  spec.modules
    .filter((module) => module.enabled && module.supported)
    .forEach((module) => {
      for (const artifactId of module.artifactIds) {
        pushArtifact(artifacts, {
          id: artifactId,
          title: artifactId,
          reason: `${module.featureId} is enabled for ${profile.label}.`,
          required: module.required,
          category: featureCategories[module.featureId] ?? "feature",
          source: "baseline"
        });
      }
    });


  if (spec.features.exampleScreen) {
    pushArtifact(artifacts, {
      id: "sample.home-screen",
      title: "Example home screen",
      reason: "Example screen is enabled to demonstrate navigation and state wiring.",
      required: false,
      category: "feature",
      source: "baseline"
    });
  }

  if (spec.features.llmNotes) {
    pushArtifact(artifacts, {
      id: "meta.advisor",
      title: "Architecture advisor report",
      reason: "Advisor output is requested to document architecture decisions and next steps.",
      required: false,
      category: "metadata",
      source: "advisor"
    });
  }

  pushArtifact(artifacts, {
    id: "meta.manifest",
    title: "Manifest metadata",
    reason: "Every generated archive carries its own manifest for auditability.",
    required: true,
    category: "metadata",
    source: "baseline"
  });

  pushArtifact(artifacts, {
    id: "meta.validation",
    title: "Validation report",
    reason: "Validation output is part of the generated package contract.",
    required: true,
    category: "metadata",
    source: "baseline"
  });

  return {
    version: "1.0",
    profileId: spec.profileId,
    generationMode: spec.generationMode,
    rootFolderName: spec.naming.rootDirectoryName,
    artifacts,
    summary: {
      totalArtifacts: artifacts.length,
      requiredArtifacts: artifacts.filter((artifact) => artifact.required).length,
      featureArtifacts: artifacts.filter((artifact) => artifact.category === "feature").length
    },
    notes
  };
}

export function manifestToGenerationPlan(manifest: ArtifactManifest): GenerationPlan {
  const artifacts: GenerationPlanItem[] = manifest.artifacts.map((artifact) => ({
    id: artifact.id,
    title: artifact.title,
    reason: artifact.reason,
    required: artifact.required
  }));

  return {
    profile: manifest.profileId,
    generationMode: manifest.generationMode,
    rootFolderName: manifest.rootFolderName,
    artifacts,
    notes: manifest.notes
  };
}

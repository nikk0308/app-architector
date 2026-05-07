import { getProjectProfile } from "./profiles.js";
import { ARTIFACT_MANIFEST_VERSION } from "./version.js";
import type {
  ArchitectureSpec,
  ArtifactDefinition,
  ArtifactManifest,
  GenerationMode,
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

function architectureArtifactId(style: string): string {
  const normalized = style.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized === "mvvm") return "architecture.mvvm";
  if (normalized === "layered") return "architecture.layered";
  if (normalized === "coordinator") return "architecture.coordinator";
  return "architecture.feature-first";
}

function modeArtifactId(mode: GenerationMode): string {
  if (mode === "commercial") return "mode.openai";
  if (mode === "hf-open") return "mode.qwen";
  if (mode === "hybrid") return "mode.hybrid";
  return "mode.baseline";
}

function modeTitle(mode: GenerationMode): string {
  if (mode === "commercial") return "GPT generation mode boundary";
  if (mode === "hf-open") return "Qwen generation mode boundary";
  if (mode === "hybrid") return "Hybrid generation mode boundary";
  return "Baseline generation mode boundary";
}

function pushSelectedProductArtifacts(spec: ArchitectureSpec, artifacts: ArtifactDefinition[]): void {
  for (const store of spec.product.distributionStores) {
    pushArtifact(artifacts, {
      id: `distribution.${store}`,
      title: `Distribution: ${store}`,
      reason: `Release preparation is requested for ${store}.`,
      required: false,
      category: "feature",
      source: "baseline"
    });
  }

  for (const strategy of spec.product.monetization) {
    pushArtifact(artifacts, {
      id: `monetization.${strategy}`,
      title: `Monetization: ${strategy}`,
      reason: `The generated starter should include a ${strategy} monetization boundary.`,
      required: false,
      category: "feature",
      source: "baseline"
    });
  }

  for (const option of spec.product.offlineData) {
    pushArtifact(artifacts, {
      id: `offline.${option}`,
      title: `Offline/Data: ${option}`,
      reason: `The generated starter should include ${option} data architecture scaffolding.`,
      required: false,
      category: "feature",
      source: "baseline"
    });
  }

  for (const option of spec.product.runtimeQuality) {
    pushArtifact(artifacts, {
      id: `quality.${option}`,
      title: `Runtime quality: ${option}`,
      reason: `The generated starter should include ${option} quality scaffolding.`,
      required: false,
      category: "feature",
      source: "baseline"
    });
  }

  for (const option of spec.product.delivery) {
    pushArtifact(artifacts, {
      id: `delivery.${option}`,
      title: `Delivery: ${option}`,
      reason: `The generated starter should include ${option} delivery scaffolding.`,
      required: false,
      category: "feature",
      source: "baseline"
    });
  }
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
    id: "docs.platform-pack",
    title: "Platform pack guide",
    reason: "Every generation documents the selected platform baseline, support matrix and setup gates.",
    required: true,
    category: "metadata",
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

  pushArtifact(artifacts, {
    id: architectureArtifactId(spec.architecture.style),
    title: `${spec.architecture.style} architecture marker`,
    reason: "The selected architecture style contributes a visible source boundary to the generated tree.",
    required: true,
    category: "profile",
    source: "baseline"
  });

  pushArtifact(artifacts, {
    id: modeArtifactId(spec.generationMode),
    title: modeTitle(spec.generationMode),
    reason: "The selected generation mode contributes a visible boundary and metadata profile for comparison.",
    required: true,
    category: "profile",
    source: spec.generationMode === "baseline" ? "baseline" : "advisor"
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

  pushSelectedProductArtifacts(spec, artifacts);

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

  pushArtifact(artifacts, {
    id: "meta.relationships",
    title: "File relationships map",
    reason: "Generated packages include a lightweight relationship map that explains how configs, managers and modules depend on each other.",
    required: true,
    category: "metadata",
    source: "baseline"
  });

  return {
    version: ARTIFACT_MANIFEST_VERSION,
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

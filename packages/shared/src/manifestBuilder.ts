import { getProjectProfile } from "./profiles.js";
import { ARTIFACT_MANIFEST_VERSION } from "./version.js";
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

function architectureArtifactId(style: string): string {
  const normalized = style.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (normalized === "mvvm") return "architecture.mvvm";
  if (normalized === "layered") return "architecture.layered";
  if (normalized === "coordinator") return "architecture.coordinator";
  return "architecture.feature-first";
}

function platformExpansionArtifactIds(profileId: ArchitectureSpec["profileId"]): string[] {
  return [
    `platform.${profileId}.app-core`,
    `platform.${profileId}.ui-system`,
    `platform.${profileId}.data-layer`,
    `platform.${profileId}.testing-layer`,
    `platform.${profileId}.resources`,
    `platform.${profileId}.presentation-flow`,
    `platform.${profileId}.domain-usecases`,
    `platform.${profileId}.infrastructure-adapters`,
    `platform.${profileId}.module-contracts`,
    `platform.${profileId}.resource-catalog`,
    `platform.${profileId}.quality-guards`,
    `platform.${profileId}.release-workflow`,
    `platform.${profileId}.test-fixtures`
  ];
}

function aiExpansionArtifactIds(mode: ArchitectureSpec["generationMode"]): string[] {
  if (mode === "baseline") {
    return [];
  }

  if (mode === "commercial") {
    return [
      "app.integration-expansion",
      "app.testing-expansion",
      "app.observability-expansion",
      "app.release-hardening",
      "app.cross-cutting-policies"
    ];
  }

  if (mode === "hf-open") {
    return [
      "app.domain-expansion",
      "app.integration-expansion",
      "app.testing-expansion",
      "app.observability-expansion"
    ];
  }

  return [
    "app.domain-expansion",
    "app.integration-expansion",
    "app.testing-expansion",
    "app.observability-expansion",
    "app.release-hardening",
    "app.cross-cutting-policies"
  ];
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

  for (const artifactId of platformExpansionArtifactIds(spec.profileId)) {
    pushArtifact(artifacts, {
      id: artifactId,
      title: artifactId,
      reason: "The selected platform contributes a fuller real application structure: UI, data, resources and tests.",
      required: true,
      category: "profile",
      source: "baseline"
    });
  }

  for (const artifactId of aiExpansionArtifactIds(spec.generationMode)) {
    pushArtifact(artifacts, {
      id: artifactId,
      title: artifactId,
      reason: "AI-assisted modes add real application architecture depth, not generator metadata folders.",
      required: false,
      category: "feature",
      source: "advisor"
    });
  }

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
    id: "meta.relationships",
    title: "File relationships map",
    reason: "Generated packages include a graph-ready relationship map that explains how source, configs, resources and modules depend on each other.",
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

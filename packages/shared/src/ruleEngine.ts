import type { GenerationPlan, NormalizedProfile } from "./types.js";
import { buildArtifactManifest, manifestToGenerationPlan } from "./manifestBuilder.js";
import { buildArchitectureSpec } from "./specBuilder.js";

export function buildGenerationPlan(profile: NormalizedProfile): GenerationPlan {
  const spec = buildArchitectureSpec({
    projectName: profile.projectName,
    appDisplayName: profile.appDisplayName,
    profile: profile.profile,
    generationMode: profile.generationMode,
    packageId: profile.packageId,
    architectureStyle: profile.architectureStyle,
    stateManagement: profile.stateManagement,
    navigationStyle: profile.navigationStyle,
    environmentMode: profile.environmentMode,
    hasAuth: profile.features.auth,
    hasAnalytics: profile.features.analytics,
    hasLocalization: profile.features.localization,
    hasPush: profile.features.push,
    hasNetworking: profile.features.networking,
    hasPersistence: profile.features.persistence,
    includeExampleScreen: true,
    includeLLMNotes: false
  });
  return manifestToGenerationPlan(buildArtifactManifest(spec));
}

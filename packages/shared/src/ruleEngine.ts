import type { GenerationPlan, NormalizedProfile, PlannedArtifact } from "./types.js";

function push(list: PlannedArtifact[], id: string, reason: string, category: PlannedArtifact["category"]): void {
  list.push({ id, reason, category });
}

export function buildGenerationPlan(profile: NormalizedProfile): GenerationPlan {
  const artifacts: PlannedArtifact[] = [];

  push(artifacts, "common.readme", "Базова документація для generated output.", "core");
  push(artifacts, "common.env", "Початкові environment-конфіги.", "core");
  push(artifacts, "common.entry", "Точка входу для вибраного профілю.", "core");
  push(artifacts, "common.config", "Службові конфіги та app environment.", "core");
  push(artifacts, "common.state", "Спільний state/service layer.", "core");
  push(artifacts, `profile.${profile.profile}.base`, "Профільний стартовий каркас.", "profile");

  if (profile.modules.navigation) {
    push(artifacts, "module.navigation", "Навігаційний шар обов’язковий для MVP.", "module");
  }
  if (profile.modules.auth) {
    push(artifacts, "module.auth", "Додано auth scaffold.", "module");
  }
  if (profile.modules.analytics) {
    push(artifacts, "module.analytics", "Додано analytics hooks.", "module");
  }
  if (profile.modules.localization) {
    push(artifacts, "module.localization", "Додано localization scaffold.", "module");
  }
  if (profile.modules.push) {
    push(artifacts, "module.push", "Додано push placeholders.", "module");
  }
  if (profile.modules.networking) {
    push(artifacts, "module.networking", "Додано network layer.", "module");
  }
  if (profile.modules.persistence) {
    push(artifacts, "module.persistence", "Додано persistence scaffold.", "module");
  }
  if (profile.includeExampleScreen) {
    push(artifacts, "module.example-screen", "Додано demo entry / стартовий екран.", "module");
  }

  const summary = [
    `Profile: ${profile.profile}`,
    `Architecture: ${profile.architectureStyle}`,
    `Navigation: ${profile.navigationStyle}`,
    `State: ${profile.stateManagement}`,
    `Modules: ${artifacts.filter((item) => item.category === "module").map((item) => item.id).join(", ") || "none"}`
  ];

  return {
    profile: profile.profile,
    artifacts,
    summary
  };
}

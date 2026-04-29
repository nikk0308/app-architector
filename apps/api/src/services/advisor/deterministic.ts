import type {
  ArchitectureAdvisorReport,
  ArchitectureDecision,
  ArchitectureSpec,
  ArtifactManifest,
  QuestionnaireAnswers,
  ValidationReport
} from "@mag/shared";
import { ADVISOR_REPORT_VERSION } from "@mag/shared";

export interface DeterministicAdvisorInput {
  answers: QuestionnaireAnswers;
  spec: ArchitectureSpec;
  manifest: ArtifactManifest;
  validation: ValidationReport;
  createdAt?: string;
  status?: ArchitectureAdvisorReport["status"];
  provider?: ArchitectureAdvisorReport["provider"];
  model?: string;
  warnings?: string[];
}

function artifactIds(manifest: ArtifactManifest, includes: string[]): string[] {
  return manifest.artifacts
    .map((artifact) => artifact.id)
    .filter((id) => includes.some((part) => id.toLowerCase().includes(part.toLowerCase())))
    .slice(0, 8);
}

function decision(input: {
  id: string;
  title: string;
  recommendation: string;
  rationale: string;
  impact?: ArchitectureDecision["impact"];
  files?: string[];
}): ArchitectureDecision {
  return {
    impact: "medium",
    files: [],
    ...input
  };
}

export function buildDeterministicAdvisorReport(input: DeterministicAdvisorInput): ArchitectureAdvisorReport {
  const { spec, manifest, validation } = input;
  const decisions: ArchitectureDecision[] = [];

  decisions.push(
    decision({
      id: "architecture-baseline",
      title: "Базова структура проєкту",
      recommendation: `${spec.architecture.style} залишає стартовий код розділеним за відповідальністю: вхід у застосунок, навігація, стан, мережа, дані та конфігурація не змішуються в одному файлі.`,
      rationale: "Це дає безпечну основу для наступних фаз генератора: можна нарощувати модулі без повного переписування стартового архіву.",
      impact: "high",
      files: artifactIds(manifest, ["entry", "base", "navigation", "home", "state"])
    })
  );

  if (spec.features.auth) {
    decisions.push(
      decision({
        id: "auth-boundary",
        title: "Окремий контур авторизації",
        recommendation: "Авторизацію краще тримати як окремий модуль із власним екраном, станом і точкою підключення до API.",
        rationale: "Так логіка входу не протікає у домашній екран і її можна буде замінити на реальний провайдер без зміни решти застосунку.",
        files: artifactIds(manifest, ["auth"])
      })
    );
  }

  if (spec.features.persistence) {
    decisions.push(
      decision({
        id: "persistence-service",
        title: "Шар локального збереження",
        recommendation: "Локальне збереження варто залишити за сервісом або репозиторієм, а не викликати сховище напряму з екранів.",
        rationale: "Це спрощує тестування, міграції та майбутню заміну демо-заглушки на SQLite, Hive, SwiftData або інший механізм.",
        files: artifactIds(manifest, ["storage", "persistence", "repository", "store"])
      })
    );
  }

  if (spec.features.networking) {
    decisions.push(
      decision({
        id: "api-client",
        title: "Єдина точка роботи з API",
        recommendation: "Запити до бекенду краще проводити через окремий API-клієнт із базовою адресою, таймаутами та місцем для обробки помилок.",
        rationale: "Коли зʼявляться реальні endpoint-и, не доведеться шукати мережеві виклики по всьому UI.",
        files: artifactIds(manifest, ["api", "network", "client"])
      })
    );
  }

  decisions.push(
    decision({
      id: "manifest-contract",
      title: "Manifest як контракт генерації",
      recommendation: "Перед додаванням нових шаблонів спочатку додавати artifact у manifest, а вже потім шаблон і тест.",
      rationale: "Так фази 4+ зможуть безпечно нарощувати генерацію, не ламаючи дерево файлів і валідацію.",
      impact: "high",
      files: ["meta.manifest", "meta.validation", "meta.advisor"]
    })
  );

  const risks: string[] = [];
  if (validation.issues.filter((issue) => issue.level === "error").length > 0) {
    risks.push("Є помилки валідації, тому архів не можна вважати стабільним до їх усунення.");
  }
  if (spec.modules.filter((module) => module.enabled).length >= 7) {
    risks.push("Проєкт має багато стартових модулів. Варто не перевантажувати MVP і додавати реальну бізнес-логіку поступово.");
  }
  if (spec.features.auth && !spec.features.networking) {
    risks.push("Авторизація без мережевого шару поки є локальною заглушкою. Для продакшен-сценарію потрібна реальна інтеграція з API.");
  }

  const nextSteps = [
    "Підставити реальні назви доменних сутностей у модулі, які зараз створені як стартові блоки.",
    "Додати мінімальні smoke-тести для навігації, стартового екрана та сервісів стану.",
    "Після стабілізації шаблонів підключити глибшу генерацію файлів за доменом продукту."
  ];

  return {
    version: ADVISOR_REPORT_VERSION,
    status: input.status ?? "fallback",
    provider: input.provider ?? "deterministic",
    model: input.model,
    summary: `План сформовано для ${spec.appDisplayName}: ${spec.profileId}, ${spec.architecture.style}, ${spec.modules.filter((module) => module.enabled).length} модулів, ${manifest.artifacts.length} artifact-ів.`,
    decisions,
    nextSteps,
    risks,
    warnings: [...(input.warnings ?? []), ...validation.issues.filter((issue) => issue.level === "warning").map((warning) => warning.message)],
    createdAt: input.createdAt ?? new Date().toISOString()
  };
}

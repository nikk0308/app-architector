import { useEffect, useMemo, useState } from "react";
import type {
  AIProviderStatusSummary,
  DeliveryOptionId,
  DistributionStoreId,
  GeneratedArtifactSummary,
  GenerationMetadata,
  GenerationMode,
  GenerationRunDetails,
  MonetizationStrategyId,
  OfflineDataOptionId,
  ProfileId,
  QuestionnaireAnswers,
  RuntimeQualityOptionId,
  RunComparison
} from "@mag/shared";
import {
  apiUrl,
  clearGenerations,
  compareGenerations,
  createArchitecturePreview,
  createGenerationFromPreview,
  deleteGeneration,
  fetchGenerationDetails,
  fetchProviderStatuses,
  listGenerations,
  type ArchitecturePreviewResponse,
  type GenerationResponse
} from "./api";
import { CustomSelect, type CustomSelectOption } from "./components/CustomSelect";
import { FileTreeViewer } from "./components/FileTreeViewer";
import { RunComparisonPanel } from "./components/RunComparisonPanel";
import { RunDetailsPanel } from "./components/RunDetailsPanel";
import { TopBar } from "./components/TopBar";
import { ValidationSummary } from "./components/ValidationSummary";

type Lang = "ua" | "en";
type Theme = "dark" | "light";
type StepId =
  | "platform"
  | "basics"
  | "ai"
  | "architecture"
  | "modules"
  | "extras"
  | "tree"
  | "result"
  | "history"
  | "compare";

type LocalText = Record<Lang, string>;
type LocalOption<T extends string> = {
  id: T;
  title: LocalText;
  description: LocalText;
  badge?: string;
  provider?: "deterministic" | "openai" | "huggingface" | "hybrid";
};
type ArchitectureKey = "feature-first" | "mvvm" | "layered" | "coordinator";
type StateKey = "native" | "riverpod" | "zustand" | "redux-toolkit" | "scriptable-object";
type NavigationKey = "coordinator" | "router" | "stack" | "scene-flow";
type EnvironmentKey = "single" | "multi";
type ModuleKey = "hasAuth" | "hasAnalytics" | "hasLocalization" | "hasPush" | "hasNetworking" | "hasPersistence";
type ProductArrayKey = "distributionStores" | "monetization" | "offlineData" | "runtimeQuality" | "delivery";

const initialForm: QuestionnaireAnswers = {
  projectName: "AI Commerce Demo",
  appDisplayName: "AI Commerce",
  profile: "ios",
  generationMode: "hf-open",
  packageId: "com.example.aicommerce",
  architectureStyle: "feature-first",
  stateManagement: "native",
  navigationStyle: "coordinator",
  environmentMode: "multi",
  hasAuth: true,
  hasAnalytics: true,
  hasLocalization: false,
  hasPush: true,
  hasNetworking: true,
  hasPersistence: true,
  includeExampleScreen: true,
  includeLLMNotes: true,
  aiInstruction: "",
  distributionStores: ["apple-app-store", "google-play"],
  monetization: ["subscription", "in-app-purchases"],
  offlineData: ["offline-cache", "sync-queue"],
  runtimeQuality: ["logging", "crash-reporting", "feature-flags"],
  delivery: ["release-checklist", "test-plan"]
};

const copy: Record<Lang, Record<string, string>> = {
  ua: {
    lab: "Лабораторія AI-архітектури",
    intro: "Стенд для порівняння Baseline / GPT / Qwen / Hybrid генерації мобільної архітектури.",
    demo: "Демо-дані",
    generateTree: "Згенерувати структурне дерево",
    generatingTree: "Генеруємо дерево...",
    createZip: "Створити ZIP з цієї архітектури",
    creatingZip: "Створюємо ZIP...",
    downloadZip: "Завантажити ZIP",
    previewOutdated: "Попередній перегляд застарів: форма змінилася. Згенеруй дерево ще раз.",
    requiredError: "Заповни назву проєкту, назву для користувача і Bundle / Package ID.",
    platform: "Платформа",
    basics: "Основне",
    ai: "Режим ШІ",
    architecture: "Архітектура",
    modules: "Модулі",
    extras: "Приклад / додатково",
    tree: "Структурне дерево",
    result: "Результат",
    history: "Історія",
    compare: "Порівняння",
    projectName: "Назва проєкту",
    displayName: "Назва для користувача",
    packageId: "Bundle / Package ID",
    aiInstruction: "Додатковий запит до ШІ",
    aiInstructionHelp: "Опиши домен, пріоритети, стиль, обмеження або потрібні рішення. Обрана ШІ-модель використає це для попереднього добору архітектурних відповідей.",
    aiInstructionPlaceholder: "Наприклад: marketplace з оплатами, ролями buyer/seller, offline cache для каталогу, швидкий MVP за 6 тижнів...",
    selectedModules: "Обрані модулі",
    validation: "Перевірка",
    architectureExplanation: "Пояснення архітектури",
    modeReady: "готово",
    noPreview: "Спочатку згенеруй структурне дерево.",
    zipReady: "ZIP готовий",
    filters: "Фільтри",
    runDetails: "Деталі запуску",
    compareSelected: "Порівняти обрані",
    latest: "Останні генерації",
    fullHistory: "Повний список",
    selectRun: "Обери запуск, щоб подивитися деталі.",
    compareEmpty: "Обери мінімум два запуски для порівняння.",
    copyTree: "Копіювати дерево",
    copied: "Скопійовано",
    files: "Файли",
    folders: "Папки",
    docs: "Документи",
    metadata: "Метадані",
    artifacts: "Артефакти",
    allPlatforms: "Усі платформи",
    allModes: "Усі режими",
    allStatuses: "Усі статуси",
    completed: "готово",
    failed: "помилка",
    delete: "Видалити",
    clearHistory: "Очистити історію",
    details: "Деталі",
    zip: "ZIP",
    loading: "Завантаження...",
    comparing: "Порівнюємо...",
    summary: "Підсумок",
    metrics: "Метрики",
    advanced: "Додатково",
    mostComplete: "Найповніший",
    architectureStyle: "Архітектурний стиль",
    stateManagement: "Керування станом",
    navigation: "Навігація",
    environment: "Середовища",
    provider: "Провайдер",
    promptCount: "символів",
    advisorArtifacts: "Advisor-артефакти",
    advisorArtifactsText: "Автоматично додаються для GPT, Qwen і Hybrid. Baseline теж отримує deterministic пояснення у preview.",
    exampleScreen: "Приклад екрана",
    exampleScreenText: "Додає видимий стартовий екран або home-flow у дерево і ZIP.",
    noHistory: "Історія порожня.",
    aiAutofillNote: "Після генерації дерева форма оновиться під ArchitectureSpec, який запропонувала ШІ. Далі можна вручну підкоригувати вибір."
    ,
    distribution: "Публікація",
    monetization: "Монетизація",
    offlineData: "Offline / Data",
    runtimeQuality: "Runtime quality",
    delivery: "Delivery / Team",
    selected: "обрано"
  },
  en: {
    lab: "AI-assisted architecture lab",
    intro: "Engineering console for comparing Baseline / GPT / Qwen / Hybrid mobile architecture generation.",
    demo: "Demo data",
    generateTree: "Generate structure tree",
    generatingTree: "Generating tree...",
    createZip: "Create ZIP from this architecture",
    creatingZip: "Creating ZIP...",
    downloadZip: "Download ZIP",
    previewOutdated: "Preview outdated: the form changed. Generate the tree again.",
    requiredError: "Fill project name, display name and Bundle / Package ID.",
    platform: "Platform",
    basics: "Basics",
    ai: "AI Mode",
    architecture: "Architecture",
    modules: "Modules",
    extras: "Example / Extras",
    tree: "Structure Tree",
    result: "Result",
    history: "History",
    compare: "Compare",
    projectName: "Project name",
    displayName: "Display name",
    packageId: "Bundle / Package ID",
    aiInstruction: "Additional AI instruction",
    aiInstructionHelp: "Describe the domain, priorities, style, constraints or preferred decisions. The selected AI model will use it to preselect architecture answers.",
    aiInstructionPlaceholder: "Example: marketplace with payments, buyer/seller roles, offline catalog cache, fast MVP in 6 weeks...",
    selectedModules: "Selected modules",
    validation: "Validation",
    architectureExplanation: "Architecture explanation",
    modeReady: "ready",
    noPreview: "Generate a structure tree first.",
    zipReady: "ZIP ready",
    filters: "Filters",
    runDetails: "Run Details",
    compareSelected: "Compare selected",
    latest: "Latest generations",
    fullHistory: "Full list",
    selectRun: "Select a run to inspect details.",
    compareEmpty: "Select at least two runs to compare.",
    copyTree: "Copy tree",
    copied: "Copied",
    files: "Files",
    folders: "Folders",
    docs: "Docs",
    metadata: "Metadata",
    artifacts: "Artifacts",
    allPlatforms: "All platforms",
    allModes: "All modes",
    allStatuses: "All statuses",
    completed: "completed",
    failed: "failed",
    delete: "Delete",
    clearHistory: "Clear history",
    details: "Details",
    zip: "ZIP",
    loading: "Loading...",
    comparing: "Comparing...",
    summary: "Summary",
    metrics: "Metrics",
    advanced: "Advanced",
    mostComplete: "Most complete",
    architectureStyle: "Architecture style",
    stateManagement: "State management",
    navigation: "Navigation",
    environment: "Environment",
    provider: "Provider",
    promptCount: "chars",
    advisorArtifacts: "Advisor artifacts",
    advisorArtifactsText: "Automatic for GPT, Qwen and Hybrid. Baseline still gets deterministic explanation in preview.",
    exampleScreen: "Example screen",
    exampleScreenText: "Adds a visible starter screen or home flow to the tree and ZIP.",
    noHistory: "History is empty.",
    aiAutofillNote: "After generating the tree, the form will update to the ArchitectureSpec suggested by AI. You can still adjust it manually."
    ,
    distribution: "Distribution",
    monetization: "Monetization",
    offlineData: "Offline / Data",
    runtimeQuality: "Runtime quality",
    delivery: "Delivery / Team",
    selected: "selected"
  }
};

const steps: Array<{ id: StepId; labelKey: string }> = [
  { id: "platform", labelKey: "platform" },
  { id: "basics", labelKey: "basics" },
  { id: "ai", labelKey: "ai" },
  { id: "architecture", labelKey: "architecture" },
  { id: "modules", labelKey: "modules" },
  { id: "extras", labelKey: "extras" },
  { id: "tree", labelKey: "tree" },
  { id: "result", labelKey: "result" },
  { id: "history", labelKey: "history" },
  { id: "compare", labelKey: "compare" }
];

const platformOptions: Array<LocalOption<ProfileId>> = [
  {
    id: "ios",
    title: { ua: "iOS / Swift", en: "iOS / Swift" },
    description: {
      ua: "SwiftUI, coordinator-lite, сервіси і готові точки для XCTest.",
      en: "SwiftUI, coordinator-lite, services and XCTest-ready seams."
    }
  },
  {
    id: "flutter",
    title: { ua: "Flutter", en: "Flutter" },
    description: {
      ua: "Feature-first структура lib, маршрутизатор, core-сервіси і стан.",
      en: "Feature-first lib structure, router, core services and state."
    }
  },
  {
    id: "react-native",
    title: { ua: "React Native", en: "React Native" },
    description: {
      ua: "TypeScript-основа з навігацією, сервісами і шаром стану.",
      en: "TypeScript shell with navigation, services and state."
    }
  },
  {
    id: "unity",
    title: { ua: "Unity / C#", en: "Unity / C#" },
    description: {
      ua: "Bootstrap-сцена, managers, сервіси і ігровий flow.",
      en: "Bootstrap scene, managers, services and gameplay flow."
    }
  }
];

const modeOptions: Array<LocalOption<GenerationMode> & { badge: string; provider: "deterministic" | "openai" | "huggingface" | "hybrid" }> = [
  {
    id: "baseline",
    title: { ua: "Baseline", en: "Baseline" },
    badge: "CODE",
    provider: "deterministic",
    description: {
      ua: "Deterministic ArchitectureSpec і ZIP без звернення до ШІ.",
      en: "Deterministic ArchitectureSpec and ZIP without an AI call."
    }
  },
  {
    id: "commercial",
    title: { ua: "GPT", en: "GPT" },
    badge: "OPENAI",
    provider: "openai",
    description: {
      ua: "OpenAI синтезує ArchitectureSpec і advisor-звіт.",
      en: "OpenAI synthesizes ArchitectureSpec and advisor output."
    }
  },
  {
    id: "hf-open",
    title: { ua: "Qwen", en: "Qwen" },
    badge: "HF",
    provider: "huggingface",
    description: {
      ua: "Qwen / Hugging Face синтезує ArchitectureSpec і advisor.",
      en: "Qwen / Hugging Face synthesizes ArchitectureSpec and advisor output."
    }
  },
  {
    id: "hybrid",
    title: { ua: "Hybrid", en: "Hybrid" },
    badge: "AI + CODE",
    provider: "hybrid",
    description: {
      ua: "Baseline-структура плюс контрольоване AI-покращення дозволених частин.",
      en: "Baseline structure with allowlisted AI refinement."
    }
  }
];

const architectureOptions: Array<LocalOption<ArchitectureKey>> = [
  {
    id: "feature-first",
    title: { ua: "Feature-first", en: "Feature-first" },
    description: {
      ua: "Кожна feature має свої екрани, стан і сервіси. Добре для модульного росту.",
      en: "Features own screens, state and services. Good for modular growth."
    }
  },
  {
    id: "mvvm",
    title: { ua: "MVVM", en: "MVVM" },
    description: {
      ua: "ViewModel відділяє стан екрана і presentation-логіку.",
      en: "ViewModel boundary for screen state and presentation logic."
    }
  },
  {
    id: "layered",
    title: { ua: "Layered", en: "Layered" },
    description: {
      ua: "Data / Domain / Presentation для чіткіших меж відповідальності.",
      en: "Data / Domain / Presentation separation for stricter boundaries."
    }
  },
  {
    id: "coordinator",
    title: { ua: "Coordinator", en: "Coordinator" },
    description: {
      ua: "Навігація і володіння flow винесені в окремий контрольований шар.",
      en: "Navigation and flow ownership is explicit and testable."
    }
  }
];

const stateOptions: Array<LocalOption<StateKey>> = [
  {
    id: "native",
    title: { ua: "Native / light", en: "Native / light" },
    description: {
      ua: "Спочатку використовуємо нативні primitives платформи.",
      en: "Use platform-native state primitives first."
    }
  },
  {
    id: "riverpod",
    title: { ua: "Riverpod", en: "Riverpod" },
    description: {
      ua: "Flutter provider graph з тестованими межами стану.",
      en: "Flutter provider graph and testable state boundaries."
    }
  },
  {
    id: "zustand",
    title: { ua: "Zustand", en: "Zustand" },
    description: {
      ua: "Легкий React Native store для feature-first екранів.",
      en: "Small React Native state store for feature-first screens."
    }
  },
  {
    id: "redux-toolkit",
    title: { ua: "Redux Toolkit", en: "Redux Toolkit" },
    description: {
      ua: "Явний централізований шар стану для більших RN застосунків.",
      en: "Explicit centralized state for larger RN apps."
    }
  },
  {
    id: "scriptable-object",
    title: { ua: "ScriptableObject", en: "ScriptableObject" },
    description: {
      ua: "Unity-friendly assets для конфігурації і стану.",
      en: "Unity-friendly config and state assets."
    }
  }
];

const navOptions: Array<LocalOption<NavigationKey>> = [
  {
    id: "coordinator",
    title: { ua: "Coordinator", en: "Coordinator" },
    description: {
      ua: "Flow objects координують екрани, переходи і маршрути.",
      en: "Flow objects coordinate screens and routes."
    }
  },
  {
    id: "router",
    title: { ua: "Router", en: "Router" },
    description: {
      ua: "Таблиця маршрутів і app-level navigation shell.",
      en: "Route table and app-level navigation shell."
    }
  },
  {
    id: "stack",
    title: { ua: "Stack", en: "Stack" },
    description: {
      ua: "Простий стек екранів для класичних mobile flows.",
      en: "Simple screen stack for mobile flows."
    }
  },
  {
    id: "scene-flow",
    title: { ua: "Scene flow", en: "Scene flow" },
    description: {
      ua: "Unity-керування flow через сцени.",
      en: "Unity scene-oriented flow control."
    }
  }
];

const environmentOptions: Array<LocalOption<EnvironmentKey>> = [
  {
    id: "single",
    title: { ua: "Single", en: "Single" },
    description: {
      ua: "Одна конфігурація для першого прототипу.",
      en: "One environment config for first prototype runs."
    }
  },
  {
    id: "multi",
    title: { ua: "Dev / Stage / Prod", en: "Dev / Stage / Prod" },
    description: {
      ua: "Окремі конфігураційні межі для реального деплою.",
      en: "Separate config boundaries for real deployment paths."
    }
  }
];

const platformRules: Record<ProfileId, {
  architecture: ArchitectureKey[];
  state: StateKey[];
  navigation: NavigationKey[];
  defaults: Pick<QuestionnaireAnswers, "architectureStyle" | "stateManagement" | "navigationStyle" | "environmentMode">;
}> = {
  ios: {
    architecture: ["feature-first", "mvvm", "coordinator", "layered"],
    state: ["native"],
    navigation: ["coordinator", "stack"],
    defaults: { architectureStyle: "feature-first", stateManagement: "native", navigationStyle: "coordinator", environmentMode: "multi" }
  },
  flutter: {
    architecture: ["feature-first", "mvvm", "layered"],
    state: ["riverpod", "native"],
    navigation: ["router", "stack"],
    defaults: { architectureStyle: "feature-first", stateManagement: "riverpod", navigationStyle: "router", environmentMode: "multi" }
  },
  "react-native": {
    architecture: ["feature-first", "layered", "mvvm"],
    state: ["zustand", "redux-toolkit", "native"],
    navigation: ["stack", "router"],
    defaults: { architectureStyle: "feature-first", stateManagement: "zustand", navigationStyle: "stack", environmentMode: "multi" }
  },
  unity: {
    architecture: ["feature-first", "coordinator", "layered"],
    state: ["scriptable-object", "native"],
    navigation: ["scene-flow"],
    defaults: { architectureStyle: "feature-first", stateManagement: "scriptable-object", navigationStyle: "scene-flow", environmentMode: "single" }
  }
};

const modules: Array<LocalOption<ModuleKey>> = [
  {
    id: "hasAuth",
    title: { ua: "Auth", en: "Auth" },
    description: {
      ua: "Заготовка feature/service/state для входу і роботи з токенами.",
      en: "Feature/service/state scaffold for sign-in and token flow."
    }
  },
  {
    id: "hasAnalytics",
    title: { ua: "Analytics", en: "Analytics" },
    description: {
      ua: "Сервіс аналітики, модель події і межа для майбутніх провайдерів.",
      en: "Analytics service, event model and provider boundary."
    }
  },
  {
    id: "hasLocalization",
    title: { ua: "Localization", en: "Localization" },
    description: {
      ua: "Каркас ресурсів і сервісу для EN/UA текстів.",
      en: "Resource/service skeleton for EN/UA text."
    }
  },
  {
    id: "hasPush",
    title: { ua: "Push", en: "Push" },
    description: {
      ua: "Заготовка провайдера і конфігураційна межа для сповіщень.",
      en: "Provider placeholder and config boundary."
    }
  },
  {
    id: "hasNetworking",
    title: { ua: "Networking", en: "Networking" },
    description: {
      ua: "API-клієнт, endpoints і модель помилок.",
      en: "Client, endpoints and error model skeleton."
    }
  },
  {
    id: "hasPersistence",
    title: { ua: "Persistence", en: "Persistence" },
    description: {
      ua: "Сервіс сховища, repository і cache facade.",
      en: "Storage service, repository/cache facade."
    }
  }
];

const distributionOptions: Array<LocalOption<DistributionStoreId>> = [
  { id: "apple-app-store", title: { ua: "Apple App Store", en: "Apple App Store" }, description: { ua: "Основний канал для iOS/iPadOS релізів.", en: "Primary channel for iOS/iPadOS releases." } },
  { id: "google-play", title: { ua: "Google Play", en: "Google Play" }, description: { ua: "Головний Android marketplace для більшості пристроїв.", en: "Main Android marketplace for most devices." } },
  { id: "samsung-galaxy-store", title: { ua: "Samsung Galaxy Store", en: "Samsung Galaxy Store" }, description: { ua: "Додатковий канал для Samsung Galaxy devices.", en: "Additional channel for Samsung Galaxy devices." } },
  { id: "huawei-appgallery", title: { ua: "Huawei AppGallery", en: "Huawei AppGallery" }, description: { ua: "Канал для Huawei/HMS ecosystem без залежності від Google Play.", en: "Channel for Huawei/HMS ecosystem without Google Play dependency." } },
  { id: "amazon-appstore", title: { ua: "Amazon Appstore", en: "Amazon Appstore" }, description: { ua: "Android/Fire OS канал для Amazon ecosystem.", en: "Android/Fire OS channel for the Amazon ecosystem." } }
];

const distributionByProfile: Record<ProfileId, DistributionStoreId[]> = {
  ios: ["apple-app-store"],
  flutter: ["apple-app-store", "google-play", "samsung-galaxy-store", "huawei-appgallery", "amazon-appstore"],
  "react-native": ["apple-app-store", "google-play", "samsung-galaxy-store", "huawei-appgallery", "amazon-appstore"],
  unity: ["apple-app-store", "google-play", "samsung-galaxy-store", "huawei-appgallery", "amazon-appstore"]
};

const monetizationOptions: Array<LocalOption<MonetizationStrategyId>> = [
  { id: "ads", title: { ua: "Реклама", en: "Ads" }, description: { ua: "Ad service boundary, consent і placement config.", en: "Ad service boundary, consent and placement config." } },
  { id: "paid-app", title: { ua: "Покупка застосунку", en: "Paid app" }, description: { ua: "Store entitlement check для платного доступу.", en: "Store entitlement check for paid access." } },
  { id: "subscription", title: { ua: "Підписка", en: "Subscription" }, description: { ua: "Paywall, entitlement state і renewal-aware boundary.", en: "Paywall, entitlement state and renewal-aware boundary." } },
  { id: "in-app-purchases", title: { ua: "Внутрішні покупки", en: "In-app purchases" }, description: { ua: "Purchase gateway, product ids і receipt validation seam.", en: "Purchase gateway, product ids and receipt validation seam." } }
];

const offlineDataOptions: Array<LocalOption<OfflineDataOptionId>> = [
  { id: "offline-cache", title: { ua: "Offline cache", en: "Offline cache" }, description: { ua: "Локальний cache boundary для читання без мережі.", en: "Local cache boundary for reads without network." } },
  { id: "sync-queue", title: { ua: "Sync queue", en: "Sync queue" }, description: { ua: "Черга відкладених змін і retry policy.", en: "Deferred changes queue and retry policy." } },
  { id: "data-migrations", title: { ua: "Data migrations", en: "Data migrations" }, description: { ua: "Місце для schema migrations локального сховища.", en: "Home for local storage schema migrations." } },
  { id: "secure-storage", title: { ua: "Secure storage", en: "Secure storage" }, description: { ua: "Окрема межа для tokens, secrets і приватних значень.", en: "Boundary for tokens, secrets and private values." } }
];

const runtimeQualityOptions: Array<LocalOption<RuntimeQualityOptionId>> = [
  { id: "logging", title: { ua: "Logging", en: "Logging" }, description: { ua: "Єдиний logger facade для debug і production подій.", en: "Unified logger facade for debug and production events." } },
  { id: "crash-reporting", title: { ua: "Crash reporting", en: "Crash reporting" }, description: { ua: "Crash reporter boundary без прив'язки до провайдера.", en: "Crash reporter boundary without vendor lock-in." } },
  { id: "feature-flags", title: { ua: "Feature flags", en: "Feature flags" }, description: { ua: "Контроль rollout, experiments і прихованих features.", en: "Controls rollout, experiments and hidden features." } },
  { id: "settings-screen", title: { ua: "Settings screen", en: "Settings screen" }, description: { ua: "Стартова зона для налаштувань користувача.", en: "Starter zone for user settings." } },
  { id: "diagnostics-screen", title: { ua: "Diagnostics screen", en: "Diagnostics screen" }, description: { ua: "Внутрішній екран health/debug інформації.", en: "Internal health/debug information screen." } }
];

const deliveryOptions: Array<LocalOption<DeliveryOptionId>> = [
  { id: "ci-cd", title: { ua: "CI/CD", en: "CI/CD" }, description: { ua: "Місце для mobile build pipeline і quality gates.", en: "Home for mobile build pipeline and quality gates." } },
  { id: "release-checklist", title: { ua: "Release checklist", en: "Release checklist" }, description: { ua: "Контрольний список перед store submission.", en: "Checklist before store submission." } },
  { id: "design-system", title: { ua: "Design system", en: "Design system" }, description: { ua: "Tokens/components boundary для стабільного UI.", en: "Tokens/components boundary for stable UI." } },
  { id: "test-plan", title: { ua: "Test plan", en: "Test plan" }, description: { ua: "Місце для smoke, regression і acceptance сценаріїв.", en: "Home for smoke, regression and acceptance scenarios." } },
  { id: "env-secrets", title: { ua: "Env / secrets", en: "Env / secrets" }, description: { ua: "Шаблон безпечного опису env і secret boundaries.", en: "Safe template for env and secret boundaries." } }
];

function text(value: LocalText, language: Lang): string {
  return value[language];
}

function pickOptions<T extends string>(options: Array<LocalOption<T>>, allowed: T[]): Array<LocalOption<T>> {
  const allowedSet = new Set(allowed);
  return options.filter((option) => allowedSet.has(option.id));
}

function safeChoice<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function filterArray<T extends string>(values: readonly T[] | undefined, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const allowedSet = new Set(allowed);
  return [...new Set(values.filter((value): value is T => allowedSet.has(value)))];
}

function normalizeFormForPlatform(form: QuestionnaireAnswers): QuestionnaireAnswers {
  const rules = platformRules[form.profile];
  return {
    ...form,
    architectureStyle: safeChoice(form.architectureStyle, rules.architecture, rules.defaults.architectureStyle as ArchitectureKey),
    stateManagement: safeChoice(form.stateManagement, rules.state, rules.defaults.stateManagement as StateKey),
    navigationStyle: safeChoice(form.navigationStyle, rules.navigation, rules.defaults.navigationStyle as NavigationKey),
    environmentMode: form.environmentMode === "single" || form.environmentMode === "multi" ? form.environmentMode : rules.defaults.environmentMode,
    distributionStores: filterArray(form.distributionStores, distributionByProfile[form.profile]),
    monetization: filterArray(form.monetization, monetizationOptions.map((option) => option.id)),
    offlineData: filterArray(form.offlineData, offlineDataOptions.map((option) => option.id)),
    runtimeQuality: filterArray(form.runtimeQuality, runtimeQualityOptions.map((option) => option.id)),
    delivery: filterArray(form.delivery, deliveryOptions.map((option) => option.id))
  };
}

function formFromPreview(current: QuestionnaireAnswers, result: ArchitecturePreviewResponse): QuestionnaireAnswers {
  return normalizeFormForPlatform({
    ...current,
    profile: result.spec.profileId,
    generationMode: result.spec.generationMode,
    projectName: result.spec.projectName,
    appDisplayName: result.spec.appDisplayName,
    packageId: result.spec.naming.packageId,
    architectureStyle: result.spec.architecture.style,
    stateManagement: result.spec.architecture.stateManagement,
    navigationStyle: result.spec.architecture.navigationStyle,
    environmentMode: result.spec.architecture.environmentMode,
    hasAuth: Boolean(result.spec.features.auth),
    hasAnalytics: Boolean(result.spec.features.analytics),
    hasLocalization: Boolean(result.spec.features.localization),
    hasPush: Boolean(result.spec.features.push),
    hasNetworking: Boolean(result.spec.features.networking),
    hasPersistence: Boolean(result.spec.features.persistence),
    includeExampleScreen: Boolean(result.spec.features.exampleScreen),
    includeLLMNotes: result.spec.generationMode !== "baseline",
    distributionStores: result.spec.product?.distributionStores ?? current.distributionStores,
    monetization: result.spec.product?.monetization ?? current.monetization,
    offlineData: result.spec.product?.offlineData ?? current.offlineData,
    runtimeQuality: result.spec.product?.runtimeQuality ?? current.runtimeQuality,
    delivery: result.spec.product?.delivery ?? current.delivery
  });
}

function getStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = localStorage.getItem(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

function formFingerprint(form: QuestionnaireAnswers): string {
  return JSON.stringify({
    ...form,
    aiInstruction: form.aiInstruction?.trim().slice(0, 2000) ?? "",
    includeLLMNotes: (form.generationMode ?? "baseline") !== "baseline"
  });
}

function providerForMode(mode: GenerationMode, statuses: AIProviderStatusSummary[]): AIProviderStatusSummary | undefined {
  const byProvider = new Map(statuses.map((status) => [status.provider, status]));
  if (mode === "baseline") return byProvider.get("deterministic");
  if (mode === "commercial") return byProvider.get("openai");
  if (mode === "hf-open") return byProvider.get("huggingface");
  return byProvider.get("openai") ?? byProvider.get("huggingface") ?? byProvider.get("deterministic");
}

function downloadUrlForGeneration(generationId: string): string {
  return apiUrl(`/api/generations/${generationId}/download`);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function countKind(artifacts: GeneratedArtifactSummary[] | undefined, kind: GeneratedArtifactSummary["kind"]): number {
  return artifacts?.filter((artifact) => artifact.kind === kind).length ?? 0;
}

function optionSelectItems<T extends string>(options: Array<LocalOption<T>>, language: Lang): CustomSelectOption[] {
  return options.map((option) => ({
    value: option.id,
    label: text(option.title, language),
    description: text(option.description, language)
  }));
}

function OptionCard(props: {
  active: boolean;
  title: string;
  description: string;
  badge?: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button className={props.active ? "option-card active" : "option-card"} type="button" onClick={props.onClick} aria-pressed={props.active}>
      <span>
        <strong>{props.title}</strong>
        {props.badge ? <em>{props.badge}</em> : null}
      </span>
      <small>{props.description}</small>
      {props.meta ? <i>{props.meta}</i> : null}
    </button>
  );
}

function TextField(props: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-field">
      <span>{props.label}</span>
      <input value={props.value} placeholder={props.placeholder} onChange={(event) => props.onChange(event.target.value)} />
    </label>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getStored("mag-theme", "dark", ["dark", "light"]));
  const [language, setLanguage] = useState<Lang>(() => getStored("mag-lang", "ua", ["ua", "en"]));
  const [activeStep, setActiveStep] = useState<StepId>("platform");
  const [form, setForm] = useState<QuestionnaireAnswers>(() => normalizeFormForPlatform(initialForm));
  const [preview, setPreview] = useState<ArchitecturePreviewResponse | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationResponse | null>(null);
  const [generations, setGenerations] = useState<GenerationMetadata[]>([]);
  const [providers, setProviders] = useState<AIProviderStatusSummary[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<GenerationRunDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [compareSelection, setCompareSelection] = useState<string[]>([]);
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [historyPlatform, setHistoryPlatform] = useState<string>("all");
  const [historyMode, setHistoryMode] = useState<string>("all");
  const [historyStatus, setHistoryStatus] = useState<string>("all");

  const t = copy[language];
  const currentFingerprint = useMemo(() => formFingerprint(form), [form]);
  const previewOutdated = Boolean(preview && previewFingerprint !== currentFingerprint);
  const requiredValid = Boolean(form.projectName.trim() && form.appDisplayName.trim() && form.packageId?.trim());
  const activeMode = form.generationMode ?? "baseline";
  const activeProvider = providerForMode(activeMode, providers);
  const shown = generation ?? preview;
  const shownArtifacts = shown?.artifacts ?? [];
  const fileCount = shown?.fileTree.filter((node) => node.type === "file").length ?? 0;
  const folderCount = shown?.fileTree.filter((node) => node.type === "directory").length ?? 0;
  const availableArchitecture = pickOptions(architectureOptions, platformRules[form.profile].architecture);
  const availableState = pickOptions(stateOptions, platformRules[form.profile].state);
  const availableNavigation = pickOptions(navOptions, platformRules[form.profile].navigation);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("mag-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("mag-lang", language);
  }, [language]);

  useEffect(() => {
    fetchProviderStatuses().then(setProviders).catch(() => setProviders([]));
    listGenerations().then(setGenerations).catch(() => setGenerations([]));
  }, []);

  function updateForm<K extends keyof QuestionnaireAnswers>(key: K, value: QuestionnaireAnswers[K]) {
    setForm((current) => normalizeFormForPlatform({
      ...current,
      [key]: value
    }));
    setGeneration(null);
  }

  function updatePlatform(profile: ProfileId) {
    setForm((current) => normalizeFormForPlatform({
      ...current,
      profile,
      ...platformRules[profile].defaults
    }));
    setGeneration(null);
  }

  function updateMode(mode: GenerationMode) {
    setForm((current) => normalizeFormForPlatform({
      ...current,
      generationMode: mode,
      includeLLMNotes: mode !== "baseline"
    }));
    setGeneration(null);
  }

  function toggleArrayValue<T extends string>(key: ProductArrayKey, value: T) {
    setForm((current) => {
      const currentValues = Array.isArray(current[key]) ? current[key] as string[] : [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];
      return normalizeFormForPlatform({
        ...current,
        [key]: nextValues
      });
    });
    setGeneration(null);
  }

  function payload(sourceForm = form): QuestionnaireAnswers {
    const mode = sourceForm.generationMode ?? "baseline";
    return normalizeFormForPlatform({
      ...sourceForm,
      aiInstruction: sourceForm.aiInstruction?.trim().slice(0, 2000) ?? "",
      generationMode: mode,
      includeLLMNotes: mode !== "baseline"
    });
  }

  async function refreshHistory() {
    setGenerations(await listGenerations());
  }

  async function generateTree() {
    if (!requiredValid) {
      setError(t.requiredError);
      return;
    }
    try {
      setLoadingPreview(true);
      setError(null);
      const request = payload();
      const result = await createArchitecturePreview(request);
      const nextForm = formFromPreview(request, result);
      setForm(nextForm);
      setPreview(result);
      setPreviewFingerprint(formFingerprint(nextForm));
      setGeneration(null);
      setActiveStep("tree");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function createZip() {
    if (!preview || previewOutdated) {
      setError(t.previewOutdated);
      return;
    }
    try {
      setLoadingZip(true);
      setError(null);
      const result = await createGenerationFromPreview(preview.previewId);
      setGeneration(result);
      setPreview((current) => current ? { ...current, ...result, previewId: current.previewId, createdAt: current.createdAt } : current);
      await refreshHistory();
      setActiveStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoadingZip(false);
    }
  }

  async function loadDetails(id: string) {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      setSelectedDetails(await fetchGenerationDetails(id));
      setActiveStep("history");
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Run details failed");
    } finally {
      setDetailsLoading(false);
    }
  }

  function toggleCompare(id: string) {
    setComparison(null);
    setCompareSelection((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current.slice(-4), id]);
  }

  async function runCompare() {
    if (compareSelection.length < 2) {
      setComparisonError(t.compareEmpty);
      return;
    }
    try {
      setComparisonLoading(true);
      setComparisonError(null);
      setComparison(await compareGenerations(compareSelection));
      setActiveStep("compare");
    } catch (err) {
      setComparisonError(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setComparisonLoading(false);
    }
  }

  async function removeHistoryItem(id: string) {
    try {
      setHistoryBusy(true);
      setError(null);
      await deleteGeneration(id);
      setCompareSelection((current) => current.filter((item) => item !== id));
      setSelectedDetails((current) => current?.metadata.id === id ? null : current);
      setComparison(null);
      await refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setHistoryBusy(false);
    }
  }

  async function removeAllHistory() {
    try {
      setHistoryBusy(true);
      setError(null);
      await clearGenerations();
      setGenerations([]);
      setCompareSelection([]);
      setComparison(null);
      setSelectedDetails(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clear history failed");
    } finally {
      setHistoryBusy(false);
    }
  }

  const filteredGenerations = generations.filter((item) => {
    const platformOk = historyPlatform === "all" || item.profile === historyPlatform;
    const modeOk = historyMode === "all" || (item.generationMode ?? "baseline") === historyMode;
    const statusOk = historyStatus === "all" || item.status === historyStatus;
    return platformOk && modeOk && statusOk;
  });

  const stepState = (id: StepId): string => {
    if (id === activeStep) return "active";
    if ((id === "tree" || id === "result") && !preview) return "locked";
    if (id === "result" && !generation) return "locked";
    if (!requiredValid && (id === "tree" || id === "result")) return "error";
    return "ready";
  };

  return (
    <div className="app-shell">
      <TopBar theme={theme} language={language} onThemeChange={setTheme} onLanguageChange={setLanguage} />

      <main className="console-layout">
        <aside className="flow-sidebar">
          <nav className="step-list" aria-label="Flow steps">
            {steps.map((step, index) => (
              <button className={`step-button ${stepState(step.id)}`} key={step.id} type="button" onClick={() => setActiveStep(step.id)}>
                <b>{index + 1}</b>
                <span>{t[step.labelKey]}</span>
              </button>
            ))}
          </nav>
          <button className="ghost-button demo-button" type="button" onClick={() => {
            setForm(normalizeFormForPlatform(initialForm));
            setPreview(null);
            setGeneration(null);
            setPreviewFingerprint(null);
            setError(null);
          }}>{t.demo}</button>
        </aside>

        <section className="workspace-panel">
          {error ? <div className="error-banner">{error}</div> : null}
          {previewOutdated ? <div className="warning-banner">{t.previewOutdated}</div> : null}

          {activeStep === "platform" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">01</span><h1>{t.platform}</h1><p>{t.intro}</p></div></div>
              <div className="option-grid four">
                {platformOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    active={form.profile === option.id}
                    title={text(option.title, language)}
                    description={text(option.description, language)}
                    onClick={() => updatePlatform(option.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === "basics" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">02</span><h1>{t.basics}</h1></div></div>
              <div className="form-grid">
                <TextField label={t.projectName} value={form.projectName} placeholder="Finance Tracker" onChange={(value) => updateForm("projectName", value)} />
                <TextField label={t.displayName} value={form.appDisplayName} placeholder="Finance" onChange={(value) => updateForm("appDisplayName", value)} />
                <TextField label={t.packageId} value={form.packageId ?? ""} placeholder="com.company.product" onChange={(value) => updateForm("packageId", value)} />
              </div>
            </div>
          ) : null}

          {activeStep === "ai" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">03</span><h1>{t.ai}</h1></div></div>
              <div className="option-grid four">
                {modeOptions.map((option) => {
                  const status = option.provider === "hybrid" ? providerForMode("hybrid", providers) : providers.find((item) => item.provider === option.provider);
                  return (
                    <OptionCard
                      key={option.id}
                      active={activeMode === option.id}
                      title={text(option.title, language)}
                      badge={option.badge}
                      description={text(option.description, language)}
                      meta={status ? `${status.status}${status.model ? ` · ${status.model}` : ""}` : t.modeReady}
                      onClick={() => updateMode(option.id)}
                    />
                  );
                })}
              </div>
              {activeProvider ? <p className="quiet-note">{t.provider}: {activeProvider.provider} · {activeProvider.status}{activeProvider.model ? ` · ${activeProvider.model}` : ""}</p> : null}
              {activeMode !== "baseline" ? (
                <label className="prompt-field">
                  <span>
                    <strong>{t.aiInstruction}</strong>
                    <small>{(form.aiInstruction ?? "").length}/2000 {t.promptCount}</small>
                  </span>
                  <textarea
                    maxLength={2000}
                    value={form.aiInstruction ?? ""}
                    placeholder={t.aiInstructionPlaceholder}
                    onChange={(event) => updateForm("aiInstruction", event.target.value)}
                  />
                  <em>{t.aiInstructionHelp}</em>
                  <em>{t.aiAutofillNote}</em>
                </label>
              ) : null}
            </div>
          ) : null}

          {activeStep === "architecture" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">04</span><h1>{t.architecture}</h1></div></div>
              <h3>{t.architectureStyle}</h3>
              <div className="option-grid four compact">
                {availableArchitecture.map((option) => (
                  <OptionCard key={option.id} active={form.architectureStyle === option.id} title={text(option.title, language)} description={text(option.description, language)} onClick={() => updateForm("architectureStyle", option.id)} />
                ))}
              </div>
              <h3>{t.stateManagement}</h3>
              <div className="option-grid five compact">
                {availableState.map((option) => (
                  <OptionCard key={option.id} active={form.stateManagement === option.id} title={text(option.title, language)} description={text(option.description, language)} onClick={() => updateForm("stateManagement", option.id)} />
                ))}
              </div>
              <h3>{t.navigation}</h3>
              <div className="option-grid four compact">
                {availableNavigation.map((option) => (
                  <OptionCard key={option.id} active={form.navigationStyle === option.id} title={text(option.title, language)} description={text(option.description, language)} onClick={() => updateForm("navigationStyle", option.id)} />
                ))}
              </div>
              <h3>{t.environment}</h3>
              <div className="option-grid two compact">
                {environmentOptions.map((option) => (
                  <OptionCard key={option.id} active={form.environmentMode === option.id} title={text(option.title, language)} description={text(option.description, language)} onClick={() => updateForm("environmentMode", option.id)} />
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === "modules" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">05</span><h1>{t.modules}</h1></div></div>
              <h3>{t.modules}</h3>
              <div className="module-grid">
                {modules.map((module) => (
                  <button
                    className={form[module.id] ? "module-card active" : "module-card"}
                    key={module.id}
                    type="button"
                    onClick={() => updateForm(module.id, !form[module.id])}
                  >
                    <span><strong>{text(module.title, language)}</strong><i>{form[module.id] ? "on" : "off"}</i></span>
                    <small>{text(module.description, language)}</small>
                  </button>
                ))}
              </div>
              <h3>{t.distribution}</h3>
              <div className="module-grid">
                {pickOptions(distributionOptions, distributionByProfile[form.profile]).map((option) => {
                  const selected = form.distributionStores?.includes(option.id) ?? false;
                  return (
                    <button className={selected ? "module-card active" : "module-card"} key={option.id} type="button" onClick={() => toggleArrayValue("distributionStores", option.id)}>
                      <span><strong>{text(option.title, language)}</strong><i>{selected ? "on" : "off"}</i></span>
                      <small>{text(option.description, language)}</small>
                    </button>
                  );
                })}
              </div>
              <h3>{t.monetization}</h3>
              <div className="module-grid">
                {monetizationOptions.map((option) => {
                  const selected = form.monetization?.includes(option.id) ?? false;
                  return (
                    <button className={selected ? "module-card active" : "module-card"} key={option.id} type="button" onClick={() => toggleArrayValue("monetization", option.id)}>
                      <span><strong>{text(option.title, language)}</strong><i>{selected ? "on" : "off"}</i></span>
                      <small>{text(option.description, language)}</small>
                    </button>
                  );
                })}
              </div>
              <h3>{t.offlineData}</h3>
              <div className="module-grid">
                {offlineDataOptions.map((option) => {
                  const selected = form.offlineData?.includes(option.id) ?? false;
                  return (
                    <button className={selected ? "module-card active" : "module-card"} key={option.id} type="button" onClick={() => toggleArrayValue("offlineData", option.id)}>
                      <span><strong>{text(option.title, language)}</strong><i>{selected ? "on" : "off"}</i></span>
                      <small>{text(option.description, language)}</small>
                    </button>
                  );
                })}
              </div>
              <h3>{t.runtimeQuality}</h3>
              <div className="module-grid">
                {runtimeQualityOptions.map((option) => {
                  const selected = form.runtimeQuality?.includes(option.id) ?? false;
                  return (
                    <button className={selected ? "module-card active" : "module-card"} key={option.id} type="button" onClick={() => toggleArrayValue("runtimeQuality", option.id)}>
                      <span><strong>{text(option.title, language)}</strong><i>{selected ? "on" : "off"}</i></span>
                      <small>{text(option.description, language)}</small>
                    </button>
                  );
                })}
              </div>
              <h3>{t.delivery}</h3>
              <div className="module-grid">
                {deliveryOptions.map((option) => {
                  const selected = form.delivery?.includes(option.id) ?? false;
                  return (
                    <button className={selected ? "module-card active" : "module-card"} key={option.id} type="button" onClick={() => toggleArrayValue("delivery", option.id)}>
                      <span><strong>{text(option.title, language)}</strong><i>{selected ? "on" : "off"}</i></span>
                      <small>{text(option.description, language)}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {activeStep === "extras" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">06</span><h1>{t.extras}</h1></div></div>
              <div className="option-grid two">
                <OptionCard active={Boolean(form.includeExampleScreen)} title={t.exampleScreen} description={t.exampleScreenText} onClick={() => updateForm("includeExampleScreen", !form.includeExampleScreen)} />
                <OptionCard active={activeMode !== "baseline"} title={t.advisorArtifacts} description={t.advisorArtifactsText} onClick={() => undefined} />
              </div>
            </div>
          ) : null}

          {activeStep === "tree" ? (
            <div className="step-panel">
              <div className="section-head">
                <div><span className="kicker">07</span><h1>{t.tree}</h1></div>
                <button className="primary-button" type="button" disabled={!requiredValid || loadingPreview} onClick={() => void generateTree()}>
                  {loadingPreview ? t.generatingTree : t.generateTree}
                </button>
              </div>
              {shown ? (
                <div className="tree-layout">
                  <FileTreeViewer
                    nodes={shown.fileTree}
                    artifacts={shownArtifacts}
                    labels={{
                      title: t.tree,
                      copy: t.copyTree,
                      copied: t.copied,
                      files: t.files,
                      folders: t.folders,
                      docs: t.docs,
                      metadata: t.metadata,
                      empty: t.noPreview
                    }}
                  />
                  <aside className="tree-side">
                    <div className="metric-grid">
                      <span><small>{t.files}</small><strong>{fileCount}</strong></span>
                      <span><small>{t.folders}</small><strong>{folderCount}</strong></span>
                      <span><small>{t.artifacts}</small><strong>{shown.manifest.summary.totalArtifacts}</strong></span>
                      <span><small>{t.docs}</small><strong>{countKind(shownArtifacts, "documentation")}</strong></span>
                    </div>
                    <ValidationSummary validationV2={shown.validationV2} />
                    <div className="advisor-summary-card">
                      <h3>{t.architectureExplanation}</h3>
                      <p>{shown.advisorSummary?.summary ?? shown.spec.explanation}</p>
                      <div className="chip-row">
                        <span className="chip">{shown.architectureSynthesis?.status ?? "baseline"}</span>
                        <span className="chip">{shown.profile.generationMode}</span>
                        <span className="chip">{shown.spec.architecture.style}</span>
                      </div>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="empty-state">{t.noPreview}</div>
              )}
            </div>
          ) : null}

          {activeStep === "result" ? (
            <div className="step-panel">
              <div className="section-head">
                <div><span className="kicker">08</span><h1>{t.result}</h1></div>
                <button className="primary-button" type="button" disabled={!preview || previewOutdated || loadingZip} onClick={() => void createZip()}>
                  {loadingZip ? t.creatingZip : t.createZip}
                </button>
              </div>
              {generation ? (
                <div className="result-card">
                  <span className="status-pill">{t.zipReady}</span>
                  <h2>{generation.profile.projectName}</h2>
                  <p>{generation.profile.profile} · {generation.profile.generationMode} · {generation.runMetrics?.fileCount ?? fileCount} {t.files.toLowerCase()} · {t.validation.toLowerCase()} {generation.runMetrics?.validationStatus ?? "passed"}</p>
                  <a className="primary-link" href={downloadUrlForGeneration(generation.generationId)}>{t.downloadZip}</a>
                </div>
              ) : (
                <div className="empty-state">{preview ? t.createZip : t.noPreview}</div>
              )}
            </div>
          ) : null}

          {activeStep === "history" ? (
            <div className="step-panel">
              <div className="section-head">
                <div><span className="kicker">09</span><h1>{t.history}</h1></div>
                <button className="ghost-button danger-button" type="button" disabled={historyBusy || generations.length === 0} onClick={() => void removeAllHistory()}>{t.clearHistory}</button>
              </div>
              <div className="filters-row">
                <CustomSelect
                  ariaLabel={t.platform}
                  value={historyPlatform}
                  options={[{ value: "all", label: t.allPlatforms }, ...optionSelectItems(platformOptions, language)]}
                  onChange={setHistoryPlatform}
                />
                <CustomSelect
                  ariaLabel={t.ai}
                  value={historyMode}
                  options={[{ value: "all", label: t.allModes }, ...optionSelectItems(modeOptions, language)]}
                  onChange={setHistoryMode}
                />
                <CustomSelect
                  ariaLabel={t.validation}
                  value={historyStatus}
                  options={[
                    { value: "all", label: t.allStatuses },
                    { value: "completed", label: t.completed },
                    { value: "failed", label: t.failed }
                  ]}
                  onChange={setHistoryStatus}
                />
              </div>
              {filteredGenerations.length > 0 ? (
                <div className="history-grid">
                  {filteredGenerations.slice(0, 12).map((item) => (
                    <article className={compareSelection.includes(item.id) ? "history-card selected" : "history-card"} key={item.id}>
                      <div>
                        <strong>{item.projectName} · {item.generationMode ?? "baseline"} · {item.profile}</strong>
                        <small>{formatDate(item.createdAt)}</small>
                      </div>
                      <div className="history-actions">
                        <button className="ghost-button" type="button" onClick={() => void loadDetails(item.id)}>{t.details}</button>
                        <button className="ghost-button" type="button" onClick={() => toggleCompare(item.id)}>{t.compare}</button>
                        <button className="ghost-button danger-button" type="button" disabled={historyBusy} onClick={() => void removeHistoryItem(item.id)}>{t.delete}</button>
                        <a href={downloadUrlForGeneration(item.id)}>{t.zip}</a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">{t.noHistory}</div>
              )}
              <RunDetailsPanel details={selectedDetails} loading={detailsLoading} error={detailsError} labels={{
                empty: t.selectRun,
                loading: t.loading,
                title: t.runDetails,
                summary: t.summary,
                modules: t.selectedModules,
                metrics: t.metrics,
                advanced: t.advanced,
                platform: t.platform,
                mode: t.ai,
                provider: t.provider,
                created: language === "ua" ? "Створено" : "Created",
                architecture: t.architectureStyle,
                state: t.stateManagement,
                navigation: t.navigation,
                zip: t.zip,
                ready: t.completed,
                missing: language === "ua" ? "немає" : "missing",
                files: t.files.toLowerCase(),
                artifacts: t.artifacts.toLowerCase(),
                warnings: language === "ua" ? "попереджень" : "warnings",
                validation: t.validation.toLowerCase()
              }} />
            </div>
          ) : null}

          {activeStep === "compare" ? (
            <div className="step-panel">
              <div className="section-head">
                <div><span className="kicker">10</span><h1>{t.compare}</h1></div>
                <button className="primary-button" type="button" disabled={compareSelection.length < 2 || comparisonLoading} onClick={() => void runCompare()}>{t.compareSelected}</button>
              </div>
              <div className="compare-selection-note">{compareSelection.length} selected</div>
              <RunComparisonPanel comparison={comparison} selectedCount={compareSelection.length} loading={comparisonLoading} error={comparisonError} labels={{
                empty: t.compareEmpty,
                loading: t.comparing,
                title: t.compare,
                strongest: t.mostComplete,
                runs: language === "ua" ? "запуски" : "runs",
                run: language === "ua" ? "Запуск" : "Run",
                mode: t.ai,
                platform: t.platform,
                files: t.files,
                artifacts: t.artifacts,
                warnings: language === "ua" ? "Попередження" : "Warnings",
                time: language === "ua" ? "Час" : "Time",
                currentSelection: language === "ua" ? "Обрано" : "Current selection",
                generationTime: language === "ua" ? "Час генерації" : "Generation time"
              }} />
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

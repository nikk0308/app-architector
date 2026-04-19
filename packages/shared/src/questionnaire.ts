import type { QuestionnaireSection } from "./types.js";

export const questionnaireSchema: QuestionnaireSection[] = [
  {
    id: "project-basics",
    title: "Базові параметри",
    description: "Назва проєкту, профіль платформи і режим генерації.",
    fields: [
      {
        key: "projectName",
        label: "Project name",
        type: "text",
        help: "Внутрішня назва проєкту",
        required: true
      },
      {
        key: "appDisplayName",
        label: "App display name",
        type: "text",
        help: "Назва для користувача",
        required: true
      },
      {
        key: "profile",
        label: "Target profile",
        type: "select",
        help: "Платформа стартової архітектури",
        required: true,
        options: [
          { label: "Unity / C#", value: "unity" },
          { label: "native iOS / Swift", value: "ios" },
          { label: "Flutter / Dart", value: "flutter" },
          { label: "React Native / TypeScript", value: "react-native" }
        ]
      },
      {
        key: "generationMode",
        label: "Generation mode",
        type: "select",
        help: "Baseline уже працює. Інші режими закладені в доменну модель для наступних фаз.",
        required: true,
        options: [
          { label: "Rule/template baseline", value: "baseline" },
          { label: "Hugging Face open model", value: "hf-open" },
          { label: "Commercial LLM", value: "commercial" },
          { label: "Hybrid", value: "hybrid" }
        ]
      },
      {
        key: "packageId",
        label: "Package / Bundle identifier",
        type: "text",
        help: "Наприклад com.example.app або com.company.product"
      }
    ]
  },
  {
    id: "architecture",
    title: "Архітектура",
    description: "Вибір стилю архітектури, керування станом і середовищ.",
    fields: [
      {
        key: "architectureStyle",
        label: "Architecture style",
        type: "select",
        help: "Базова архітектурна схема",
        options: [
          { label: "Layered", value: "layered" },
          { label: "MVVM", value: "mvvm" },
          { label: "Feature-first", value: "feature-first" },
          { label: "Coordinator", value: "coordinator" }
        ]
      },
      {
        key: "stateManagement",
        label: "State management",
        type: "select",
        help: "Базовий спосіб керування станом",
        options: [
          { label: "Native / light", value: "native" },
          { label: "Provider", value: "provider" },
          { label: "Riverpod", value: "riverpod" },
          { label: "Redux Toolkit", value: "redux-toolkit" },
          { label: "ScriptableObject", value: "scriptable-object" }
        ]
      },
      {
        key: "navigationStyle",
        label: "Navigation",
        type: "select",
        help: "Тип навігаційного шару",
        options: [
          { label: "Stack", value: "stack" },
          { label: "Router", value: "router" },
          { label: "Coordinator", value: "coordinator" },
          { label: "Scene flow", value: "scene-flow" }
        ]
      },
      {
        key: "environmentMode",
        label: "Environment config",
        type: "select",
        help: "Single або multi environment",
        options: [
          { label: "Single", value: "single" },
          { label: "Multi", value: "multi" }
        ]
      }
    ]
  },
  {
    id: "feature-modules",
    title: "Модулі",
    description: "Функціональні флаги, які мають потрапити у стартову архітектуру.",
    fields: [
      {
        key: "hasAuth",
        label: "Auth scaffold",
        type: "boolean",
        help: "Згенерувати базову auth-структуру"
      },
      {
        key: "hasAnalytics",
        label: "Analytics hooks",
        type: "boolean",
        help: "Додати analytics abstraction і базові hook-и"
      },
      {
        key: "hasLocalization",
        label: "Localization scaffold",
        type: "boolean",
        help: "Базова структура локалізації"
      },
      {
        key: "hasPush",
        label: "Push placeholder",
        type: "boolean",
        help: "Push notifications placeholder і service façade"
      },
      {
        key: "hasNetworking",
        label: "Networking layer",
        type: "boolean",
        help: "HTTP-клієнт і abstraction під API"
      },
      {
        key: "hasPersistence",
        label: "Persistence / storage",
        type: "boolean",
        help: "Storage abstraction або локальний persistence scaffold"
      }
    ]
  },
  {
    id: "extras",
    title: "Додатково",
    description: "Прикладовий запуск і допоміжні блоки для demo-версії.",
    fields: [
      {
        key: "includeExampleScreen",
        label: "Include example screen",
        type: "boolean",
        help: "Додати стартовий demo-модуль"
      },
      {
        key: "includeLLMNotes",
        label: "Include LLM notes block",
        type: "boolean",
        help: "Додати блок із підказками для майбутніх LLM-режимів"
      }
    ]
  }
];

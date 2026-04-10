import type { ProfileId } from "./types.js";

export interface QuestionnaireFieldOption {
  value: string | boolean;
  label: string;
}

export interface QuestionnaireField {
  key: string;
  label: string;
  type: "text" | "select" | "boolean";
  help: string;
  required?: boolean;
  options?: QuestionnaireFieldOption[];
}

export interface QuestionnaireSection {
  title: string;
  description: string;
  fields: QuestionnaireField[];
}

export const profileDefaults: Record<ProfileId, {
  architectureStyle: string;
  stateManagement: string;
  navigationStyle: string;
  entryPoint: string;
}> = {
  unity: {
    architectureStyle: "manager-driven",
    stateManagement: "scriptable-store",
    navigationStyle: "scene-flow",
    entryPoint: "Assets/Scenes/Bootstrap.unity"
  },
  ios: {
    architectureStyle: "mvvm-coordinator",
    stateManagement: "observable-object",
    navigationStyle: "coordinator",
    entryPoint: "ios/<Project>/Sources/App/<Project>App.swift"
  },
  flutter: {
    architectureStyle: "feature-first",
    stateManagement: "provider",
    navigationStyle: "router",
    entryPoint: "lib/main.dart"
  },
  "react-native": {
    architectureStyle: "feature-first",
    stateManagement: "zustand-like-store",
    navigationStyle: "stack-navigation",
    entryPoint: "index.js"
  }
};

export const questionnaireSchema: QuestionnaireSection[] = [
  {
    title: "Базові параметри",
    description: "Ці поля формують універсальний профіль генерації.",
    fields: [
      {
        key: "projectName",
        label: "Назва проєкту",
        type: "text",
        help: "Використовується для назв папок, класів і README.",
        required: true
      },
      {
        key: "appDisplayName",
        label: "Назва застосунку для UI",
        type: "text",
        help: "Людське відображуване ім’я.",
        required: true
      },
      {
        key: "profile",
        label: "Профіль генерації",
        type: "select",
        help: "Визначає платформний адаптер.",
        required: true,
        options: [
          { value: "unity", label: "Unity" },
          { value: "ios", label: "native iOS (Swift/Xcode)" },
          { value: "flutter", label: "Flutter" },
          { value: "react-native", label: "React Native" }
        ]
      },
      {
        key: "packageId",
        label: "Package / Bundle identifier",
        type: "text",
        help: "Наприклад com.example.myapp. Якщо порожнє — згенерується автоматично."
      },
      {
        key: "environmentMode",
        label: "Режим environment-конфігів",
        type: "select",
        help: "single = один environment, multi = dev/prod templates.",
        options: [
          { value: "single", label: "Single environment" },
          { value: "multi", label: "Dev / Prod environment" }
        ]
      }
    ]
  },
  {
    title: "Архітектурні рішення",
    description: "Система використовує їх у rule engine та template engine.",
    fields: [
      {
        key: "architectureStyle",
        label: "Архітектурний стиль",
        type: "text",
        help: "Наприклад mvvm-coordinator, manager-driven, feature-first."
      },
      {
        key: "stateManagement",
        label: "Стратегія стану",
        type: "text",
        help: "Наприклад provider, observable-object, scriptable-store."
      },
      {
        key: "navigationStyle",
        label: "Навігаційний стиль",
        type: "text",
        help: "Наприклад router, scene-flow, coordinator."
      }
    ]
  },
  {
    title: "Універсальні модулі",
    description: "Спільний набір для всіх профілів.",
    fields: [
      { key: "hasAuth", label: "Auth scaffold", type: "boolean", help: "Додати базовий auth-модуль." },
      { key: "hasAnalytics", label: "Analytics hooks", type: "boolean", help: "Додати заглушки аналітики." },
      { key: "hasLocalization", label: "Localization scaffold", type: "boolean", help: "Додати файли локалізації." },
      { key: "hasPush", label: "Push scaffold", type: "boolean", help: "Додати push placeholders." },
      { key: "hasNetworking", label: "Network layer scaffold", type: "boolean", help: "Додати network client." },
      { key: "hasPersistence", label: "Persistence scaffold", type: "boolean", help: "Додати локальне збереження або storage-wrapper." },
      { key: "includeExampleScreen", label: "Стартовий екран / приклад запуску", type: "boolean", help: "Додати demo-screen / scene." },
      { key: "includeLLMNotes", label: "LLM helper notes", type: "boolean", help: "Додати текстові підказки для README." }
    ]
  }
];

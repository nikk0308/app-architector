import type { QuestionnaireSection } from "./types.js";

export const questionnaireSchema: QuestionnaireSection[] = [
  {
    id: "project-basics",
    title: "Основне",
    description: "Дай сервісу назву додатка і вибери платформу, під яку потрібен стартовий проєкт.",
    fields: [
      {
        key: "projectName",
        label: "Назва проєкту",
        type: "text",
        help: "Наприклад: Finance Tracker",
        required: true
      },
      {
        key: "appDisplayName",
        label: "Назва для користувача",
        type: "text",
        help: "Таку назву побачить користувач у додатку",
        required: true
      },
      {
        key: "profile",
        label: "Платформа",
        type: "select",
        help: "Під що зібрати стартову структуру",
        required: true,
        options: [
          { label: "Unity / C#", value: "unity" },
          { label: "iOS / Swift", value: "ios" },
          { label: "Flutter / Dart", value: "flutter" },
          { label: "React Native / TypeScript", value: "react-native" }
        ]
      },
      {
        key: "generationMode",
        label: "Режим генерації",
        type: "select",
        help: "Стабільна шаблонна генерація використовується за замовчуванням.",
        required: true,
        options: [
          { label: "Стабільна шаблонна генерація", value: "baseline" },
          { label: "Hugging Face open model", value: "hf-open" },
          { label: "Commercial LLM", value: "commercial" },
          { label: "Hybrid", value: "hybrid" }
        ]
      },
      {
        key: "packageId",
        label: "Bundle / Package ID",
        type: "text",
        help: "Наприклад: com.company.product"
      }
    ]
  },
  {
    id: "architecture",
    title: "Структура проєкту",
    description: "Обери, як зручніше організувати екрани, сервіси, стан і конфігурацію.",
    fields: [
      {
        key: "architectureStyle",
        label: "Архітектурний підхід",
        type: "select",
        help: "Можна залишити автоматичний вибір",
        options: [
          { label: "Layered", value: "layered" },
          { label: "MVVM", value: "mvvm" },
          { label: "Feature-first", value: "feature-first" },
          { label: "Coordinator", value: "coordinator" }
        ]
      },
      {
        key: "stateManagement",
        label: "Керування станом",
        type: "select",
        help: "Базовий спосіб роботи зі станом додатка",
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
        label: "Навігація",
        type: "select",
        help: "Як буде організований перехід між екранами",
        options: [
          { label: "Stack", value: "stack" },
          { label: "Router", value: "router" },
          { label: "Coordinator", value: "coordinator" },
          { label: "Scene flow", value: "scene-flow" }
        ]
      },
      {
        key: "environmentMode",
        label: "Конфігурації середовищ",
        type: "select",
        help: "Один режим або окремо dev/stage/prod",
        options: [
          { label: "Один режим", value: "single" },
          { label: "Dev / Stage / Prod", value: "multi" }
        ]
      }
    ]
  },
  {
    id: "feature-modules",
    title: "Модулі",
    description: "Вибери готові заготовки, які одразу мають бути в архіві.",
    fields: [
      {
        key: "hasAuth",
        label: "Авторизація",
        type: "boolean",
        help: "Папки та базові файли для входу користувача"
      },
      {
        key: "hasAnalytics",
        label: "Аналітика",
        type: "boolean",
        help: "Єдине місце для майбутніх подій аналітики"
      },
      {
        key: "hasLocalization",
        label: "Локалізація",
        type: "boolean",
        help: "Структура для перекладів і текстів інтерфейсу"
      },
      {
        key: "hasPush",
        label: "Push-сповіщення",
        type: "boolean",
        help: "Порожній сервіс, який потім можна підключити до провайдера"
      },
      {
        key: "hasNetworking",
        label: "API-клієнт",
        type: "boolean",
        help: "Базовий шар для запитів до бекенду"
      },
      {
        key: "hasPersistence",
        label: "Локальне збереження",
        type: "boolean",
        help: "Заготовка для кешу, налаштувань або локального сховища"
      }
    ]
  },
  {
    id: "extras",
    title: "Додатково",
    description: "Невеликі допоміжні файли, які зручні для першого запуску.",
    fields: [
      {
        key: "includeExampleScreen",
        label: "Приклад екрана",
        type: "boolean",
        help: "Додати простий стартовий екран або demo-модуль"
      },
      {
        key: "includeLLMNotes",
        label: "Технічні нотатки",
        type: "boolean",
        help: "Допоміжний блок для майбутніх режимів генерації"
      }
    ]
  }
];

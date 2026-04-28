import { useEffect, useMemo, useState } from "react";
import type { ArchitectureAdvisorReport, ArchitectureAdvisorStatus, GenerationMetadata, QuestionnaireAnswers, QuestionnaireField, QuestionnaireSection } from "@mag/shared";
import { apiUrl, createAdvisorPlan, createGeneration, fetchAdvisorStatus, fetchQuestionnaire, listGenerations, previewProfile, type GenerationResponse, type PreviewResponse } from "./api";

const initialForm: QuestionnaireAnswers = {
  projectName: "",
  appDisplayName: "",
  profile: "ios",
  generationMode: "baseline",
  packageId: "",
  architectureStyle: "",
  stateManagement: "",
  navigationStyle: "",
  environmentMode: "single",
  hasAuth: false,
  hasAnalytics: false,
  hasLocalization: false,
  hasPush: false,
  hasNetworking: true,
  hasPersistence: false,
  includeExampleScreen: true,
  includeLLMNotes: false
};

const hiddenFieldKeys = new Set(["generationMode", "includeLLMNotes"]);

const platformLabels: Record<string, string> = {
  ios: "iOS / Swift",
  flutter: "Flutter",
  "react-native": "React Native",
  unity: "Unity"
};

const featureLabels: Array<{ key: keyof QuestionnaireAnswers; label: string }> = [
  { key: "hasNetworking", label: "API-клієнт" },
  { key: "hasAuth", label: "Авторизація" },
  { key: "hasPersistence", label: "Локальне збереження" },
  { key: "hasLocalization", label: "Локалізація" },
  { key: "hasAnalytics", label: "Аналітика" },
  { key: "hasPush", label: "Push" },
  { key: "includeExampleScreen", label: "Приклад екрана" }
];

function fieldValue(form: QuestionnaireAnswers, key: string): string | boolean {
  const value = form[key as keyof QuestionnaireAnswers];
  return typeof value === "undefined" ? "" : value;
}

function downloadUrlForGeneration(generationId: string): string {
  return apiUrl(`/api/generations/${generationId}/download`);
}

function humanError(message: string): string {
  if (message === "Failed to fetch") {
    return "Не вдалося підключитися до серверної частини. Перевір, чи запущений API та чи правильно налаштований домен.";
  }
  return message;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function visibleFields(fields: QuestionnaireField[]): QuestionnaireField[] {
  return fields.filter((field) => !hiddenFieldKeys.has(field.key));
}

export default function App() {
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [form, setForm] = useState<QuestionnaireAnswers>(initialForm);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [generations, setGenerations] = useState<GenerationMetadata[]>([]);
  const [createdGeneration, setCreatedGeneration] = useState<GenerationResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advisorStatus, setAdvisorStatus] = useState<ArchitectureAdvisorStatus | null>(null);
  const [advisorPlan, setAdvisorPlan] = useState<ArchitectureAdvisorReport | null>(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionnaire().then(setSections).catch((err) => setError(humanError(err.message)));
    listGenerations().then(setGenerations).catch((err) => setError(humanError(err.message)));
    fetchAdvisorStatus().then(setAdvisorStatus).catch(() => setAdvisorStatus(null));
  }, []);

  const displayedSections = useMemo(
    () => sections
      .map((section) => ({ ...section, fields: visibleFields(section.fields) }))
      .filter((section) => section.fields.length > 0),
    [sections]
  );

  const enabledFeatures = useMemo(
    () => featureLabels.filter((feature) => Boolean(form[feature.key])),
    [form]
  );

  const canSubmit = form.projectName.trim().length > 0 && form.appDisplayName.trim().length > 0;
  const selectedPlatform = platformLabels[form.profile] ?? form.profile;
  const latestGeneration = createdGeneration ?? null;
  const isBusy = loadingPreview || loadingGenerate;

  function buildRequestPayload() {
    return {
      ...form,
      generationMode: form.includeLLMNotes ? "hybrid" : "baseline",
      includeLLMNotes: form.includeLLMNotes
    } as const;
  }

  function updateField(key: string, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handlePreview() {
    if (!canSubmit) {
      setError("Заповни назву проєкту і назву додатка, щоб зібрати попередній перегляд.");
      return;
    }

    try {
      setLoadingPreview(true);
      setError(null);
      const result = await previewProfile(buildRequestPayload());
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? humanError(err.message) : "Не вдалося підготувати попередній перегляд.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGenerate() {
    if (!canSubmit) {
      setError("Заповни назву проєкту і назву додатка, щоб створити ZIP.");
      return;
    }

    try {
      setLoadingGenerate(true);
      setError(null);
      const result = await createGeneration(buildRequestPayload());
      setAdvisorPlan(result.advisor ?? null);
      setCreatedGeneration(result);
      setPreview(result);
      setGenerations(await listGenerations());
    } catch (err) {
      setError(err instanceof Error ? humanError(err.message) : "Не вдалося створити архів.");
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Mobile App Architect</div>
          <h1>Стартова архітектура мобільного застосунку за кілька кліків</h1>
          <p>
            Обери платформу, базову структуру та потрібні модулі. Сервіс збере готовий ZIP з файлами,
            README та зрозумілою структурою проєкту.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={handleGenerate} disabled={!canSubmit || isBusy}>
              {loadingGenerate ? "Створюємо ZIP..." : "Створити ZIP"}
            </button>
            <button className="secondary" onClick={handlePreview} disabled={!canSubmit || isBusy}>
              {loadingPreview ? "Перевіряємо..." : "Переглянути структуру"}
            </button>
          </div>
        </div>
        <div className="hero-card" aria-label="Короткий план роботи">
          <span>1</span>
          <strong>Заповни форму</strong>
          <span>2</span>
          <strong>Перевір структуру</strong>
          <span>3</span>
          <strong>Завантаж ZIP</strong>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <main className="layout">
        <section className="panel form-panel">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Налаштування</span>
              <h2>Опиши майбутній додаток</h2>
            </div>
            <span className="status-pill">Стабільний режим</span>
          </div>

          {displayedSections.length === 0 ? (
            <div className="empty-state">Завантажуємо форму...</div>
          ) : null}

          {displayedSections.map((section, index) => (
            <div className="section-block" key={section.id}>
              <div className="section-title-row">
                <span className="step-number">{index + 1}</span>
                <div>
                  <h3>{section.title}</h3>
                  <p>{section.description}</p>
                </div>
              </div>
              <div className="field-grid">
                {section.fields.map((field) => {
                  const value = fieldValue(form, field.key);
                  const fieldId = `field-${field.key}`;
                  const booleanField = field.type === "boolean";

                  return (
                    <label className={booleanField ? "field checkbox-field" : "field"} key={field.key} htmlFor={fieldId}>
                      <span className="field-label">{field.label}</span>
                      {field.type === "select" ? (
                        <select
                          id={fieldId}
                          value={String(value)}
                          onChange={(event) => updateField(field.key, event.target.value)}
                        >
                          <option value="">Обрати автоматично</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : booleanField ? (
                        <div className="checkbox-row">
                          <input
                            id={fieldId}
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(event) => updateField(field.key, event.target.checked)}
                          />
                          <span>{Boolean(value) ? "Додати" : "Не додавати"}</span>
                        </div>
                      ) : (
                        <input
                          id={fieldId}
                          type="text"
                          value={String(value)}
                          onChange={(event) => updateField(field.key, event.target.value)}
                          placeholder={field.help}
                        />
                      )}
                      <small>{field.help}</small>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="advisor-option">
            <label className="toggle-line" htmlFor="advisor-notes">
              <input
                id="advisor-notes"
                type="checkbox"
                checked={Boolean(form.includeLLMNotes)}
                onChange={(event) => updateField("includeLLMNotes", event.target.checked)}
              />
              <span>Додати архітектурний план у ZIP</span>
            </label>
            <p>У ZIP зʼявляться docs/architecture-decisions.md та .mag/architecture-advice.json. Якщо зовнішній провайдер недоступний, буде створено стабільний локальний план.</p>
            {advisorStatus ? <small>Статус: {advisorStatus.status}{advisorStatus.model ? ` · ` : ""}</small> : null}
            <button className="secondary small-button" onClick={handleAdvisorPlan} disabled={!canSubmit || isBusy || advisorLoading}>
              {advisorLoading ? "Готуємо план..." : "Показати план"}
            </button>
            {advisorError ? <small className="error-text">{advisorError}</small> : null}
          </div>

          <div className="actions">
            <button className="secondary" onClick={handlePreview} disabled={!canSubmit || isBusy}>
              {loadingPreview ? "Перевіряємо..." : "Переглянути структуру"}
            </button>
            <button className="primary" onClick={handleGenerate} disabled={!canSubmit || isBusy}>
              {loadingGenerate ? "Створюємо ZIP..." : "Створити ZIP"}
            </button>
          </div>
        </section>

        <aside className="side-column">
          <section className="panel preview-panel">
            <div className="panel-header compact">
              <div>
                <span className="section-kicker">Попередній перегляд</span>
                <h2>Що буде у ZIP</h2>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-tile">
                <span>Платформа</span>
                <strong>{selectedPlatform}</strong>
              </div>
              <div className="summary-tile">
                <span>Архітектура</span>
                <strong>{form.architectureStyle || "Автоматично"}</strong>
              </div>
              <div className="summary-tile">
                <span>Файлів</span>
                <strong>{preview ? preview.fileTree.filter((node) => node.type === "file").length : "—"}</strong>
              </div>
              <div className="summary-tile">
                <span>Перевірка</span>
                <strong>{preview?.validation.spec.status === "passed" && preview.validation.manifest.status === "passed" ? "Готово" : preview ? "Є зауваження" : "—"}</strong>
              </div>
            </div>

            <div className="selected-modules">
              <h3>Обрані модулі</h3>
              {enabledFeatures.length > 0 ? (
                <div className="chips">
                  {enabledFeatures.map((feature) => <span className="chip" key={String(feature.key)}>{feature.label}</span>)}
                </div>
              ) : (
                <p>Поки що додаткові модулі не вибрані.</p>
              )}
            </div>

            {preview ? (
              <div className="preview-stack">
                <div className="card success-card">
                  <h3>Структура готова до генерації</h3>
                  <p>
                    Коренева папка: <strong>{preview.manifest.rootFolderName}</strong>. Артефактів у плані: {preview.manifest.summary.totalArtifacts}.
                  </p>
                </div>

                <div className="card">
                  <h3>Дерево файлів</h3>
                  <ul className="tree-list">
                    {preview.fileTree.slice(0, 80).map((node) => (
                      <li className={node.type === "directory" ? "directory-node" : "file-node"} key={node.path}>{node.path}</li>
                    ))}
                  </ul>
                  {preview.fileTree.length > 80 ? <small>Показано перші 80 елементів з {preview.fileTree.length}.</small> : null}
                </div>

                {preview.notes.length > 0 ? (
                  <div className="card">
                    <h3>Нотатки генерації</h3>
                    <ul className="note-list">
                      {preview.notes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                ) : null}

                {advisorPlan ? (
                  <div className="card advisor-card">
                    <div className="card-row">
                      <h3>Архітектурний план</h3>
                      <span className="status-pill">{advisorPlan.status}</span>
                    </div>
                    <p>{advisorPlan.summary}</p>
                    <ul className="note-list">
                      {advisorPlan.decisions.slice(0, 4).map((decision) => (
                        <li key={decision.id}>
                          <strong>{decision.title}:</strong> {decision.recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <details className="technical-details">
                  <summary>Технічні деталі для перевірки</summary>
                  <div className="technical-grid">
                    <div className="card">
                      <h3>Profile</h3>
                      <pre>{JSON.stringify(preview.profile, null, 2)}</pre>
                    </div>
                    <div className="card">
                      <h3>Spec</h3>
                      <pre>{JSON.stringify(preview.spec, null, 2)}</pre>
                    </div>
                    <div className="card">
                      <h3>Manifest</h3>
                      <pre>{JSON.stringify(preview.manifest, null, 2)}</pre>
                    </div>
                    <div className="card">
                      <h3>Validation</h3>
                      <pre>{JSON.stringify(preview.validation, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              </div>
            ) : (
              <div className="empty-state">
                Заповни базові поля і натисни «Переглянути структуру», щоб побачити майбутній ZIP до генерації.
              </div>
            )}
          </section>

          {latestGeneration ? (
            <section className="panel download-panel">
              <h2>Архів готовий</h2>
              <p>Остання генерація успішно зібрана. ZIP можна завантажити прямо зараз.</p>
              <a className="download-link" href={downloadUrlForGeneration(latestGeneration.generationId)}>Завантажити ZIP</a>
            </section>
          ) : null}
        </aside>
      </main>

      <section className="panel history-panel">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Історія</span>
            <h2>Останні готові архіви</h2>
          </div>
          <span className="status-pill">{generations.length} збережено</span>
        </div>

        <div className="history-list">
          {generations.map((item) => (
            <article className="history-card" key={item.id}>
              <div>
                <strong>{item.projectName}</strong>
                <div>{platformLabels[item.profile] ?? item.profile} · {item.status === "completed" ? "готово" : "помилка"}</div>
                <small>{formatDate(item.createdAt)}</small>
              </div>
              <a href={downloadUrlForGeneration(item.id)}>ZIP</a>
            </article>
          ))}
          {generations.length === 0 ? <div className="empty-state">Після першої генерації тут з’явиться посилання на архів.</div> : null}
        </div>
      </section>
    </div>
  );
}

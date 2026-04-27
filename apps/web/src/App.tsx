import { useEffect, useMemo, useState } from "react";
import type { GenerationMetadata, QuestionnaireAnswers, QuestionnaireSection } from "@mag/shared";
import { apiUrl, createGeneration, fetchQuestionnaire, listGenerations, previewProfile, type GenerationResponse, type PreviewResponse } from "./api";

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

function fieldValue(form: QuestionnaireAnswers, key: string): string | boolean {
  const value = form[key as keyof QuestionnaireAnswers];
  return typeof value === "undefined" ? "" : value;
}

function downloadUrlForGeneration(generationId: string): string {
  return apiUrl(`/api/generations/${generationId}/download`);
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

  useEffect(() => {
    fetchQuestionnaire().then(setSections).catch((err) => setError(err.message));
    listGenerations().then(setGenerations).catch((err) => setError(err.message));
  }, []);

  const selectedModeIsBaseline = useMemo(() => (form.generationMode ?? "baseline") === "baseline", [form.generationMode]);

  function updateField(key: string, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handlePreview() {
    try {
      setLoadingPreview(true);
      setError(null);
      const result = await previewProfile(form);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGenerate() {
    try {
      setLoadingGenerate(true);
      setError(null);
      const result = await createGeneration(form);
      setCreatedGeneration(result);
      setPreview(result);
      setGenerations(await listGenerations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <h1>Mobile App Architect</h1>
          <p>Phase 1–2 build: canonical spec, manifest, validation and deterministic baseline archive generation.</p>
        </div>
        <div className="hero-badge">baseline engine</div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}
      {!selectedModeIsBaseline ? (
        <div className="warning-banner">
          Обраний режим уже є в доменній моделі, але поточна збірка все ще генерує baseline-шаблони.
        </div>
      ) : null}

      <main className="layout">
        <section className="panel form-panel">
          <div className="panel-header">
            <h2>Questionnaire</h2>
            <p>Заповни базові параметри, архітектуру та модулі.</p>
          </div>

          {sections.map((section) => (
            <div className="section-block" key={section.id}>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
              <div className="field-grid">
                {section.fields.map((field) => (
                  <label className="field" key={field.key}>
                    <span>{field.label}</span>
                    {field.type === "select" ? (
                      <select
                        value={String(fieldValue(form, field.key))}
                        onChange={(event) => updateField(field.key, event.target.value)}
                      >
                        <option value="">Auto</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={Boolean(fieldValue(form, field.key))}
                        onChange={(event) => updateField(field.key, event.target.checked)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(fieldValue(form, field.key))}
                        onChange={(event) => updateField(field.key, event.target.value)}
                        placeholder={field.help}
                      />
                    )}
                    <small>{field.help}</small>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="actions">
            <button onClick={handlePreview} disabled={loadingPreview || loadingGenerate}>
              {loadingPreview ? "Loading preview..." : "Preview spec"}
            </button>
            <button className="primary" onClick={handleGenerate} disabled={loadingGenerate || loadingPreview}>
              {loadingGenerate ? "Generating..." : "Generate archive"}
            </button>
          </div>
        </section>

        <section className="panel preview-panel">
          <div className="panel-header">
            <h2>Preview</h2>
            <p>Spec, manifest, validation and file tree.</p>
          </div>

          {preview ? (
            <div className="preview-stack">
              <div className="card">
                <h3>Normalized profile</h3>
                <pre>{JSON.stringify(preview.profile, null, 2)}</pre>
              </div>
              <div className="card">
                <h3>Architecture spec</h3>
                <pre>{JSON.stringify(preview.spec, null, 2)}</pre>
              </div>
              <div className="card">
                <h3>Artifact manifest</h3>
                <pre>{JSON.stringify(preview.manifest, null, 2)}</pre>
              </div>
              <div className="card">
                <h3>Validation</h3>
                <pre>{JSON.stringify(preview.validation, null, 2)}</pre>
              </div>
              <div className="card">
                <h3>Tree preview</h3>
                <ul className="tree-list">
                  {preview.fileTree.map((node) => (
                    <li key={node.path}>{node.path}</li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="empty-state">Поки що нічого немає. Натисни Preview spec.</div>
          )}
        </section>
      </main>

      <section className="panel history-panel">
        <div className="panel-header">
          <h2>Generations</h2>
          <p>Останні збережені генерації з SQLite.</p>
        </div>

        {createdGeneration ? (
          <div className="download-banner">
            <strong>Останній архів готовий.</strong>
            <a href={downloadUrlForGeneration(createdGeneration.generationId)}>Завантажити ZIP</a>
          </div>
        ) : null}

        <div className="history-list">
          {generations.map((item) => (
            <article className="history-card" key={item.id}>
              <div>
                <strong>{item.projectName}</strong>
                <div>{item.profile} · {item.generationMode ?? "baseline"}</div>
                <div>{item.status}</div>
              </div>
              <a href={downloadUrlForGeneration(item.id)}>ZIP</a>
            </article>
          ))}
          {generations.length === 0 ? <div className="empty-state">Історія поки порожня.</div> : null}
        </div>
      </section>
    </div>
  );
}

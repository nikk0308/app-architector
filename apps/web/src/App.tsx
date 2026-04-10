import { useEffect, useMemo, useState } from "react";
import type { QuestionnaireAnswers, QuestionnaireSection, TreeNode } from "@mag/shared";
import { createGeneration, fetchQuestionnaire, getApiRoot, previewProfile } from "./api";

const initialForm: QuestionnaireAnswers = {
  projectName: "MindBoost Generator Demo",
  appDisplayName: "MindBoost",
  profile: "flutter",
  environmentMode: "multi",
  hasAuth: true,
  hasAnalytics: true,
  hasLocalization: true,
  hasPush: false,
  hasNetworking: true,
  hasPersistence: true,
  includeExampleScreen: true,
  includeLLMNotes: false
};

export function App() {
  const [sections, setSections] = useState<QuestionnaireSection[]>([]);
  const [form, setForm] = useState<QuestionnaireAnswers>(initialForm);
  const [currentStep, setCurrentStep] = useState(0);
  const [preview, setPreview] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuestionnaire()
      .then((data) => setSections(data.sections))
      .catch((err) => setError(String(err)));
  }, []);

  const step = sections[currentStep];
  const canGoNext = currentStep < sections.length - 1;
  const summary = useMemo(() => JSON.stringify(form, null, 2), [form]);

  const onChange = (key: keyof QuestionnaireAnswers, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handlePreview() {
    setError(null);
    setLoadingPreview(true);
    try {
      const data = await previewProfile(form);
      setPreview(data);
      setCurrentStep(sections.length);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleGenerate() {
    setError(null);
    setLoadingGenerate(true);
    try {
      const data = await createGeneration(form);
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingGenerate(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Diploma MVP</p>
          <h1>Intelligent Mobile Architecture Generator</h1>
          <p className="subtitle">
            Один генератор, одне deterministic ядро, чотири профілі: Unity, iOS, Flutter, React Native.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Опитування</h2>
          {sections.length === 0 ? (
            <p>Завантаження схеми опитування…</p>
          ) : step ? (
            <>
              <div className="step-meta">
                <span>Крок {Math.min(currentStep + 1, sections.length)} / {sections.length}</span>
                <strong>{step.title}</strong>
              </div>
              <p className="muted">{step.description}</p>

              <div className="form-grid">
                {step.fields.map((field) => {
                  const fieldKey = field.key as keyof QuestionnaireAnswers;
                  const value = form[fieldKey];
                  if (field.type === "boolean") {
                    return (
                      <label key={field.key} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) => onChange(fieldKey, event.target.checked)}
                        />
                        <div>
                          <strong>{field.label}</strong>
                          <p>{field.help}</p>
                        </div>
                      </label>
                    );
                  }

                  if (field.type === "select") {
                    return (
                      <label key={field.key} className="field">
                        <span>{field.label}</span>
                        <select
                          value={String(value ?? "")}
                          onChange={(event) => onChange(fieldKey, event.target.value)}
                        >
                          <option value="">Select…</option>
                          {field.options?.map((option) => (
                            <option key={String(option.value)} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <small>{field.help}</small>
                      </label>
                    );
                  }

                  return (
                    <label key={field.key} className="field">
                      <span>{field.label}</span>
                      <input
                        value={String(value ?? "")}
                        onChange={(event) => onChange(fieldKey, event.target.value)}
                        placeholder={field.help}
                      />
                      <small>{field.help}</small>
                    </label>
                  );
                })}
              </div>

              <div className="actions">
                <button disabled={currentStep === 0} onClick={() => setCurrentStep((prev) => prev - 1)}>
                  Назад
                </button>
                {canGoNext ? (
                  <button onClick={() => setCurrentStep((prev) => prev + 1)}>Далі</button>
                ) : (
                  <button onClick={handlePreview} disabled={loadingPreview}>
                    {loadingPreview ? "Готуємо preview…" : "Побудувати preview"}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="muted">Опитування завершено. Можна перевірити preview або повернутися назад для змін.</p>
              <div className="actions">
                <button onClick={() => setCurrentStep(sections.length - 1)}>Повернутись до редагування</button>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>Preview конфігурації</h2>
          <pre className="code-block">{summary}</pre>
          {preview && (
            <>
              <div className="summary-card">
                <h3>Architecture summary</h3>
                <p>{preview.architectureSummary.explanation}</p>
                <p className="muted">{preview.architectureSummary.llmNotes}</p>
              </div>

              <div className="summary-card">
                <h3>Generation plan</h3>
                <ul className="compact-list">
                  {preview.plan.artifacts.map((artifact: any) => (
                    <li key={artifact.id}>
                      <strong>{artifact.id}</strong> — {artifact.reason}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="summary-card">
                <h3>File tree</h3>
                <Tree tree={preview.fileTree} />
              </div>

              <button className="primary" onClick={handleGenerate} disabled={loadingGenerate}>
                {loadingGenerate ? "Генеруємо ZIP…" : "Згенерувати проєкт"}
              </button>
            </>
          )}

          {result && (
            <div className="summary-card success">
              <h3>Готово</h3>
              <p>ID генерації: {result.id}</p>
              <a href={`${getApiRoot()}${result.downloadUrl}`} target="_blank" rel="noreferrer">
                Завантажити ZIP
              </a>
            </div>
          )}

          {error && <p className="error">{error}</p>}
        </section>
      </main>
    </div>
  );
}

function Tree({ tree }: { tree: TreeNode[] }) {
  return (
    <ul className="compact-list tree">
      {tree.map((item) => (
        <li key={`${item.type}-${item.path}`}>
          <code>{item.type === "directory" ? "📁" : "📄"} {item.path}</code>
        </li>
      ))}
    </ul>
  );
}

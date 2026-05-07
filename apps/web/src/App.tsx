import { useEffect, useMemo, useState } from "react";
import type {
  AIProviderStatusSummary,
  GeneratedArtifactSummary,
  GenerationMetadata,
  GenerationMode,
  GenerationRunDetails,
  ProfileId,
  QuestionnaireAnswers,
  RunComparison
} from "@mag/shared";
import {
  apiUrl,
  compareGenerations,
  createArchitecturePreview,
  createGenerationFromPreview,
  fetchGenerationDetails,
  fetchProviderStatuses,
  listGenerations,
  type ArchitecturePreviewResponse,
  type GenerationResponse
} from "./api";
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
  includeLLMNotes: true
};

const copy: Record<Lang, Record<string, string>> = {
  ua: {
    lab: "AI-assisted architecture lab",
    intro: "Стенд для порівняння Baseline / GPT / Qwen / Hybrid генерації мобільної архітектури.",
    demo: "Demo data",
    generateTree: "Згенерувати структурне дерево",
    generatingTree: "Генеруємо дерево...",
    createZip: "Створити ZIP з цієї архітектури",
    creatingZip: "Створюємо ZIP...",
    downloadZip: "Download ZIP",
    previewOutdated: "Preview outdated: форма змінилась. Згенеруй дерево ще раз.",
    requiredError: "Заповни назву проєкту, назву для користувача і bundle/package id.",
    platform: "Platform",
    basics: "Basics",
    ai: "AI Mode",
    architecture: "Architecture",
    modules: "Modules",
    extras: "Example / Extras",
    tree: "Generated Tree",
    result: "Result",
    history: "History",
    compare: "Compare",
    projectName: "Назва проєкту",
    displayName: "Назва для користувача",
    packageId: "Bundle / Package ID",
    selectedModules: "Обрані модулі",
    validation: "Validation",
    architectureExplanation: "Пояснення архітектури",
    modeReady: "ready",
    noPreview: "Спочатку згенеруй структурне дерево.",
    zipReady: "ZIP готовий",
    filters: "Фільтри",
    runDetails: "Run Details",
    compareSelected: "Compare selected",
    latest: "Останні генерації",
    fullHistory: "Full list",
    selectRun: "Обери run для деталей.",
    compareEmpty: "Обери мінімум два runs для порівняння.",
    copyTree: "Copy tree",
    files: "Files",
    folders: "Folders",
    docs: "Docs",
    metadata: "Metadata"
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
    requiredError: "Fill project name, display name and bundle/package id.",
    platform: "Platform",
    basics: "Basics",
    ai: "AI Mode",
    architecture: "Architecture",
    modules: "Modules",
    extras: "Example / Extras",
    tree: "Generated Tree",
    result: "Result",
    history: "History",
    compare: "Compare",
    projectName: "Project name",
    displayName: "Display name",
    packageId: "Bundle / Package ID",
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
    files: "Files",
    folders: "Folders",
    docs: "Docs",
    metadata: "Metadata"
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

const platformOptions: Array<{ id: ProfileId; title: string; description: string }> = [
  { id: "ios", title: "iOS / Swift", description: "SwiftUI, coordinator-lite, services, XCTest-ready seams." },
  { id: "flutter", title: "Flutter", description: "Feature-first lib structure, router, core services and state." },
  { id: "react-native", title: "React Native", description: "TypeScript shell with navigation, services and state." },
  { id: "unity", title: "Unity / C#", description: "Bootstrap scene, managers, services and gameplay flow." }
];

const modeOptions: Array<{ id: GenerationMode; title: string; badge: string; description: string; provider: "deterministic" | "openai" | "huggingface" | "hybrid" }> = [
  { id: "baseline", title: "Baseline", badge: "CODE", description: "Deterministic ArchitectureSpec and ZIP materialization.", provider: "deterministic" },
  { id: "commercial", title: "GPT", badge: "OPENAI", description: "OpenAI synthesizes ArchitectureSpec and advisor output.", provider: "openai" },
  { id: "hf-open", title: "Qwen", badge: "HF", description: "Qwen/Hugging Face synthesizes ArchitectureSpec and advisor output.", provider: "huggingface" },
  { id: "hybrid", title: "Hybrid", badge: "AI + CODE", description: "Baseline structure with allowlisted AI refinement.", provider: "hybrid" }
];

const architectureOptions = [
  { key: "architectureStyle", value: "feature-first", title: "Feature-first", description: "Features own screens, state and services. Good for modular growth." },
  { key: "architectureStyle", value: "mvvm", title: "MVVM", description: "ViewModel boundary for screen state and presentation logic." },
  { key: "architectureStyle", value: "layered", title: "Layered", description: "Data / Domain / Presentation separation for stricter boundaries." },
  { key: "architectureStyle", value: "coordinator", title: "Coordinator", description: "Navigation and flow ownership is explicit and testable." }
] as const;

const stateOptions = [
  { value: "native", title: "Native / light", description: "Use platform-native state primitives first." },
  { value: "riverpod", title: "Riverpod", description: "Flutter provider graph and testable state boundaries." },
  { value: "zustand", title: "Zustand", description: "Small React Native state store for feature-first screens." },
  { value: "redux-toolkit", title: "Redux Toolkit", description: "Explicit centralized state for larger RN apps." },
  { value: "scriptable-object", title: "ScriptableObject", description: "Unity-friendly config and state assets." }
] as const;

const navOptions = [
  { value: "coordinator", title: "Coordinator", description: "Flow objects coordinate screens and routes." },
  { value: "router", title: "Router", description: "Route table and app-level navigation shell." },
  { value: "stack", title: "Stack", description: "Simple screen stack for mobile flows." },
  { value: "scene-flow", title: "Scene flow", description: "Unity scene-oriented flow control." }
] as const;

const modules = [
  { key: "hasAuth", title: "Auth", description: "Feature/service/state scaffold for sign-in and token flow." },
  { key: "hasAnalytics", title: "Analytics", description: "Analytics service, event model and hook boundary." },
  { key: "hasLocalization", title: "Localization", description: "Resource/service skeleton for EN/UA text." },
  { key: "hasPush", title: "Push", description: "Provider placeholder and config boundary." },
  { key: "hasNetworking", title: "Networking", description: "Client, endpoints and error model skeleton." },
  { key: "hasPersistence", title: "Persistence", description: "Storage service, repository/cache facade." }
] as const;

function getStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  const value = localStorage.getItem(key) as T | null;
  return value && allowed.includes(value) ? value : fallback;
}

function formFingerprint(form: QuestionnaireAnswers): string {
  return JSON.stringify({
    ...form,
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
  const [form, setForm] = useState<QuestionnaireAnswers>(initialForm);
  const [preview, setPreview] = useState<ArchitecturePreviewResponse | null>(null);
  const [previewFingerprint, setPreviewFingerprint] = useState<string | null>(null);
  const [generation, setGeneration] = useState<GenerationResponse | null>(null);
  const [generations, setGenerations] = useState<GenerationMetadata[]>([]);
  const [providers, setProviders] = useState<AIProviderStatusSummary[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingZip, setLoadingZip] = useState(false);
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
    setForm((current) => ({
      ...current,
      [key]: value
    }));
    setGeneration(null);
  }

  function updateMode(mode: GenerationMode) {
    setForm((current) => ({
      ...current,
      generationMode: mode,
      includeLLMNotes: mode !== "baseline"
    }));
    setGeneration(null);
  }

  function payload(): QuestionnaireAnswers {
    const mode = form.generationMode ?? "baseline";
    return {
      ...form,
      generationMode: mode,
      includeLLMNotes: mode !== "baseline"
    };
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
      setPreview(result);
      setPreviewFingerprint(formFingerprint(request));
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
      setGenerations(await listGenerations());
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
          <div className="mini-hero">
            <span className="kicker">{t.lab}</span>
            <p>{t.intro}</p>
          </div>
          <nav className="step-list" aria-label="Flow steps">
            {steps.map((step, index) => (
              <button className={`step-button ${stepState(step.id)}`} key={step.id} type="button" onClick={() => setActiveStep(step.id)}>
                <b>{index + 1}</b>
                <span>{t[step.labelKey]}</span>
              </button>
            ))}
          </nav>
          <button className="ghost-button demo-button" type="button" onClick={() => {
            setForm(initialForm);
            setError(null);
          }}>{t.demo}</button>
        </aside>

        <section className="workspace-panel">
          {error ? <div className="error-banner">{error}</div> : null}
          {previewOutdated ? <div className="warning-banner">{t.previewOutdated}</div> : null}

          {activeStep === "platform" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">01</span><h1>{t.platform}</h1></div></div>
              <div className="option-grid four">
                {platformOptions.map((option) => (
                  <OptionCard
                    key={option.id}
                    active={form.profile === option.id}
                    title={option.title}
                    description={option.description}
                    onClick={() => updateForm("profile", option.id)}
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
                      title={option.title}
                      badge={option.badge}
                      description={option.description}
                      meta={status ? `${status.status}${status.model ? ` · ${status.model}` : ""}` : t.modeReady}
                      onClick={() => updateMode(option.id)}
                    />
                  );
                })}
              </div>
              {activeProvider ? <p className="quiet-note">Provider: {activeProvider.provider} · {activeProvider.status}{activeProvider.model ? ` · ${activeProvider.model}` : ""}</p> : null}
            </div>
          ) : null}

          {activeStep === "architecture" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">04</span><h1>{t.architecture}</h1></div></div>
              <h3>Architecture style</h3>
              <div className="option-grid four compact">
                {architectureOptions.map((option) => (
                  <OptionCard key={option.value} active={form.architectureStyle === option.value} title={option.title} description={option.description} onClick={() => updateForm("architectureStyle", option.value)} />
                ))}
              </div>
              <h3>State management</h3>
              <div className="option-grid five compact">
                {stateOptions.map((option) => (
                  <OptionCard key={option.value} active={form.stateManagement === option.value} title={option.title} description={option.description} onClick={() => updateForm("stateManagement", option.value)} />
                ))}
              </div>
              <h3>Navigation</h3>
              <div className="option-grid four compact">
                {navOptions.map((option) => (
                  <OptionCard key={option.value} active={form.navigationStyle === option.value} title={option.title} description={option.description} onClick={() => updateForm("navigationStyle", option.value)} />
                ))}
              </div>
              <h3>Environment</h3>
              <div className="option-grid two compact">
                <OptionCard active={form.environmentMode === "single"} title="Single" description="One environment config for first prototype runs." onClick={() => updateForm("environmentMode", "single")} />
                <OptionCard active={form.environmentMode === "multi"} title="Dev / Stage / Prod" description="Separate config boundaries for real deployment paths." onClick={() => updateForm("environmentMode", "multi")} />
              </div>
            </div>
          ) : null}

          {activeStep === "modules" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">05</span><h1>{t.modules}</h1></div></div>
              <div className="module-grid">
                {modules.map((module) => (
                  <button
                    className={form[module.key] ? "module-card active" : "module-card"}
                    key={module.key}
                    type="button"
                    onClick={() => updateForm(module.key, !form[module.key])}
                  >
                    <span><strong>{module.title}</strong><i>{form[module.key] ? "on" : "off"}</i></span>
                    <small>{module.description}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {activeStep === "extras" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">06</span><h1>{t.extras}</h1></div></div>
              <div className="option-grid two">
                <OptionCard active={Boolean(form.includeExampleScreen)} title="Example screen" description="Adds visible starter screen/home flow files to the generated tree." onClick={() => updateForm("includeExampleScreen", !form.includeExampleScreen)} />
                <OptionCard active={activeMode !== "baseline"} title="Advisor artifacts" description="Automatic for GPT, Qwen and Hybrid. Baseline still gets deterministic explanation in preview." onClick={() => undefined} />
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
                      copied: "Copied",
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
                      <span><small>Artifacts</small><strong>{shown.manifest.summary.totalArtifacts}</strong></span>
                      <span><small>Docs</small><strong>{countKind(shownArtifacts, "documentation")}</strong></span>
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
                  <p>{generation.profile.profile} · {generation.profile.generationMode} · {generation.runMetrics?.fileCount ?? fileCount} files · validation {generation.runMetrics?.validationStatus ?? "passed"}</p>
                  <a className="primary-link" href={downloadUrlForGeneration(generation.generationId)}>{t.downloadZip}</a>
                </div>
              ) : (
                <div className="empty-state">{preview ? t.createZip : t.noPreview}</div>
              )}
            </div>
          ) : null}

          {activeStep === "history" ? (
            <div className="step-panel">
              <div className="section-head"><div><span className="kicker">09</span><h1>{t.history}</h1></div></div>
              <div className="filters-row">
                <select value={historyPlatform} onChange={(event) => setHistoryPlatform(event.target.value)}>
                  <option value="all">All platforms</option>
                  {platformOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
                <select value={historyMode} onChange={(event) => setHistoryMode(event.target.value)}>
                  <option value="all">All modes</option>
                  {modeOptions.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
                <select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}>
                  <option value="all">All statuses</option>
                  <option value="completed">completed</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div className="history-grid">
                {filteredGenerations.slice(0, 12).map((item) => (
                  <article className={compareSelection.includes(item.id) ? "history-card selected" : "history-card"} key={item.id}>
                    <div>
                      <strong>{item.projectName} · {item.generationMode ?? "baseline"} · {item.profile}</strong>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                    <div className="history-actions">
                      <button className="ghost-button" type="button" onClick={() => void loadDetails(item.id)}>Details</button>
                      <button className="ghost-button" type="button" onClick={() => toggleCompare(item.id)}>Compare</button>
                      <a href={downloadUrlForGeneration(item.id)}>ZIP</a>
                    </div>
                  </article>
                ))}
              </div>
              <RunDetailsPanel details={selectedDetails} loading={detailsLoading} error={detailsError} labels={{
                empty: t.selectRun,
                loading: "Loading...",
                title: t.runDetails,
                summary: "Summary",
                modules: t.selectedModules,
                metrics: "Metrics",
                advanced: "Advanced"
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
                loading: "Comparing...",
                title: t.compare,
                strongest: "Most complete"
              }} />
            </div>
          ) : null}
        </section>
      </main>

      <div className="floating-actions">
        <button className="secondary-button" type="button" disabled={!requiredValid || loadingPreview} onClick={() => void generateTree()}>
          {loadingPreview ? t.generatingTree : t.generateTree}
        </button>
        <button className="primary-button" type="button" disabled={!preview || previewOutdated || loadingZip} onClick={() => void createZip()}>
          {loadingZip ? t.creatingZip : t.createZip}
        </button>
      </div>
    </div>
  );
}

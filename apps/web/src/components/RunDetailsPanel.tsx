import type { GenerationRunDetails } from "@mag/shared";

interface RunDetailsPanelProps {
  details: GenerationRunDetails | null;
  loading: boolean;
  error: string | null;
  language?: "ua" | "en";
  labels?: {
    empty: string;
    loading: string;
    title: string;
    summary: string;
    modules: string;
    metrics: string;
    advanced: string;
    platform?: string;
    mode?: string;
    provider?: string;
    created?: string;
    architecture?: string;
    state?: string;
    navigation?: string;
    zip?: string;
    ready?: string;
    missing?: string;
    files?: string;
    artifacts?: string;
    warnings?: string;
    validation?: string;
    advisorTitle?: string;
    advisorRationale?: string;
    advisorModules?: string;
    advisorMode?: string;
    advisorTradeoffs?: string;
    advisorChecks?: string;
    relationshipEdges?: string;
  };
}

function formatMs(value?: number): string {
  if (typeof value !== "number") return "-";
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(1)} s`;
}

function formatDate(value?: string, language: "ua" | "en" = "en"): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString(language === "ua" ? "uk-UA" : "en-GB", {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })} UTC+3`;
}

export function RunDetailsPanel({ details, loading, error, language = "en", labels }: RunDetailsPanelProps) {
  const isUa = language === "ua";
  const text = {
    empty: isUa ? "Обери запуск, щоб переглянути деталі." : "Select a run to inspect it.",
    loading: isUa ? "Завантажуємо деталі запуску..." : "Loading run details...",
    title: "Run Details",
    summary: isUa ? "Підсумок" : "Summary",
    modules: isUa ? "Обрані модулі" : "Selected modules",
    metrics: isUa ? "Метрики" : "Metrics",
    advanced: isUa ? "Розширені metadata" : "Advanced metadata",
    platform: isUa ? "Платформа" : "Platform",
    mode: isUa ? "Режим" : "Mode",
    provider: isUa ? "Провайдер" : "Provider",
    created: isUa ? "Створено" : "Created",
    architecture: isUa ? "Архітектура" : "Architecture",
    state: "State",
    navigation: isUa ? "Навігація" : "Navigation",
    zip: "ZIP",
    ready: isUa ? "готовий" : "ready",
    missing: isUa ? "відсутній" : "missing",
    files: isUa ? "файлів" : "files",
    artifacts: isUa ? "блоків плану" : "plan blocks",
    warnings: isUa ? "попереджень" : "warnings",
    validation: isUa ? "перевірка" : "validation",
    advisorTitle: isUa ? "Пояснення advisor-а" : "Advisor explanation",
    advisorRationale: isUa ? "Архітектурне рішення" : "Architecture rationale",
    advisorModules: isUa ? "Вплив модулів" : "Module impact",
    advisorMode: isUa ? "Роль режиму генерації" : "Generation mode impact",
    advisorTradeoffs: isUa ? "Компроміси" : "Trade-offs",
    advisorChecks: isUa ? "Наступні перевірки" : "Next checks",
    relationshipEdges: isUa ? "Зв’язки" : "Relations",
    ...labels
  };

  if (loading) return <div className="empty-state">{text.loading}</div>;
  if (error) return <div className="empty-state error-muted">{error}</div>;
  if (!details) return text.empty ? <div className="empty-state">{text.empty}</div> : null;

  const metrics = details.metrics;
  const spec = details.spec;
  const modules = spec?.modules.filter((module) => module.enabled).map((module) => module.featureId) ?? [];
  const validationStatus = details.validationV2?.postMaterialization?.status ?? details.validationV2?.preMaterialization?.status ?? details.validation?.status ?? "-";
  const mode = details.metadata.generationMode ?? "baseline";
  const provider = details.architectureSynthesis?.usedAi
    ? `${details.architectureSynthesis.provider}${details.architectureSynthesis.model ? ` · ${details.architectureSynthesis.model}` : ""}`
    : "deterministic";
  const fileCount = metrics?.fileCount ?? details.metadata.fileTree?.filter((node) => node.type === "file").length ?? "-";
  const relationCount = details.relationshipGraph?.summary?.edges ?? details.artifacts.filter((artifact) => artifact.path.includes("relationship")).length;
  const humanSummary = isUa
    ? `${details.metadata.projectName} · ${mode} · ${details.metadata.profile} · ${fileCount} ${text.files} · ${text.validation}: ${validationStatus}.`
    : `${details.metadata.projectName} · ${mode} · ${details.metadata.profile} · ${fileCount} ${text.files} · ${text.validation}: ${validationStatus}.`;
  const modulePreview = modules.slice(0, 8).join(", ") || "core";
  const advisorBlocks = [
    {
      title: text.advisorRationale,
      body: details.advisor?.summary
        ?? (isUa
          ? `${details.metadata.profile} starter побудовано навколо ${spec?.architecture.style ?? "обраної"} архітектури, State ${spec?.architecture.stateManagement ?? "default"} і навігації ${spec?.architecture.navigationStyle ?? "default"}.`
          : `${details.metadata.profile} starter uses ${spec?.architecture.style ?? "selected"} architecture with ${spec?.architecture.stateManagement ?? "default"} state and ${spec?.architecture.navigationStyle ?? "default"} navigation.`)
    },
    {
      title: text.advisorModules,
      body: isUa
        ? `Увімкнені модулі (${modulePreview}) представлені service/state/resource/integration boundaries, а не одиночними placeholder-файлами.`
        : `Enabled modules (${modulePreview}) are represented as service, state, resource and integration boundaries instead of isolated placeholder files.`
    },
    {
      title: text.advisorMode,
      body: details.architectureSynthesis?.usedAi
        ? (isUa
          ? `${mode} використав ${provider}, щоб сформувати ArchitectureSpec; ZIP створив deterministic materializer зі збереженого snapshot.`
          : `${mode} used ${provider} to shape the ArchitectureSpec; the deterministic materializer produced the ZIP from that stored snapshot.`)
        : (isUa
          ? "Baseline тримає ArchitectureSpec повністю deterministic і використовує advisor для пояснення рішень."
          : "Baseline keeps the ArchitectureSpec fully deterministic and uses advisor output for explanation.")
    },
    {
      title: text.advisorTradeoffs,
      body: isUa
        ? "Це starter-архітектура: вона робить межі, wiring і зв’язки файлів явними, але не замінює production-ready бізнес-логіку."
        : "This is a starter architecture: it makes boundaries, wiring and file relationships explicit, but does not replace production-ready business logic."
    },
    {
      title: text.advisorChecks,
      body: isUa
        ? `Наступні перевірки: platform setup, реальні endpoints, warnings (${metrics?.warningCount ?? 0}) і relationship graph (${relationCount}) перед реалізацією.`
        : `Next checks: validate platform setup, connect real endpoints, review warnings (${metrics?.warningCount ?? 0}) and inspect the relationship graph (${relationCount}) before implementation.`
    }
  ];

  return (
    <div className="run-details-panel redesigned-panel">
      <div className="section-head">
        <div>
          <span className="kicker">{text.title}</span>
          <h2>{details.metadata.projectName} · {mode} · {details.metadata.profile}</h2>
        </div>
        <span className="status-pill">{details.metadata.status}</span>
      </div>

      <p className="human-summary">{humanSummary}</p>

      <div className="detail-grid">
        <span><small>{text.platform}</small><strong>{details.metadata.profile}</strong></span>
        <span><small>{text.mode}</small><strong>{mode}</strong></span>
        <span><small>{text.provider}</small><strong>{provider}</strong></span>
        <span><small>{text.created}</small><strong>{formatDate(details.metadata.createdAt, language)}</strong></span>
        <span><small>{text.architecture}</small><strong>{spec?.architecture.style ?? "-"}</strong></span>
        <span><small>{text.state}</small><strong>{spec?.architecture.stateManagement ?? "-"}</strong></span>
        <span><small>{text.navigation}</small><strong>{spec?.architecture.navigationStyle ?? "-"}</strong></span>
        <span><small>{text.zip}</small><strong>{details.metadata.zipPath ? text.ready : text.missing}</strong></span>
      </div>

      <div className="metric-bars">
        <div><span>{metrics?.fileCount ?? 0} {text.files}</span><i style={{ width: `${Math.min(100, ((metrics?.fileCount ?? 0) / 260) * 100)}%` }} /></div>
        <div><span>{metrics?.artifactCount ?? 0} {text.artifacts}</span><i style={{ width: `${Math.min(100, ((metrics?.artifactCount ?? 0) / 90) * 100)}%` }} /></div>
        <div><span>{relationCount} {text.relationshipEdges}</span><i style={{ width: `${Math.min(100, (relationCount / 520) * 100)}%` }} /></div>
        <div><span>{metrics?.warningCount ?? 0} {text.warnings}</span><i className="warn-bar" style={{ width: `${Math.min(100, ((metrics?.warningCount ?? 0) / 12) * 100)}%` }} /></div>
        <div><span>{formatMs(metrics?.generationTimeMs)}</span><i style={{ width: `${Math.min(100, ((metrics?.generationTimeMs ?? 0) / 20000) * 100)}%` }} /></div>
      </div>

      {modules.length > 0 ? (
        <div>
          <h3>{text.modules}</h3>
          <div className="chip-row">
            {modules.map((module) => <span className="chip" key={module}>{module}</span>)}
          </div>
        </div>
      ) : null}

      <div className="advisor-summary-card run-advisor-card">
        <h3>{text.advisorTitle}</h3>
        <div className="advisor-grid">
          {advisorBlocks.map((block) => (
            <article key={block.title}>
              <strong>{block.title}</strong>
              <p>{block.body}</p>
            </article>
          ))}
        </div>
      </div>

      <details className="advanced-details">
        <summary>{text.advanced}</summary>
        <pre>{JSON.stringify({
          synthesis: details.architectureSynthesis,
          validation: details.validationV2,
          relationshipGraph: details.relationshipGraph?.summary,
          metrics,
          advisorStatus: details.advisor?.status,
          hybrid: details.hybridRefinement
        }, null, 2)}</pre>
      </details>
    </div>
  );
}

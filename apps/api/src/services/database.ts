import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  compareGenerationRunDetails,
  type ArchitectureAdvisorReport,
  type ArchitectureSpec,
  type ArchitectureSynthesisSummary,
  type ArtifactManifest,
  type GenerationMetadata,
  type GenerationRunDetails,
  type FileRelationshipGraph,
  type HybridRefinementReport,
  type QuestionnaireAnswerSet,
  type RunArtifactRecord,
  type RunComparison,
  type RunMetrics,
  type ValidationV2Report,
  type ValidationReport
} from "@mag/shared";
import { env } from "../env.js";

const dbDirectory = path.dirname(env.DATABASE_PATH);
if (dbDirectory && dbDirectory !== ".") {
  fs.mkdirSync(dbDirectory, { recursive: true });
}

const db = new Database(env.DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    profile TEXT NOT NULL,
    generationMode TEXT,
    projectName TEXT NOT NULL,
    status TEXT NOT NULL,
    zipPath TEXT,
    outputDir TEXT,
    fileTreeJson TEXT,
    answersJson TEXT,
    profileJson TEXT,
    planJson TEXT,
    specJson TEXT,
    manifestJson TEXT,
    validationJson TEXT,
    validationV2Json TEXT,
    advisorJson TEXT,
    metricsJson TEXT,
    generatorLogPath TEXT,
    diagnosticsPath TEXT,
    errorMessage TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS run_artifacts (
    runId TEXT NOT NULL,
    path TEXT NOT NULL,
    kind TEXT NOT NULL,
    required INTEGER NOT NULL DEFAULT 0,
    generated INTEGER NOT NULL DEFAULT 0,
    sizeBytes INTEGER,
    hash TEXT,
    description TEXT,
    PRIMARY KEY (runId, path)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS architecture_previews (
    id TEXT PRIMARY KEY,
    answersJson TEXT NOT NULL,
    profileJson TEXT NOT NULL,
    planJson TEXT NOT NULL,
    specJson TEXT NOT NULL,
    manifestJson TEXT NOT NULL,
    validationJson TEXT NOT NULL,
    validationV2Json TEXT,
    fileTreeJson TEXT NOT NULL,
    artifactsJson TEXT,
    notesJson TEXT,
    architectureSynthesisJson TEXT,
    advisorJson TEXT,
    hybridRefinementJson TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function ensureColumn(table: string, column: string, type: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!existing.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}

ensureColumn("generations", "generationMode", "TEXT");
ensureColumn("generations", "answersJson", "TEXT");
ensureColumn("generations", "specJson", "TEXT");
ensureColumn("generations", "manifestJson", "TEXT");
ensureColumn("generations", "validationJson", "TEXT");
ensureColumn("generations", "validationV2Json", "TEXT");
ensureColumn("generations", "architectureSynthesisJson", "TEXT");
ensureColumn("generations", "advisorJson", "TEXT");
ensureColumn("generations", "hybridRefinementJson", "TEXT");
ensureColumn("generations", "metricsJson", "TEXT");
ensureColumn("generations", "generatorLogPath", "TEXT");
ensureColumn("generations", "diagnosticsPath", "TEXT");
ensureColumn("generations", "errorMessage", "TEXT");
ensureColumn("architecture_previews", "previewDurationMs", "INTEGER");

const insertStatement = db.prepare(`
  INSERT INTO generations (
    id, profile, generationMode, projectName, status, zipPath, outputDir, fileTreeJson, profileJson,
    answersJson, planJson, specJson, manifestJson, validationJson, validationV2Json, architectureSynthesisJson, advisorJson, hybridRefinementJson, metricsJson, generatorLogPath, diagnosticsPath, errorMessage
  ) VALUES (
    @id, @profile, @generationMode, @projectName, @status, @zipPath, @outputDir, @fileTreeJson, @profileJson,
    @answersJson, @planJson, @specJson, @manifestJson, @validationJson, @validationV2Json, @architectureSynthesisJson, @advisorJson, @hybridRefinementJson, @metricsJson, @generatorLogPath, @diagnosticsPath, @errorMessage
  )
  ON CONFLICT(id) DO UPDATE SET
    profile = excluded.profile,
    generationMode = excluded.generationMode,
    projectName = excluded.projectName,
    status = excluded.status,
    zipPath = excluded.zipPath,
    outputDir = excluded.outputDir,
    fileTreeJson = excluded.fileTreeJson,
    profileJson = excluded.profileJson,
    answersJson = excluded.answersJson,
    planJson = excluded.planJson,
    specJson = excluded.specJson,
    manifestJson = excluded.manifestJson,
    validationJson = excluded.validationJson,
    validationV2Json = excluded.validationV2Json,
    architectureSynthesisJson = excluded.architectureSynthesisJson,
    advisorJson = excluded.advisorJson,
    hybridRefinementJson = excluded.hybridRefinementJson,
    metricsJson = excluded.metricsJson,
    generatorLogPath = excluded.generatorLogPath,
    diagnosticsPath = excluded.diagnosticsPath,
    errorMessage = excluded.errorMessage
`);

const deleteArtifactsStatement = db.prepare("DELETE FROM run_artifacts WHERE runId = ?");
const deleteGenerationStatement = db.prepare("DELETE FROM generations WHERE id = ?");
const deleteAllArtifactsStatement = db.prepare("DELETE FROM run_artifacts");
const deleteAllGenerationsStatement = db.prepare("DELETE FROM generations");
const insertArtifactStatement = db.prepare(`
  INSERT INTO run_artifacts (
    runId, path, kind, required, generated, sizeBytes, hash, description
  ) VALUES (
    @runId, @path, @kind, @required, @generated, @sizeBytes, @hash, @description
  )
`);

export interface ArchitecturePreviewSnapshotRecord {
  id: string;
  answersJson: string;
  profileJson: string;
  planJson: string;
  specJson: string;
  manifestJson: string;
  validationJson: string;
  validationV2Json?: string;
  fileTreeJson: string;
  artifactsJson?: string;
  notesJson?: string;
  architectureSynthesisJson?: string;
  advisorJson?: string;
  hybridRefinementJson?: string;
  previewDurationMs?: number;
  createdAt?: string;
}

const insertPreviewStatement = db.prepare(`
  INSERT INTO architecture_previews (
    id, answersJson, profileJson, planJson, specJson, manifestJson, validationJson, validationV2Json,
    fileTreeJson, artifactsJson, notesJson, architectureSynthesisJson, advisorJson, hybridRefinementJson, previewDurationMs, createdAt
  ) VALUES (
    @id, @answersJson, @profileJson, @planJson, @specJson, @manifestJson, @validationJson, @validationV2Json,
    @fileTreeJson, @artifactsJson, @notesJson, @architectureSynthesisJson, @advisorJson, @hybridRefinementJson, @previewDurationMs, @createdAt
  )
  ON CONFLICT(id) DO UPDATE SET
    answersJson = excluded.answersJson,
    profileJson = excluded.profileJson,
    planJson = excluded.planJson,
    specJson = excluded.specJson,
    manifestJson = excluded.manifestJson,
    validationJson = excluded.validationJson,
    validationV2Json = excluded.validationV2Json,
    fileTreeJson = excluded.fileTreeJson,
    artifactsJson = excluded.artifactsJson,
    notesJson = excluded.notesJson,
    architectureSynthesisJson = excluded.architectureSynthesisJson,
    advisorJson = excluded.advisorJson,
    hybridRefinementJson = excluded.hybridRefinementJson,
    previewDurationMs = excluded.previewDurationMs,
    createdAt = excluded.createdAt
`);

function parseJson<T>(value: unknown): T | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return undefined;
  }
}

function parseValidation(value: unknown): ValidationReport | undefined {
  const parsed = parseJson<{ manifest?: ValidationReport } | ValidationReport>(value);
  if (!parsed) {
    return undefined;
  }
  if ("manifest" in parsed && parsed.manifest) {
    return parsed.manifest;
  }
  return parsed as ValidationReport;
}

function readRelationshipGraph(metadata: GenerationMetadata, manifest?: ArtifactManifest): FileRelationshipGraph | undefined {
  if (!metadata.outputDir || !manifest?.rootFolderName) {
    return undefined;
  }
  const graphPath = path.join(metadata.outputDir, manifest.rootFolderName, "architecture", "file-relationships.graph.json");
  if (!fs.existsSync(graphPath)) {
    return undefined;
  }
  try {
    return JSON.parse(fs.readFileSync(graphPath, "utf8")) as FileRelationshipGraph;
  } catch {
    return undefined;
  }
}

function mapRow(row: Record<string, unknown>): GenerationMetadata {
  return {
    id: String(row.id),
    profile: String(row.profile) as GenerationMetadata["profile"],
    generationMode: row.generationMode ? (String(row.generationMode) as GenerationMetadata["generationMode"]) : undefined,
    projectName: String(row.projectName),
    status: String(row.status) as GenerationMetadata["status"],
    zipPath: row.zipPath ? String(row.zipPath) : undefined,
    outputDir: row.outputDir ? String(row.outputDir) : undefined,
    fileTree: parseJson(row.fileTreeJson),
    createdAt: String(row.createdAt),
    answersJson: row.answersJson ? String(row.answersJson) : undefined,
    profileJson: row.profileJson ? String(row.profileJson) : undefined,
    planJson: row.planJson ? String(row.planJson) : undefined,
    specJson: row.specJson ? String(row.specJson) : undefined,
    manifestJson: row.manifestJson ? String(row.manifestJson) : undefined,
    validationJson: row.validationJson ? String(row.validationJson) : undefined,
    validationV2Json: row.validationV2Json ? String(row.validationV2Json) : undefined,
    architectureSynthesisJson: row.architectureSynthesisJson ? String(row.architectureSynthesisJson) : undefined,
    advisorJson: row.advisorJson ? String(row.advisorJson) : undefined,
    hybridRefinementJson: row.hybridRefinementJson ? String(row.hybridRefinementJson) : undefined,
    metricsJson: row.metricsJson ? String(row.metricsJson) : undefined,
    generatorLogPath: row.generatorLogPath ? String(row.generatorLogPath) : undefined,
    diagnosticsPath: row.diagnosticsPath ? String(row.diagnosticsPath) : undefined,
    errorMessage: row.errorMessage ? String(row.errorMessage) : undefined
  };
}

function mapArtifactRow(row: Record<string, unknown>): RunArtifactRecord {
  return {
    runId: String(row.runId),
    path: String(row.path),
    kind: String(row.kind) as RunArtifactRecord["kind"],
    required: Boolean(row.required),
    generated: Boolean(row.generated),
    sizeBytes: row.sizeBytes === null || row.sizeBytes === undefined ? undefined : Number(row.sizeBytes),
    hash: row.hash ? String(row.hash) : undefined,
    description: row.description ? String(row.description) : undefined
  };
}

function artifactsByRunId(id: string): RunArtifactRecord[] {
  const rows = db.prepare("SELECT * FROM run_artifacts WHERE runId = ? ORDER BY path ASC").all(id) as Record<string, unknown>[];
  return rows.map(mapArtifactRow);
}

function buildDetails(metadata: GenerationMetadata): GenerationRunDetails {
  const manifest = parseJson<ArtifactManifest>(metadata.manifestJson);
  return {
    metadata,
    input: parseJson<QuestionnaireAnswerSet>(metadata.answersJson),
    spec: parseJson<ArchitectureSpec>(metadata.specJson),
    manifest,
    validation: parseValidation(metadata.validationJson),
    validationV2: parseJson<{ preMaterialization?: ValidationV2Report; postMaterialization?: ValidationV2Report }>(metadata.validationV2Json) as GenerationRunDetails["validationV2"],
    architectureSynthesis: parseJson<ArchitectureSynthesisSummary>(metadata.architectureSynthesisJson),
    advisor: parseJson<ArchitectureAdvisorReport>(metadata.advisorJson),
    hybridRefinement: parseJson<HybridRefinementReport>(metadata.hybridRefinementJson),
    metrics: parseJson<RunMetrics>(metadata.metricsJson),
    artifacts: artifactsByRunId(metadata.id),
    relationshipGraph: readRelationshipGraph(metadata, manifest)
  };
}

const saveTransaction = db.transaction((metadata: GenerationMetadata, artifacts: RunArtifactRecord[]) => {
  insertStatement.run({
    id: metadata.id,
    profile: metadata.profile,
    generationMode: metadata.generationMode ?? null,
    projectName: metadata.projectName,
    status: metadata.status,
    zipPath: metadata.zipPath ?? null,
    outputDir: metadata.outputDir ?? null,
    fileTreeJson: metadata.fileTree ? JSON.stringify(metadata.fileTree) : null,
    profileJson: metadata.profileJson ?? null,
    answersJson: metadata.answersJson ?? null,
    planJson: metadata.planJson ?? null,
    specJson: metadata.specJson ?? null,
    manifestJson: metadata.manifestJson ?? null,
    validationJson: metadata.validationJson ?? null,
    validationV2Json: metadata.validationV2Json ?? null,
    architectureSynthesisJson: metadata.architectureSynthesisJson ?? null,
    advisorJson: metadata.advisorJson ?? null,
    hybridRefinementJson: metadata.hybridRefinementJson ?? null,
    metricsJson: metadata.metricsJson ?? null,
    generatorLogPath: metadata.generatorLogPath ?? null,
    diagnosticsPath: metadata.diagnosticsPath ?? null,
    errorMessage: metadata.errorMessage ?? null
  });

  deleteArtifactsStatement.run(metadata.id);
  for (const artifact of artifacts) {
    insertArtifactStatement.run({
      runId: artifact.runId,
      path: artifact.path,
      kind: artifact.kind,
      required: artifact.required ? 1 : 0,
      generated: artifact.generated ? 1 : 0,
      sizeBytes: artifact.sizeBytes ?? null,
      hash: artifact.hash ?? null,
      description: artifact.description ?? null
    });
  }
});

const deleteByIdTransaction = db.transaction((id: string): GenerationMetadata | null => {
  const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }
  const metadata = mapRow(row);
  deleteArtifactsStatement.run(id);
  deleteGenerationStatement.run(id);
  return metadata;
});

const clearTransaction = db.transaction((): GenerationMetadata[] => {
  const rows = db.prepare("SELECT * FROM generations").all() as Record<string, unknown>[];
  const metadata = rows.map(mapRow);
  deleteAllArtifactsStatement.run();
  deleteAllGenerationsStatement.run();
  return metadata;
});

export const generationRepository = {
  save(metadata: GenerationMetadata, artifacts: RunArtifactRecord[] = []): void {
    saveTransaction(metadata, artifacts);
  },
  getById(id: string): GenerationMetadata | null {
    const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },
  getDetailsById(id: string): GenerationRunDetails | null {
    const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    const metadata = row ? mapRow(row) : null;
    return metadata ? buildDetails(metadata) : null;
  },
  compare(ids: string[]): RunComparison {
    const details = ids.map((id) => this.getDetailsById(id)).filter((item): item is GenerationRunDetails => Boolean(item));
    return compareGenerationRunDetails(details);
  },
  list(limit = 20): GenerationMetadata[] {
    const rows = db.prepare("SELECT * FROM generations ORDER BY createdAt DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map(mapRow);
  },
  deleteById(id: string): GenerationMetadata | null {
    return deleteByIdTransaction(id);
  },
  clear(): GenerationMetadata[] {
    return clearTransaction();
  },
  savePreview(snapshot: ArchitecturePreviewSnapshotRecord): void {
    insertPreviewStatement.run({
      id: snapshot.id,
      answersJson: snapshot.answersJson,
      profileJson: snapshot.profileJson,
      planJson: snapshot.planJson,
      specJson: snapshot.specJson,
      manifestJson: snapshot.manifestJson,
      validationJson: snapshot.validationJson,
      validationV2Json: snapshot.validationV2Json ?? null,
      fileTreeJson: snapshot.fileTreeJson,
      artifactsJson: snapshot.artifactsJson ?? null,
      notesJson: snapshot.notesJson ?? null,
      architectureSynthesisJson: snapshot.architectureSynthesisJson ?? null,
      advisorJson: snapshot.advisorJson ?? null,
      hybridRefinementJson: snapshot.hybridRefinementJson ?? null,
      previewDurationMs: typeof snapshot.previewDurationMs === "number" ? Math.max(0, Math.round(snapshot.previewDurationMs)) : null,
      createdAt: snapshot.createdAt ?? new Date().toISOString()
    });
  },
  getPreviewById(id: string): ArchitecturePreviewSnapshotRecord | null {
    const row = db.prepare("SELECT * FROM architecture_previews WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!row) {
      return null;
    }
    return {
      id: String(row.id),
      answersJson: String(row.answersJson),
      profileJson: String(row.profileJson),
      planJson: String(row.planJson),
      specJson: String(row.specJson),
      manifestJson: String(row.manifestJson),
      validationJson: String(row.validationJson),
      validationV2Json: row.validationV2Json ? String(row.validationV2Json) : undefined,
      fileTreeJson: String(row.fileTreeJson),
      artifactsJson: row.artifactsJson ? String(row.artifactsJson) : undefined,
      notesJson: row.notesJson ? String(row.notesJson) : undefined,
      architectureSynthesisJson: row.architectureSynthesisJson ? String(row.architectureSynthesisJson) : undefined,
      advisorJson: row.advisorJson ? String(row.advisorJson) : undefined,
      hybridRefinementJson: row.hybridRefinementJson ? String(row.hybridRefinementJson) : undefined,
      previewDurationMs: typeof row.previewDurationMs === "number" ? row.previewDurationMs : row.previewDurationMs ? Number(row.previewDurationMs) : undefined,
      createdAt: row.createdAt ? String(row.createdAt) : undefined
    };
  }
};

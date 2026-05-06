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
const insertArtifactStatement = db.prepare(`
  INSERT INTO run_artifacts (
    runId, path, kind, required, generated, sizeBytes, hash, description
  ) VALUES (
    @runId, @path, @kind, @required, @generated, @sizeBytes, @hash, @description
  )
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
  return {
    metadata,
    input: parseJson<QuestionnaireAnswerSet>(metadata.answersJson),
    spec: parseJson<ArchitectureSpec>(metadata.specJson),
    manifest: parseJson<ArtifactManifest>(metadata.manifestJson),
    validation: parseValidation(metadata.validationJson),
    validationV2: parseJson<{ preMaterialization?: ValidationV2Report; postMaterialization?: ValidationV2Report }>(metadata.validationV2Json) as GenerationRunDetails["validationV2"],
    architectureSynthesis: parseJson<ArchitectureSynthesisSummary>(metadata.architectureSynthesisJson),
    advisor: parseJson<ArchitectureAdvisorReport>(metadata.advisorJson),
    hybridRefinement: parseJson<HybridRefinementReport>(metadata.hybridRefinementJson),
    metrics: parseJson<RunMetrics>(metadata.metricsJson),
    artifacts: artifactsByRunId(metadata.id)
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
  }
};

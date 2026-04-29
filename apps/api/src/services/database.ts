import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { GenerationMetadata } from "@mag/shared";
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
    profileJson TEXT,
    planJson TEXT,
    specJson TEXT,
    manifestJson TEXT,
    validationJson TEXT,
    advisorJson TEXT,
    generatorLogPath TEXT,
    diagnosticsPath TEXT,
    errorMessage TEXT,
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
ensureColumn("generations", "specJson", "TEXT");
ensureColumn("generations", "manifestJson", "TEXT");
ensureColumn("generations", "validationJson", "TEXT");
ensureColumn("generations", "advisorJson", "TEXT");
ensureColumn("generations", "generatorLogPath", "TEXT");
ensureColumn("generations", "diagnosticsPath", "TEXT");
ensureColumn("generations", "errorMessage", "TEXT");

const insertStatement = db.prepare(`
  INSERT INTO generations (
    id, profile, generationMode, projectName, status, zipPath, outputDir, fileTreeJson, profileJson,
    planJson, specJson, manifestJson, validationJson, advisorJson, generatorLogPath, diagnosticsPath, errorMessage
  ) VALUES (
    @id, @profile, @generationMode, @projectName, @status, @zipPath, @outputDir, @fileTreeJson, @profileJson,
    @planJson, @specJson, @manifestJson, @validationJson, @advisorJson, @generatorLogPath, @diagnosticsPath, @errorMessage
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
    planJson = excluded.planJson,
    specJson = excluded.specJson,
    manifestJson = excluded.manifestJson,
    validationJson = excluded.validationJson,
    advisorJson = excluded.advisorJson,
    generatorLogPath = excluded.generatorLogPath,
    diagnosticsPath = excluded.diagnosticsPath,
    errorMessage = excluded.errorMessage
`);

function mapRow(row: Record<string, unknown>): GenerationMetadata {
  return {
    id: String(row.id),
    profile: String(row.profile) as GenerationMetadata["profile"],
    generationMode: row.generationMode ? (String(row.generationMode) as GenerationMetadata["generationMode"]) : undefined,
    projectName: String(row.projectName),
    status: String(row.status) as GenerationMetadata["status"],
    zipPath: row.zipPath ? String(row.zipPath) : undefined,
    outputDir: row.outputDir ? String(row.outputDir) : undefined,
    fileTree: row.fileTreeJson ? JSON.parse(String(row.fileTreeJson)) : undefined,
    createdAt: String(row.createdAt),
    profileJson: row.profileJson ? String(row.profileJson) : undefined,
    planJson: row.planJson ? String(row.planJson) : undefined,
    specJson: row.specJson ? String(row.specJson) : undefined,
    manifestJson: row.manifestJson ? String(row.manifestJson) : undefined,
    validationJson: row.validationJson ? String(row.validationJson) : undefined,
    advisorJson: row.advisorJson ? String(row.advisorJson) : undefined,
    generatorLogPath: row.generatorLogPath ? String(row.generatorLogPath) : undefined,
    diagnosticsPath: row.diagnosticsPath ? String(row.diagnosticsPath) : undefined,
    errorMessage: row.errorMessage ? String(row.errorMessage) : undefined
  };
}

export const generationRepository = {
  save(metadata: GenerationMetadata): void {
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
      planJson: metadata.planJson ?? null,
      specJson: metadata.specJson ?? null,
      manifestJson: metadata.manifestJson ?? null,
      validationJson: metadata.validationJson ?? null,
      advisorJson: metadata.advisorJson ?? null,
      generatorLogPath: metadata.generatorLogPath ?? null,
      diagnosticsPath: metadata.diagnosticsPath ?? null,
      errorMessage: metadata.errorMessage ?? null
    });
  },
  getById(id: string): GenerationMetadata | null {
    const row = db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    return row ? mapRow(row) : null;
  },
  list(limit = 20): GenerationMetadata[] {
    const rows = db.prepare("SELECT * FROM generations ORDER BY createdAt DESC LIMIT ?").all(limit) as Record<string, unknown>[];
    return rows.map(mapRow);
  }
};

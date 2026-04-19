import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { GenerationMetadata, GenerationMode, TreeNode } from "@mag/shared";
import { env } from "../env.js";

const dbFilePath = path.resolve(env.DATABASE_PATH);
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
const db = new Database(dbFilePath);

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

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
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

ensureColumn("generations", "generationMode", "TEXT");
ensureColumn("generations", "specJson", "TEXT");
ensureColumn("generations", "manifestJson", "TEXT");
ensureColumn("generations", "validationJson", "TEXT");

const insertStatement = db.prepare(`
  INSERT INTO generations (
    id, profile, generationMode, projectName, status, zipPath, outputDir, fileTreeJson, profileJson, planJson, specJson, manifestJson, validationJson
  ) VALUES (
    @id, @profile, @generationMode, @projectName, @status, @zipPath, @outputDir, @fileTreeJson, @profileJson, @planJson, @specJson, @manifestJson, @validationJson
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
    validationJson = excluded.validationJson
`);

function parseTree(value?: string | null): TreeNode[] | undefined {
  if (!value) {
    return undefined;
  }
  return JSON.parse(value) as TreeNode[];
}

function mapRow(row: Record<string, unknown>): GenerationMetadata {
  return {
    id: String(row.id),
    profile: row.profile as GenerationMetadata["profile"],
    generationMode: (row.generationMode as GenerationMode | null) ?? undefined,
    projectName: String(row.projectName),
    status: row.status as GenerationMetadata["status"],
    createdAt: String(row.createdAt),
    zipPath: row.zipPath ? String(row.zipPath) : undefined,
    outputDir: row.outputDir ? String(row.outputDir) : undefined,
    fileTree: parseTree(row.fileTreeJson as string | null),
    profileJson: row.profileJson ? String(row.profileJson) : undefined,
    planJson: row.planJson ? String(row.planJson) : undefined,
    specJson: row.specJson ? String(row.specJson) : undefined,
    manifestJson: row.manifestJson ? String(row.manifestJson) : undefined,
    validationJson: row.validationJson ? String(row.validationJson) : undefined
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
      validationJson: metadata.validationJson ?? null
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

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { GenerationMetadata, TreeNode } from "@mag/shared";

interface SaveGenerationInput {
  id: string;
  profile: string;
  projectName: string;
  status: "completed" | "failed";
  zipPath?: string;
  outputDir?: string;
  fileTree?: TreeNode[];
  profileJson?: string;
  planJson?: string;
}

export class GenerationRepository {
  private readonly db: Database.Database;

  constructor(filePath: string) {
    const absolute = path.resolve(process.cwd(), filePath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    this.db = new Database(absolute);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        profile TEXT NOT NULL,
        project_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        zip_path TEXT,
        output_dir TEXT,
        file_tree_json TEXT,
        profile_json TEXT,
        plan_json TEXT
      )
    `);
  }

  save(input: SaveGenerationInput): void {
    const stmt = this.db.prepare(`
      INSERT INTO generations (
        id, profile, project_name, status, created_at, zip_path, output_dir, file_tree_json, profile_json, plan_json
      ) VALUES (
        @id, @profile, @projectName, @status, @createdAt, @zipPath, @outputDir, @fileTreeJson, @profileJson, @planJson
      )
    `);

    stmt.run({
      ...input,
      createdAt: new Date().toISOString(),
      fileTreeJson: input.fileTree ? JSON.stringify(input.fileTree) : null
    });
  }

  list(): GenerationMetadata[] {
    const rows = this.db.prepare(`
      SELECT id, profile, project_name, status, created_at, zip_path, output_dir, file_tree_json, profile_json, plan_json
      FROM generations
      ORDER BY created_at DESC
      LIMIT 30
    `).all() as Array<Record<string, string | null>>;

    return rows.map((row) => ({
      id: row.id!,
      profile: row.profile as GenerationMetadata["profile"],
      projectName: row.project_name!,
      status: row.status as GenerationMetadata["status"],
      createdAt: row.created_at!,
      zipPath: row.zip_path ?? undefined,
      outputDir: row.output_dir ?? undefined,
      fileTree: row.file_tree_json ? JSON.parse(row.file_tree_json) : undefined,
      profileJson: row.profile_json ?? undefined,
      planJson: row.plan_json ?? undefined
    }));
  }

  getById(id: string): GenerationMetadata | undefined {
    const row = this.db.prepare(`
      SELECT id, profile, project_name, status, created_at, zip_path, output_dir, file_tree_json, profile_json, plan_json
      FROM generations
      WHERE id = ?
    `).get(id) as Record<string, string | null> | undefined;

    if (!row) return undefined;

    return {
      id: row.id!,
      profile: row.profile as GenerationMetadata["profile"],
      projectName: row.project_name!,
      status: row.status as GenerationMetadata["status"],
      createdAt: row.created_at!,
      zipPath: row.zip_path ?? undefined,
      outputDir: row.output_dir ?? undefined,
      fileTree: row.file_tree_json ? JSON.parse(row.file_tree_json) : undefined,
      profileJson: row.profile_json ?? undefined,
      planJson: row.plan_json ?? undefined
    };
  }
}

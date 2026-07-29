#!/usr/bin/env node

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const [source, target] = process.argv.slice(2);
if (!source || !target) {
  console.error("Usage: backup-sqlite.mjs SOURCE TARGET");
  process.exit(2);
}

if (!fs.existsSync(source)) {
  console.error(`SQLite database does not exist: ${source}`);
  process.exit(3);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const database = new Database(source, { readonly: true, fileMustExist: true });

try {
  await database.backup(target);
  console.log(target);
} finally {
  database.close();
}

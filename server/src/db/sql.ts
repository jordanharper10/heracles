import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { env } from '../env.js';

let SQL: any;
let db: any;

export async function getDb() {
  if (!SQL) SQL = await initSqlJs();      // loads wasm; pure JS
  if (!db) {
    if (fs.existsSync(env.DB_FILE)) {
      const buf = fs.readFileSync(env.DB_FILE);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }
  }
  return db;
}

export function saveDb() {
  const data = db.export();
  const buf = Buffer.from(data);
  fs.writeFileSync(path.resolve(env.DB_FILE), buf);
}

export function run(sql: string, params: any[] = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
}

export function all<T = any>(sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows as T[];
}

export function one<T = any>(sql: string, params: any[] = []): T | null {
  return all<T>(sql, params)[0] ?? null;
}


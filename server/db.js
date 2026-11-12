import { DatabaseSync } from 'node:sqlite';

export function openDb(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      level TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      equipment_name TEXT NOT NULL,
      message TEXT NOT NULL,
      acked_by TEXT,
      acked_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_ts ON events (ts DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_equipment ON events (equipment_id);
    CREATE INDEX IF NOT EXISTS idx_level ON events (level);
  `);
  return db;
}

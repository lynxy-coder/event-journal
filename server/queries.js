const DAY = 24 * 3600 * 1000;

export function buildWhere(f = {}) {
  const parts = [];
  const params = {};

  if (f.from) {
    parts.push('ts >= :from');
    params.from = Date.parse(f.from + 'T00:00:00');
  }
  if (f.to) {
    parts.push('ts < :to');
    params.to = Date.parse(f.to + 'T00:00:00') + DAY;
  }
  if (['info', 'warning', 'alarm'].includes(f.level)) {
    parts.push('level = :level');
    params.level = f.level;
  }
  if (f.equipment) {
    parts.push('equipment_id = :equipment');
    params.equipment = f.equipment;
  }
  if (f.q) {
    parts.push('message LIKE :q');
    params.q = '%' + f.q + '%';
  }
  if (f.acked === 'no') parts.push("level != 'info' AND acked_at IS NULL");
  if (f.acked === 'yes') parts.push('acked_at IS NOT NULL');

  return { sql: parts.length ? 'WHERE ' + parts.join(' AND ') : '', params };
}

export function countEvents(db, filters) {
  const { sql, params } = buildWhere(filters);
  return db.prepare('SELECT COUNT(*) AS n FROM events ' + sql).get(params).n;
}

export function listEvents(db, filters, offset = 0, limit = 100) {
  const { sql, params } = buildWhere(filters);
  const q = `SELECT * FROM events ${sql} ORDER BY ts DESC, id DESC LIMIT :limit OFFSET :offset`;
  return db.prepare(q).all({ ...params, limit, offset });
}

export function ackEvent(db, id, user) {
  const res = db
    .prepare("UPDATE events SET acked_by = ?, acked_at = ? WHERE id = ? AND level != 'info' AND acked_at IS NULL")
    .run(user, Date.now(), id);
  if (!res.changes) return null;
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id);
}

export function getStats(db, filters) {
  const { sql, params } = buildWhere(filters);
  const bad = (sql ? sql + ' AND' : 'WHERE') + " level != 'info'";

  const t = db
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(level = 'alarm') AS alarms,
        SUM(level = 'warning') AS warnings,
        SUM(level != 'info' AND acked_at IS NULL) AS unacked,
        AVG(acked_at - ts) / 1000 AS reaction
       FROM events ${sql}`
    )
    .get(params);

  const top = db
    .prepare(
      `SELECT equipment_id AS id, equipment_name AS name, COUNT(*) AS count
       FROM events ${bad} GROUP BY equipment_id ORDER BY count DESC LIMIT 5`
    )
    .all(params);

  const byHour = new Array(24).fill(0);
  const hourRows = db
    .prepare(
      `SELECT CAST(strftime('%H', ts / 1000, 'unixepoch', 'localtime') AS INTEGER) AS h, COUNT(*) AS n
       FROM events ${bad} GROUP BY h`
    )
    .all(params);
  for (const r of hourRows) byHour[r.h] = r.n;

  return {
    total: t.total,
    alarms: t.alarms || 0,
    warnings: t.warnings || 0,
    unacked: t.unacked || 0,
    avgReactionSec: t.reaction === null ? null : Math.round(t.reaction),
    top,
    byHour,
  };
}

const LEVEL_RU = { info: 'Инфо', warning: 'Предупреждение', alarm: 'Авария' };

function csvCell(v) {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}

// ; и BOM - иначе русский Excel ломает кодировку и колонки
export function* csvRows(db, filters) {
  yield '﻿Время;Уровень;Оборудование;Сообщение;Квитировал;Время квитирования\n';

  const { sql, params } = buildWhere(filters);
  const it = db.prepare(`SELECT * FROM events ${sql} ORDER BY ts DESC, id DESC`).iterate(params);

  for (const e of it) {
    const cols = [
      new Date(e.ts).toLocaleString('ru-RU'),
      LEVEL_RU[e.level],
      e.equipment_name,
      e.message,
      e.acked_by,
      e.acked_at ? new Date(e.acked_at).toLocaleString('ru-RU') : '',
    ];
    yield cols.map(csvCell).join(';') + '\n';
  }
}

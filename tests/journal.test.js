import test from 'node:test';
import assert from 'node:assert/strict';

import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { listEvents, countEvents, ackEvent } from '../server/queries.js';

function makeDb() {
  const db = openDb(':memory:');
  seed(db, 2000);
  return db;
}

test('фильтры по уровню и оборудованию', () => {
  const db = makeDb();
  const rows = listEvents(db, { level: 'alarm', equipment: 'chl-2' }, 0, 500);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((e) => e.level === 'alarm' && e.equipment_id === 'chl-2'));
});

test('страницы не пересекаются', () => {
  const db = makeDb();
  const a = listEvents(db, {}, 0, 50);
  const b = listEvents(db, {}, 50, 50);
  assert.equal(countEvents(db, {}), 2000);
  assert.notEqual(a[0].id, b[0].id);
});

test('квитировать можно только один раз', () => {
  const db = makeDb();
  const [alarm] = listEvents(db, { level: 'alarm', acked: 'no' }, 0, 1);
  assert.equal(ackEvent(db, alarm.id, 'Иванов').acked_by, 'Иванов');
  assert.equal(ackEvent(db, alarm.id, 'Петров'), null);
});

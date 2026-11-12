import test from 'node:test';
import assert from 'node:assert/strict';

import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { listEvents, countEvents, ackEvent, parsePaging, csvRows } from '../server/queries.js';

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

test('limit и offset приводятся к безопасным значениям', () => {
  assert.deepEqual(parsePaging({}), { limit: 100, offset: 0 });
  assert.deepEqual(parsePaging({ limit: '-5' }), { limit: 100, offset: 0 }); // отрицательный LIMIT отключил бы пагинацию
  assert.deepEqual(parsePaging({ limit: '1000' }), { limit: 500, offset: 0 });
  assert.deepEqual(parsePaging({ limit: '1.5', offset: 'abc' }), { limit: 1, offset: 0 });
  assert.equal(parsePaging({ offset: '-3' }).offset, 0);
});

test('поиск не зависит от регистра (в том числе русского) и не считает % подстановкой', () => {
  const db = makeDb();
  assert.equal(countEvents(db, { q: 'отказ' }), countEvents(db, { q: 'ОТКАЗ' }));
  assert.ok(countEvents(db, { q: 'отказ' }) > 0);
  assert.equal(countEvents(db, { q: '%' }), 0); // в тексте событий нет знака %
});

test('CSV: ячейки, похожие на формулы, не выполняются в Excel', () => {
  const db = makeDb();
  const [alarm] = listEvents(db, { level: 'alarm', acked: 'no' }, 0, 1);
  ackEvent(db, alarm.id, '=cmd|calc');
  const csv = [...csvRows(db, { level: 'alarm' })].join('');
  assert.ok(csv.includes("'=cmd|calc"));
  assert.ok(!csv.includes(';=cmd'));
});

test('квитировать можно только один раз', () => {
  const db = makeDb();
  const [alarm] = listEvents(db, { level: 'alarm', acked: 'no' }, 0, 1);
  assert.equal(ackEvent(db, alarm.id, 'Иванов').acked_by, 'Иванов');
  assert.equal(ackEvent(db, alarm.id, 'Петров'), null);
});

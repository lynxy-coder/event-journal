import { EQUIPMENT } from './equipment.js';

const TEXTS = {
  ventilation: {
    info: ['Запуск установки', 'Остановка установки', 'Смена режима регулирования'],
    warning: ['Отклонение температуры притока от уставки', 'Загрязнение фильтра'],
    alarm: ['Отказ датчика температуры', 'Остановка вентилятора', 'Угроза замораживания'],
  },
  chiller: {
    info: ['Пуск компрессора', 'Остановка компрессора'],
    warning: ['Высокое давление конденсации', 'Повышенная температура воды'],
    alarm: ['Отказ компрессора', 'Низкое давление хладагента'],
  },
  pump: {
    info: ['Переключение на резервный насос', 'Плановый запуск'],
    warning: ['Повышенная вибрация', 'Падение давления в контуре'],
    alarm: ['Сухой ход', 'Отказ насоса'],
  },
};

const USERS = ['Смирнов А.', 'Кузнецова Е.', 'Орлов К.'];

// эти ломаются чаще, иначе на графике все столбики одинаковые
const WEIGHT = { 'chl-2': 4, 'pmp-2': 3, 'ahu-0': 2 };

// mulberry32, чтобы данные каждый раз были одинаковые
function makeRandom(a) {
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(db, count = 100000) {
  const rand = makeRandom(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const pool = [];
  for (const e of EQUIPMENT) {
    for (let i = 0; i < (WEIGHT[e.id] || 1); i++) pool.push(e);
  }

  // днём событий в 4 раза больше, чем ночью
  const hours = [];
  for (let h = 0; h < 24; h++) {
    const n = h >= 7 && h <= 19 ? 4 : 1;
    for (let i = 0; i < n; i++) hours.push(h);
  }

  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const times = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now - Math.floor(rand() * 180) * DAY);
    d.setHours(pick(hours), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
    // если вылезли в будущее, сдвигаем на сутки назад
    times.push(d.getTime() > now ? d.getTime() - DAY : d.getTime());
  }
  times.sort((a, b) => a - b);

  const insert = db.prepare(
    'INSERT INTO events (ts, level, equipment_id, equipment_name, message, acked_by, acked_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  db.exec('BEGIN');
  for (const ts of times) {
    const eq = pick(pool);
    const r = rand();
    const level = r < 0.6 ? 'info' : r < 0.88 ? 'warning' : 'alarm';

    let by = null;
    let at = null;
    if (level !== 'info' && (rand() < 0.9 || ts > now - DAY)) {
      at = ts + (20 + Math.floor(rand() * (level === 'alarm' ? 600 : 1800))) * 1000;
      by = pick(USERS);
      if (at > now) by = at = null;
    }

    insert.run(ts, level, eq.id, eq.name, pick(TEXTS[eq.type][level]), by, at);
  }
  db.exec('COMMIT');
}

export function seedIfEmpty(db, count) {
  const row = db.prepare('SELECT COUNT(*) AS n FROM events').get();
  if (row.n === 0) seed(db, count);
}

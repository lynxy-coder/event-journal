import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { openDb } from './db.js';
import { seedIfEmpty } from './seed.js';
import { EQUIPMENT } from './equipment.js';
import { listEvents, countEvents, ackEvent, getStats, csvRows, parsePaging } from './queries.js';

const PORT = process.env.PORT || 3000;
const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(here, '../public');
const DB_FILE = path.resolve(here, '../data/journal.db');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

await fs.mkdir(path.dirname(DB_FILE), { recursive: true });
const db = openDb(DB_FILE);
console.log('готовлю базу, при первом запуске это несколько секунд...');
seedIfEmpty(db, 100000);

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let s = '';
    req.on('data', (c) => {
      s += c;
      // тело запроса маленькое, больше 10 КБ не принимаем
      if (s.length > 10000) req.destroy();
    });
    req.on('close', () => resolve({}));
    req.on('end', () => {
      try {
        resolve(JSON.parse(s));
      } catch {
        resolve({});
      }
    });
  });
}

async function api(req, res, url) {
  const filters = Object.fromEntries(url.searchParams);

  if (url.pathname === '/api/equipment') return json(res, EQUIPMENT);

  if (url.pathname === '/api/events' && req.method === 'GET') {
    const { limit, offset } = parsePaging(filters);
    return json(res, { total: countEvents(db, filters), rows: listEvents(db, filters, offset, limit) });
  }

  if (url.pathname === '/api/stats') return json(res, getStats(db, filters));

  if (url.pathname === '/api/events.csv') {
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="events.csv"',
    });
    for (const line of csvRows(db, filters)) res.write(line);
    return res.end();
  }

  const m = url.pathname.match(/^\/api\/events\/(\d+)\/ack$/);
  if (m && req.method === 'POST') {
    const body = await readBody(req);
    // user должен быть строкой: массивы и объекты не принимаем
    const user = typeof body?.user === 'string' ? body.user.trim() : '';
    if (!user) return json(res, { error: 'Укажите, кто квитирует' }, 400);
    const ev = ackEvent(db, Number(m[1]), user.slice(0, 60));
    if (!ev) return json(res, { error: 'Событие нельзя квитировать' }, 409);
    return json(res, ev);
  }

  json(res, { error: 'Not found' }, 404);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/api/')) {
    try {
      return await api(req, res, url);
    } catch (e) {
      console.error(e);
      return json(res, { error: 'Ошибка сервера' }, 500);
    }
  }

  const file = path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403);
    return res.end();
  }

  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'text/plain' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log('http://localhost:' + PORT));

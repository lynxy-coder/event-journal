import { LEVELS, escapeHtml, formatTime } from './format.js';

const ROW_H = 40;
const PAGE = 100;

// рисуем только видимые строки, высота spacer как будто строк все 100 000
export function createTable({ viewport, spacer, loadPage, onAck }) {
  let total = 0;
  let pages = new Map();
  let loading = new Set();
  let failed = new Set(); // страницы, которые не удалось загрузить: не просим их снова, пока не сменятся фильтры
  let gen = 0; // меняется при сбросе фильтров, старые ответы выбрасываем

  function getRow(i) {
    const p = pages.get(Math.floor(i / PAGE));
    return p ? p[i % PAGE] : null;
  }

  async function fetchPage(n) {
    if (pages.has(n) || loading.has(n) || failed.has(n)) return;
    loading.add(n);
    const g = gen;
    try {
      const data = await loadPage(n * PAGE, PAGE);
      if (g === gen) pages.set(n, data.rows);
    } catch (e) {
      console.error(e);
      if (g === gen) failed.add(n);
    } finally {
      // у старого запроса (фильтры уже сменились) нельзя трогать данные нового
      if (g === gen) loading.delete(n);
    }
    if (g === gen) render();
  }

  function rowHtml(i) {
    const e = getRow(i);
    const style = `style="top:${i * ROW_H}px"`;
    if (!e) {
      const text = failed.has(Math.floor(i / PAGE)) ? 'Не удалось загрузить, смените фильтр или обновите страницу' : 'Загрузка…';
      return `<div class="row loading" ${style}><div>${text}</div></div>`;
    }

    let ack = '';
    if (e.acked_at) ack = `<span class="acked">${escapeHtml(e.acked_by)}, ${formatTime(e.acked_at)}</span>`;
    else if (e.level !== 'info') ack = `<button type="button" data-id="${e.id}">Квитировать</button>`;

    return `<div class="row" ${style}>
      <div>${formatTime(e.ts)}</div>
      <div class="level level-${e.level}">${LEVELS[e.level]}</div>
      <div title="${escapeHtml(e.equipment_name)}">${escapeHtml(e.equipment_name)}</div>
      <div title="${escapeHtml(e.message)}">${escapeHtml(e.message)}</div>
      <div>${ack}</div>
    </div>`;
  }

  function render() {
    const first = Math.max(0, Math.floor(viewport.scrollTop / ROW_H) - 5);
    const last = Math.min(total - 1, Math.ceil((viewport.scrollTop + viewport.clientHeight) / ROW_H) + 5);

    let html = '';
    for (let i = first; i <= last; i++) html += rowHtml(i);
    spacer.innerHTML = html || '<div class="empty">Ничего не найдено</div>';

    if (total > 0) {
      for (let n = Math.floor(first / PAGE); n <= Math.floor(last / PAGE); n++) fetchPage(n);
    }
  }

  let waiting = false;
  viewport.addEventListener('scroll', () => {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(() => {
      waiting = false;
      render();
    });
  });
  window.addEventListener('resize', render);

  spacer.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-id]');
    if (b) onAck(Number(b.dataset.id));
  });

  return {
    async reset() {
      gen++;
      pages = new Map();
      loading = new Set();
      failed = new Set();
      viewport.scrollTop = 0;

      const g = gen;
      const data = await loadPage(0, PAGE);
      if (g !== gen) return total;

      total = data.total;
      pages.set(0, data.rows);
      spacer.style.height = total * ROW_H + 'px';
      render();
      return total;
    },

    updateRow(ev) {
      for (const rows of pages.values()) {
        const i = rows.findIndex((r) => r.id === ev.id);
        if (i !== -1) rows[i] = ev;
      }
      render();
    },
  };
}

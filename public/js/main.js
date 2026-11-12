import { getEquipment, getStats, getPage, csvUrl, ack } from './api.js';
import { createTable } from './table.js';
import { renderNumbers, renderCharts } from './charts.js';

const form = document.getElementById('filters');
const userInput = document.getElementById('user');
const countEl = document.getElementById('count');

let filters = {};

const table = createTable({
  viewport: document.getElementById('viewport'),
  spacer: document.getElementById('spacer'),
  loadPage: (offset, limit) => getPage(filters, offset, limit),
  onAck: acknowledge,
});

async function acknowledge(id) {
  const user = userInput.value.trim();
  if (!user) {
    userInput.focus();
    alert('Впишите фамилию диспетчера сверху');
    return;
  }
  try {
    table.updateRow(await ack(id, user));
    refreshStats();
  } catch (e) {
    alert(e.message);
  }
}

let statsGen = 0; // номер последнего запроса статистики: ответы на старые запросы выбрасываем

async function refreshStats() {
  const id = ++statsGen;
  try {
    const s = await getStats(filters);
    if (id !== statsGen) return;
    renderNumbers(document.getElementById('numbers'), s);
    renderCharts(s);
  } catch (e) {
    console.error(e);
  }
}

async function applyFilters() {
  filters = Object.fromEntries(new FormData(form));
  document.getElementById('csv').href = csvUrl(filters);
  try {
    const [total] = await Promise.all([table.reset(), refreshStats()]);
    countEl.textContent = 'Найдено записей: ' + total.toLocaleString('ru-RU');
  } catch (e) {
    console.error(e);
    countEl.textContent = 'Не удалось загрузить данные';
  }
}

let timer;
form.addEventListener('input', (e) => {
  clearTimeout(timer);
  // по тексту ждём 300 мс, чтобы не дёргать сервер на каждую букву
  timer = setTimeout(applyFilters, e.target.name === 'q' ? 300 : 0);
});
form.addEventListener('reset', () => setTimeout(applyFilters));
form.addEventListener('submit', (e) => e.preventDefault());

userInput.value = localStorage.getItem('user') || '';
userInput.addEventListener('input', () => localStorage.setItem('user', userInput.value));

const root = document.documentElement;
root.dataset.theme = localStorage.getItem('theme') || 'dark';
document.getElementById('theme').addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', root.dataset.theme);
  refreshStats(); // цвета графиков берутся из css, перерисовываем
});

const sel = form.elements.equipment;
for (const e of await getEquipment()) sel.add(new Option(e.name, e.id));

applyFilters();

import { formatDuration } from './format.js';

let topChart, hoursChart;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function options() {
  const muted = css('--text-muted');
  const grid = css('--border');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: muted }, grid: { color: grid } },
      y: { ticks: { color: muted }, grid: { color: grid }, beginAtZero: true },
    },
  };
}

export function renderNumbers(el, s) {
  const n = (x) => x.toLocaleString('ru-RU');
  const items = [
    ['Всего событий', n(s.total)],
    ['Аварий', n(s.alarms)],
    ['Предупреждений', n(s.warnings)],
    ['Не квитировано', n(s.unacked)],
    ['Среднее время реакции', formatDuration(s.avgReactionSec)],
  ];
  el.innerHTML = items.map(([name, v]) => `<div class="number"><b>${v}</b><span>${name}</span></div>`).join('');
}

export function renderCharts(s) {
  // Chart.js грузится с CDN: без интернета графиков нет, но остальная страница должна работать
  if (typeof Chart === 'undefined') return;
  if (topChart) topChart.destroy();
  if (hoursChart) hoursChart.destroy();

  const o = options();
  o.indexAxis = 'y';
  o.scales.y.beginAtZero = false;
  o.scales.x.beginAtZero = true;

  topChart = new Chart(document.getElementById('top-chart'), {
    type: 'bar',
    data: {
      labels: s.top.map((e) => e.name),
      datasets: [{ data: s.top.map((e) => e.count), backgroundColor: css('--alarm') }],
    },
    options: o,
  });

  hoursChart = new Chart(document.getElementById('hours-chart'), {
    type: 'bar',
    data: {
      labels: s.byHour.map((_, h) => String(h).padStart(2, '0')),
      datasets: [{ data: s.byHour, backgroundColor: css('--accent') }],
    },
    options: options(),
  });
}

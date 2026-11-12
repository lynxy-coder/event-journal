export const LEVELS = { info: 'Инфо', warning: 'Предупреждение', alarm: 'Авария' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';');
}

export function formatTime(ms) {
  return new Date(ms).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDuration(sec) {
  if (sec === null) return '—';
  if (sec < 60) return sec + ' с';
  return Math.floor(sec / 60) + ' мин ' + (sec % 60) + ' с';
}

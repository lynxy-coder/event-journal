function query(filters, extra = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, ...extra })) {
    if (value !== '' && value !== undefined) params.set(key, value);
  }
  return params.toString();
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ошибка ${res.status}`);
  return res.json();
}

export const getEquipment = () => getJson('/api/equipment');
export const getStats = (filters) => getJson(`/api/stats?${query(filters)}`);
export const getPage = (filters, offset, limit) =>
  getJson(`/api/events?${query(filters, { offset, limit })}`);
export const csvUrl = (filters) => `/api/events.csv?${query(filters)}`;

export async function ack(id, user) {
  const res = await fetch(`/api/events/${id}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Не удалось квитировать');
  return data;
}

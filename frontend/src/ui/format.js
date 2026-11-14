export const MONTHS_RU = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const MONTHS_RU_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

export const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU'));
export const fmtCompact = (n) => (n == null ? '' : n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
export const fmtRatio = (r) => (r == null ? '—' : `×${r.toFixed(2)}`);
export const fmtPct = (x, d = 1) => (x == null ? '—' : `${(x * 100).toFixed(d)}%`);
export const pad2 = (n) => String(n).padStart(2, '0');
export const ymLabel = (y, m) => `${y}-${pad2(m)}`;

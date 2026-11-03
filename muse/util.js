export const uid = () =>
  (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (n) => (n == null || !Number.isFinite(n) ? '—' : fmt.format(n));
export const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export function matches(q, ...fields) {
  const s = (q || '').trim().toLowerCase();
  if (!s) return true;
  return fields.some((f) => String(Array.isArray(f) ? f.join(' ') : f ?? '').toLowerCase().includes(s));
}

export const SORTS = [
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['updated', 'Recently updated'],
  ['name', 'Name A–Z'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
];

export function sortList(list, sort, priceOf = (x) => x.price) {
  const a = [...list];
  switch (sort) {
    case 'oldest': return a.sort((x, y) => x.createdAt - y.createdAt);
    case 'updated': return a.sort((x, y) => y.updatedAt - x.updatedAt);
    case 'name': return a.sort((x, y) => x.name.localeCompare(y.name));
    case 'price-asc': return a.sort((x, y) => (priceOf(x) ?? Infinity) - (priceOf(y) ?? Infinity));
    case 'price-desc': return a.sort((x, y) => (priceOf(y) ?? -1) - (priceOf(x) ?? -1));
    default: return a.sort((x, y) => y.createdAt - x.createdAt);
  }
}

export function validUrl(s) {
  if (!s) return true;
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export function parsePrice(s) {
  if (s === '' || s == null) return null;
  const n = Number(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // keep spreadsheet apps from running formulas
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export const STATUS = [['want', 'Want'], ['ordered', 'Ordered'], ['purchased', 'Purchased']];
export const PRIORITY = [['high', 'High'], ['medium', 'Medium'], ['low', 'Low']];
export const GIFT_STATUS = [['want', 'Idea'], ['ordered', 'Ordered'], ['purchased', 'Bought'], ['given', 'Given']];
export const statusList = (kind) => (kind === 'gift' ? GIFT_STATUS : STATUS);

/** Next calendar date for 'YYYY-MM-DD'. yearly = repeats every year (birthdays, holidays). */
export function nextDate(iso, yearly = true) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (!yearly) return new Date(+m[1], +m[2] - 1, +m[3]);
  let dt = new Date(today.getFullYear(), +m[2] - 1, +m[3]);
  if (dt < today) dt = new Date(today.getFullYear() + 1, +m[2] - 1, +m[3]);
  return dt;
}
export function daysUntil(dt) {
  if (!dt) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((dt - t) / 86400000);
}
export function whenLabel(dt) {
  const n = daysUntil(dt);
  if (n == null) return '';
  const ds = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (n < 0) return ds + ' · passed';
  if (n === 0) return ds + ' · today';
  if (n === 1) return ds + ' · tomorrow';
  return `${ds} · in ${n} days`;
}
const pad2 = (n) => String(n).padStart(2, '0');
/** Today's local date as YYYY-MM-DD. */
export const todayKey = () => { const t = new Date(); return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`; };
/** A holiday list is archived the day after its date. */
export const isArchived = (o) => !!o.date && o.date < todayKey();
/** Move a past date forward a year at a time until it's today or later. */
export const rollForward = (iso) => { let [y, m, d] = iso.split('-').map(Number); const t = todayKey(); let out = iso; while (out < t) { y += 1; out = `${y}-${pad2(m)}-${pad2(d)}`; } return out; };

export function sortOccasions(list) {
  const key = (o) => { const n = daysUntil(nextDate(o.date, false)); return n == null ? 1e6 : n < 0 ? 2e6 - n : n; };
  return [...list].sort((a, b) => key(a) - key(b) || a.name.localeCompare(b.name));
}

export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter', 'All seasons'];
export const label = (pairs, v) => (pairs.find((p) => p[0] === v) || [v, v])[1];

export function outfitCost(outfit, byId) {
  let total = 0, missing = 0, count = 0;
  outfit.pieces.forEach((p) => {
    const prod = byId[p.productId];
    if (!prod) return;
    count++;
    if (prod.price == null) missing++; else total += prod.price;
  });
  return { total: Math.round(total * 100) / 100, missing, count };
}

export function routineCost(routine, byId) {
  let total = 0, missing = 0;
  routine.steps.forEach((s) => {
    if (!s.productId) return;
    const prod = byId[s.productId];
    if (!prod || s.owned) return;
    if (prod.price == null) missing++; else total += prod.price;
  });
  return { total, missing };
}

export function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
export function dataURLToBlob(d) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(d || '');
  if (!m) return null;
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: m[1] || 'application/octet-stream' });
}

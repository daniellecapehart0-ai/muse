// Data-access layer for the online version. Screens never talk to Supabase directly; they call
// getAll / getOne / commit / imageUrl exactly as they did with on-device storage.
// Records keep the same shape the app uses; this file translates them to and from the database.
import { supabase } from './supabase.js';
import { PHOTO_BUCKET } from './config.js';

export const STORES = ['products', 'categories', 'outfits', 'routines', 'people', 'occasions', 'images'];

let uid = null;
/** Called when someone signs in or out. Every query below is scoped to this account. */
export function setUser(id) { uid = id; urlCache.clear(); childSig.clear(); }
export const currentUserId = () => uid;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === 'string' && UUID.test(s);
const newId = () => crypto.randomUUID();
const iso = (t) => (t ? new Date(t).toISOString() : null);
const ms = (s) => (s ? Date.parse(s) : null);
const num = (v) => (v == null ? null : Number(v));
const pathOf = (imageId) => (imageId ? `${uid}/${imageId}` : null);
const idOf = (path) => (path ? path.split('/').pop() : null);

function friendly(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'No internet connection. Check your connection and try again.';
  if (/JWT|session|not authenticated|401/i.test(m)) return 'Your session ended. Sign in again.';
  if (/does not belong to this account/i.test(m)) return 'That item is no longer available. Refresh and try again.';
  if (/exceeded|too large|413/i.test(m)) return 'That photo is too large. Choose one under 15 MB.';
  return m;
}
const check = ({ error, data }) => { if (error) throw new Error(friendly(error)); return data; };
function need() { if (!uid) throw new Error('Sign in to save.'); }

// ---------- record <-> row ----------
const MAP = {
  categories: {
    table: 'categories', select: '*',
    toRow: (c) => ({ id: c.id, user_id: uid, name: c.name, description: c.description, icon: c.icon, accent: c.accent, item_label: c.itemLabel, cover_path: pathOf(c.coverImageId), sort_order: c.order, created_at: iso(c.createdAt), updated_at: iso(c.updatedAt) }),
    fromRow: (r) => ({ id: r.id, name: r.name, description: r.description, icon: r.icon, accent: r.accent, itemLabel: r.item_label, coverImageId: idOf(r.cover_path), order: r.sort_order, createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
  },
  people: {
    table: 'people', select: '*, person_lists(occasion_id)',
    toRow: (p) => ({ id: p.id, user_id: uid, name: p.name, relationship: p.relationship, birthday: p.birthday || null, budget: p.budget, clothing_size: p.clothingSize, shoe_size: p.shoeSize, ring_size: p.ringSize, favorite_colors: p.favoriteColors, likes: p.likes, dislikes: p.dislikes, notes: p.notes, accent: p.accent, photo_path: pathOf(p.coverImageId), created_at: iso(p.createdAt), updated_at: iso(p.updatedAt) }),
    fromRow: (r) => ({ id: r.id, name: r.name, relationship: r.relationship, birthday: r.birthday || '', budget: num(r.budget), clothingSize: r.clothing_size, shoeSize: r.shoe_size, ringSize: r.ring_size, favoriteColors: r.favorite_colors, likes: r.likes, dislikes: r.dislikes, notes: r.notes, accent: r.accent, coverImageId: idOf(r.photo_path), eventIds: (r.person_lists || []).map((l) => l.occasion_id || 'birthday'), createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
    child: { table: 'person_lists', fk: 'person_id', rows: (p) => [...new Set(p.eventIds || [])].filter((e) => e === 'birthday' || isUuid(e)).map((e) => ({ user_id: uid, person_id: p.id, occasion_id: e === 'birthday' ? null : e })) },
  },
  occasions: {
    table: 'occasions', select: '*, occasion_items(product_id, position)',
    toRow: (o) => ({ id: o.id, user_id: uid, name: o.name, date: o.date || null, icon: o.icon, accent: o.accent, description: o.description, cover_path: pathOf(o.coverImageId), created_at: iso(o.createdAt), updated_at: iso(o.updatedAt) }),
    fromRow: (r) => ({ id: r.id, name: r.name, date: r.date || '', yearly: false, icon: r.icon, accent: r.accent, description: r.description, coverImageId: idOf(r.cover_path), productIds: (r.occasion_items || []).sort((a, b) => a.position - b.position).map((i) => i.product_id), createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
    child: { table: 'occasion_items', fk: 'occasion_id', rows: (o) => (o.productIds || []).filter(isUuid).map((pid, i) => ({ user_id: uid, occasion_id: o.id, product_id: pid, position: i })) },
  },
  products: {
    table: 'products', select: '*, price_history(price, recorded_at)',
    toRow: (p) => ({
      id: p.id, user_id: uid, kind: p.kind, category_id: p.categoryId || null, person_id: p.personId || null,
      occasion_id: p.occasionId && p.occasionId !== 'birthday' ? p.occasionId : null, for_birthday: p.occasionId === 'birthday',
      name: p.name, brand: p.brand, store: p.store, url: p.url, price: p.price, size: p.size, color: p.color, product_type: p.productType,
      shade_name: p.shadeName, shade_number: p.shadeNumber, notes: p.notes, priority: p.priority, status: p.status, favorite: p.favorite,
      image_path: pathOf(p.imageId), image_url: p.imageUrl || '', purchased_at: iso(p.purchasedAt), created_at: iso(p.createdAt), updated_at: iso(p.updatedAt),
    }),
    fromRow: (r) => ({
      id: r.id, kind: r.kind, categoryId: r.category_id, personId: r.person_id, occasionId: r.for_birthday ? 'birthday' : r.occasion_id,
      name: r.name, brand: r.brand, store: r.store, url: r.url, price: num(r.price), size: r.size, color: r.color, productType: r.product_type,
      shadeName: r.shade_name, shadeNumber: r.shade_number, notes: r.notes, priority: r.priority, status: r.status, favorite: r.favorite,
      imageId: idOf(r.image_path), imageUrl: r.image_url, purchasedAt: ms(r.purchased_at),
      priceHistory: (r.price_history || []).sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).map((h) => ({ price: num(h.price), at: ms(h.recorded_at) })),
      createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
    }),
    child: { table: 'price_history', fk: 'product_id', rows: (p) => (p.priceHistory || []).map((h) => ({ user_id: uid, product_id: p.id, price: h.price, recorded_at: iso(h.at) })) },
  },
  outfits: {
    table: 'outfits', select: '*, outfit_pieces(id, product_id, position)',
    toRow: (o) => ({ id: o.id, user_id: uid, name: o.name, description: o.description, tags: o.tags, season: o.season, occasion: o.occasion, notes: o.notes, favorite: o.favorite, cover_path: pathOf(o.coverImageId), created_at: iso(o.createdAt), updated_at: iso(o.updatedAt) }),
    fromRow: (r) => ({ id: r.id, name: r.name, description: r.description, tags: r.tags || [], season: r.season, occasion: r.occasion, notes: r.notes, favorite: r.favorite, coverImageId: idOf(r.cover_path), pieces: (r.outfit_pieces || []).sort((a, b) => a.position - b.position).map((x) => ({ id: x.id, productId: x.product_id })), createdAt: ms(r.created_at), updatedAt: ms(r.updated_at) }),
    child: { table: 'outfit_pieces', fk: 'outfit_id', rows: (o) => (o.pieces || []).filter((x) => isUuid(x.productId)).map((x, i) => ({ id: isUuid(x.id) ? x.id : newId(), user_id: uid, outfit_id: o.id, product_id: x.productId, position: i })) },
  },
  routines: {
    table: 'routines', select: '*, routine_steps(*)',
    toRow: (r) => ({ id: r.id, user_id: uid, name: r.name, description: r.description, occasion: r.occasion, duration: r.duration, notes: r.notes, favorite: r.favorite, cover_path: pathOf(r.coverImageId), created_at: iso(r.createdAt), updated_at: iso(r.updatedAt) }),
    fromRow: (r) => ({ id: r.id, name: r.name, description: r.description, occasion: r.occasion, duration: r.duration, notes: r.notes, favorite: r.favorite, coverImageId: idOf(r.cover_path), createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
      steps: (r.routine_steps || []).sort((a, b) => a.position - b.position).map((s) => ({ id: s.id, productId: s.product_id, standalone: { name: s.standalone_name, brand: s.standalone_brand, shade: s.standalone_shade }, instructions: s.instructions, notes: s.notes, owned: s.owned })) }),
    child: { table: 'routine_steps', fk: 'routine_id', rows: (r) => (r.steps || []).map((s, i) => ({ id: isUuid(s.id) ? s.id : newId(), user_id: uid, routine_id: r.id, product_id: isUuid(s.productId) ? s.productId : null, position: i, standalone_name: s.standalone?.name || '', standalone_brand: s.standalone?.brand || '', standalone_shade: s.standalone?.shade || '', instructions: s.instructions || '', notes: s.notes || '', owned: !!s.owned })) },
  },
};
// Parents are written before anything that points at them.
const PUT_ORDER = ['categories', 'people', 'occasions', 'products', 'outfits', 'routines'];

// Child rows are rewritten only when they changed since we last saw them.
const childSig = new Map();
const sigOf = (store, rec) => JSON.stringify(MAP[store].child.rows(rec).map(({ id, user_id, ...rest }) => rest));

// ---------- reads ----------
export async function getAll(store) {
  need();
  if (store === 'images') return listImages();
  const m = MAP[store];
  const out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await supabase.from(m.table).select(m.select).eq('user_id', uid).order('created_at').range(from, from + 999));
    rows.forEach((r) => { const rec = m.fromRow(r); out.push(rec); if (m.child) childSig.set(store + ':' + rec.id, sigOf(store, rec)); });
    if (rows.length < 1000) break;
  }
  return out;
}

export async function getOne(store, id) {
  need();
  if (store === 'images') {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(pathOf(id));
    return error || !data ? null : { id, blob: data, type: data.type, createdAt: Date.now() };
  }
  const m = MAP[store];
  const rows = check(await supabase.from(m.table).select(m.select).eq('id', id).limit(1));
  return rows[0] ? m.fromRow(rows[0]) : null;
}

async function listNames() {
  const names = [];
  for (let offset = 0; ; offset += 1000) {
    const list = check(await supabase.storage.from(PHOTO_BUCKET).list(uid, { limit: 1000, offset }));
    list.filter((f) => f.id).forEach((f) => names.push(f.name));
    if (list.length < 1000) break;
  }
  return names;
}
async function listImages() {
  const out = [];
  for (const name of await listNames()) { const r = await getOne('images', name); if (r) out.push(r); }
  return out;
}

// ---------- photos ----------
/** Large phone photos are scaled to 1600px JPEG before upload to save space and data. */
async function shrink(blob) {
  if (!blob || !blob.type || !blob.type.startsWith('image/') || blob.type === 'image/gif' || blob.size < 500 * 1024) return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const out = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.86));
    return out && out.size < blob.size ? out : blob;
  } catch { return blob; }
}
async function uploadImage(img) {
  const blob = await shrink(img.blob);
  check(await supabase.storage.from(PHOTO_BUCKET).upload(pathOf(img.id), blob, { contentType: blob.type || 'image/jpeg', upsert: true }));
}

const urlCache = new Map();
/** A short-lived private link to one of the signed-in person's photos. */
export async function imageUrl(id) {
  if (!id || !uid) return null;
  const hit = urlCache.get(id);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(pathOf(id), 3600);
  if (error || !data) return null;
  urlCache.set(id, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
export function forgetImage(id) { urlCache.delete(id); }

// ---------- writes ----------
/**
 * Apply a set of changes: ops = { clear: [store], put: { store: [records] }, del: { store: [ids] } }.
 * Order keeps links valid: photos upload first, deletes run next (the database removes linked rows),
 * then parents are saved before the rows that point at them.
 */
export async function commit(ops) {
  need();
  for (const s of ops.clear || []) await clearStore(s);

  for (const img of ops.put?.images || []) await uploadImage(img);

  for (const [s, ids] of Object.entries(ops.del || {})) {
    const list = (ids || []).filter(Boolean);
    if (!list.length || s === 'images') continue;
    check(await supabase.from(MAP[s].table).delete().in('id', list));
    list.forEach((id) => childSig.delete(s + ':' + id));
  }

  for (const s of PUT_ORDER) {
    const recs = ops.put?.[s];
    if (recs?.length) check(await supabase.from(MAP[s].table).upsert(recs.map(MAP[s].toRow), { onConflict: 'id' }));
  }
  for (const s of PUT_ORDER) {
    const recs = ops.put?.[s]; const child = MAP[s].child;
    if (!recs?.length || !child) continue;
    const changed = recs.filter((r) => childSig.get(s + ':' + r.id) !== sigOf(s, r));
    if (!changed.length) continue;
    check(await supabase.from(child.table).delete().in(child.fk, changed.map((r) => r.id)));
    const rows = changed.flatMap(child.rows);
    if (rows.length) check(await supabase.from(child.table).insert(rows));
    changed.forEach((r) => childSig.set(s + ':' + r.id, sigOf(s, r)));
  }

  const gone = (ops.del?.images || []).filter(Boolean);
  if (gone.length) { await supabase.storage.from(PHOTO_BUCKET).remove(gone.map(pathOf)); gone.forEach(forgetImage); }
}

async function clearStore(s) {
  if (s === 'images') {
    const names = await listNames();
    for (let i = 0; i < names.length; i += 100) await supabase.storage.from(PHOTO_BUCKET).remove(names.slice(i, i + 100).map((n) => `${uid}/${n}`));
    urlCache.clear();
    return;
  }
  check(await supabase.from(MAP[s].table).delete().eq('user_id', uid));
  [...childSig.keys()].filter((k) => k.startsWith(s + ':')).forEach((k) => childSig.delete(k));
}

// ---------- account ----------
export async function loadProfile() {
  need();
  const rows = check(await supabase.from('profiles').select('display_name').eq('id', uid).limit(1));
  return rows[0] || null;
}
export async function saveProfileName(name) {
  if (!uid) return;
  await supabase.from('profiles').update({ display_name: name.slice(0, 40) }).eq('id', uid);
}
/** Deletes every photo, then the account (the database removes all of its rows). */
export async function deleteAccount() {
  need();
  await clearStore('images');
  check(await supabase.rpc('delete_my_account'));
  await supabase.auth.signOut();
}

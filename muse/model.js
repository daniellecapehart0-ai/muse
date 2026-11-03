// Record shapes. Every record has a stable string id. normalize* repairs or rejects records read from storage or imports.
const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ts = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : Date.now());
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const okId = (v) => typeof v === 'string' && v.length > 0 && v.length < 200;

/** Product: one wishlist item. kind = clothing | makeup | custom (custom items belong to categoryId). */
export function normProduct(r) {
  if (!r || !okId(r.id)) return null;
  const kind = oneOf(r.kind, ['clothing', 'makeup', 'custom', 'gift'], null);
  if (!kind) return null;
  if (kind === 'custom' && !okId(r.categoryId)) return null;
  if (kind === 'gift' && !okId(r.personId)) return null;
  return {
    id: r.id, kind, categoryId: kind === 'custom' ? r.categoryId : null,
    personId: kind === 'gift' ? r.personId : null,
    occasionId: kind === 'gift' && okId(r.occasionId) ? r.occasionId : null, // an occasion id, or 'birthday' for the person's birthday
    name: str(r.name).trim() || 'Untitled item',
    brand: str(r.brand), store: str(r.store), url: str(r.url),
    price: num(r.price) != null && r.price >= 0 ? r.price : null,
    size: str(r.size), color: str(r.color),
    productType: str(r.productType), shadeName: str(r.shadeName), shadeNumber: str(r.shadeNumber),
    notes: str(r.notes),
    priority: oneOf(r.priority, ['high', 'medium', 'low'], 'medium'),
    status: oneOf(r.status, kind === 'gift' ? ['want', 'ordered', 'purchased', 'given'] : ['want', 'ordered', 'purchased'], 'want'),
    favorite: !!r.favorite,
    imageId: okId(r.imageId) ? r.imageId : null,
    imageUrl: str(r.imageUrl),
    // when it was marked purchased (or bought/given for gifts); null while still wanted
    purchasedAt: ['purchased', 'given'].includes(r.status) && num(r.purchasedAt) ? r.purchasedAt : null,
    // earlier prices, oldest first; the current price is `price`
    priceHistory: Array.isArray(r.priceHistory) ? r.priceHistory.filter((h) => h && num(h.price) != null && h.price >= 0 && num(h.at)).map((h) => ({ price: h.price, at: h.at })).slice(-20) : [],
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

/** Category: a user-made collection. order = display position on Home. */
export function normCategory(r) {
  if (!r || !okId(r.id)) return null;
  return {
    id: r.id, name: str(r.name).trim() || 'Untitled collection', description: str(r.description),
    icon: str(r.icon).slice(0, 4), accent: /^#[0-9a-f]{6}$/i.test(r.accent) ? r.accent : '#E07070',
    itemLabel: str(r.itemLabel).trim() || 'item',
    coverImageId: okId(r.coverImageId) ? r.coverImageId : null,
    order: num(r.order) ?? 0,
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

/** Outfit: pieces is the ordered outfit-to-product relationship [{id, productId}]. Products are referenced, never copied. */
export function normOutfit(r) {
  if (!r || !okId(r.id)) return null;
  return {
    id: r.id, name: str(r.name).trim() || 'Untitled outfit', description: str(r.description),
    tags: Array.isArray(r.tags) ? r.tags.map(str).filter(Boolean) : [],
    season: str(r.season), occasion: str(r.occasion), notes: str(r.notes), favorite: !!r.favorite,
    coverImageId: okId(r.coverImageId) ? r.coverImageId : null,
    pieces: Array.isArray(r.pieces) ? r.pieces.filter((p) => p && okId(p.productId)).map((p) => ({ id: okId(p.id) ? p.id : p.productId, productId: p.productId })) : [],
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

/** Routine: steps are ordered; step number = position. A step links a makeup product OR holds a standalone product. */
export function normRoutine(r) {
  if (!r || !okId(r.id)) return null;
  const steps = Array.isArray(r.steps) ? r.steps.filter(Boolean).map((s, i) => ({
    id: okId(s.id) ? s.id : r.id + '-s' + i,
    productId: okId(s.productId) ? s.productId : null,
    standalone: s.standalone && typeof s.standalone === 'object'
      ? { name: str(s.standalone.name), brand: str(s.standalone.brand), shade: str(s.standalone.shade) }
      : { name: '', brand: '', shade: '' },
    instructions: str(s.instructions), notes: str(s.notes), owned: !!s.owned,
  })) : [];
  return {
    id: r.id, name: str(r.name).trim() || 'Untitled routine', description: str(r.description),
    occasion: str(r.occasion), duration: str(r.duration), notes: str(r.notes), favorite: !!r.favorite,
    coverImageId: okId(r.coverImageId) ? r.coverImageId : null, steps,
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

const isoDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : '#E07070');

/** Person: a gift profile for someone the user shops for. Gift ideas are products with kind 'gift' and this personId. */
export function normPerson(r) {
  if (!r || !okId(r.id)) return null;
  return {
    id: r.id, name: str(r.name).trim() || 'Unnamed', relationship: str(r.relationship), birthday: isoDate(r.birthday),
    budget: num(r.budget) != null && r.budget >= 0 ? r.budget : null,
    clothingSize: str(r.clothingSize), shoeSize: str(r.shoeSize), ringSize: str(r.ringSize),
    favoriteColors: str(r.favoriteColors), likes: str(r.likes), dislikes: str(r.dislikes), notes: str(r.notes),
    accent: hex(r.accent), coverImageId: okId(r.coverImageId) ? r.coverImageId : null,
    eventIds: Array.isArray(r.eventIds) ? [...new Set(r.eventIds.filter(okId))] : [], // gift lists shown on the profile: 'birthday' or occasion ids
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

/** Occasion: a holiday or event list. productIds references the user's own wishlist items (never copies); gifts point here via occasionId. */
export function normOccasion(r) {
  if (!r || !okId(r.id)) return null;
  return {
    id: r.id, name: str(r.name).trim() || 'Untitled occasion', date: isoDate(r.date), yearly: r.yearly !== false,
    icon: str(r.icon).slice(0, 4), accent: hex(r.accent), description: str(r.description),
    productIds: Array.isArray(r.productIds) ? [...new Set(r.productIds.filter(okId))] : [],
    coverImageId: okId(r.coverImageId) ? r.coverImageId : null,
    createdAt: ts(r.createdAt), updatedAt: ts(r.updatedAt || r.createdAt),
  };
}

export const NORMALIZERS = { products: normProduct, categories: normCategory, outfits: normOutfit, routines: normRoutine, people: normPerson, occasions: normOccasion };

export function normalizeAll(raw) {
  const out = {}; let invalid = 0;
  for (const [k, fn] of Object.entries(NORMALIZERS)) {
    const list = Array.isArray(raw[k]) ? raw[k] : [];
    const seen = new Set();
    out[k] = [];
    list.forEach((r) => { const n = fn(r); if (n && !seen.has(n.id)) { seen.add(n.id); out[k].push(n); } else invalid++; });
  }
  // custom items whose collection is gone are kept visible by re-homing as invalid count only
  const catIds = new Set(out.categories.map((c) => c.id));
  const personIds = new Set(out.people.map((p) => p.id));
  const occIds = new Set(out.occasions.map((o) => o.id));
  out.products = out.products.filter((p) => {
    if ((p.kind === 'custom' && !catIds.has(p.categoryId)) || (p.kind === 'gift' && !personIds.has(p.personId))) { invalid++; return false; }
    return true;
  }).map((p) => (p.occasionId && p.occasionId !== 'birthday' && !occIds.has(p.occasionId) ? { ...p, occasionId: null } : p));
  out.people = out.people.map((p) => ({ ...p, eventIds: p.eventIds.filter((e) => e === 'birthday' || occIds.has(e)) }));
  const ownIds = new Set(out.products.filter((p) => p.kind !== 'gift').map((p) => p.id));
  out.occasions = out.occasions.map((o) => ({ ...o, productIds: o.productIds.filter((id) => ownIds.has(id)) }));
  return { data: out, invalid };
}

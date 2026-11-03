import React from 'react';
import { getAll, getOne, commit, forgetImage } from './db.js';
import { normalizeAll, normProduct, normCategory, normOutfit, normRoutine, normPerson, normOccasion } from './model.js';
import { uid, sortOccasions, isArchived } from './util.js';

const { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } = React;
const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const EMPTY = { products: [], categories: [], outfits: [], routines: [], people: [], occasions: [] };
const ALL_STORES = ['products', 'categories', 'outfits', 'routines', 'people', 'occasions', 'images'];

const isDone = (s) => s === 'purchased' || s === 'given';

export function StoreProvider({ children, onError, onDeleted, onPurchased }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [invalid, setInvalid] = useState(0);
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const dataRef = useRef(EMPTY);
  dataRef.current = data;
  const savedTimer = useRef(null);

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const raw = {};
      for (const s of Object.keys(EMPTY)) raw[s] = await getAll(s);
      const { data: d, invalid: bad } = normalizeAll(raw);
      setData(d); setInvalid(bad);
    } catch (e) {
      if (!quiet) setLoadError(e.message || String(e));
    } finally { if (!quiet) setLoading(false); lastLoad.current = Date.now(); }
  }, []);
  const lastLoad = useRef(0);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onShow = () => { if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > 30000 && !document.querySelector('.modal')) load(true); };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [load]);

  /** Write ops in one transaction, then update memory. Returns true on success. */
  const run = useCallback(async (ops, next) => {
    clearTimeout(savedTimer.current);
    setStatus({ state: 'saving', message: 'Saving…' });
    try {
      await commit(ops);
      setData((cur) => next(cur));
      (ops.del?.images || []).forEach(forgetImage);
      setStatus({ state: 'saved', message: 'Saved' });
      savedTimer.current = setTimeout(() => setStatus({ state: 'idle', message: '' }), 2200);
      return true;
    } catch (e) {
      const msg = /quota/i.test(String(e && (e.name + e.message))) ? 'Out of storage space on this device. Remove some images and try again.' : (e?.message || 'Could not save.');
      setStatus({ state: 'error', message: "Couldn't save: " + msg });
      onError && onError("Couldn't save. " + msg);
      return false;
    }
  }, [onError]);

  /** Purchase date + price history bookkeeping for a product being saved over `prev`. */
  function track(prev, rec) {
    const now = Date.now();
    const out = { ...rec };
    if (isDone(out.status)) out.purchasedAt = prev && isDone(prev.status) ? (prev.purchasedAt || now) : now;
    else out.purchasedAt = null;
    out.priceHistory = prev ? [...(prev.priceHistory || [])] : [];
    if (prev && prev.price != null && prev.price !== out.price) out.priceHistory = [...out.priceHistory, { price: prev.price, at: prev.updatedAt || now }].slice(-20);
    return out;
  }
  const justBought = (prev, rec) => isDone(rec.status) && !(prev && isDone(prev.status));
  const readImages = async (ids) => (await Promise.all(ids.filter(Boolean).map((i) => getOne('images', i).catch(() => null)))).filter(Boolean);

  const replaceIn = (list, rec) => (list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec]);

  // image helper: returns {imageId, put, del}
  function imageOps(oldId, file, keep) {
    const put = [], del = [];
    let id = keep ? oldId : null;
    if (file) { id = uid(); put.push({ id, blob: file, type: file.type, createdAt: Date.now() }); }
    if (oldId && oldId !== id) del.push(oldId);
    return { id, put, del };
  }

  const actions = useMemo(() => ({
    async saveProduct(draft, file, keepImage) {
      const now = Date.now();
      const prev = dataRef.current.products.find((p) => p.id === draft.id);
      const img = imageOps(prev?.imageId || null, file, keepImage);
      const rec = track(prev, normProduct({ ...draft, id: draft.id || uid(), imageId: img.id, createdAt: prev?.createdAt || now, updatedAt: now }));
      const ok = await run({ put: { products: [rec], images: img.put }, del: { images: img.del } }, (d) => ({ ...d, products: replaceIn(d.products, rec) }));
      if (ok && justBought(prev, rec)) onPurchased && onPurchased(rec);
      return ok ? rec : null;
    },
    async patchProduct(id, patch) {
      const p = dataRef.current.products.find((x) => x.id === id); if (!p) return false;
      const rec = track(p, { ...p, ...patch, updatedAt: Date.now() });
      const ok = await run({ put: { products: [rec] } }, (d) => ({ ...d, products: replaceIn(d.products, rec) }));
      if (ok && justBought(p, rec)) onPurchased && onPurchased(rec);
      return ok;
    },
    /** Deleting a product also removes its references from outfits and routines in the same transaction. */
    async deleteProducts(ids) {
      const set = new Set(ids);
      const d0 = dataRef.current;
      const prods = d0.products.filter((p) => set.has(p.id));
      const now = Date.now();
      const outfits = d0.outfits.filter((o) => o.pieces.some((p) => set.has(p.productId)))
        .map((o) => ({ ...o, pieces: o.pieces.filter((p) => !set.has(p.productId)), updatedAt: now }));
      const routines = d0.routines.filter((r) => r.steps.some((s) => set.has(s.productId)))
        .map((r) => ({ ...r, updatedAt: now, steps: r.steps.map((s) => {
          if (!set.has(s.productId)) return s;
          const p = prods.find((x) => x.id === s.productId);
          return { ...s, productId: null, standalone: { name: p?.name || '', brand: p?.brand || '', shade: p?.shadeName || '' } };
        }) }));
      const occasions = d0.occasions.filter((o) => o.productIds.some((id) => set.has(id)))
        .map((o) => ({ ...o, productIds: o.productIds.filter((id) => !set.has(id)), updatedAt: now }));
      const swap = (list, changed) => list.map((x) => changed.find((c) => c.id === x.id) || x);
      // keep everything needed to undo: the items, their photos, and the lists they were in before
      const undo = { put: {
        products: prods, images: await readImages(prods.map((p) => p.imageId)),
        outfits: d0.outfits.filter((o) => outfits.some((x) => x.id === o.id)),
        routines: d0.routines.filter((r) => routines.some((x) => x.id === r.id)),
        occasions: d0.occasions.filter((o) => occasions.some((x) => x.id === o.id)),
      } };
      const ok = await run(
        { put: { outfits, routines, occasions }, del: { products: ids, images: prods.map((p) => p.imageId).filter(Boolean) } },
        (d) => ({ ...d, products: d.products.filter((p) => !set.has(p.id)), outfits: swap(d.outfits, outfits), routines: swap(d.routines, routines), occasions: swap(d.occasions, occasions) }),
      );
      if (ok && onDeleted) onDeleted(prods.length === 1 ? `Deleted ${prods[0].name}` : `Deleted ${prods.length} items`, () => restoreSnap(undo));
      return ok;
    },
    async savePerson(draft, file, keepImage) { return saveDoc('people', normPerson, draft, file, keepImage); },
    async saveOccasion(draft, file, keepImage) { return saveDoc('occasions', normOccasion, draft, file, keepImage); },
    /** Deletes a gift profile and only that person's gift ideas. */
    async deletePerson(id) {
      const d0 = dataRef.current;
      const person = d0.people.find((p) => p.id === id); if (!person) return false;
      const gifts = d0.products.filter((p) => p.kind === 'gift' && p.personId === id);
      return run(
        { del: { people: [id], products: gifts.map((g) => g.id), images: [person.coverImageId, ...gifts.map((g) => g.imageId)].filter(Boolean) } },
        (d) => ({ ...d, people: d.people.filter((p) => p.id !== id), products: d.products.filter((p) => !(p.kind === 'gift' && p.personId === id)) }),
      );
    },
    /** Deletes an occasion list. Wishlist items and gifts stay; gifts just lose the occasion tag. */
    async deleteOccasion(id) {
      const d0 = dataRef.current;
      const occ = d0.occasions.find((o) => o.id === id); if (!occ) return false;
      const now = Date.now();
      const gifts = d0.products.filter((p) => p.occasionId === id).map((p) => ({ ...p, occasionId: null, updatedAt: now }));
      const people = d0.people.filter((p) => p.eventIds.includes(id)).map((p) => ({ ...p, eventIds: p.eventIds.filter((e) => e !== id), updatedAt: now }));
      return run(
        { put: { products: gifts, people }, del: { occasions: [id], images: [occ.coverImageId].filter(Boolean) } },
        (d) => ({ ...d, occasions: d.occasions.filter((o) => o.id !== id), products: d.products.map((p) => gifts.find((g) => g.id === p.id) || p), people: d.people.map((p) => people.find((x) => x.id === p.id) || p) }),
      );
    },
    async saveOutfit(draft, file, keepImage) { return saveDoc('outfits', normOutfit, draft, file, keepImage); },
    async saveRoutine(draft, file, keepImage) { return saveDoc('routines', normRoutine, draft, file, keepImage); },
    async saveCategory(draft, file, keepImage) {
      const isNew = !dataRef.current.categories.some((c) => c.id === draft.id);
      const order = isNew ? Math.max(-1, ...dataRef.current.categories.map((c) => c.order)) + 1 : draft.order;
      return saveDoc('categories', normCategory, { ...draft, order }, file, keepImage);
    },
    async patchDoc(store, id, patch) {
      const r = dataRef.current[store].find((x) => x.id === id); if (!r) return false;
      const rec = { ...r, ...patch, updatedAt: Date.now() };
      return run({ put: { [store]: [rec] } }, (d) => ({ ...d, [store]: replaceIn(d[store], rec) }));
    },
    async duplicateDoc(store, id) {
      const r = dataRef.current[store].find((x) => x.id === id); if (!r) return null;
      const now = Date.now();
      // cover image is shared by reference only if none; copy blob reference by re-saving is avoided: duplicate drops the custom cover
      const rec = { ...r, id: uid(), name: r.name + ' (copy)', favorite: false, coverImageId: null, createdAt: now, updatedAt: now };
      if (rec.pieces) rec.pieces = r.pieces.map((p) => ({ ...p, id: uid() }));
      if (rec.steps) rec.steps = r.steps.map((s) => ({ ...s, id: uid(), standalone: { ...s.standalone } }));
      const ok = await run({ put: { [store]: [rec] } }, (d) => ({ ...d, [store]: [...d[store], rec] }));
      return ok ? rec : null;
    },
    async deleteDoc(store, id) {
      const r = dataRef.current[store].find((x) => x.id === id); if (!r) return false;
      const undo = { put: { [store]: [r], images: await readImages([r.coverImageId]) } };
      const ok = await run({ del: { [store]: [id], images: [r.coverImageId].filter(Boolean) } }, (d) => ({ ...d, [store]: d[store].filter((x) => x.id !== id) }));
      if (ok && onDeleted) onDeleted(`Deleted ${r.name}`, () => restoreSnap(undo));
      return ok;
    },

    /** Deletes a collection and only the items that belong to it. */
    async deleteCategory(id) {
      const d0 = dataRef.current;
      const cat = d0.categories.find((c) => c.id === id); if (!cat) return false;
      const items = d0.products.filter((p) => p.kind === 'custom' && p.categoryId === id);
      return run(
        { del: { categories: [id], products: items.map((p) => p.id), images: [cat.coverImageId, ...items.map((p) => p.imageId)].filter(Boolean) } },
        (d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id), products: d.products.filter((p) => !(p.kind === 'custom' && p.categoryId === id)) }),
      );
    },
    async reorderCategories(orderedIds) {
      const now = Date.now();
      const recs = orderedIds.map((cid, i) => ({ ...dataRef.current.categories.find((c) => c.id === cid), order: i, updatedAt: now }));
      return run({ put: { categories: recs } }, (d) => ({ ...d, categories: d.categories.map((c) => recs.find((r) => r.id === c.id) || c) }));
    },
    /** mode: 'replace' wipes everything first; 'merge' keeps existing records and overwrites matching ids. */
    async importAll(clean, images, mode) {
      const ops = { put: { ...clean, images }, clear: mode === 'replace' ? ALL_STORES : [] };
      return run(ops, (d) => {
        if (mode === 'replace') return clean;
        const merged = {};
        for (const k of Object.keys(EMPTY)) { let list = d[k]; clean[k].forEach((r) => { list = replaceIn(list, r); }); merged[k] = list; }
        return merged;
      });
    },
    async clearAll() {
      return run({ clear: ALL_STORES }, () => EMPTY);
    },
  }), [run, onDeleted, onPurchased]);

  /** Puts back exactly what a delete removed. */
  function restoreSnap(undo) {
    return run({ put: undo.put }, (d) => {
      const out = { ...d };
      Object.entries(undo.put).forEach(([k, recs]) => { if (k !== 'images' && out[k]) recs.forEach((r) => { out[k] = replaceIn(out[k], r); }); });
      return out;
    });
  }

  async function saveDoc(store, norm, draft, file, keepImage) {
    const now = Date.now();
    const prev = dataRef.current[store].find((x) => x.id === draft.id);
    const img = imageOps(prev?.coverImageId || null, file, keepImage);
    const rec = norm({ ...draft, id: draft.id || uid(), coverImageId: img.id, createdAt: prev?.createdAt || now, updatedAt: now });
    const ok = await run({ put: { [store]: [rec], images: img.put }, del: { images: img.del } }, (d) => ({ ...d, [store]: replaceIn(d[store], rec) }));
    return ok ? rec : null;
  }

  const byId = useMemo(() => Object.fromEntries(data.products.map((p) => [p.id, p])), [data.products]);
  const categories = useMemo(() => [...data.categories].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt), [data.categories]);

  const people = useMemo(() => [...data.people].sort((a, b) => a.name.localeCompare(b.name)), [data.people]);
  // Lists whose date has passed live only in Settings › Archived Lists, along with the gifts tagged to them.
  const allOccasions = useMemo(() => sortOccasions(data.occasions), [data.occasions]);
  const occasions = useMemo(() => allOccasions.filter((o) => !isArchived(o)), [allOccasions]);
  const archivedOccasions = useMemo(() => allOccasions.filter(isArchived).sort((a, b) => b.date.localeCompare(a.date)), [allOccasions]);
  const archivedIds = useMemo(() => new Set(archivedOccasions.map((o) => o.id)), [archivedOccasions]);
  const value = { ...data, categories, people, occasions, allOccasions, archivedOccasions, archivedIds, byId, loading, loadError, invalid, status, actions, reload: load };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

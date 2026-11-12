import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, IconBtn, Icon, Field, Img, ImageInput, Modal, Empty, Chip, useUi, useDirty, useGuardedClose } from './ui.jsx';
import { CLOTHING_TYPES, clothingType } from './data.jsx';
import { readProductLink, fetchProductPhoto, guessMakeupType } from './linkfill.js';
import { money, fmtDate, matches, sortList, SORTS, STATUS, PRIORITY, label, validUrl, parsePrice, statusList } from './util.js';

const { useState, useMemo, useRef } = React;

export const MAKEUP_TYPES = ['Primer', 'Foundation', 'Concealer', 'Powder', 'Blush', 'Bronzer', 'Contour', 'Highlighter', 'Eyeshadow', 'Eyeliner', 'Mascara', 'Brow', 'Lip liner', 'Lipstick', 'Lip gloss', 'Lip balm', 'Setting spray', 'Skincare', 'Tool'];

export function kindLabel(p, categories, people = []) {
  if (p.kind === 'clothing') return 'Clothes';
  if (p.kind === 'makeup') return 'Makeup';
  if (p.kind === 'gift') return 'Gift for ' + (people.find((x) => x.id === p.personId)?.name || 'someone');
  return categories.find((c) => c.id === p.categoryId)?.name || 'Collection';
}

function subtitle(p) {
  if (p.kind === 'makeup') return [p.brand, p.shadeName && `${p.shadeName}${p.shadeNumber ? ' ' + p.shadeNumber : ''}`].filter(Boolean).join(' · ');
  return [p.brand, p.store !== p.brand ? p.store : ''].filter(Boolean).join(' · ');
}

/** Change from the first price you saved: { diff, first } or null. */
export function priceChange(p) {
  const first = p.priceHistory && p.priceHistory.length ? p.priceHistory[0].price : null;
  if (first == null || p.price == null || first === p.price) return null;
  return { diff: Math.round((p.price - first) * 100) / 100, first };
}

export function ProductCard({ p, onOpen }) {
  const { actions } = useStore();
  const { open } = useNav();
  const press = useRef({ timer: null, fired: false, x: 0, y: 0 });
  const change = priceChange(p);
  const showActions = () => open({ type: 'quick', id: p.id, stack: true });
  // press and hold (phones) or right-click (computers) opens quick actions
  const touchStart = (e) => {
    const t = e.touches[0]; press.current.fired = false; press.current.x = t.clientX; press.current.y = t.clientY;
    press.current.timer = setTimeout(() => { press.current.fired = true; showActions(); }, 450);
  };
  const touchMove = (e) => { const t = e.touches[0]; if (Math.abs(t.clientX - press.current.x) > 8 || Math.abs(t.clientY - press.current.y) > 8) clearTimeout(press.current.timer); };
  // after a long press, stop the phone from turning the lift into a tap on whatever opened underneath
  const touchEnd = (e) => { clearTimeout(press.current.timer); if (press.current.fired && e.cancelable) e.preventDefault(); };
  return (
    <article className="pcard">
      <button type="button" className="pcard-hit" aria-label={`Open ${p.name}`}
        onClick={(e) => { if (press.current.fired) { e.preventDefault(); press.current.fired = false; return; } onOpen(); }}
        onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} onTouchCancel={touchEnd}
        onContextMenu={(e) => { e.preventDefault(); clearTimeout(press.current.timer); showActions(); }}>
        <div className="pcard-img">
          <Img imageId={p.imageId} url={p.imageUrl} alt="" />
          {p.status !== 'want' && <span className={`pcard-status st-${p.status}`}>{label(statusList(p.kind), p.status)}</span>}
        </div>
        <div className="pcard-body">
          <p className="pcard-name">{p.name}</p>
          {subtitle(p) && <p className="pcard-sub">{subtitle(p)}</p>}
          <p className="pcard-meta">
            <span className="num">{money(p.price)}</span>
            {change ? <span className={`price-tag ${change.diff < 0 ? 'down' : 'up'}`} title={`Was ${money(change.first)} when you saved it`}>{change.diff < 0 ? '↓' : '↑'} {money(Math.abs(change.diff)).replace('.00', '')}</span>
              : p.priority === 'high' && <span className="prio">High priority</span>}
          </p>
        </div>
      </button>
      <IconBtn className={`fav ${p.favorite ? 'on' : ''}`} icon="heart" filled={p.favorite}
        label={p.favorite ? `Remove ${p.name} from favorites` : `Add ${p.name} to favorites`}
        aria-pressed={p.favorite} onClick={() => actions.patchProduct(p.id, { favorite: !p.favorite })} />
      <IconBtn className="pcard-more" icon="more" label={`More actions for ${p.name}`} onClick={showActions} />
    </article>
  );
}

/** Reusable wishlist section: toolbar (search, filters, sort) + grid. Used for clothes, makeup and every custom collection. */
export function ProductSection({ kind, categoryId, personId, fixedOcc, title, eyebrow, addLabel, emptyTitle, emptyBody, id }) {
  const { products, occasions, archivedIds } = useStore();
  const [occ, setOcc] = useState('all');
  const statuses = statusList(kind);
  const { open } = useNav();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [prio, setPrio] = useState('all');
  const [type, setType] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('newest');

  const mine = useMemo(() => products.filter((p) => p.kind === kind && (kind !== 'custom' || p.categoryId === categoryId) && (kind !== 'gift' || (p.personId === personId && !archivedIds.has(p.occasionId))) && (!fixedOcc || p.occasionId === fixedOcc)), [products, kind, categoryId, personId, fixedOcc, archivedIds]);
  const typeOf = (p) => (kind === 'clothing' ? clothingType(p) : p.productType);
  const types = useMemo(() => [...new Set(mine.map(typeOf).filter(Boolean))].sort(), [mine]);
  const list = useMemo(() => sortList(mine.filter((p) =>
    (status === 'all' || p.status === status) && (prio === 'all' || p.priority === prio) && (type === 'all' || typeOf(p) === type) && (occ === 'all' || (occ === 'none' ? !p.occasionId : p.occasionId === occ)) &&
    (!favOnly || p.favorite) && matches(q, p.name, p.brand, p.store, p.color, p.size, p.productType, p.shadeName, p.shadeNumber, p.notes)), sort), [mine, q, status, prio, type, favOnly, sort, occ]);
  const filtered = q || status !== 'all' || prio !== 'all' || type !== 'all' || occ !== 'all' || favOnly;
  const add = () => open({ type: 'product-edit', kind, categoryId, personId, occasionId: fixedOcc || undefined });

  return (
    <section className="section" aria-labelledby={id}>
      <div className="section-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="section-title" id={id}>{title} <span className="count num">{mine.length}</span></h2>
        </div>
        <Btn icon="plus" onClick={add}>{addLabel}</Btn>
      </div>
      {mine.length > 0 && (
        <div className="toolbar" role="group" aria-label={`Filter ${title}`}>
          <label className="search-mini">
            <Icon name="search" size={16} />
            <input className="input" type="search" placeholder={`Search ${title.toLowerCase()}`} aria-label={`Search ${title}`} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="filters">
          <select className="input select" aria-label="Purchase status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>{statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {kind === 'gift' && !fixedOcc && occasions.length > 0 && (
            <select className="input select" aria-label="Occasion" value={occ} onChange={(e) => setOcc(e.target.value)}>
              <option value="all">Any occasion</option><option value="none">No occasion</option>
              {occasions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <select className="input select" aria-label="Priority" value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="all">Any priority</option>{PRIORITY.map(([v, l]) => <option key={v} value={v}>{l} priority</option>)}
          </select>
          {(kind === 'makeup' || kind === 'clothing') && types.length > 0 && (
            <select className="input select" aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All types</option>{types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <select className="input select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button type="button" className={`toggle ${favOnly ? 'on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
            <Icon name="heart" size={15} filled={favOnly} />Favorites
          </button>
          </div>
        </div>
      )}
      {mine.length === 0 ? (
        <Empty title={emptyTitle} body={emptyBody} action={<Btn variant="secondary" icon="plus" onClick={add}>{addLabel}</Btn>} />
      ) : list.length === 0 ? (
        <Empty title="Nothing matches" body="Try a different search or clear the filters."
          action={filtered && <Btn variant="secondary" onClick={() => { setQ(''); setStatus('all'); setPrio('all'); setType('all'); setOcc('all'); setFavOnly(false); }}>Clear filters</Btn>} />
      ) : (
        <div className="grid products">
          {list.map((p) => <ProductCard key={p.id} p={p} onOpen={() => open({ type: 'product-detail', id: p.id })} />)}
        </div>
      )}
    </section>
  );
}

// ---------- editor ----------
const blank = (kind, categoryId, personId, occasionId) => ({ id: null, kind, categoryId: categoryId || null, personId: personId || '', occasionId: occasionId || '', name: '', brand: '', store: '', url: '', price: '', size: '', color: '', productType: '', shadeName: '', shadeNumber: '', notes: '', priority: 'medium', status: 'want', favorite: false, imageUrl: '' });

export function ProductEditor({ product, kind, categoryId, personId, occasionId, onClose, onSaved }) {
  const { actions, categories, people, occasions, allOccasions } = useStore();
  const k = product?.kind || kind;
  const cat = categories.find((c) => c.id === (product?.categoryId || categoryId));
  const fixedPerson = product?.personId || personId;
  const init = product ? { ...product, price: product.price == null ? '' : String(product.price), personId: product.personId || '', occasionId: product.occasionId || '' } : blank(k, categoryId, personId, occasionId);
  const statuses = statusList(k);
  const [d, setD] = useState(init);
  const [img, setImg] = useState({ file: null, keep: !!product?.imageId, imageId: product?.imageId, url: product?.imageUrl || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = useDirty({ init, img: { keep: !!product?.imageId, url: product?.imageUrl || '' } }, { init: d, img: { keep: img.keep, url: img.url, f: img.file ? img.file.name + img.file.size : undefined } });
  const close = useGuardedClose(dirty, onClose);
  const set = (key) => (e) => setD({ ...d, [key]: e.target.value });
  const [linkState, setLinkState] = useState({ busy: false, msg: '', kind: '' });
  const live = useRef({ d, img });
  live.current = { d, img };

  /** Read the store page and fill in whatever is still empty. Nothing the person typed gets replaced. */
  async function fillFromLink(rawUrl) {
    const url = (rawUrl ?? d.url).trim();
    if (!validUrl(url) || !url) { setLinkState({ busy: false, kind: 'error', msg: 'Paste a full product link that starts with https://' }); return; }
    setLinkState({ busy: true, kind: '', msg: 'Reading the product page…' });
    try {
      const info = await readProductLink(url);
      const filled = [];
      const prev = live.current.d;
      {
        const next = { ...prev, url };
        const put = (key, val, label) => { if (val != null && val !== '' && !String(prev[key] ?? '').trim()) { next[key] = String(val); filled.push(label); } };
        put('name', info.name, 'name');
        put('brand', info.brand, 'brand');
        if (k !== 'makeup') put('store', info.store, 'store');
        if (info.price != null && (!info.currency || info.currency === 'USD')) put('price', info.price.toFixed(2).replace(/\.00$/, ''), 'price');
        if (k === 'clothing') { put('color', info.color, 'color'); put('productType', clothingType({ name: info.name || prev.name, productType: '' }), 'type'); }
        if (k === 'makeup') { put('shadeName', info.color, 'shade'); put('productType', guessMakeupType(info.name || prev.name), 'type'); }
        setD(next);
      }
      const cur = live.current.img;
      const hasPhoto = cur.file || (cur.keep && cur.imageId) || cur.url;
      if (info.image && !hasPhoto) {
        setLinkState({ busy: true, kind: '', msg: 'Saving the photo…' });
        const file = await fetchProductPhoto(info.image);
        if (file) setImg((v) => ({ ...v, file, keep: false, url: '' })); else setImg((v) => ({ ...v, url: info.image }));
        filled.push('photo');
      }
      const where = info.store ? ` from ${info.store}` : '';
      const odd = info.price != null && info.currency && info.currency !== 'USD' ? ` The price is in ${info.currency}, so add the USD price yourself.` : '';
      setLinkState({ busy: false, kind: filled.length ? 'ok' : 'error',
        msg: filled.length ? `Filled in ${filled.join(', ').replace(/, ([^,]*)$/, ' and $1')}${where}.${info.price == null ? ' The store didn\u2019t share a price, so add it yourself.' : ''} ${k === 'makeup' ? 'Check the shade' : k === 'clothing' ? 'Check the size and color' : 'Check the details'} before saving.${odd}` : `Everything was already filled in.${odd}` });
    } catch (err) {
      setLinkState({ busy: false, kind: 'error', msg: err.message });
    }
  }

  async function save(e) {
    e.preventDefault();
    const er = {};
    if (!d.name.trim()) er.name = 'Give this item a name.';
    const price = parsePrice(d.price);
    if (Number.isNaN(price)) er.price = 'Enter a price like 48 or 48.50.';
    if (!validUrl(d.url.trim())) er.url = 'Enter a full link starting with https://';
    if (!validUrl(img.url.trim())) er.imageUrl = 'Image link must start with https://';
    if (k === 'gift' && !d.personId) er.personId = 'Choose who this gift is for.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const rec = await actions.saveProduct({ ...d, name: d.name.trim(), url: d.url.trim(), price, imageUrl: img.url.trim(), personId: d.personId || null, occasionId: d.occasionId || null }, img.file, img.keep);
    setSaving(false);
    if (rec) onSaved ? onSaved(rec) : onClose();
  }

  const noun = k === 'clothing' ? 'clothing item' : k === 'makeup' ? 'makeup product' : k === 'gift' ? 'gift idea' : (cat?.itemLabel || 'item');
  const forName = people.find((p) => p.id === fixedPerson)?.name;
  return (
    <Modal title={product ? `Edit ${noun}` : `Add ${noun}`} onClose={close} size="lg"
      footer={<>
        <Btn variant="secondary" onClick={close}>Cancel</Btn>
        <Btn type="submit" form="product-form" disabled={saving}>{saving ? 'Saving…' : product ? 'Save changes' : k === 'gift' ? 'Save gift idea' : 'Add to wishlist'}</Btn>
      </>}>
      <form id="product-form" className="form" onSubmit={save} noValidate>
        {cat && <p className="form-context">In <strong>{cat.name}</strong></p>}
        {k === 'gift' && fixedPerson && forName && <p className="form-context">For <strong>{forName}</strong></p>}
        <div className="link-fill" role="group" aria-labelledby="link-fill-label">
          <label id="link-fill-label" htmlFor="product-link" className="label-text">Product link</label>
          <div className="link-fill-row">
            <input id="product-link" className="input" type="url" inputMode="url" value={d.url} placeholder="Paste a link from any store"
              aria-invalid={errors.url ? 'true' : undefined}
              onChange={set('url')}
              onPaste={(e) => { const t = (e.clipboardData?.getData('text') || '').trim(); if (/^https?:\/\//i.test(t) && !d.name.trim()) setTimeout(() => fillFromLink(t), 0); }} />
            <Btn variant="secondary" icon="search" disabled={linkState.busy || !d.url.trim()} onClick={() => fillFromLink()}>{linkState.busy ? 'Reading…' : 'Fill in details'}</Btn>
          </div>
          {errors.url && <p className="error">{errors.url}</p>}
          {linkState.msg && <p className={`link-fill-msg ${linkState.kind}`} role="status">{linkState.msg}</p>}
          {!linkState.msg && !errors.url && <p className="hint">Paste a link and MUSE fills in the name, brand, price and photo when the store shares them.</p>}
        </div>
        <div className="form-grid">
          {k === 'gift' && !fixedPerson && (
            <Field label="For *" error={errors.personId} full>
              <select className="input select" value={d.personId} onChange={set('personId')}>
                <option value="">Choose a person</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Name *" error={errors.name} full><input className="input" value={d.name} onChange={set('name')} placeholder={k === 'makeup' ? 'Soft Pinch liquid blush' : k === 'gift' ? 'Cashmere beanie' : 'Linen wrap midi skirt'} /></Field>
          <Field label="Brand"><input className="input" value={d.brand} onChange={set('brand')} /></Field>
          {k !== 'makeup' && <Field label="Store"><input className="input" value={d.store} onChange={set('store')} /></Field>}
          {k === 'makeup' && (
            <Field label="Product type">
              <select className="input select" value={d.productType} onChange={set('productType')}>
                <option value="">Choose a type</option>
                {[...new Set([...MAKEUP_TYPES, d.productType].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}
          {k === 'clothing' && (
            <Field label="Type" hint="Used for your usual sizes in Your Data">
              <select className="input select" value={d.productType} onChange={set('productType')}>
                <option value="">Choose a type</option>
                {[...new Set([...CLOTHING_TYPES, d.productType].filter(Boolean))].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}
          <Field label="Price (USD)" error={errors.price}><input className="input num" inputMode="decimal" value={d.price} onChange={set('price')} placeholder="0.00" /></Field>
          {k === 'clothing' && <>
            <Field label="Size"><input className="input" value={d.size} onChange={set('size')} placeholder="S, 6, 28…" /></Field>
            <Field label="Color"><input className="input" value={d.color} onChange={set('color')} /></Field>
          </>}
          {k === 'makeup' && <>
            <Field label="Shade name"><input className="input" value={d.shadeName} onChange={set('shadeName')} /></Field>
            <Field label="Shade number"><input className="input" value={d.shadeNumber} onChange={set('shadeNumber')} /></Field>
          </>}
          {k === 'gift' && (
            <Field label="Occasion">
              <select className="input select" value={d.occasionId} onChange={set('occasionId')}>
                <option value="">No occasion</option>
                <option value="birthday">Their birthday</option>
                {d.occasionId && d.occasionId !== 'birthday' && !occasions.some((o) => o.id === d.occasionId) && <option value={d.occasionId}>{(allOccasions.find((o) => o.id === d.occasionId)?.name || 'Archived list') + ' (archived)'}</option>}
                {occasions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Priority">
            <select className="input select" value={d.priority} onChange={set('priority')}>{PRIORITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label={k === 'gift' ? 'Gift status' : 'Purchase status'}>
            <select className="input select" value={d.status} onChange={set('status')}>{statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <ImageInput label="Photo" value={img} onChange={setImg} />
          {errors.imageUrl && <p className="error full" role="alert">{errors.imageUrl}</p>}
          <Field label="Notes" full><textarea className="input" rows="3" value={d.notes} onChange={set('notes')} /></Field>
        </div>
      </form>
    </Modal>
  );
}

// ---------- detail ----------
export function ProductDetail({ id, onClose }) {
  const { byId, outfits, routines, categories, people, occasions, allOccasions, actions } = useStore();
  const { open } = useNav();
  const { confirm, toast } = useUi();
  const p = byId[id];
  if (!p) return <Modal title="Item not found" onClose={onClose} size="sm"><p>This item was deleted.</p></Modal>;
  const inOutfits = outfits.filter((o) => o.pieces.some((x) => x.productId === id));
  const inRoutines = routines.filter((r) => r.steps.some((s) => s.productId === id));
  async function del() {
    const refs = inOutfits.length + inRoutines.length;
    const ok = await confirm({ title: `Delete ${p.name}?`, danger: true, confirmLabel: 'Delete item',
      body: refs ? `It will also be removed from ${[inOutfits.length && `${inOutfits.length} outfit${inOutfits.length > 1 ? 's' : ''}`, inRoutines.length && `${inRoutines.length} routine${inRoutines.length > 1 ? 's' : ''}`].filter(Boolean).join(' and ')}. Routine steps keep its name as a standalone entry. This can't be undone.` : 'This removes it from your wishlist. This can\'t be undone.' });
    if (ok && await actions.deleteProducts([id])) onClose();
  }
  const rows = [
    [p.kind === 'gift' ? 'For' : 'Collection', p.kind === 'gift' ? (people.find((x) => x.id === p.personId)?.name || '') : kindLabel(p, categories)],
    ['Occasion', p.kind === 'gift' ? (p.occasionId === 'birthday' ? 'Birthday' : allOccasions.find((o) => o.id === p.occasionId)?.name || '') : ''], ['Brand', p.brand], ['Store', p.store], ['Type', p.productType],
    ['Shade', [p.shadeName, p.shadeNumber].filter(Boolean).join(' · ')], ['Size', p.size], ['Color', p.color],
    ['Priority', label(PRIORITY, p.priority)], ['Added', fmtDate(p.createdAt)], [p.kind === 'gift' ? (p.status === 'given' ? 'Given' : 'Bought') : 'Bought', p.purchasedAt ? fmtDate(p.purchasedAt) : ''], ['Updated', fmtDate(p.updatedAt)],
  ].filter((r) => r[1]);
  return (
    <Modal title={p.name} onClose={onClose} size="lg"
      footer={<>
        <Btn variant="ghost" icon="trash" className="danger-text" onClick={del}>Delete</Btn>
        <span className="spacer" />
        <Btn variant="secondary" icon="edit" onClick={() => open({ type: 'product-edit', product: p, back: { type: 'product-detail', id } })}>Edit</Btn>
      </>}>
      <div className="detail">
        <div className="detail-img"><Img imageId={p.imageId} url={p.imageUrl} alt={p.name} /></div>
        <div className="detail-info">
          <p className="detail-price num">{money(p.price)}</p>
          {priceChange(p) && (() => { const c = priceChange(p); return (
            <div className={`price-note ${c.diff < 0 ? 'down' : 'up'}`}>
              <strong>{c.diff < 0 ? '↓' : '↑'} {money(Math.abs(c.diff))}</strong> since you saved it at {money(c.first)}
              <ul className="price-history">
                {[...p.priceHistory, { price: p.price, at: p.updatedAt, now: true }].map((h, i) => <li key={i} className="num"><span>{fmtDate(h.at)}</span><span>{money(h.price)}{h.now ? ' (now)' : ''}</span></li>)}
              </ul>
            </div>
          ); })()}
          <div className="detail-actions">
            <label className="status-select">
              <span className="sr-only">{p.kind === 'gift' ? 'Gift status' : 'Purchase status'}</span>
              <select className="input select" value={p.status} onChange={(e) => actions.patchProduct(id, { status: e.target.value })}>
                {statusList(p.kind).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <button type="button" className={`toggle ${p.favorite ? 'on' : ''}`} aria-pressed={p.favorite} onClick={() => actions.patchProduct(id, { favorite: !p.favorite })}>
              <Icon name="heart" size={15} filled={p.favorite} />{p.favorite ? 'Favorite' : 'Add to favorites'}
            </button>
          </div>
          {p.url && validUrl(p.url) && (
            <a className="btn btn-primary" href={p.url} target="_blank" rel="noopener noreferrer"><Icon name="ext" size={16} />Open product page</a>
          )}
          <dl className="dl">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          {p.notes && <div className="notes"><p className="eyebrow">Notes</p><p>{p.notes}</p></div>}
          {p.kind !== 'gift' && <OccasionToggles product={p} />}
          {(inOutfits.length > 0 || inRoutines.length > 0) && (
            <div className="used-in">
              <p className="eyebrow">Used in</p>
              <div className="chips">
                {inOutfits.map((o) => <button key={o.id} type="button" className="chip chip-link" onClick={() => open({ type: 'outfit-edit', outfit: o })}>{o.name}</button>)}
                {inRoutines.map((r) => <button key={r.id} type="button" className="chip chip-link" onClick={() => open({ type: 'routine-edit', routine: r })}>{r.name}</button>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Multi-select picker for existing wishlist items. Returns product ids; never copies products. */
export function ProductPicker({ kind, exclude = [], onPick, onCancel, title }) {
  const { products, categories } = useStore();
  const kinds = Array.isArray(kind) ? kind : [kind];
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const list = products.filter((p) => kinds.includes(p.kind) && !exclude.includes(p.id) && matches(q, p.name, p.brand, p.productType, p.color, p.shadeName));
  const toggle = (pid) => setSel(sel.includes(pid) ? sel.filter((x) => x !== pid) : [...sel, pid]);
  const total = products.filter((p) => kinds.includes(p.kind)).length;
  return (
    <div className="picker" role="group" aria-label={title}>
      <div className="picker-head">
        <p className="picker-title">{title}</p>
        <label className="search-mini"><Icon name="search" size={16} /><input className="input" type="search" placeholder="Search your wishlist" aria-label="Search wishlist" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      {total === 0 ? <p className="hint">{kinds.length > 1 ? 'Your wishlists are empty.' : `Your ${kind === 'clothing' ? 'clothes' : 'makeup'} wishlist is empty.`} Add items on Home first.</p>
        : list.length === 0 ? <p className="hint">No other items match.</p> : (
        <div className="picker-grid">
          {list.map((p) => (
            <label key={p.id} className={`pick ${sel.includes(p.id) ? 'on' : ''}`}>
              <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
              <Img imageId={p.imageId} url={p.imageUrl} alt="" />
              <span className="pick-name">{p.name}</span>
              {kinds.length > 1 && <span className="pick-kind">{kindLabel(p, categories)}</span>}
              <span className="pick-price num">{money(p.price)}</span>
            </label>
          ))}
        </div>
      )}
      <div className="picker-foot">
        <Btn variant="secondary" size="sm" onClick={onCancel}>Cancel</Btn>
        <Btn size="sm" disabled={!sel.length} onClick={() => onPick(sel)}>Add {sel.length || ''} selected</Btn>
      </div>
    </div>
  );
}

/** Lets the user put one of their own wishlist items into holiday / occasion lists (by reference). */
function OccasionToggles({ product }) {
  const { occasions, actions } = useStore();
  const { open } = useNav();
  return (
    <div className="used-in">
      <p className="eyebrow">Holidays &amp; lists</p>
      {occasions.length === 0 ? (
        <p className="hint">Group items like this one into a holiday or occasion list. <button type="button" className="link-btn" onClick={() => open({ type: 'occasion-edit', stack: true, stay: true })}>Create one</button></p>
      ) : (
        <div className="chips">
          {occasions.map((o) => {
            const on = o.productIds.includes(product.id);
            return (
              <button key={o.id} type="button" className={`chip chip-toggle ${on ? 'on' : ''}`} aria-pressed={on}
                onClick={() => actions.patchDoc('occasions', o.id, { productIds: on ? o.productIds.filter((x) => x !== product.id) : [...o.productIds, product.id] })}>
                {on ? <Icon name="check" size={14} /> : <Icon name="plus" size={14} />}{o.name}
              </button>
            );
          })}
          <button type="button" className="chip chip-link" onClick={() => open({ type: 'occasion-edit', stack: true, stay: true })}>New list…</button>
        </div>
      )}
    </div>
  );
}

/** Quick actions sheet (press and hold a card, or tap ⋯). */
export function QuickActions({ id, onClose }) {
  const { byId, actions } = useStore();
  const { open } = useNav();
  const p = byId[id];
  if (!p) return null;
  const done = p.status === 'purchased' || p.status === 'given';
  const Row = ({ icon, title, sub, onClick, danger }) => (
    <button type="button" className={`settings-row ${danger ? 'danger-row' : ''}`} onClick={onClick}>
      <span className="settings-row-icon" aria-hidden="true"><Icon name={icon} size={20} /></span>
      <span className="settings-row-text"><span className="settings-row-title">{title}</span>{sub && <span className="muted">{sub}</span>}</span>
    </button>
  );
  const act = async (fn) => { onClose(); await fn(); };
  return (
    <Modal title={p.name} onClose={onClose} size="sm">
      <div className="settings-list quick-list">
        {!done && <Row icon="check" title={p.kind === 'gift' ? 'Mark as bought' : 'I bought it'} sub={p.price != null ? money(p.price) : undefined} onClick={() => act(() => actions.patchProduct(p.id, { status: 'purchased' }))} />}
        {p.kind === 'gift' && p.status !== 'given' && <Row icon="gift" title="Mark as given" onClick={() => act(() => actions.patchProduct(p.id, { status: 'given' }))} />}
        {done && <Row icon="back" title={p.kind === 'gift' ? 'Move back to ideas' : 'Move back to wishlist'} onClick={() => act(() => actions.patchProduct(p.id, { status: 'want' }))} />}
        {!done && <Row icon="box" title="Track a package" sub="Get a reminder before it arrives" onClick={() => open({ type: 'package-edit', productId: p.id })} />}
        <Row icon="heart" title={p.favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={() => act(() => actions.patchProduct(p.id, { favorite: !p.favorite }))} />
        <Row icon="edit" title="Edit" onClick={() => open({ type: 'product-edit', product: p })} />
        {p.url && validUrl(p.url) && (
          <a className="settings-row" href={p.url} target="_blank" rel="noopener noreferrer" onClick={onClose}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name="ext" size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">Open product page</span></span>
          </a>
        )}
        <Row icon="trash" title="Delete" sub="You can undo right after" danger onClick={() => act(() => actions.deleteProducts([p.id]))} />
      </div>
    </Modal>
  );
}

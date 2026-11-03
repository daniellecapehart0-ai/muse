import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, IconBtn, Icon, Field, Img, ImageInput, Modal, Empty, useUi, useDirty, useGuardedClose } from './ui.jsx';
import { ProductPicker } from './products.jsx';
import { money, fmtDate, matches, sortList, SORTS, SEASONS, outfitCost, uid } from './util.js';

const { useState, useMemo } = React;

/** Cover: uploaded cover image, else a collage of the first pieces. */
export function OutfitCover({ outfit }) {
  const { byId } = useStore();
  if (outfit.coverImageId) return <div className="cover"><Img imageId={outfit.coverImageId} alt="" /></div>;
  const pieces = outfit.pieces.map((p) => byId[p.productId]).filter(Boolean).slice(0, 4);
  if (!pieces.length) return <div className="cover"><div className="img-ph"><Icon name="image" size={22} /></div></div>;
  return (
    <div className={`cover collage n${pieces.length}`}>
      {pieces.map((p) => <Img key={p.id} imageId={p.imageId} url={p.imageUrl} alt="" />)}
    </div>
  );
}

export function CostLine({ cost, prefix = 'Est.' }) {
  if (!cost.count) return <span className="muted">No pieces yet</span>;
  return (
    <span className="num">
      {prefix} {money(cost.total)}
      {cost.missing > 0 && <span className="incomplete"> · {cost.missing} price{cost.missing > 1 ? 's' : ''} missing</span>}
    </span>
  );
}

function DocCard({ doc, store, cover, meta, onOpen }) {
  const { actions } = useStore();
  const { confirm, toast } = useUi();
  const noun = store === 'outfits' ? 'outfit' : 'routine';
  async function del() {
    if (await confirm({ title: `Delete ${doc.name}?`, danger: true, confirmLabel: `Delete ${noun}`, body: `The ${noun} is removed. Wishlist items it uses stay in your wishlist.` }))
      await actions.deleteDoc(store, doc.id);
  }
  return (
    <article className="dcard">
      <button type="button" className="dcard-hit" onClick={onOpen} aria-label={`Open ${doc.name}`}>
        {cover}
        <div className="dcard-body">
          <p className="dcard-name">{doc.name}</p>
          <p className="dcard-meta">{meta}</p>
        </div>
      </button>
      <div className="dcard-actions">
        <IconBtn className={`fav ${doc.favorite ? 'on' : ''}`} icon="heart" filled={doc.favorite} aria-pressed={doc.favorite}
          label={doc.favorite ? `Remove ${doc.name} from favorites` : `Add ${doc.name} to favorites`}
          onClick={() => actions.patchDoc(store, doc.id, { favorite: !doc.favorite })} />
        <IconBtn icon="copy" label={`Duplicate ${doc.name}`} onClick={async () => { if (await actions.duplicateDoc(store, doc.id)) toast(`Duplicated ${doc.name}`); }} />
        <IconBtn icon="trash" label={`Delete ${doc.name}`} onClick={del} />
      </div>
    </article>
  );
}
export { DocCard };

export function OutfitCard({ outfit }) {
  const { byId } = useStore();
  const { open } = useNav();
  const cost = outfitCost(outfit, byId);
  return <DocCard doc={outfit} store="outfits" cover={<OutfitCover outfit={outfit} />} onOpen={() => open({ type: 'outfit-edit', outfit })}
    meta={<>{cost.count} piece{cost.count === 1 ? '' : 's'} · <CostLine cost={cost} prefix="" /></>} />;
}

export function OutfitsView() {
  const { outfits, byId } = useStore();
  const { open } = useNav();
  const [q, setQ] = useState('');
  const [season, setSeason] = useState('all');
  const [occasion, setOccasion] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('updated');
  const occasions = [...new Set(outfits.map((o) => o.occasion).filter(Boolean))].sort();
  const list = useMemo(() => sortList(outfits.filter((o) => (season === 'all' || o.season === season) && (occasion === 'all' || o.occasion === occasion) && (!favOnly || o.favorite) &&
    matches(q, o.name, o.description, o.tags, o.occasion, o.season, o.notes, o.pieces.map((p) => byId[p.productId]?.name))), sort, (o) => outfitCost(o, byId).total), [outfits, q, season, occasion, favOnly, sort, byId]);
  const add = () => open({ type: 'outfit-edit' });
  return (
    <section className="section" aria-labelledby="closet-h">
      <div className="section-head">
        <div><p className="eyebrow">Organize</p><h1 className="page-title" id="closet-h">Future Closet</h1>
          <p className="lede">Put wishlist pieces together into outfits and see what each look would cost.</p></div>
        <Btn icon="plus" onClick={add}>New outfit</Btn>
      </div>
      {outfits.length > 0 && (
        <div className="toolbar">
          <label className="search-mini"><Icon name="search" size={16} /><input className="input" type="search" placeholder="Search outfits" aria-label="Search outfits" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="filters">
          <select className="input select" aria-label="Season" value={season} onChange={(e) => setSeason(e.target.value)}><option value="all">Any season</option>{SEASONS.map((s) => <option key={s}>{s}</option>)}</select>
          {occasions.length > 0 && <select className="input select" aria-label="Occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}><option value="all">Any occasion</option>{occasions.map((s) => <option key={s}>{s}</option>)}</select>}
          <select className="input select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l.replace('Price', 'Cost')}</option>)}</select>
          <button type="button" className={`toggle ${favOnly ? 'on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}><Icon name="heart" size={15} filled={favOnly} />Favorites</button>
          </div>
        </div>
      )}
      {outfits.length === 0 ? <Empty title="No outfits yet" body="Start an outfit, then add pieces from your clothes wishlist. Prices stay linked, so totals update when an item's price changes." action={<Btn variant="secondary" icon="plus" onClick={add}>New outfit</Btn>} />
        : list.length === 0 ? <Empty title="No outfits match" body="Try a different search or filter." />
        : <div className="grid docs">{list.map((o) => <OutfitCard key={o.id} outfit={o} />)}</div>}
    </section>
  );
}

const blankOutfit = () => ({ id: null, name: '', description: '', tags: [], season: '', occasion: '', notes: '', favorite: false, pieces: [] });

export function OutfitEditor({ outfit, onClose }) {
  const { actions, byId } = useStore();
  const { open } = useNav();
  const init = outfit ? { ...outfit, tagText: outfit.tags.join(', ') } : { ...blankOutfit(), tagText: '' };
  const [d, setD] = useState(init);
  const [img, setImg] = useState({ file: null, keep: !!outfit?.coverImageId, imageId: outfit?.coverImageId });
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = useDirty({ init, keep: !!outfit?.coverImageId }, { init: d, keep: img.keep, f: img.file?.name });
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const pieces = d.pieces.filter((p) => byId[p.productId]);
  const cost = outfitCost({ pieces }, byId);

  function move(i, dir) { const a = [...d.pieces]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setD({ ...d, pieces: a }); }
  async function save(e) {
    e.preventDefault();
    if (!d.name.trim()) { setErr('Give this outfit a name.'); return; }
    setSaving(true);
    const tags = d.tagText.split(',').map((t) => t.trim()).filter(Boolean);
    const { tagText, ...rest } = d;
    const rec = await actions.saveOutfit({ ...rest, name: d.name.trim(), tags, pieces }, img.file, img.keep);
    setSaving(false);
    if (rec) onClose();
  }

  return (
    <Modal title={outfit ? 'Edit outfit' : 'New outfit'} onClose={close} size="xl"
      footer={<><Btn variant="secondary" onClick={close}>Cancel</Btn><Btn type="submit" form="outfit-form" disabled={saving}>{saving ? 'Saving…' : 'Save outfit'}</Btn></>}>
      <form id="outfit-form" className="editor" onSubmit={save} noValidate>
        <div className="editor-main">
          <div className="editor-sub">
            <h3 className="sub-title">Pieces <span className="count num">{pieces.length}</span></h3>
            <p className="cost-total"><CostLine cost={cost} prefix="Estimated total" /></p>
          </div>
          {cost.missing > 0 && <p className="hint">The total is incomplete: {cost.missing} piece{cost.missing > 1 ? 's have' : ' has'} no price yet.</p>}
          {pieces.length === 0 && !picking && <Empty title="No pieces yet" body="Add clothes from your wishlist. Removing a piece here never deletes it from your wishlist." />}
          <ol className="pieces">
            {pieces.map((pc, i) => {
              const p = byId[pc.productId];
              return (
                <li key={pc.id} className="piece">
                  <div className="piece-img"><Img imageId={p.imageId} url={p.imageUrl} alt="" /></div>
                  <div className="piece-info">
                    <button type="button" className="link-btn piece-name" onClick={() => open({ type: 'product-detail', id: p.id, stack: true })}>{p.name}</button>
                    <p className="muted">{[p.brand, p.size, p.color].filter(Boolean).join(' · ')}</p>
                    <p className="num">{p.price == null ? <span className="incomplete">No price</span> : money(p.price)}</p>
                  </div>
                  <div className="piece-actions">
                    <IconBtn icon="up" label={`Move ${p.name} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconBtn icon="down" label={`Move ${p.name} down`} disabled={i === pieces.length - 1} onClick={() => move(i, 1)} />
                    <IconBtn icon="x" label={`Remove ${p.name} from outfit`} onClick={() => setD({ ...d, pieces: d.pieces.filter((x) => x.id !== pc.id) })} />
                  </div>
                </li>
              );
            })}
          </ol>
          {picking ? (
            <ProductPicker kind="clothing" title="Add pieces from your clothes wishlist" exclude={pieces.map((p) => p.productId)} onCancel={() => setPicking(false)}
              onPick={(ids) => { setD({ ...d, pieces: [...d.pieces, ...ids.map((productId) => ({ id: uid(), productId }))] }); setPicking(false); }} />
          ) : <Btn variant="secondary" icon="plus" onClick={() => setPicking(true)}>Add pieces</Btn>}
        </div>
        <div className="editor-side form-grid">
          <Field label="Outfit name *" error={err} full><input className="input" value={d.name} onChange={(e) => { setErr(''); set('name')(e); }} placeholder="Gallery opening" /></Field>
          <Field label="Season"><select className="input select" value={d.season} onChange={set('season')}><option value="">None</option>{SEASONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Occasion"><input className="input" value={d.occasion} onChange={set('occasion')} placeholder="Date night, work…" /></Field>
          <Field label="Tags" hint="Separate with commas" full><input className="input" value={d.tagText} onChange={set('tagText')} placeholder="neutral, layered" /></Field>
          <Field label="Description" full><textarea className="input" rows="2" value={d.description} onChange={set('description')} /></Field>
          <Field label="Notes" full><textarea className="input" rows="2" value={d.notes} onChange={set('notes')} /></Field>
          <ImageInput label="Cover image (optional)" value={img} onChange={setImg} allowUrl={false} />
          {outfit && <p className="hint full">Created {fmtDate(outfit.createdAt)} · Updated {fmtDate(outfit.updatedAt)}</p>}
        </div>
      </form>
    </Modal>
  );
}

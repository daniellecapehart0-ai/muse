import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, IconBtn, Icon, Field, Img, ImageInput, Modal, Empty, useUi, useDirty, useGuardedClose } from './ui.jsx';
import { ProductSection } from './products.jsx';
import { money } from './util.js';

const { useState } = React;
export const ACCENTS = ['#E07070', '#C9504F', '#EE9277', '#D98BA0', '#B86B5E', '#8FA98E'];

function stats(products, id) {
  const items = products.filter((p) => p.kind === 'custom' && p.categoryId === id);
  const want = items.filter((p) => p.status !== 'purchased');
  return { n: items.length, value: want.reduce((s, p) => s + (p.price || 0), 0) };
}

export function CategoryTile({ cat }) {
  const { products } = useStore();
  const { go } = useNav();
  const s = stats(products, cat.id);
  return (
    <button type="button" className="ctile" style={{ '--cat': cat.accent }} onClick={() => go('c-' + cat.id)}>
      <div className="ctile-img">
        {cat.coverImageId ? <Img imageId={cat.coverImageId} alt="" /> : <span className="ctile-icon" aria-hidden="true">{cat.icon || cat.name[0]}</span>}
      </div>
      <span className="ctile-body">
        <span className="ctile-name">{cat.name}</span>
        <span className="ctile-meta num">{s.n} {s.n === 1 ? cat.itemLabel : cat.itemLabel + 's'}{s.value ? ` · ${money(s.value)} to go` : ''}</span>
      </span>
      <Icon name="arrow" size={16} />
    </button>
  );
}

export function CategoryEditor({ category, onClose, onSaved }) {
  const { actions } = useStore();
  const init = category || { id: null, name: '', description: '', icon: '', accent: ACCENTS[0], itemLabel: 'item', order: 0 };
  const [d, setD] = useState(init);
  const [img, setImg] = useState({ file: null, keep: !!category?.coverImageId, imageId: category?.coverImageId });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = useDirty({ init, keep: !!category?.coverImageId }, { init: d, keep: img.keep, f: img.file?.name });
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (!d.name.trim()) { setErr('Give this collection a name.'); return; }
    setSaving(true);
    const rec = await actions.saveCategory({ ...d, name: d.name.trim(), itemLabel: d.itemLabel.trim().toLowerCase() || 'item' }, img.file, img.keep);
    setSaving(false);
    if (rec) (onSaved ? onSaved(rec) : onClose());
  }
  return (
    <Modal title={category ? 'Edit collection' : 'Create new category'} onClose={close} size="md"
      footer={<><Btn variant="secondary" onClick={close}>Cancel</Btn><Btn type="submit" form="cat-form" disabled={saving}>{saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}</Btn></>}>
      <form id="cat-form" className="form-grid" onSubmit={save} noValidate>
        <Field label="Name *" error={err} full><input className="input" value={d.name} onChange={(e) => { setErr(''); set('name')(e); }} placeholder="Home decor, Books, Fragrance…" /></Field>
        <Field label="Description" full><textarea className="input" rows="2" value={d.description} onChange={set('description')} /></Field>
        <Field label="Icon" hint="An emoji or up to 2 letters"><input className="input" maxLength={4} value={d.icon} onChange={set('icon')} placeholder="✿" /></Field>
        <Field label="Call each item a…" hint="Used in counts, like “3 bottles”"><input className="input" value={d.itemLabel} onChange={set('itemLabel')} /></Field>
        <fieldset className="field full swatches">
          <legend>Accent color</legend>
          <div className="swatch-row">
            {ACCENTS.map((c) => (
              <label key={c} className="swatch" style={{ '--sw': c }}>
                <input type="radio" name="accent" value={c} checked={d.accent.toLowerCase() === c.toLowerCase()} onChange={set('accent')} />
                <span className="sr-only">{c}</span>
              </label>
            ))}
            <label className="swatch custom"><span className="sr-only">Custom color</span><input type="color" value={d.accent} onChange={set('accent')} /></label>
          </div>
        </fieldset>
        <ImageInput label="Cover image (optional)" value={img} onChange={setImg} allowUrl={false} />
      </form>
    </Modal>
  );
}

/** Manage all collections: open, edit, reorder, delete. */
export function CollectionsView() {
  const { categories, products, actions } = useStore();
  const { go, open } = useNav();
  const { confirm, toast } = useUi();
  function move(i, dir) {
    const ids = categories.map((c) => c.id); const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    actions.reorderCategories(ids);
  }
  return (
    <section className="section" aria-labelledby="coll-h">
      <div className="section-head">
        <div><p className="eyebrow">Organize</p><h1 className="page-title" id="coll-h">Collections</h1>
          <p className="lede">Your own wishlists for anything beyond clothes and makeup. Reorder them to set how they appear on Home.</p></div>
        <Btn icon="plus" onClick={() => open({ type: 'category-edit' })}>Create new category</Btn>
      </div>
      {categories.length === 0 ? <Empty title="No collections yet" body="Make one for fragrance, home decor, books, travel gear, or anything else you're saving up for." action={<Btn variant="secondary" icon="plus" onClick={() => open({ type: 'category-edit' })}>Create new category</Btn>} />
        : (
          <ol className="cat-list">
            {categories.map((c, i) => {
              const s = stats(products, c.id);
              return (
                <li key={c.id} className="cat-row" style={{ '--cat': c.accent }}>
                  <span className="cat-dot" aria-hidden="true">{c.icon || c.name[0]}</span>
                  <button type="button" className="cat-row-main" onClick={() => go('c-' + c.id)}>
                    <span className="cat-row-name">{c.name}</span>
                    <span className="muted num">{s.n} {s.n === 1 ? c.itemLabel : c.itemLabel + 's'}{c.description ? ` · ${c.description}` : ''}</span>
                  </button>
                  <div className="piece-actions">
                    <IconBtn icon="up" label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconBtn icon="down" label={`Move ${c.name} down`} disabled={i === categories.length - 1} onClick={() => move(i, 1)} />
                    <IconBtn icon="edit" label={`Edit ${c.name}`} onClick={() => open({ type: 'category-edit', category: c })} />
                    <IconBtn icon="trash" label={`Delete ${c.name}`} onClick={async () => {
                      if (await confirm({ title: `Delete ${c.name}?`, danger: true, confirmLabel: 'Delete collection', body: s.n ? `This also deletes the ${s.n} ${s.n === 1 ? c.itemLabel : c.itemLabel + 's'} saved in it. Your clothes, makeup, outfits and other collections are not affected. Export a backup first if you might want them back.` : 'This collection is empty. Nothing else is affected.' }))
                        if (await actions.deleteCategory(c.id)) toast(`${c.name} deleted`);
                    }} />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
    </section>
  );
}

export function CollectionView({ id }) {
  const { categories, actions } = useStore();
  const { go, open } = useNav();
  const { confirm, toast } = useUi();
  const cat = categories.find((c) => c.id === id);
  if (!cat) return <Empty title="Collection not found" body="It may have been deleted." action={<Btn variant="secondary" onClick={() => go('collections')}>See all collections</Btn>} />;
  const plural = cat.itemLabel + 's';
  return (
    <div style={{ '--cat': cat.accent }}>
      <header className="coll-head">
        {cat.coverImageId && <div className="coll-cover"><Img imageId={cat.coverImageId} alt="" /></div>}
        <div className="coll-head-text">
          <p className="eyebrow"><span className="cat-dot sm" aria-hidden="true">{cat.icon || cat.name[0]}</span> Collection</p>
          <h1 className="page-title">{cat.name}</h1>
          {cat.description && <p className="lede">{cat.description}</p>}
          <div className="row-actions">
            <Btn variant="secondary" size="sm" icon="edit" onClick={() => open({ type: 'category-edit', category: cat })}>Edit collection</Btn>
            <Btn variant="ghost" size="sm" icon="trash" className="danger-text" onClick={async () => {
              if (await confirm({ title: `Delete ${cat.name}?`, danger: true, confirmLabel: 'Delete collection', body: `This deletes the collection and every ${cat.itemLabel} saved in it. Nothing outside this collection is affected.` }))
                if (await actions.deleteCategory(cat.id)) { toast(`${cat.name} deleted`); go('collections'); }
            }}>Delete</Btn>
          </div>
        </div>
      </header>
      <ProductSection key={cat.id} id={'cat-' + cat.id} kind="custom" categoryId={cat.id} title={plural[0].toUpperCase() + plural.slice(1)}
        addLabel={`Add ${cat.itemLabel}`} emptyTitle={`No ${plural} yet`} emptyBody={`Save the first ${cat.itemLabel} you're considering, with a link, price and photo.`} />
    </div>
  );
}

import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, IconBtn, Icon, Field, Img, ImageInput, Modal, Empty, useDirty, useGuardedClose } from './ui.jsx';
import { ProductPicker, MAKEUP_TYPES } from './products.jsx';
import { DocCard } from './outfits.jsx';
import { money, fmtDate, matches, sortList, SORTS, routineCost, uid } from './util.js';

const { useState, useMemo } = React;

export function RoutineCover({ routine }) {
  const { byId } = useStore();
  if (routine.coverImageId) return <div className="cover"><Img imageId={routine.coverImageId} alt="" /></div>;
  const prods = routine.steps.map((s) => byId[s.productId]).filter(Boolean).slice(0, 4);
  if (!prods.length) return <div className="cover"><div className="img-ph steps-ph"><span className="num">{routine.steps.length}</span><span>steps</span></div></div>;
  return <div className={`cover collage n${prods.length}`}>{prods.map((p) => <Img key={p.id} imageId={p.imageId} url={p.imageUrl} alt="" />)}</div>;
}

export function RoutineCard({ routine }) {
  const { open } = useNav();
  const owned = routine.steps.filter((s) => s.owned).length;
  return <DocCard doc={routine} store="routines" cover={<RoutineCover routine={routine} />} onOpen={() => open({ type: 'routine-edit', routine })}
    meta={<>{routine.steps.length} step{routine.steps.length === 1 ? '' : 's'}{routine.duration ? ` · ${routine.duration}` : ''}{routine.steps.length ? ` · ${owned}/${routine.steps.length} owned` : ''}</>} />;
}

export function RoutinesView() {
  const { routines, byId } = useStore();
  const { open } = useNav();
  const [q, setQ] = useState('');
  const [occasion, setOccasion] = useState('all');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('updated');
  const occasions = [...new Set(routines.map((o) => o.occasion).filter(Boolean))].sort();
  const list = useMemo(() => sortList(routines.filter((r) => (occasion === 'all' || r.occasion === occasion) && (!favOnly || r.favorite) &&
    matches(q, r.name, r.description, r.occasion, r.notes, r.steps.map((s) => byId[s.productId]?.name || s.standalone.name))), sort.startsWith('price') ? 'updated' : sort), [routines, q, occasion, favOnly, sort, byId]);
  const add = () => open({ type: 'routine-edit' });
  return (
    <section className="section" aria-labelledby="routine-h">
      <div className="section-head">
        <div><p className="eyebrow">Organize</p><h1 className="page-title" id="routine-h">Future Makeup Routine</h1>
          <p className="lede">Plan a routine step by step, using products you own and ones still on your wishlist.</p></div>
        <Btn icon="plus" onClick={add}>New routine</Btn>
      </div>
      {routines.length > 0 && (
        <div className="toolbar">
          <label className="search-mini"><Icon name="search" size={16} /><input className="input" type="search" placeholder="Search routines" aria-label="Search routines" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="filters">
          {occasions.length > 0 && <select className="input select" aria-label="Occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}><option value="all">Any occasion</option>{occasions.map((s) => <option key={s}>{s}</option>)}</select>}
          <select className="input select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>{SORTS.filter(([v]) => !v.startsWith('price')).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <button type="button" className={`toggle ${favOnly ? 'on' : ''}`} aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}><Icon name="heart" size={15} filled={favOnly} />Favorites</button>
          </div>
        </div>
      )}
      {routines.length === 0 ? <Empty title="No routines yet" body="Create a routine like “Everyday glow” and add steps from your makeup wishlist or products you already own." action={<Btn variant="secondary" icon="plus" onClick={add}>New routine</Btn>} />
        : list.length === 0 ? <Empty title="No routines match" body="Try a different search or filter." />
        : <div className="grid docs">{list.map((r) => <RoutineCard key={r.id} routine={r} />)}</div>}
    </section>
  );
}

const newStep = (productId = null, owned = false) => ({ id: uid(), productId, standalone: { name: '', brand: '', shade: '' }, instructions: '', notes: '', owned });

export function RoutineEditor({ routine, onClose }) {
  const { actions, byId, products } = useStore();
  const init = routine || { id: null, name: '', description: '', occasion: '', duration: '', notes: '', favorite: false, steps: [] };
  const [d, setD] = useState(init);
  const [img, setImg] = useState({ file: null, keep: !!routine?.coverImageId, imageId: routine?.coverImageId });
  const [picking, setPicking] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = useDirty({ init, keep: !!routine?.coverImageId }, { init: d, keep: img.keep, f: img.file?.name });
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const makeup = products.filter((p) => p.kind === 'makeup');
  const cost = routineCost(d, byId);

  const setStep = (i, patch) => setD({ ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  function move(i, dir) { const a = [...d.steps]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setD({ ...d, steps: a }); }

  async function save(e) {
    e.preventDefault();
    if (!d.name.trim()) { setErr('Give this routine a name.'); return; }
    const steps = d.steps.map((s) => (s.productId && !byId[s.productId] ? { ...s, productId: null } : s));
    setSaving(true);
    const rec = await actions.saveRoutine({ ...d, name: d.name.trim(), steps }, img.file, img.keep);
    setSaving(false);
    if (rec) onClose();
  }

  return (
    <Modal title={routine ? 'Edit routine' : 'New routine'} onClose={close} size="xl"
      footer={<><Btn variant="secondary" onClick={close}>Cancel</Btn><Btn type="submit" form="routine-form" disabled={saving}>{saving ? 'Saving…' : 'Save routine'}</Btn></>}>
      <form id="routine-form" className="editor" onSubmit={save} noValidate>
        <div className="editor-main">
          <div className="editor-sub">
            <h3 className="sub-title">Steps <span className="count num">{d.steps.length}</span></h3>
            {(cost.total > 0 || cost.missing > 0) && <p className="cost-total num">Still to buy: {money(cost.total)}{cost.missing > 0 && <span className="incomplete"> · {cost.missing} price{cost.missing > 1 ? 's' : ''} missing</span>}</p>}
          </div>
          {d.steps.length === 0 && !picking && <Empty title="No steps yet" body="Add a blank step, or pull several products from your makeup wishlist at once." />}
          <ol className="steps">
            {d.steps.map((s, i) => {
              const p = s.productId ? byId[s.productId] : null;
              return (
                <li key={s.id} className="step">
                  <div className="step-num num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</div>
                  <div className="step-body">
                    <div className="step-product">
                      {p && <div className="step-img"><Img imageId={p.imageId} url={p.imageUrl} alt="" /></div>}
                      <div className="step-fields form-grid">
                        <Field label={`Step ${i + 1} product`} full>
                          <select className="input select" value={s.productId || ''} onChange={(e) => setStep(i, { productId: e.target.value || null, owned: e.target.value ? byId[e.target.value]?.status === 'purchased' : s.owned })}>
                            <option value="">Standalone product (not on wishlist)</option>
                            {makeup.map((m) => <option key={m.id} value={m.id}>{m.name}{m.shadeName ? ` — ${m.shadeName}` : ''}</option>)}
                          </select>
                        </Field>
                        {!p && <>
                          <Field label="Product name"><input className="input" value={s.standalone.name} onChange={(e) => setStep(i, { standalone: { ...s.standalone, name: e.target.value } })} list="makeup-types" /></Field>
                          <Field label="Brand"><input className="input" value={s.standalone.brand} onChange={(e) => setStep(i, { standalone: { ...s.standalone, brand: e.target.value } })} /></Field>
                          <Field label="Shade"><input className="input" value={s.standalone.shade} onChange={(e) => setStep(i, { standalone: { ...s.standalone, shade: e.target.value } })} /></Field>
                        </>}
                        {p && <p className="muted full">{[p.brand, p.productType, p.shadeName, p.shadeNumber].filter(Boolean).join(' · ')} · <span className="num">{money(p.price)}</span></p>}
                      </div>
                    </div>
                    <div className="form-grid">
                      <Field label="How to apply" full><textarea className="input" rows="2" value={s.instructions} onChange={(e) => setStep(i, { instructions: e.target.value })} placeholder="Tap onto cheekbones with fingertips, blend up." /></Field>
                      <Field label="Personal notes" full><input className="input" value={s.notes} onChange={(e) => setStep(i, { notes: e.target.value })} /></Field>
                    </div>
                    <div className="seg" role="radiogroup" aria-label={`Step ${i + 1} status`}>
                      <button type="button" role="radio" aria-checked={s.owned} className={s.owned ? 'on' : ''} onClick={() => setStep(i, { owned: true })}>Owned</button>
                      <button type="button" role="radio" aria-checked={!s.owned} className={!s.owned ? 'on' : ''} onClick={() => setStep(i, { owned: false })}>Want to buy</button>
                    </div>
                  </div>
                  <div className="piece-actions">
                    <IconBtn icon="up" label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} />
                    <IconBtn icon="down" label={`Move step ${i + 1} down`} disabled={i === d.steps.length - 1} onClick={() => move(i, 1)} />
                    <IconBtn icon="x" label={`Remove step ${i + 1}`} onClick={() => setD({ ...d, steps: d.steps.filter((x) => x.id !== s.id) })} />
                  </div>
                </li>
              );
            })}
          </ol>
          <datalist id="makeup-types">{MAKEUP_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
          {picking ? (
            <ProductPicker kind="makeup" title="Add steps from your makeup wishlist" exclude={d.steps.map((s) => s.productId).filter(Boolean)} onCancel={() => setPicking(false)}
              onPick={(ids) => { setD({ ...d, steps: [...d.steps, ...ids.map((id) => newStep(id, byId[id]?.status === 'purchased'))] }); setPicking(false); }} />
          ) : (
            <div className="row-actions">
              <Btn variant="secondary" icon="plus" onClick={() => setD({ ...d, steps: [...d.steps, newStep()] })}>Add step</Btn>
              <Btn variant="secondary" icon="plus" onClick={() => setPicking(true)}>Add from wishlist</Btn>
            </div>
          )}
        </div>
        <div className="editor-side form-grid">
          <Field label="Routine name *" error={err} full><input className="input" value={d.name} onChange={(e) => { setErr(''); set('name')(e); }} placeholder="Everyday glow" /></Field>
          <Field label="Occasion"><input className="input" value={d.occasion} onChange={set('occasion')} placeholder="Work, evening…" /></Field>
          <Field label="Estimated time"><input className="input" value={d.duration} onChange={set('duration')} placeholder="15 min" /></Field>
          <Field label="Description" full><textarea className="input" rows="2" value={d.description} onChange={set('description')} /></Field>
          <Field label="Notes" full><textarea className="input" rows="2" value={d.notes} onChange={set('notes')} /></Field>
          <ImageInput label="Cover image (optional)" value={img} onChange={setImg} allowUrl={false} />
          {routine && <p className="hint full">Created {fmtDate(routine.createdAt)} · Updated {fmtDate(routine.updatedAt)}</p>}
        </div>
      </form>
    </Modal>
  );
}

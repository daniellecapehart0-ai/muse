import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, Icon, Field, Img, ImageInput, Modal, Empty, useUi, useDirty, useGuardedClose } from './ui.jsx';
import { ProductSection, ProductCard, ProductPicker } from './products.jsx';
import { ACCENTS } from './collections.jsx';
import { money, nextDate, whenLabel, parsePrice, isArchived, rollForward, fmtDate } from './util.js';

const { useState } = React;

const OCCASION_IDEAS = ['Birthday', 'Christmas', 'Hanukkah', "Valentine's Day", "Mother's Day", "Father's Day", 'Anniversary', 'Graduation', 'Lunar New Year', 'Eid', 'Diwali', 'Wedding', 'Baby shower'];
const initials = (n) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export function personTotals(products, id, archivedIds = new Set()) {
  const gifts = products.filter((p) => p.kind === 'gift' && p.personId === id && !archivedIds.has(p.occasionId));
  const sum = (list) => list.reduce((s, p) => s + (p.price || 0), 0);
  return {
    n: gifts.length,
    planned: sum(gifts),
    bought: sum(gifts.filter((p) => p.status === 'purchased' || p.status === 'given')),
    missing: gifts.filter((p) => p.price == null).length,
  };
}

export function Avatar({ person, size = 'md' }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ '--cat': person.accent }}>
      {person.coverImageId ? <Img imageId={person.coverImageId} alt="" fallback={<span>{initials(person.name)}</span>} /> : <span aria-hidden="true">{initials(person.name)}</span>}
    </span>
  );
}

function BudgetMeter({ planned, budget }) {
  if (budget == null) return null;
  const over = planned > budget;
  const pct = budget > 0 ? Math.min(100, (planned / budget) * 100) : 100;
  return <span className={`meter ${over ? 'over' : ''}`} role="img" aria-label={`${money(planned)} planned of a ${money(budget)} budget`}><span style={{ width: pct + '%' }} /></span>;
}

function Swatches({ value, onChange }) {
  return (
    <fieldset className="field full swatches">
      <legend>Color</legend>
      <div className="swatch-row">
        {ACCENTS.map((c) => (
          <label key={c} className="swatch" style={{ '--sw': c }}>
            <input type="radio" name="accent" value={c} checked={value.toLowerCase() === c.toLowerCase()} onChange={(e) => onChange(e.target.value)} />
            <span className="sr-only">{c}</span>
          </label>
        ))}
        <label className="swatch custom"><span className="sr-only">Custom color</span><input type="color" value={value} onChange={(e) => onChange(e.target.value)} /></label>
      </div>
    </fieldset>
  );
}

// ---------- cards ----------
export function PersonCard({ person }) {
  const { products, archivedIds } = useStore();
  const { go } = useNav();
  const t = personTotals(products, person.id, archivedIds);
  const bday = person.birthday ? whenLabel(nextDate(person.birthday, true)) : '';
  return (
    <button type="button" className="person-card" style={{ '--cat': person.accent }} onClick={() => go('p-' + person.id)}>
      <Avatar person={person} size="lg" />
      <span className="person-card-body">
        <span className="person-name">{person.name}</span>
        {person.relationship && <span className="muted">{person.relationship}</span>}
        {bday && <span className="person-bday">Birthday {bday}</span>}
        <span className="person-money num">
          {t.n} idea{t.n === 1 ? '' : 's'} · {money(t.planned)}{person.budget != null ? ` of ${money(person.budget)}` : ''}
        </span>
        <BudgetMeter planned={t.planned} budget={person.budget} />
      </span>
    </button>
  );
}

export function OccasionTile({ occ }) {
  const { products, byId } = useStore();
  const { go } = useNav();
  const dt = nextDate(occ.date, false);
  const mine = occ.productIds.filter((id) => byId[id]).length;
  const gifts = products.filter((p) => p.kind === 'gift' && p.occasionId === occ.id).length;
  return (
    <button type="button" className="occ-tile" style={{ '--cat': occ.accent }} onClick={() => go('o-' + occ.id)}>
      <span className="occ-date" aria-hidden="true">
        {dt ? <><span className="occ-mon">{dt.toLocaleDateString('en-US', { month: 'short' })}</span><span className="occ-day num">{dt.getDate()}</span></>
          : <span className="occ-icon">{occ.icon || occ.name[0]}</span>}
      </span>
      <span className="occ-body">
        <span className="occ-name">{occ.icon && dt ? occ.icon + ' ' : ''}{occ.name}</span>
        {dt && <span className="muted">{whenLabel(dt)}</span>}
        <span className="muted num">{mine} of my item{mine === 1 ? '' : 's'} · {gifts} gift{gifts === 1 ? '' : 's'}</span>
      </span>
      <Icon name="arrow" size={16} />
    </button>
  );
}

// ---------- editors ----------
const blankPerson = () => ({ id: null, name: '', relationship: '', birthday: '', budget: '', clothingSize: '', shoeSize: '', ringSize: '', favoriteColors: '', likes: '', dislikes: '', notes: '', accent: ACCENTS[0] });

export function PersonEditor({ person, onClose }) {
  const { actions } = useStore();
  const { go } = useNav();
  const init = person ? { ...person, budget: person.budget == null ? '' : String(person.budget) } : blankPerson();
  const [d, setD] = useState(init);
  const [img, setImg] = useState({ file: null, keep: !!person?.coverImageId, imageId: person?.coverImageId });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const dirty = useDirty({ init, keep: !!person?.coverImageId }, { init: d, keep: img.keep, f: img.file?.name });
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    const er = {};
    if (!d.name.trim()) er.name = 'Add their name.';
    const budget = parsePrice(d.budget);
    if (Number.isNaN(budget)) er.budget = 'Enter an amount like 100 or 75.50.';
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    const rec = await actions.savePerson({ ...d, name: d.name.trim(), budget }, img.file, img.keep);
    setSaving(false);
    if (rec) { onClose(); if (!person) go('p-' + rec.id); }
  }

  return (
    <Modal title={person ? `Edit ${person.name}'s profile` : 'New gift profile'} onClose={close} size="lg"
      footer={<><Btn variant="secondary" onClick={close}>Cancel</Btn><Btn type="submit" form="person-form" disabled={saving}>{saving ? 'Saving…' : person ? 'Save profile' : 'Create profile'}</Btn></>}>
      <form id="person-form" className="form-grid" onSubmit={save} noValidate>
        <Field label="Name *" error={errors.name}><input className="input" value={d.name} onChange={set('name')} placeholder="Mom, Jess, Grandpa Lee…" /></Field>
        <Field label="Relationship"><input className="input" value={d.relationship} onChange={set('relationship')} placeholder="Sister, best friend, coworker…" /></Field>
        <Field label="Birthday"><input className="input" type="date" value={d.birthday} onChange={set('birthday')} /></Field>
        <Field label="Gift budget (USD)" error={errors.budget} hint="Total you want to spend on them"><input className="input num" inputMode="decimal" value={d.budget} onChange={set('budget')} placeholder="0.00" /></Field>
        <p className="form-section full">Sizes &amp; favorites</p>
        <Field label="Clothing size"><input className="input" value={d.clothingSize} onChange={set('clothingSize')} placeholder="M top, 28 jeans" /></Field>
        <Field label="Shoe size"><input className="input" value={d.shoeSize} onChange={set('shoeSize')} /></Field>
        <Field label="Ring size"><input className="input" value={d.ringSize} onChange={set('ringSize')} /></Field>
        <Field label="Favorite colors"><input className="input" value={d.favoriteColors} onChange={set('favoriteColors')} placeholder="Sage, cream" /></Field>
        <Field label="Loves" full><textarea className="input" rows="2" value={d.likes} onChange={set('likes')} placeholder="Hobbies, brands, scents, snacks, things they've mentioned wanting" /></Field>
        <Field label="Avoid" full><textarea className="input" rows="2" value={d.dislikes} onChange={set('dislikes')} placeholder="Things they don't like or already have" /></Field>
        <Field label="Notes" full><textarea className="input" rows="2" value={d.notes} onChange={set('notes')} /></Field>
        <Swatches value={d.accent} onChange={(v) => setD({ ...d, accent: v })} />
        <ImageInput label="Photo (optional)" value={img} onChange={setImg} allowUrl={false} />
      </form>
    </Modal>
  );
}

const blankOccasion = () => ({ id: null, name: '', date: '', yearly: false, icon: '', accent: ACCENTS[1], description: '', productIds: [] });

export function OccasionEditor({ occasion, onClose, stay }) {
  const { actions } = useStore();
  const { go } = useNav();
  const init = occasion || blankOccasion();
  const [d, setD] = useState(init);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = useDirty(init, d);
  const close = useGuardedClose(dirty, onClose);
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  async function save(e) {
    e.preventDefault();
    if (!d.name.trim()) { setErr('Name this holiday or occasion.'); return; }
    setSaving(true);
    const rec = await actions.saveOccasion({ ...d, name: d.name.trim(), yearly: false }, null, true);
    setSaving(false);
    if (rec) { onClose(); if (!occasion && !stay) go('o-' + rec.id); }
  }
  return (
    <Modal title={occasion ? 'Edit occasion' : 'New holiday or occasion'} onClose={close} size="md"
      footer={<><Btn variant="secondary" onClick={close}>Cancel</Btn><Btn type="submit" form="occ-form" disabled={saving}>{saving ? 'Saving…' : occasion ? 'Save changes' : 'Create list'}</Btn></>}>
      <form id="occ-form" className="form-grid" onSubmit={save} noValidate>
        <Field label="Name *" error={err} full>
          <input className="input" list="occasion-ideas" value={d.name} onChange={(e) => { setErr(''); set('name')(e); }} placeholder="Christmas, My birthday, Anniversary…" />
        </Field>
        <datalist id="occasion-ideas">{OCCASION_IDEAS.map((o) => <option key={o} value={o} />)}</datalist>
        <Field label="Date"><input className="input" type="date" value={d.date} onChange={set('date')} /></Field>
        <Field label="Icon" hint="An emoji or a letter"><input className="input" maxLength={4} value={d.icon} onChange={set('icon')} /></Field>
        <p className="hint full">After this date, the list moves to Settings › Archived Lists. You can bring it back for next year from there.</p>
        <Field label="Description" full><textarea className="input" rows="2" value={d.description} onChange={set('description')} placeholder="Who you're celebrating with, plans, reminders" /></Field>
        <Swatches value={d.accent} onChange={(v) => setD({ ...d, accent: v })} />
      </form>
    </Modal>
  );
}

// ---------- pages ----------
export function GiftsView() {
  const { people, occasions, products, archivedIds } = useStore();
  const { open } = useNav();
  const gifts = products.filter((p) => p.kind === 'gift' && !archivedIds.has(p.occasionId));
  const planned = gifts.reduce((s, p) => s + (p.price || 0), 0);
  const bought = gifts.filter((p) => p.status === 'purchased' || p.status === 'given').length;
  return (
    <>
      <section className="hero gifts-hero">
        <p className="eyebrow">Gifts</p>
        <h1 className="hero-title">Gifts for the<br />people you love.</h1>
        <p className="lede">Give each person a gift profile with their sizes, favorites and budget, and keep gift ideas for them in one place. Holiday lists gather your own wishlist and the gifts you're giving.</p>
        {(people.length > 0 || gifts.length > 0) && (
          <dl className="stats stats-4">
            <div><dt>People</dt><dd className="num">{people.length}</dd></div>
            <div><dt>Gift ideas</dt><dd className="num">{gifts.length}</dd></div>
            <div><dt>Bought or given</dt><dd className="num">{bought}</dd></div>
            <div><dt>Planned spend</dt><dd className="num">{money(planned)}</dd></div>
          </dl>
        )}
      </section>
      <section className="section" aria-labelledby="people-h">
        <div className="section-head">
          <div><p className="eyebrow">Gift profiles</p><h2 className="section-title" id="people-h">People <span className="count num">{people.length}</span></h2></div>
          <Btn icon="plus" onClick={() => open({ type: 'person-edit' })}>Add person</Btn>
        </div>
        {people.length === 0
          ? <Empty title="No gift profiles yet" body="Add someone you shop for. Save their sizes, favorite colors, what they love and a budget, then collect gift ideas for them."
            action={<Btn variant="secondary" icon="plus" onClick={() => open({ type: 'person-edit' })}>Add person</Btn>} />
          : <div className="grid people">{people.map((p) => <PersonCard key={p.id} person={p} />)}</div>}
      </section>
      <OccasionsSection />
    </>
  );
}

export function OccasionsSection({ eyebrow = 'Holidays & occasions' }) {
  const { occasions } = useStore();
  const { open } = useNav();
  return (
    <section className="section" aria-labelledby="occ-h">
      <div className="section-head">
        <div><p className="eyebrow">{eyebrow}</p><h2 className="section-title" id="occ-h">Holiday lists <span className="count num">{occasions.length}</span></h2></div>
        <Btn icon="plus" onClick={() => open({ type: 'occasion-edit' })}>New holiday list</Btn>
      </div>
      {occasions.length === 0
        ? <Empty title="No holiday lists yet" body="Make a list for Christmas, your birthday or any occasion. Add things from your own wishlists to it, and tag the gifts you're giving so you can see them together."
          action={<Btn variant="secondary" icon="plus" onClick={() => open({ type: 'occasion-edit' })}>New holiday list</Btn>} />
        : <div className="grid cats">{occasions.map((o) => <OccasionTile key={o.id} occ={o} />)}</div>}
    </section>
  );
}

/** The gift lists a person has: their birthday, holiday lists you've added, and any event a gift idea is tagged with. */
export function personEvents(p, occasions, products) {
  const used = products.filter((g) => g.kind === 'gift' && g.personId === p.id && g.occasionId && !(g.occasionId !== 'birthday' && isArchived(occasions.find((o) => o.id === g.occasionId) || {}))).map((g) => g.occasionId);
  const ids = [...new Set([...(p.birthday ? ['birthday'] : []), ...p.eventIds, ...used])];
  return ids.map((eid) => {
    if (eid === 'birthday') return { id: 'birthday', name: 'Birthday', icon: '🎂', dt: p.birthday ? nextDate(p.birthday, true) : null };
    const o = occasions.find((x) => x.id === eid);
    return o ? { id: o.id, name: o.name, icon: o.icon, dt: nextDate(o.date, false) } : null;
  }).filter(Boolean);
}

export function EventPicker({ personId, onClose }) {
  const { people, occasions, products, actions } = useStore();
  const { open } = useNav();
  const p = people.find((x) => x.id === personId);
  if (!p) return null;
  const have = new Set(personEvents(p, occasions, products).map((e) => e.id));
  const choices = [
    ...(!have.has('birthday') ? [{ id: 'birthday', name: `${p.name}'s birthday`, note: p.birthday ? whenLabel(nextDate(p.birthday, true)) : 'Add their birthday in the profile for a countdown' }] : []),
    ...occasions.filter((o) => !have.has(o.id)).map((o) => ({ id: o.id, name: o.name, note: o.date ? whenLabel(nextDate(o.date, false)) : 'No date' })),
  ];
  const add = async (eid) => { if (await actions.patchDoc('people', p.id, { eventIds: [...p.eventIds.filter((e) => e !== eid), eid] })) onClose(eid); };
  return (
    <Modal title={`Add a list for ${p.name}`} onClose={() => onClose()} size="sm">
      <p className="hint">Pick the event you're shopping for. Gift ideas you add to that list are tagged with it.</p>
      <div className="settings-list event-choices">
        {choices.map((c) => (
          <button key={c.id} type="button" className="settings-row" onClick={() => add(c.id)}>
            <span className="settings-row-icon" aria-hidden="true"><Icon name={c.id === 'birthday' ? 'gift' : 'calendar'} size={20} /></span>
            <span className="settings-row-text"><span className="settings-row-title">{c.name}</span><span className="muted">{c.note}</span></span>
            <Icon name="plus" size={18} />
          </button>
        ))}
        <button type="button" className="settings-row" onClick={() => { onClose(); open({ type: 'occasion-edit', stay: true }); }}>
          <span className="settings-row-icon" aria-hidden="true"><Icon name="plus" size={20} /></span>
          <span className="settings-row-text"><span className="settings-row-title">New holiday list…</span><span className="muted">Then come back and add it here</span></span>
        </button>
      </div>
    </Modal>
  );
}

export function PersonView({ id }) {
  const { people, products, occasions, archivedIds, actions } = useStore();
  const { go, open } = useNav();
  const { confirm, toast } = useUi();
  const [active, setActive] = useState('all');
  const [picking, setPicking] = useState(false);
  const p = people.find((x) => x.id === id);
  if (!p) return <Empty title="Profile not found" body="It may have been deleted." action={<Btn variant="secondary" onClick={() => go('gifts')}>Back to Gifts</Btn>} />;
  const t = personTotals(products, p.id, archivedIds);
  const bday = p.birthday ? whenLabel(nextDate(p.birthday, true)) : '';
  const events = personEvents(p, occasions, products);
  const activeEvent = events.some((e) => e.id === active) ? active : 'all';
  const ev = events.find((e) => e.id === activeEvent);
  const mineGifts = products.filter((g) => g.kind === 'gift' && g.personId === p.id && !archivedIds.has(g.occasionId));
  const countFor = (eid) => mineGifts.filter((g) => g.occasionId === eid).length;
  const evTotal = ev ? mineGifts.filter((g) => g.occasionId === ev.id).reduce((s, g) => s + (g.price || 0), 0) : 0;
  const details = [['Clothing size', p.clothingSize], ['Shoe size', p.shoeSize], ['Ring size', p.ringSize], ['Favorite colors', p.favoriteColors], ['Loves', p.likes], ['Avoid', p.dislikes], ['Notes', p.notes]].filter((r) => r[1]);
  const over = p.budget != null && t.planned > p.budget;
  async function del() {
    const ok = await confirm({ title: `Delete ${p.name}'s profile?`, danger: true, confirmLabel: 'Delete profile',
      body: t.n ? `This also deletes the ${t.n} gift idea${t.n === 1 ? '' : 's'} saved for ${p.name}. Your own wishlists and holiday lists are not affected.` : 'Your own wishlists and holiday lists are not affected.' });
    if (ok && await actions.deletePerson(p.id)) { toast('Profile deleted'); go('gifts'); }
  }
  return (
    <div style={{ '--cat': p.accent }}>
      <button type="button" className="back-link" onClick={() => go('gifts')}><Icon name="back" size={16} />All gifts</button>
      <header className="profile-head">
        <Avatar person={p} size="xl" />
        <div className="profile-text">
          <p className="eyebrow">Gift profile</p>
          <h1 className="page-title">{p.name}</h1>
          {(p.relationship || bday) && <p className="muted">{[p.relationship, bday && 'Birthday ' + bday].filter(Boolean).join(' · ')}</p>}
          <div className="row-actions">
            <Btn variant="secondary" size="sm" icon="edit" onClick={() => open({ type: 'person-edit', person: p })}>Edit profile</Btn>
            <Btn variant="ghost" size="sm" icon="trash" className="danger-text" onClick={del}>Delete</Btn>
          </div>
        </div>
      </header>
      <div className="profile-grid">
        <section className="panel" aria-labelledby="pd-h">
          <h2 className="sub-title" id="pd-h">Sizes &amp; favorites</h2>
          {details.length
            ? <dl className="dl">{details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            : <div className="panel-empty"><p className="hint">Add their sizes, favorite colors and what they love so shopping for them is easier.</p>
              <Btn variant="secondary" size="sm" icon="edit" onClick={() => open({ type: 'person-edit', person: p })}>Fill in profile</Btn></div>}
        </section>
        <section className="panel" aria-labelledby="pb-h">
          <h2 className="sub-title" id="pb-h">Budget</h2>
          <p className="big-money num">{money(t.planned)}</p>
          <p className="muted">planned across {t.n} idea{t.n === 1 ? '' : 's'}{t.missing ? `, ${t.missing} without a price` : ''}</p>
          <p className="num">Bought or given: <strong>{money(t.bought)}</strong></p>
          {p.budget != null ? (
            <>
              <BudgetMeter planned={t.planned} budget={p.budget} />
              <p className={over ? 'over-text num' : 'num'}>{over ? `${money(t.planned - p.budget)} over the ${money(p.budget)} budget` : `${money(p.budget - t.planned)} left of ${money(p.budget)}`}</p>
            </>
          ) : <p className="hint">No budget set. Add one in the profile to track spending.</p>}
        </section>
      </div>
      <div className="event-tabs-wrap">
        <p className="eyebrow">This list is for</p>
        <div className="seg-tabs event-tabs" role="tablist" aria-label={`${p.name}'s gift lists`}>
          <button type="button" role="tab" aria-selected={activeEvent === 'all'} className={`pill ${activeEvent === 'all' ? 'on' : ''}`} onClick={() => setActive('all')}>
            All ideas <span className="pill-count num">{t.n}</span>
          </button>
          {events.map((e) => (
            <button key={e.id} type="button" role="tab" aria-selected={activeEvent === e.id} className={`pill ${activeEvent === e.id ? 'on' : ''}`} onClick={() => setActive(e.id)}>
              {e.icon ? e.icon + ' ' : ''}{e.name} <span className="pill-count num">{countFor(e.id)}</span>
            </button>
          ))}
          <button type="button" className="pill ghost" onClick={() => setPicking(true)}><Icon name="plus" size={16} />Event</button>
        </div>
        {ev && (
          <p className="event-when">
            {ev.dt ? <>{ev.name === 'Birthday' ? `${p.name}'s birthday` : ev.name} is <strong>{whenLabel(ev.dt).split(' · ')[1]}</strong> ({ev.dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})</> : `${ev.name} has no date yet`}
            {' · '}<span className="num">{money(evTotal)} planned</span>
            {countFor(ev.id) === 0 && p.eventIds.includes(ev.id) && <> · <button type="button" className="link-btn" onClick={async () => { if (await actions.patchDoc('people', p.id, { eventIds: p.eventIds.filter((x) => x !== ev.id) })) setActive('all'); }}>Remove this list</button></>}
          </p>
        )}
      </div>
      <ProductSection key={p.id + activeEvent} id={'gifts-' + p.id} kind="gift" personId={p.id} fixedOcc={ev ? ev.id : undefined}
        eyebrow={`For ${p.name}`} title={ev ? `${ev.name} list` : 'Gift ideas'} addLabel="Add gift idea"
        emptyTitle={ev ? `Nothing on the ${ev.name.toLowerCase()} list yet` : 'No gift ideas yet'}
        emptyBody={ev ? `Gift ideas you add here are saved for ${p.name}'s ${ev.name === 'Birthday' ? 'birthday' : ev.name}.` : `Save ideas for ${p.name} with a link, price and photo. Mark them bought and given as you go.`} />
      {picking && <EventPicker personId={p.id} onClose={(eid) => { setPicking(false); if (eid) setActive(eid); }} />}
    </div>
  );
}

export function OccasionView({ id }) {
  const { allOccasions, products, byId, people, actions } = useStore();
  const { go, open } = useNav();
  const { confirm, toast } = useUi();
  const [picking, setPicking] = useState(false);
  const [copyText, setCopyText] = useState('');
  const occ = allOccasions.find((o) => o.id === id);
  const archived = !!occ && isArchived(occ);
  if (!occ) return <Empty title="List not found" body="It may have been deleted." action={<Btn variant="secondary" onClick={() => go('gifts')}>Back to Gifts</Btn>} />;
  const dt = nextDate(occ.date, false);
  const mine = occ.productIds.map((pid) => byId[pid]).filter((p) => p && p.kind !== 'gift');
  const wanted = mine.filter((p) => p.status !== 'purchased');
  const gifts = products.filter((p) => p.kind === 'gift' && p.occasionId === occ.id);
  const groups = people.map((person) => ({ person, items: gifts.filter((g) => g.personId === person.id) })).filter((g) => g.items.length);
  const giftTotal = gifts.reduce((s, p) => s + (p.price || 0), 0);

  async function copyList() {
    const lines = mine.map((p) => {
      const bits = [p.name, p.brand, p.size && 'size ' + p.size, p.color, p.shadeName && 'shade ' + p.shadeName + (p.shadeNumber ? ' ' + p.shadeNumber : ''), p.price != null && money(p.price)].filter(Boolean);
      return '• ' + bits.join(' — ') + (p.url ? '\n  ' + p.url : '');
    });
    const text = `My ${occ.name} wishlist\n\n${lines.join('\n')}`;
    try { await navigator.clipboard.writeText(text); toast('List copied. Paste it into a text or email.'); }
    catch { setCopyText(text); }
  }
  async function del() {
    if (await confirm({ title: `Delete ${occ.name}?`, danger: true, confirmLabel: 'Delete list',
      body: 'Only the list is deleted. Your wishlist items and gift ideas stay where they are; gifts just lose this occasion tag.' }))
      if (await actions.deleteOccasion(occ.id)) { toast('List deleted'); go(archived ? 'settings' : 'gifts'); }
  }
  const removeItem = (pid) => actions.patchDoc('occasions', occ.id, { productIds: occ.productIds.filter((x) => x !== pid) });

  return (
    <div style={{ '--cat': occ.accent }}>
      {archived
        ? <button type="button" className="back-link" onClick={() => go('settings')}><Icon name="back" size={16} />Archived Lists</button>
        : <button type="button" className="back-link" onClick={() => go('gifts')}><Icon name="back" size={16} />All gifts</button>}
      {archived && (
        <div className="archive-banner" role="note">
          <span><strong>Archived.</strong> This list ended on {fmtDate(nextDate(occ.date, false).getTime())}. It's kept here exactly as it was.</span>
          <Btn size="sm" onClick={async () => { const date = rollForward(occ.date); if (await actions.patchDoc('occasions', occ.id, { date })) toast(`${occ.name} is back for ${date.slice(0, 4)}`); }}>Bring back for next year</Btn>
        </div>
      )}
      <header className="profile-head">
        <span className="occ-date occ-date-lg" aria-hidden="true">
          {dt ? <><span className="occ-mon">{dt.toLocaleDateString('en-US', { month: 'short' })}</span><span className="occ-day num">{dt.getDate()}</span></> : <span className="occ-icon">{occ.icon || occ.name[0]}</span>}
        </span>
        <div className="profile-text">
          <p className="eyebrow">Holiday list</p>
          <h1 className="page-title">{occ.icon ? occ.icon + ' ' : ''}{occ.name}</h1>
          {dt && <p className="muted">{whenLabel(dt)}</p>}
          {occ.description && <p className="lede">{occ.description}</p>}
          <div className="row-actions">
            <Btn variant="secondary" size="sm" icon="edit" onClick={() => open({ type: 'occasion-edit', occasion: occ })}>Edit</Btn>
            {mine.length > 0 && <Btn variant="secondary" size="sm" icon="copy" onClick={copyList}>Copy my list</Btn>}
            <Btn variant="ghost" size="sm" icon="trash" className="danger-text" onClick={del}>Delete</Btn>
          </div>
        </div>
      </header>

      <section className="section" aria-labelledby="occ-mine-h">
        <div className="section-head">
          <div>
            <p className="eyebrow">From my wishlists</p>
            <h2 className="section-title" id="occ-mine-h">What I'm hoping for <span className="count num">{mine.length}</span></h2>
            {mine.length > 0 && <p className="muted num">{money(wanted.reduce((s, p) => s + (p.price || 0), 0))} across {wanted.length} item{wanted.length === 1 ? '' : 's'} not yet bought</p>}
          </div>
          {!picking && <Btn icon="plus" onClick={() => setPicking(true)}>Add from my wishlists</Btn>}
        </div>
        {picking && (
          <ProductPicker kind={['clothing', 'makeup', 'custom']} title={`Add to ${occ.name}`} exclude={occ.productIds} onCancel={() => setPicking(false)}
            onPick={async (ids) => { if (await actions.patchDoc('occasions', occ.id, { productIds: [...occ.productIds, ...ids] })) { setPicking(false); toast(`Added ${ids.length} to ${occ.name}`); } }} />
        )}
        {mine.length === 0 && !picking
          ? <Empty title="Nothing on this list yet" body="Add items from your clothes, makeup and collections. They stay in those wishlists too; this list just points to them." />
          : (
            <div className="grid products">
              {mine.map((p) => (
                <div key={p.id} className="listed">
                  <ProductCard p={p} onOpen={() => open({ type: 'product-detail', id: p.id })} />
                  <button type="button" className="unlist" onClick={() => removeItem(p.id)} aria-label={`Remove ${p.name} from ${occ.name}`}>
                    <Icon name="x" size={14} />Remove from list
                  </button>
                </div>
              ))}
            </div>
          )}
      </section>

      <section className="section" aria-labelledby="occ-gifts-h">
        <div className="section-head">
          <div>
            <p className="eyebrow">Gifts I'm giving</p>
            <h2 className="section-title" id="occ-gifts-h">Gifts <span className="count num">{gifts.length}</span></h2>
            {gifts.length > 0 && <p className="muted num">{money(giftTotal)} planned</p>}
          </div>
          {people.length > 0 && <Btn icon="plus" onClick={() => open({ type: 'product-edit', kind: 'gift', occasionId: occ.id })}>Add gift</Btn>}
        </div>
        {people.length === 0
          ? <Empty title="Add a person first" body="Gifts belong to a gift profile. Create one, then add gift ideas and tag them with this occasion."
            action={<Btn variant="secondary" icon="plus" onClick={() => open({ type: 'person-edit' })}>Add person</Btn>} />
          : groups.length === 0
            ? <Empty title="No gifts tagged yet" body={`Add a gift here, or set the occasion to ${occ.name} on any gift idea in a gift profile.`} />
            : groups.map(({ person, items }) => (
              <div key={person.id} className="gift-group">
                <button type="button" className="gift-group-head" onClick={() => go('p-' + person.id)}>
                  <Avatar person={person} size="sm" />
                  <span className="gift-group-name">{person.name}</span>
                  <span className="muted num">{items.length} · {money(items.reduce((s, p) => s + (p.price || 0), 0))}</span>
                  <Icon name="arrow" size={16} />
                </button>
                <div className="grid products">{items.map((g) => <ProductCard key={g.id} p={g} onOpen={() => open({ type: 'product-detail', id: g.id })} />)}</div>
              </div>
            ))}
      </section>

      {copyText && (
        <Modal title="Copy your list" onClose={() => setCopyText('')} size="sm" footer={<Btn onClick={() => setCopyText('')}>Done</Btn>}>
          <p className="hint">Select the text below and copy it.</p>
          <textarea className="input copy-box" rows="10" readOnly value={copyText} aria-label="Your list as text" onFocus={(e) => e.target.select()} />
        </Modal>
      )}
    </div>
  );
}

import React from 'react';
import { useStore } from './store.jsx';
import { useNav } from './nav.js';
import { Btn, Icon, Empty } from './ui.jsx';
import { BagArt } from './splash.jsx';
import { saveProfileName } from './db.js';
import { money, nextDate, daysUntil } from './util.js';

const { useState, useMemo } = React;

export const CLOTHING_TYPES = ['Tops & shirts', 'T-shirts', 'Sweaters', 'Sweatshirts & hoodies', 'Jeans', 'Pants', 'Sweatpants & joggers', 'Leggings', 'Shorts', 'Skirts', 'Dresses', 'Jackets & coats', 'Shoes', 'Swim', 'Intimates & sleep', 'Accessories'];

// Order matters: more specific words are checked before general ones (jeans before pants, t-shirt before shirt).
const TYPE_WORDS = [
  ['Jeans', /\b(jeans?|denim)\b/i], ['Sweatpants & joggers', /\b(sweat ?pants?|joggers?|track ?pants?)\b/i],
  ['Leggings', /\bleggings?\b/i], ['Sweatshirts & hoodies', /\b(sweat ?shirts?|hoodies?|crew ?necks?|pullovers?|zip[- ]?ups?)\b/i],
  ['T-shirts', /\b(t-?shirts?|tees?|graphic tee)\b/i], ['Sweaters', /\b(sweaters?|cardigans?|knits?|jumpers?)\b/i],
  ['Pants', /\b(pants|trousers|slacks|chinos|cargos?|flares?)\b/i], ['Shorts', /\bshorts\b/i], ['Skirts', /\bskirts?\b/i],
  ['Dresses', /\b(dress|dresses|gown)\b/i], ['Jackets & coats', /\b(jackets?|coats?|blazers?|puffers?|parkas?|trench)\b/i],
  ['Shoes', /\b(shoes?|sneakers?|boots?|heels?|loafers?|sandals?|flats|mules?|slides)\b/i], ['Swim', /\b(bikini|swim\w*|one-?piece)\b/i],
  ['Intimates & sleep', /\b(bras?|bralette|underwear|pajamas?|pyjamas?|lingerie|robe|slip)\b/i],
  ['Tops & shirts', /\b(shirts?|blouses?|tops?|cami|camisole|tanks?|bodysuits?|polo|button[- ]?down|corset)\b/i],
  ['Accessories', /\b(hat|cap|beanie|scarf|belt|gloves?|sunglasses|bag|purse|tote|jewelry|necklace|earrings?|bracelet|ring)\b/i],
];
export function clothingType(p) {
  if (p.productType) return p.productType;
  const hit = TYPE_WORDS.find(([, re]) => re.test(p.name));
  return hit ? hit[0] : '';
}

const readName = () => { try { return localStorage.getItem('muse-name') || ''; } catch { return ''; } };
let nameTimer = null;
export const saveName = (n) => {
  try { localStorage.setItem('muse-name', n.trim()); } catch { /* optional */ }
  clearTimeout(nameTimer); nameTimer = setTimeout(() => saveProfileName(n.trim()), 600);
};
export const getName = readName;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Hi there' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** Upcoming gifting dates: holiday lists with a date, plus everyone's birthday. */
export function upcomingEvents(occasions, people, products) {
  const ev = [];
  occasions.forEach((o) => {
    const dt = nextDate(o.date, false);
    const n = daysUntil(dt);
    if (dt && n >= 0) ev.push({ key: 'o' + o.id, kind: 'occasion', id: o.id, name: o.name, dt, n, accent: o.accent, gifts: products.filter((p) => p.kind === 'gift' && p.occasionId === o.id).length });
  });
  people.forEach((p) => {
    const dt = p.birthday ? nextDate(p.birthday, true) : null;
    if (dt) ev.push({ key: 'b' + p.id, kind: 'birthday', id: p.id, name: `${p.name}'s birthday`, dt, n: daysUntil(dt), accent: p.accent, gifts: products.filter((g) => g.kind === 'gift' && g.personId === p.id && g.occasionId === 'birthday').length });
  });
  return ev.sort((a, b) => a.n - b.n);
}
const daysText = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

function mode(list) {
  const counts = new Map();
  list.forEach((s) => counts.set(s, (counts.get(s) || 0) + 1));
  let best = null, bestN = 0;
  counts.forEach((n, s) => { if (n > bestN) { best = s; bestN = n; } }); // first-seen wins ties; list is newest first
  return { value: best, count: bestN };
}

/** Everything the Your Data page shows, computed from the user's own records. */
export function computeInsights({ products, categories, occasions, people }) {
  const own = products.filter((p) => p.kind !== 'gift');
  const gifts = products.filter((p) => p.kind === 'gift');
  const sum = (l) => l.reduce((s, p) => s + (p.price || 0), 0);
  const priced = own.filter((p) => p.price != null);
  const wanted = own.filter((p) => p.status !== 'purchased');
  const bought = own.filter((p) => p.status === 'purchased');
  const giftsBought = gifts.filter((p) => p.status === 'purchased' || p.status === 'given');

  // brands, grouped case-insensitively, shown with their most common spelling
  const brandMap = new Map();
  own.forEach((p) => {
    const b = p.brand.trim(); if (!b) return;
    const k = b.toLowerCase();
    const e = brandMap.get(k) || { names: [], count: 0, value: 0, bought: 0 };
    e.names.push(b); e.count++; e.value += p.price || 0; if (p.status === 'purchased') e.bought++;
    brandMap.set(k, e);
  });
  const brands = [...brandMap.values()].map((e) => ({ label: mode(e.names).value, count: e.count, value: e.value, bought: e.bought }))
    .sort((a, b) => b.count - a.count || b.value - a.value || a.label.localeCompare(b.label));

  const storeMap = new Map();
  own.forEach((p) => { const s = p.store.trim(); if (!s) return; const k = s.toLowerCase(); const e = storeMap.get(k) || { names: [], count: 0 }; e.names.push(s); e.count++; storeMap.set(k, e); });
  const stores = [...storeMap.values()].map((e) => ({ label: mode(e.names).value, count: e.count })).sort((a, b) => b.count - a.count).slice(0, 5);

  // usual size per clothing type (newest items first so ties go to what you save lately)
  const byType = new Map();
  [...own].filter((p) => p.kind === 'clothing' && p.size.trim()).sort((a, b) => b.createdAt - a.createdAt).forEach((p) => {
    const t = clothingType(p) || 'Other clothing';
    const size = p.size.trim().replace(/\s+/g, ' ');
    const norm = /^[a-z]{1,4}$/i.test(size) ? size.toUpperCase() : size;
    (byType.get(t) || byType.set(t, []).get(t)).push(norm);
  });
  const order = [...CLOTHING_TYPES, 'Other clothing'];
  const sizes = [...byType.entries()].map(([type, list]) => ({ type, ...mode(list), total: list.length }))
    .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  const sections = [
    { label: 'Clothes', items: own.filter((p) => p.kind === 'clothing') },
    { label: 'Makeup', items: own.filter((p) => p.kind === 'makeup') },
    ...categories.map((c) => ({ label: c.name, items: own.filter((p) => p.kind === 'custom' && p.categoryId === c.id) })),
  ].map((s) => ({ label: s.label, value: sum(s.items.filter((p) => p.status !== 'purchased')), count: s.items.length })).filter((s) => s.count);

  // spending by month, from purchase dates (older purchases without one fall back to when they were last updated)
  const when = (p) => p.purchasedAt || p.updatedAt;
  const mk = (t) => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
  const nowK = mk(Date.now());
  const months = Array.from({ length: 6 }, (_, i) => {
    const k = nowK - 5 + i;
    const label = new Date(Math.floor(k / 12), k % 12, 1).toLocaleDateString('en-US', { month: 'short', ...(k % 12 === 0 || i === 0 ? { year: '2-digit' } : {}) });
    return { label, value: sum(bought.filter((p) => mk(when(p)) === k)), count: bought.filter((p) => mk(when(p)) === k).length };
  });
  const drops = own.filter((p) => p.status !== 'purchased' && p.priceHistory && p.priceHistory.length && p.price != null && p.price < p.priceHistory[0].price);

  return {
    thisMonth: months[5].value, lastMonth: months[4].value, months,
    dropCount: drops.length, dropSaved: drops.reduce((s, p) => s + (p.priceHistory[0].price - p.price), 0),
    ownCount: own.length, wantedCount: wanted.length, wantedTotal: sum(wanted), wantedUnpriced: wanted.filter((p) => p.price == null).length,
    spent: sum(bought), boughtCount: bought.length,
    avg: priced.length ? sum(priced) / priced.length : null, pricedCount: priced.length,
    giftsSpent: sum(giftsBought), giftsPlanned: sum(gifts), giftCount: gifts.length,
    brands, stores, sizes, sections,
    events: upcomingEvents(occasions, people, products),
  };
}

function Bars({ rows, value, label }) {
  const max = Math.max(1, ...rows.map(value));
  return (
    <ul className="bars">
      {rows.map((r) => (
        <li key={r.label} className="bar-row" title={`${r.label}: ${label(r)}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(2, (value(r) / max) * 100)}%` }} /></span>
          <span className="bar-value num">{label(r)}</span>
        </li>
      ))}
    </ul>
  );
}

function Tile({ label, value, note }) {
  return <div className="tile"><dt>{label}</dt><dd className="num">{value}</dd>{note && <p className="stat-note">{note}</p>}</div>;
}

/** Compact summary on Home that opens Your Data. */
export function DataCard() {
  const store = useStore();
  const { go } = useNav();
  const d = useMemo(() => computeInsights(store), [store.products, store.categories, store.occasions, store.people]);
  const next = d.events[0];
  return (
    <button type="button" className="data-card" onClick={() => go('data')}>
      <span className="data-card-head"><span className="eyebrow">Your Data</span><span className="data-card-link">See all<Icon name="arrow" size={16} /></span></span>
      <span className="data-card-stats">
        <span><span className="dc-label">Wishlist</span><span className="dc-value num">{money(d.wantedTotal)}</span></span>
        <span><span className="dc-label">Spent</span><span className="dc-value num">{money(d.spent)}</span></span>
        <span><span className="dc-label">{next ? next.name : 'Next event'}</span><span className="dc-value num">{next ? (next.n === 0 ? 'Today' : `${next.n} days`) : '—'}</span></span>
      </span>
    </button>
  );
}

export function DataView() {
  const store = useStore();
  const { go, open } = useNav();
  const d = useMemo(() => computeInsights(store), [store.products, store.categories, store.occasions, store.people]);
  const [name, setName] = useState(readName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const next = d.events[0];
  const top = d.brands[0];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const summary = [];
  if (d.wantedCount) summary.push(`You're saving up for ${d.wantedCount} thing${d.wantedCount === 1 ? '' : 's'}${d.wantedTotal ? `, about ${money(d.wantedTotal)} in all` : ''}.`);
  if (next) summary.push(`${next.name} is ${daysText(next.n)}.`);
  if (!summary.length) summary.push('Start saving things you love and your shopping story will show up here.');

  return (
    <>
      <section className="welcome" aria-labelledby="welcome-h">
        <div className="welcome-text">
          <p className="eyebrow">{today}</p>
          <h1 className="welcome-title" id="welcome-h">{greeting()}{name ? `, ${name}` : ''}!</h1>
          <p className="welcome-sub">{summary.join(' ')}</p>
          {!name && !editing && <button type="button" className="link-btn" onClick={() => setEditing(true)}>What should MUSE call you?</button>}
          {editing && (
            <form className="name-form" onSubmit={(e) => { e.preventDefault(); saveName(draft); setName(draft.trim()); setEditing(false); }}>
              <label className="sr-only" htmlFor="welcome-name">Your name</label>
              <input id="welcome-name" className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your first name" autoFocus maxLength={40} />
              <Btn type="submit" size="sm">Save</Btn>
            </form>
          )}
        </div>
        <div className="welcome-art" aria-hidden="true"><BagArt animated={false} /></div>
      </section>

      <section className="section" aria-labelledby="money-h">
        <div className="section-head"><div><p className="eyebrow">Your Data</p><h2 className="section-title" id="money-h">Money</h2></div></div>
        <dl className="tiles">
          <Tile label="Still on your wishlist" value={money(d.wantedTotal)} note={d.wantedUnpriced ? `${d.wantedUnpriced} item${d.wantedUnpriced === 1 ? '' : 's'} without a price` : `${d.wantedCount} item${d.wantedCount === 1 ? '' : 's'}`} />
          <Tile label="Spent this month" value={money(d.thisMonth)} note={`${money(d.lastMonth)} last month`} />
          <Tile label="Spent on yourself" value={money(d.spent)} note={`All time · ${d.boughtCount} item${d.boughtCount === 1 ? '' : 's'}`} />
          <Tile label="Average price" value={d.avg == null ? '—' : money(d.avg)} note={d.pricedCount ? `across ${d.pricedCount} priced item${d.pricedCount === 1 ? '' : 's'}` : 'Add prices to see this'} />
          <Tile label="Spent on gifts" value={money(d.giftsSpent)} note={d.giftCount ? `${money(d.giftsPlanned)} planned across ${d.giftCount} idea${d.giftCount === 1 ? '' : 's'}` : 'No gift ideas yet'} />
          <Tile label="Price drops" value={d.dropCount ? `↓ ${money(d.dropSaved)}` : '—'} note={d.dropCount ? `on ${d.dropCount} item${d.dropCount === 1 ? '' : 's'} you still want` : 'Lower a price when something goes on sale'} />
        </dl>
        {d.months.some((m) => m.value) && (
          <div className="panel">
            <h3 className="sub-title">Spending by month</h3>
            <Bars rows={d.months} value={(r) => r.value} label={(r) => money(r.value)} />
          </div>
        )}
        {d.sections.length > 1 && (
          <div className="panel">
            <h3 className="sub-title">Wishlist by section</h3>
            <Bars rows={d.sections} value={(r) => r.value} label={(r) => money(r.value)} />
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="soon-h">
        <div className="section-head"><div><p className="eyebrow">Gifting</p><h2 className="section-title" id="soon-h">Coming up</h2></div></div>
        {next ? (
          <>
            <button type="button" className="countdown" style={{ '--cat': next.accent }} onClick={() => go(next.kind === 'birthday' ? 'p-' + next.id : 'o-' + next.id)}>
              <span className="countdown-num num">{next.n}</span>
              <span className="countdown-text">
                <span className="countdown-unit">{next.n === 1 ? 'day' : 'days'} until</span>
                <span className="countdown-name">{next.name}</span>
                <span className="muted">{next.dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · {next.gifts} gift{next.gifts === 1 ? '' : 's'} planned</span>
              </span>
            </button>
            {d.events.length > 1 && (
              <ul className="event-list">
                {d.events.slice(1, 6).map((e) => (
                  <li key={e.key}>
                    <button type="button" className="event-row" style={{ '--cat': e.accent }} onClick={() => go(e.kind === 'birthday' ? 'p-' + e.id : 'o-' + e.id)}>
                      <span className="occ-date sm" aria-hidden="true"><span className="occ-mon">{e.dt.toLocaleDateString('en-US', { month: 'short' })}</span><span className="occ-day num">{e.dt.getDate()}</span></span>
                      <span className="event-name">{e.name}</span>
                      <span className="muted num">{daysText(e.n)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <Empty title="No dates yet" body="Add birthdays to gift profiles and dates to holiday lists to see a countdown here."
            action={<div className="row-actions"><Btn variant="secondary" size="sm" onClick={() => go('gifts')}>Go to Gifts</Btn><Btn variant="secondary" size="sm" onClick={() => open({ type: 'occasion-edit' })}>New holiday list</Btn></div>} />
        )}
      </section>

      <section className="section" aria-labelledby="brands-h">
        <div className="section-head"><div><p className="eyebrow">Your taste</p><h2 className="section-title" id="brands-h">Brands</h2></div></div>
        {top ? (
          <>
            <div className="top-brand">
              <span className="top-brand-label">Your top brand</span>
              <span className="top-brand-name">{top.label}</span>
              <span className="muted num">{top.count} item{top.count === 1 ? '' : 's'}{top.value ? ` · ${money(top.value)}` : ''}{top.bought ? ` · ${top.bought} bought` : ''}</span>
            </div>
            {d.brands.length > 1 && (
              <div className="panel">
                <h3 className="sub-title">Items by brand</h3>
                <Bars rows={d.brands.slice(0, 8)} value={(r) => r.count} label={(r) => `${r.count}`} />
                {d.brands.length > 8 && <p className="hint">+ {d.brands.length - 8} more brand{d.brands.length - 8 === 1 ? '' : 's'}</p>}
              </div>
            )}
            {d.stores.length > 0 && (
              <p className="hint">Favorite stores: {d.stores.map((s) => `${s.label} (${s.count})`).join(', ')}</p>
            )}
          </>
        ) : <Empty title="No brands yet" body="Add a brand to your wishlist items and MUSE will show which ones you love most." />}
      </section>

      <section className="section" aria-labelledby="sizes-h">
        <div className="section-head"><div><p className="eyebrow">Fit</p><h2 className="section-title" id="sizes-h">Your sizes</h2></div></div>
        {d.sizes.length ? (
          <div className="panel size-panel">
            <table className="size-table">
              <thead><tr><th scope="col">Category</th><th scope="col">Usual size</th><th scope="col" className="r">Based on</th></tr></thead>
              <tbody>
                {d.sizes.map((s) => (
                  <tr key={s.type}><th scope="row">{s.type}</th><td><span className="size-chip">{s.value}</span></td><td className="r muted num">{s.count} of {s.total}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="hint">Your most common size in each category, from the clothes you've saved. Set an item's type when you add it for the best results.</p>
          </div>
        ) : <Empty title="No sizes yet" body="Add a type and a size to clothing items (like Jeans, size 27) to see your usual size in each category." />}
      </section>
    </>
  );
}

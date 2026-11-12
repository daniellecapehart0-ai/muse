import React from 'react';
import { StoreProvider, useStore } from './store.jsx';
import { NavCtx, useNav } from './nav.js';
import { UiProvider, useUi, Btn, IconBtn, Icon, Empty, Img, Modal } from './ui.jsx';
import { ProductSection, ProductEditor, ProductDetail, ProductCard, kindLabel, QuickActions } from './products.jsx';
import { OutfitsView, OutfitEditor, OutfitCard, OutfitCover } from './outfits.jsx';
import { RoutinesView, RoutineEditor, RoutineCard, RoutineCover } from './routines.jsx';
import { CollectionsView, CollectionView, CategoryEditor, CategoryTile } from './collections.jsx';
import { BackupPanel } from './backup.jsx';
import { Splash } from './splash.jsx';
import { SettingsView } from './settings.jsx';
import { DataView, DataCard } from './data.jsx';
import { PackagesView, PackagesCard, PackageEditor } from './packages.jsx';
import { registerServiceWorker } from './push.js';
import { DocPage, APP } from './legal.jsx';
import { AuthGate } from './auth.jsx';
import { applyTheme, currentTheme } from './themes.js';
import { GiftsView, PersonView, OccasionView, PersonEditor, OccasionEditor, PersonCard, OccasionTile, OccasionsSection, Avatar } from './gifts.jsx';
import { money, matches } from './util.js';

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Routes live in the hash: home, closet, routines, collections, c-<collectionId>, gifts, p-<personId>, o-<occasionId>
const isGifts = (r) => r === 'gifts' || r.startsWith('p-') || r.startsWith('o-');
const readRoute = () => (location.hash || '#home').slice(1) || 'home';

function Header({ route, q, setQ }) {
  const { go, open } = useNav();
  const { status, people } = useStore();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(false); };
    const k = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [menu]);
  const onGifts = isGifts(route);
  const onOrganize = !['home', 'settings', 'data', 'privacy', 'terms', 'help'].includes(route) && !onGifts;
  const add = (m) => { setMenu(false); open(m); };
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button type="button" className="wordmark" onClick={() => { setQ(''); go('home'); }} aria-label="MUSE home">MUSE</button>
        <nav className="mainnav" aria-label="Main">
          <button type="button" className={route === 'home' && !q ? 'on' : ''} aria-current={route === 'home' ? 'page' : undefined} onClick={() => { setQ(''); go('home'); }}>Home</button>
          <button type="button" className={onOrganize && !q ? 'on' : ''} aria-current={onOrganize ? 'page' : undefined} onClick={() => { setQ(''); go(onOrganize ? route : 'closet'); }}>Organize</button>
          <button type="button" className={onGifts && !q ? 'on' : ''} aria-current={onGifts ? 'page' : undefined} onClick={() => { setQ(''); go('gifts'); }}>Gifts</button>
          <button type="button" className={route === 'data' && !q ? 'on' : ''} aria-current={route === 'data' ? 'page' : undefined} onClick={() => { setQ(''); go('data'); }}>Your Data</button>
        </nav>
        <label className="search">
          <Icon name="search" size={16} />
          <input type="search" className="input" placeholder="Search everything" aria-label="Search everything in MUSE" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <span className={`save-state ${status.state}`} role="status" aria-live="polite">{status.message}</span>
        <IconBtn icon="gear" label="Settings" onClick={() => { setQ(''); go('settings'); }} />
        <div className="add-wrap" ref={menuRef}>
          <Btn icon="plus" onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label="Add" title="Add"><span className="add-label">Add</span></Btn>
          {menu && (
            <div className="menu" role="menu">
              <button role="menuitem" type="button" onClick={() => add({ type: 'product-edit', kind: 'clothing' })}>Clothing item</button>
              <button role="menuitem" type="button" onClick={() => add({ type: 'product-edit', kind: 'makeup' })}>Makeup product</button>
              <button role="menuitem" type="button" onClick={() => add({ type: 'outfit-edit' })}>Outfit</button>
              <button role="menuitem" type="button" onClick={() => add({ type: 'routine-edit' })}>Makeup routine</button>
              <button role="menuitem" type="button" onClick={() => add({ type: 'category-edit' })}>New category</button>
              <span className="menu-sep" role="separator" />
              <button role="menuitem" type="button" onClick={() => add({ type: 'person-edit' })}>Gift profile</button>
              {people.length > 0 && <button role="menuitem" type="button" onClick={() => add({ type: 'product-edit', kind: 'gift' })}>Gift idea</button>}
              <button role="menuitem" type="button" onClick={() => add({ type: 'occasion-edit' })}>Holiday list</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function Stats() {
  const { products: all, outfits, routines } = useStore();
  const products = all.filter((p) => p.kind !== 'gift');
  const wish = products.filter((p) => p.status !== 'purchased');
  const value = wish.reduce((s, p) => s + (p.price || 0), 0);
  const unpriced = wish.filter((p) => p.price == null).length;
  const items = [
    ['Wishlist items', wish.length],
    ['Wishlist total', money(value), unpriced ? `${unpriced} without a price` : null],
    ['Purchased', products.filter((p) => p.status === 'purchased').length],
    ['Outfits & routines', outfits.length + routines.length],
  ];
  return (
    <dl className="stats">
      {items.map(([k, v, note]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd>{note && <p className="stat-note">{note}</p>}</div>)}
    </dl>
  );
}

function PlanCard({ title, sub, docs, render, onGo, empty }) {
  return (
    <button type="button" className="plan-card" onClick={onGo}>
      <span className="plan-title">{title}<Icon name="arrow" size={18} /></span>
      <span className="plan-sub">{sub}</span>
      {docs.length ? <span className="plan-thumbs">{docs.map((d) => <span key={d.id}>{render(d)}</span>)}</span> : <span className="plan-empty">{empty}</span>}
    </button>
  );
}

const readTab = () => { try { return localStorage.getItem('muse-home-tab') || 'clothing'; } catch { return 'clothing'; } };

function Home() {
  const { outfits, routines, categories, products, people } = useStore();
  const { go, open } = useNav();
  const [tab, setTabState] = useState(readTab);
  const setTab = (t) => { setTabState(t); try { localStorage.setItem('muse-home-tab', t); } catch { /* optional */ } };
  const cat = tab.startsWith('c-') ? categories.find((c) => 'c-' + c.id === tab) : null;
  const active = cat ? tab : tab === 'makeup' ? 'makeup' : 'clothing';
  const count = (k, cid) => products.filter((p) => p.kind === k && (k !== 'custom' || p.categoryId === cid)).length;
  const pick = (list) => [...list].sort((a, b) => (b.favorite - a.favorite) || b.updatedAt - a.updatedAt).slice(0, 3);
  const own = products.filter((p) => p.kind !== 'gift');
  const isEmpty = !own.length && !outfits.length && !routines.length;
  const Tab = ({ id, children }) => (
    <button type="button" role="tab" aria-selected={active === id} className={`pill ${active === id ? 'on' : ''}`} onClick={() => setTab(id)}>{children}</button>
  );
  const s = (n) => (n === 1 ? '' : 's');
  return (
    <>
      <section className="hero">
        <h1 className="hero-title">Everything you're saving up for.</h1>
        {isEmpty && <p className="lede">Save clothes and makeup you want, plan outfits and routines, and keep gift ideas for the people you love. Tap + to add your first item.</p>}
        <DataCard />
        <PackagesCard />
      </section>
      <div className="seg-tabs" role="tablist" aria-label="Wishlists">
        <Tab id="clothing">Clothes <span className="pill-count num">{count('clothing')}</span></Tab>
        <Tab id="makeup">Makeup <span className="pill-count num">{count('makeup')}</span></Tab>
        {categories.map((c) => <Tab key={c.id} id={'c-' + c.id}>{c.icon ? c.icon + ' ' : ''}{c.name} <span className="pill-count num">{count('custom', c.id)}</span></Tab>)}
        <button type="button" className="pill ghost" onClick={() => open({ type: 'category-edit' })}><Icon name="plus" size={16} />Collection</button>
      </div>
      {active === 'clothing' && <ProductSection id="clothes-h" kind="clothing" eyebrow="Wishlist" title="Clothes" addLabel="Add"
        emptyTitle="Your clothes wishlist is empty" emptyBody="Save pieces you're eyeing with a photo, price, size and link to the shop." />}
      {active === 'makeup' && <ProductSection id="makeup-h" kind="makeup" eyebrow="Wishlist" title="Makeup" addLabel="Add"
        emptyTitle="Your makeup wishlist is empty" emptyBody="Save products with their shade name and number so you buy the right one." />}
      {cat && <ProductSection key={cat.id} id={'cat-' + cat.id} kind="custom" categoryId={cat.id} title={cat.name} addLabel="Add"
        eyebrow={<>Collection · <button type="button" className="link-btn" onClick={() => go('c-' + cat.id)}>Edit collection</button></>}
        emptyTitle={`No ${cat.itemLabel}s yet`} emptyBody={`Save the first ${cat.itemLabel} you're considering, with a link, price and photo.`} />}
      <div className="plan-grid">
        <PlanCard title="Future Closet" sub={`${outfits.length} outfit${s(outfits.length)}`} docs={pick(outfits)} render={(o) => <OutfitCover outfit={o} />}
          onGo={() => go('closet')} empty="Put your saved clothes together into outfits." />
        <PlanCard title="Makeup Routines" sub={`${routines.length} routine${s(routines.length)}`} docs={pick(routines)} render={(r) => <RoutineCover routine={r} />}
          onGo={() => go('routines')} empty="Plan a routine step by step." />
      </div>
      <OccasionsSection eyebrow="Your holidays" />
      <button type="button" className="teaser" onClick={() => go('gifts')}>
        {people.length
          ? <span className="avatar-stack">{people.slice(0, 4).map((p) => <Avatar key={p.id} person={p} size="md" />)}</span>
          : <span className="avatar avatar-md" style={{ '--cat': '#F08080' }}><Icon name="gift" size={22} /></span>}
        <span className="teaser-text">
          <span className="teaser-title">Gifts for others</span>
          <span className="muted">{people.length ? `${people.length} gift profile${s(people.length)}` : 'Add the people you shop for'}</span>
        </span>
        <Icon name="arrow" size={18} />
      </button>
    </>
  );
}

function TabBar({ route }) {
  const { go, open } = useNav();
  const { archivedIds } = useStore();
  const inArchive = route.startsWith('o-') && archivedIds.has(route.slice(2));
  const onGifts = isGifts(route) && !inArchive;
  const onOrg = !!route && !['home', 'settings', 'data', 'privacy', 'terms', 'help'].includes(route) && !isGifts(route);
  const T = ({ label, icon, on, onClick }) => (
    <button type="button" className={`tab ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined} onClick={onClick}>
      <Icon name={icon} size={22} /><span>{label}</span>
    </button>
  );
  return (
    <nav className="tabbar" aria-label="Main">
      <T label="Home" icon="home" on={route === 'home' || route === 'data'} onClick={() => go('home')} />
      <T label="Organize" icon="grid" on={onOrg} onClick={() => go(onOrg ? route : 'closet')} />
      <button type="button" className="tab-add" aria-label="Add something" onClick={() => open({ type: 'add-menu' })}><Icon name="plus" size={28} /></button>
      <T label="Gifts" icon="gift" on={onGifts} onClick={() => go('gifts')} />
      <T label="Settings" icon="gear" on={['settings', 'privacy', 'terms', 'help'].includes(route) || inArchive} onClick={() => go('settings')} />
    </nav>
  );
}

function AddSheet({ onClose }) {
  const { open } = useNav();
  const { people } = useStore();
  const opts = [
    ['Clothing item', 'shirt', { type: 'product-edit', kind: 'clothing' }],
    ['Makeup product', 'lipstick', { type: 'product-edit', kind: 'makeup' }],
    ['Outfit', 'grid', { type: 'outfit-edit' }],
    ['Makeup routine', 'list', { type: 'routine-edit' }],
    ['Collection', 'folder', { type: 'category-edit' }],
    ['Holiday list', 'calendar', { type: 'occasion-edit' }],
    ['Package', 'box', { type: 'package-edit' }],
    ['Gift profile', 'person', { type: 'person-edit' }],
    ...(people.length ? [['Gift idea', 'gift', { type: 'product-edit', kind: 'gift' }]] : []),
  ];
  return (
    <Modal title="Add to MUSE" onClose={onClose} size="sm">
      <div className="add-grid">
        {opts.map(([l, icon, m]) => <button key={l} type="button" className="add-opt" onClick={() => open(m)}><Icon name={icon} size={20} /><span>{l}</span></button>)}
      </div>
    </Modal>
  );
}

function Organize({ route }) {
  const { categories } = useStore();
  const { go } = useNav();
  const tabs = [['closet', 'Future Closet'], ['routines', 'Makeup Routines'], ['packages', 'Packages'], ['collections', 'Collections']];
  return (
    <>
      <nav className="subnav" aria-label="Organize views">
        {tabs.map(([r, l]) => <button key={r} type="button" className={route === r || (r === 'collections' && route.startsWith('c-')) ? 'on' : ''} aria-current={route === r ? 'page' : undefined} onClick={() => go(r)}>{l}</button>)}
        {categories.length > 0 && <span className="subnav-sep" aria-hidden="true" />}
        {categories.map((c) => <button key={c.id} type="button" className={`sub-cat ${route === 'c-' + c.id ? 'on' : ''}`} aria-current={route === 'c-' + c.id ? 'page' : undefined} onClick={() => go('c-' + c.id)}>{c.icon ? c.icon + ' ' : ''}{c.name}</button>)}
      </nav>
      {route === 'closet' && <OutfitsView />}
      {route === 'routines' && <RoutinesView />}
      {route === 'packages' && <PackagesView />}
      {route === 'collections' && <CollectionsView />}
      {route.startsWith('c-') && <CollectionView id={route.slice(2)} />}
    </>
  );
}

function SearchResults({ q, clear }) {
  const { products, outfits, routines, categories, byId, people, occasions, archivedIds } = useStore();
  const { open, go } = useNav();
  const pl = people.filter((p) => matches(q, p.name, p.relationship, p.likes, p.favoriteColors, p.notes));
  const oc = occasions.filter((o) => matches(q, o.name, o.description));
  const ps = products.filter((p) => !(p.kind === 'gift' && archivedIds.has(p.occasionId)) && matches(q, p.name, p.brand, p.store, p.color, p.size, p.productType, p.shadeName, p.shadeNumber, p.notes));
  const os = outfits.filter((o) => matches(q, o.name, o.description, o.tags, o.occasion, o.season, o.notes, o.pieces.map((x) => byId[x.productId]?.name)));
  const rs = routines.filter((r) => matches(q, r.name, r.description, r.occasion, r.notes, r.steps.map((s) => byId[s.productId]?.name || s.standalone.name)));
  const cs = categories.filter((c) => matches(q, c.name, c.description));
  const total = ps.length + os.length + rs.length + cs.length + pl.length + oc.length;
  return (
    <section className="section" aria-live="polite">
      <div className="section-head">
        <div><p className="eyebrow">Search</p><h1 className="page-title">{total} result{total === 1 ? '' : 's'} for “{q}”</h1></div>
        <Btn variant="secondary" onClick={clear}>Clear search</Btn>
      </div>
      {total === 0 && <Empty title="Nothing found" body="Search looks through items, gift ideas, people, holiday lists, outfits, routines and collections." />}
      {pl.length > 0 && <><h2 className="sub-title">Gift profiles</h2><div className="grid people">{pl.map((p) => <PersonCard key={p.id} person={p} />)}</div></>}
      {oc.length > 0 && <><h2 className="sub-title">Holiday lists</h2><div className="grid cats">{oc.map((o) => <OccasionTile key={o.id} occ={o} />)}</div></>}
      {cs.length > 0 && <><h2 className="sub-title">Collections</h2><div className="grid cats">{cs.map((c) => <CategoryTile key={c.id} cat={c} />)}</div></>}
      {ps.length > 0 && <><h2 className="sub-title">Wishlist items</h2><div className="grid products">{ps.map((p) => (
        <div key={p.id} className="result-wrap"><ProductCard p={p} onOpen={() => open({ type: 'product-detail', id: p.id })} /><span className="result-kind">{kindLabel(p, categories, people)}</span></div>
      ))}</div></>}
      {os.length > 0 && <><h2 className="sub-title">Outfits</h2><div className="grid docs">{os.map((o) => <OutfitCard key={o.id} outfit={o} />)}</div></>}
      {rs.length > 0 && <><h2 className="sub-title">Routines</h2><div className="grid docs">{rs.map((r) => <RoutineCard key={r.id} routine={r} />)}</div></>}
    </section>
  );
}

function ModalHost({ stack, closeTop, replaceTop }) {
  return stack.map((m, i) => {
    const top = i === stack.length - 1;
    const onClose = () => (m.back ? replaceTop(m.back) : closeTop());
    const key = m.key;
    const wrap = (el) => <div key={key} className={top ? '' : 'under'} aria-hidden={top ? undefined : 'true'}>{el}</div>;
    switch (m.type) {
      case 'product-edit': return wrap(<ProductEditor product={m.product} kind={m.kind} categoryId={m.categoryId} personId={m.personId} occasionId={m.occasionId} onClose={onClose}
        onSaved={() => (m.back ? replaceTop(m.back) : closeTop())} />);
      case 'product-detail': return wrap(<ProductDetail id={m.id} onClose={closeTop} />);
      case 'outfit-edit': return wrap(<OutfitEditor outfit={m.outfit} onClose={onClose} />);
      case 'routine-edit': return wrap(<RoutineEditor routine={m.routine} onClose={onClose} />);
      case 'category-edit': return wrap(<CategoryEditor category={m.category} onClose={onClose} />);
      case 'person-edit': return wrap(<PersonEditor person={m.person} onClose={onClose} />);
      case 'occasion-edit': return wrap(<OccasionEditor occasion={m.occasion} stay={m.stay} onClose={onClose} />);
      case 'backup': return wrap(<BackupPanel onClose={closeTop} />);
      case 'add-menu': return wrap(<AddSheet onClose={closeTop} />);
      case 'package-edit': return wrap(<PackageEditor pkg={m.pkg} productId={m.productId} onClose={closeTop} />);
      case 'quick': return wrap(<QuickActions id={m.id} onClose={closeTop} />);
      default: return null;
    }
  });
}

function Shell() {
  const store = useStore();
  const [route, setRoute] = useState(readRoute);
  const [q, setQ] = useState('');
  const [stack, setStack] = useState([]);
  const [splash, setSplash] = useState(false); // the launch animation plays above sign-in; this one is for "Replay welcome"
  const keyRef = useRef(0);
  useEffect(() => {
    const h = () => { setRoute(readRoute()); };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = useCallback((r) => {
    setQ('');
    if (readRoute() !== r) location.hash = r; else setRoute(r);
    window.scrollTo({ top: 0 });
  }, []);
  const withKey = (m) => ({ ...m, key: ++keyRef.current });
  const open = useCallback((m) => setStack((s) => (m.stack || !s.length ? [...s, withKey(m)] : [...s.slice(0, -1), withKey(m)])), []);
  const closeTop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const replaceTop = useCallback((m) => setStack((s) => [...s.slice(0, -1), withKey(m)]), []);
  const nav = useMemo(() => ({ go, open }), [go, open]);
  const valid = ['home', 'closet', 'routines', 'packages', 'collections'].includes(route) || route.startsWith('c-') || isGifts(route) || ['settings', 'data', 'privacy', 'terms', 'help'].includes(route);
  const r = valid ? route : 'home';

  let main;
  if (store.loading) main = <p className="loading">Opening your wishlist…</p>;
  else if (store.loadError) main = <Empty title="MUSE couldn't open its storage" body={store.loadError} action={<Btn onClick={store.reload}>Try again</Btn>} />;
  else if (q.trim()) main = <SearchResults q={q.trim()} clear={() => setQ('')} />;
  else if (r === 'home') main = <Home />;
  else if (r === 'gifts') main = <GiftsView />;
  else if (r === 'data') main = <DataView />;
  else if (['privacy', 'terms', 'help'].includes(r)) main = <DocPage route={r} />;
  else if (r === 'settings') main = <SettingsView onReplayWelcome={() => setSplash(true)} />;
  else if (r.startsWith('p-')) main = <PersonView id={r.slice(2)} />;
  else if (r.startsWith('o-')) main = <OccasionView id={r.slice(2)} />;
  else main = <Organize route={r} />;

  return (
    <NavCtx.Provider value={nav}>
      <Header route={r} q={q} setQ={setQ} />
      <main className="page" id="main">
        {store.invalid > 0 && <p className="banner" role="status">{store.invalid} damaged record{store.invalid > 1 ? 's were' : ' was'} skipped while loading. Everything else is intact.</p>}
        {main}
      </main>
      <footer className="foot">
        <p>Saved to your MUSE account. Use <button type="button" className="link-btn" onClick={() => open({ type: 'backup' })}>Backup &amp; export</button> to download a copy.</p>
        <p className="foot-links"><button type="button" className="link-btn" onClick={() => go('privacy')}>Privacy</button> · <button type="button" className="link-btn" onClick={() => go('terms')}>Terms</button> · <button type="button" className="link-btn" onClick={() => go('help')}>Help</button> · MUSE {APP.version}</p>
      </footer>
      <TabBar route={q.trim() ? '' : r} />
      <ModalHost stack={stack} closeTop={closeTop} replaceTop={replaceTop} />
      {splash && <Splash loading={store.loading} onDone={() => setSplash(false)}
        empty={!store.products.length && !store.categories.length && !store.people.length && !store.occasions.length && !store.outfits.length && !store.routines.length} />}
    </NavCtx.Provider>
  );
}

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) return <div className="page"><Empty title="Something went wrong on this screen" body={'Your saved data is safe. Reload to continue. (' + this.state.err.message + ')'} action={<Btn onClick={() => location.reload()}>Reload</Btn>} /></div>;
    return this.props.children;
  }
}

function StoreWithToasts() {
  const { toast, celebrate } = useUi();
  const onError = useCallback((m) => toast(m, 'error'), [toast]);
  const onDeleted = useCallback((label, undo) => toast(label, 'info', { label: 'Undo', onClick: async () => { if (await undo()) toast('Restored'); } }), [toast]);
  const onPurchased = useCallback((p) => {
    if (p.kind === 'gift') celebrate(p.status === 'given' ? 'Gift given!' : 'Gift bought!', p.name);
    else celebrate(['Treat yourself!', 'It’s yours!', 'Good find!'][Math.floor(Math.random() * 3)], `You got the ${p.name}`);
  }, [celebrate]);
  return <StoreProvider onError={onError} onDeleted={onDeleted} onPurchased={onPurchased}><Shell /></StoreProvider>;
}

function LaunchSplash() {
  const [show, setShow] = useState(true);
  return show ? <Splash loading={false} empty={false} onDone={() => setShow(false)} /> : null;
}

/** The whole app: launch animation, then sign-in, then MUSE for the signed-in person. */
export default function MuseRoot() {
  useEffect(() => { applyTheme(currentTheme()); registerServiceWorker(); }, []);
  return (
    <Boundary>
      <UiProvider>
        <AuthGate>{() => <StoreWithToasts />}</AuthGate>
        <LaunchSplash />
      </UiProvider>
    </Boundary>
  );
}

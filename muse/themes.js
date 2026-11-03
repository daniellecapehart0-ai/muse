// Color themes. Each palette names a few roles; light and dark token sets are derived from them,
// with text colors pushed darker or lighter until they meet readable contrast on their background.
export const THEMES = [
  { id: 'peach', name: 'Peach Sorbet', colors: ['#F08080', '#F4978E', '#F8AD9D', '#FBC4AB', '#FFDAB9'], primary: '#F08080', c2: '#F4978E', c3: '#F8AD9D', soft: '#FBC4AB', base: '#FFDAB9', ink: '#4A2A2A' },
  { id: 'pastels', name: 'Soft Pastels', colors: ['#FFD6FF', '#E7C6FF', '#C8B6FF', '#B8C0FF', '#BBD0FF'], primary: '#C8B6FF', c2: '#B8C0FF', c3: '#BBD0FF', soft: '#E7C6FF', base: '#FFD6FF', ink: '#3B2A5C' },
  { id: 'meadow', name: 'Meadow Green', colors: ['#D9ED92', '#B5E48C', '#99D98C', '#76C893', '#52B69A', '#34A0A4', '#168AAD', '#1A759F', '#1E6091', '#184E77'], primary: '#52B69A', c2: '#76C893', c3: '#99D98C', soft: '#B5E48C', base: '#D9ED92', ink: '#184E77' },
  { id: 'watermelon', name: 'Watermelon Sorbet', colors: ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C'], primary: '#EF476F', c2: '#06D6A0', c3: '#118AB2', soft: '#FFD166', base: '#FFD166', ink: '#073B4C' },
  { id: 'ocean', name: 'Ocean Blue Serenity', colors: ['#03045E', '#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#ADE8F4', '#CAF0F8'], primary: '#00B4D8', c2: '#48CAE4', c3: '#0077B6', soft: '#ADE8F4', base: '#CAF0F8', ink: '#03045E' },
  { id: 'peachy', name: 'Peachy Delight', colors: ['#D8E2DC', '#FFE5D9', '#FFCAD4', '#F4ACB7', '#9D8189'], primary: '#F4ACB7', c2: '#FFCAD4', c3: '#D8E2DC', soft: '#FFCAD4', base: '#FFE5D9', ink: '#4E3A42' },
  { id: 'fiery', name: 'Fiery Red Sunset', colors: ['#03071E', '#370617', '#6A040F', '#9D0208', '#D00000', '#DC2F02', '#E85D04', '#F48C06', '#FAA307', '#FFBA08'], primary: '#E85D04', c2: '#F48C06', c3: '#D00000', soft: '#FAA307', base: '#FFBA08', ink: '#370617' },
  { id: 'christmas', name: 'Christmas Theme', colors: ['#D4E09B', '#F6F4D2', '#CBDFBD', '#F19C79', '#A44A3F'], primary: '#A44A3F', c2: '#F19C79', c3: '#D4E09B', soft: '#CBDFBD', base: '#F6F4D2', ink: '#3B2420' },
  { id: 'valentine', name: "Valentine's", colors: ['#461220', '#8C2F39', '#B23A48', '#FCB9B2', '#FED0BB'], primary: '#B23A48', c2: '#8C2F39', c3: '#FCB9B2', soft: '#FCB9B2', base: '#FED0BB', ink: '#461220' },
];

// ---------- color math ----------
const rgb = (h) => { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** mix(a, b, t): t = share of b */
export const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Push `c` toward black (light ground) or white (dark ground) until it reaches `target` contrast on `ground`. */
function ensure(c, ground, target) {
  const toward = contrast('#000000', ground) >= contrast('#FFFFFF', ground) ? '#000000' : '#FFFFFF';
  let out = c;
  for (let t = 0; t <= 1.0001 && contrast(out, ground) < target; t += 0.04) out = mix(c, toward, t);
  return out;
}
const onColor = (fill, ink) => (contrast('#FFFFFF', fill) >= 4.5 ? '#FFFFFF' : ensure(ink, fill, 5.5));
const rgba = (h, a) => `rgba(${rgb(h).join(', ')}, ${a})`;

function lightTokens(t) {
  const bg = mix(t.base, '#FFFFFF', 0.7);
  const soft = t.soft;
  return {
    bg, surface: mix(t.base, '#FFFFFF', 0.9), 'surface-2': mix(soft, '#FFFFFF', 0.55), tint: mix(soft, '#FFFFFF', 0.5), ph: mix(soft, '#FFFFFF', 0.4),
    line: rgba(t.ink, 0.12), 'line-strong': rgba(t.ink, 0.24),
    fg: ensure(t.ink, bg, 9), muted: ensure(mix(t.ink, bg, 0.3), bg, 5.2), 'accent-ink': ensure(t.primary, bg, 4.8),
    primary: t.primary, 'primary-hover': mix(t.primary, '#FFFFFF', 0.15), 'on-primary': onColor(t.primary, t.ink),
    panel: soft, 'on-panel': ensure(t.ink, soft, 7),
    danger: '#B3261E', ok: '#2F7D5C', shadow: `0 6px 18px ${rgba(t.ink, 0.1)}`,
  };
}
function darkTokens(t) {
  const bg = mix(t.ink, '#0B0B0D', 0.62);
  return {
    bg, surface: mix(bg, t.soft, 0.08), 'surface-2': mix(bg, t.soft, 0.14), tint: mix(bg, t.primary, 0.2), ph: mix(bg, t.soft, 0.12),
    line: 'rgba(255, 255, 255, 0.11)', 'line-strong': 'rgba(255, 255, 255, 0.22)',
    fg: ensure(mix(t.base, '#FFFFFF', 0.6), bg, 12), muted: ensure(mix(t.soft, '#FFFFFF', 0.35), bg, 6.5), 'accent-ink': ensure(mix(t.primary, '#FFFFFF', 0.25), bg, 6),
    primary: t.primary, 'primary-hover': mix(t.primary, '#FFFFFF', 0.15), 'on-primary': onColor(t.primary, t.ink),
    panel: mix(bg, t.primary, 0.22), 'on-panel': ensure(mix(t.base, '#FFFFFF', 0.6), mix(bg, t.primary, 0.22), 10),
    danger: '#FF8A80', ok: '#8FD1AE', shadow: '0 6px 18px rgba(0, 0, 0, 0.3)',
  };
}
const decl = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(';');

/** CSS that overrides the default (Peach Sorbet) tokens. `html:root` outranks the stylesheet's `:root` rules. */
export function themeCss(id) {
  const t = THEMES.find((x) => x.id === id);
  if (!t || t.id === 'peach') return '';
  const brand = {
    coral: t.primary, salmon: t.c2, apricot: t.c3, peach: t.soft, cream: t.base, 'bag-dark': mix(t.primary, '#000000', 0.12),
    'splash-bg': t.base, 'splash-ink': ensure(t.ink, t.base, 7), 'splash-accent': ensure(t.primary, t.base, 4.5), 'on-coral': onColor(t.primary, t.ink),
  };
  const D = decl(darkTokens(t));
  return `html:root{${decl(brand)};${decl(lightTokens(t))}}`
    + `@media (prefers-color-scheme: dark){html:root:not([data-theme="light"]){${D};color-scheme:dark}}`
    + `html:root[data-theme="dark"]{${D};color-scheme:dark}`;
}

// ---------- applying + remembering (per device) ----------
const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
export const currentTheme = () => get('muse-theme', 'peach');
export const currentAppearance = () => get('muse-appearance', 'system');

export function applyTheme(id) {
  const css = themeCss(id);
  let el = document.getElementById('muse-theme');
  if (!el) { el = document.createElement('style'); el.id = 'muse-theme'; document.head.appendChild(el); }
  el.textContent = css;
  set('muse-theme', id); set('muse-theme-css', css);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#FFF3EA');
}
export function applyAppearance(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else if (get('muse-appearance', 'system') !== 'system') root.removeAttribute('data-theme');
  set('muse-appearance', mode);
}

/** Inline script for the page head: applies the saved theme before first paint so there's no flash of the default colors. */
export const BOOT_SCRIPT = `try{var c=localStorage.getItem('muse-theme-css');if(c){var s=document.createElement('style');s.id='muse-theme';s.textContent=c;document.head.appendChild(s)}var a=localStorage.getItem('muse-appearance');if(a==='light'||a==='dark')document.documentElement.setAttribute('data-theme',a)}catch(e){}`;

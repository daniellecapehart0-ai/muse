import React from 'react';
import { DocSheet, APP } from './legal.jsx';

const { useState, useEffect, useRef } = React;

/** The MUSE shopping bag. `animated` plays the drop-in and the word rising out of the bag. */
export function BagArt({ animated = true, className = '' }) {
  return (
    <svg className={`bag-art ${animated ? 'animated' : ''} ${className}`} viewBox="0 0 300 340" role="img" aria-label="MUSE">
      <ellipse className="bag-shadow" cx="150" cy="322" rx="104" ry="9" style={{ fill: 'var(--coral)' }} opacity=".22" />
      <g className="bag-drop">
        {/* inside of the bag, seen through the opening */}
        <path d="M66 122 L234 122 L238 136 L62 136 Z" style={{ fill: 'var(--bag-dark)' }} />
        {/* handles sit behind the front panel */}
        <g className="bag-handles" fill="none" strokeLinecap="round">
          <path d="M104 140 C100 66, 200 66, 196 140" style={{ stroke: 'var(--bag-dark)' }} strokeWidth="11" />
          <path d="M104 140 C100 66, 200 66, 196 140" style={{ stroke: 'var(--apricot)' }} strokeWidth="4" opacity=".7" />
        </g>
        {/* the word lives inside the bag and rises out */}
        <g className="muse-word">
          <text x="150" y="104" textAnchor="middle" className="muse-text">MUSE</text>
        </g>
        {/* front panel */}
        <path d="M60 130 L240 130 L254 300 Q255 314 241 314 L59 314 Q45 314 46 300 Z" style={{ fill: 'var(--coral)' }} />
        <path d="M206 130 L240 130 L254 300 Q255 314 241 314 L222 314 Z" style={{ fill: 'var(--salmon)' }} opacity=".55" />
        <rect x="60" y="130" width="180" height="22" style={{ fill: 'var(--salmon)' }} />
        <circle cx="104" cy="141" r="6" style={{ fill: 'var(--cream)' }} />
        <circle cx="196" cy="141" r="6" style={{ fill: 'var(--cream)' }} />
        {/* boutique label */}
        <rect x="92" y="198" width="116" height="52" rx="14" style={{ fill: 'var(--cream)' }} />
        <rect x="98" y="204" width="104" height="40" rx="10" fill="none" style={{ stroke: 'var(--apricot)' }} strokeWidth="2" strokeDasharray="4 4" />
        <path d="M150 234 c-9-7-15-11-15-17 a6.5 6.5 0 0 1 15-3 a6.5 6.5 0 0 1 15 3 c0 6-6 10-15 17z" style={{ fill: 'var(--coral)' }} />
      </g>
      <g className="sparkles">
        <path className="spark s1" d="M58 74 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" style={{ fill: 'var(--coral)' }} />
        <path className="spark s2" d="M246 58 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" style={{ fill: 'var(--salmon)' }} />
        <path className="spark s3" d="M236 108 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" style={{ fill: 'var(--apricot)' }} />
        <path className="spark s4" d="M78 30 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5z" style={{ fill: 'var(--peach)' }} />
      </g>
    </svg>
  );
}

/** Launch screen. First visit (no data yet) waits for "Start my wishlist"; later visits play once and fade away. Tap or Escape skips. */
export function Splash({ loading, empty, onDone }) {
  const reduce = useRef(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches).current;
  const [welcomed] = useState(() => { try { return localStorage.getItem('muse-welcomed') === '1'; } catch { return true; } });
  const firstRun = !loading && !welcomed && empty;
  const [leaving, setLeaving] = useState(false);
  const [doc, setDoc] = useState(null);
  const ctaRef = useRef(null);
  const leave = () => { try { localStorage.setItem('muse-welcomed', '1'); } catch { /* optional */ } setLeaving(true); };

  useEffect(() => {
    if (loading || firstRun) return;
    const t = setTimeout(leave, reduce ? 900 : 2600);
    return () => clearTimeout(t);
  }, [loading, firstRun]);
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, reduce ? 0 : 450);
    return () => clearTimeout(t);
  }, [leaving]);
  useEffect(() => {
    if (firstRun) setTimeout(() => ctaRef.current?.focus(), reduce ? 0 : 1600);
    const k = (e) => { if (e.key === 'Escape' && !firstRun && !doc) leave(); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [firstRun, doc]);

  return (
    <div className={`splash ${leaving ? 'leaving' : ''} ${reduce ? 'still' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome to MUSE"
      onClick={() => { if (!firstRun) leave(); }}>
      <div className="splash-inner">
        <BagArt animated={!reduce} />
        <p className="splash-tag">Your wishlist, beautifully kept.</p>
        {firstRun && (
          <div className="splash-first">
            <p className="splash-sub">Save the clothes and makeup you love, plan outfits and routines, and keep gift ideas for everyone on your list.</p>
            <button ref={ctaRef} type="button" className="splash-cta" onClick={(e) => { e.stopPropagation(); leave(); }}>Start my wishlist</button>
            <p className="splash-legal">By continuing, you confirm you're {APP.minAge} or older and agree to the{' '}
              <button type="button" onClick={(e) => { e.stopPropagation(); setDoc('terms'); }}>Terms of Use</button> and{' '}
              <button type="button" onClick={(e) => { e.stopPropagation(); setDoc('privacy'); }}>Privacy Policy</button>.</p>
          </div>
        )}
      </div>
      {doc && <div onClick={(e) => e.stopPropagation()}><DocSheet doc={doc} onClose={() => setDoc(null)} /></div>}
    </div>
  );
}

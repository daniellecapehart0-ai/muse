import React from 'react';
import { supabase, rememberMe, setRememberMe, lastEmail, saveLastEmail, askToKeepStorage } from './supabase.js';
import { setUser, loadProfile } from './db.js';
import { BagArt } from './splash.jsx';
import { DocSheet, APP } from './legal.jsx';
import { Icon } from './ui.jsx';

const { useState, useEffect } = React;

function niceAuthError(e) {
  const m = (e && e.message) || String(e);
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Check them, or reset your password.";
  if (/already registered|already been registered|exists/i.test(m)) return 'There is already an account with that email. Sign in instead.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first. Check your inbox for the link from MUSE.';
  if (/password should be|at least/i.test(m)) return 'Use a password with at least 8 characters.';
  if (/valid email|invalid email|unable to validate email/i.test(m)) return 'Enter a valid email address.';
  if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
  if (/Failed to fetch|network|Load failed/i.test(m)) return 'No internet connection. Check your connection and try again.';
  return m;
}

function PasswordField({ id, label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} minLength={8} required />
        <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
      </div>
    </div>
  );
}

/** Sign in, create an account, or get a reset link. */
export function AuthScreen() {
  const returning = lastEmail();
  const [mode, setMode] = useState(returning ? 'signin' : 'signup'); // signup | signin | forgot
  const [email, setEmail] = useState(returning);
  const [keep, setKeep] = useState(rememberMe);
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [doc, setDoc] = useState(null);

  const switchTo = (m) => { setMode(m); setError(''); setNotice(''); };

  async function submit(e) {
    e.preventDefault();
    setError(''); setNotice('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (mode !== 'forgot' && password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (mode === 'signup' && !agree) { setError(`To create an account, confirm you're ${APP.minAge} or older and agree to the Terms and Privacy Policy.`); return; }
    setBusy(true);
    try {
      if (mode !== 'forgot') await setRememberMe(keep);
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        saveLastEmail(keep ? email.trim() : '');
      } else if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: location.origin + '/', data: { display_name: name.trim() } },
        });
        if (err) throw err;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('already registered');
        saveLastEmail(keep ? email.trim() : '');
        try { localStorage.setItem('muse-name', name.trim()); localStorage.setItem('muse-welcomed', '1'); } catch { /* optional */ }
        if (data.session) {
          if (name.trim()) await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', data.user.id);
        } else {
          setNotice(`Almost there. We sent a link to ${email.trim()}. Open it on this device to finish creating your account.`);
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/' });
        if (err) throw err;
        setNotice(`If there's an account for ${email.trim()}, a reset link is on its way. Open it on this device.`);
      }
    } catch (err) { setError(niceAuthError(err)); }
    setBusy(false);
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-bag" aria-hidden="true"><BagArt animated={false} /></div>
          <p className="auth-tag">Your wishlist, beautifully kept.</p>
        </div>
        {mode !== 'forgot' && (
          <div className="seg seg-lg auth-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => switchTo('signup')}>Create account</button>
            <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => switchTo('signin')}>Sign in</button>
          </div>
        )}
        <form className="auth-form" onSubmit={submit} noValidate>
          {mode === 'signin' && returning && email === returning && <p className="auth-welcome">Welcome back! Sign in to pick up where you left off.</p>}
          {mode === 'forgot' && <><h1 className="auth-title">Reset your password</h1><p className="hint">Enter your email and we'll send you a link to choose a new password.</p></>}
          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="auth-name">First name <span className="muted">(optional)</span></label>
              <input id="auth-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== 'forgot' && (
            <PasswordField id="auth-password" label={mode === 'signup' ? 'Create a password (8+ characters)' : 'Password'} value={password} onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          )}
          {mode !== 'forgot' && (
            <label className="check auth-keep">
              <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
              <span>Keep me signed in on this device</span>
            </label>
          )}
          {mode === 'signup' && (
            <label className="check auth-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>I'm {APP.minAge} or older and I agree to the{' '}
                <button type="button" className="link-btn" onClick={() => setDoc('terms')}>Terms of Use</button> and{' '}
                <button type="button" className="link-btn" onClick={() => setDoc('privacy')}>Privacy Policy</button>.</span>
            </label>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>
            {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>
          {mode === 'signin' && <button type="button" className="link-btn auth-link" onClick={() => switchTo('forgot')}>Forgot your password?</button>}
          {mode === 'forgot' && <button type="button" className="link-btn auth-link" onClick={() => switchTo('signin')}><Icon name="back" size={14} /> Back to sign in</button>}
        </form>
      </div>
      <p className="auth-foot">
        <button type="button" className="link-btn" onClick={() => setDoc('privacy')}>Privacy</button> · <button type="button" className="link-btn" onClick={() => setDoc('terms')}>Terms</button> · <button type="button" className="link-btn" onClick={() => setDoc('help')}>Help</button>
      </p>
      {doc && <DocSheet doc={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}

/** Shown after opening a password reset link. */
function NewPassword({ onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(niceAuthError(err)); else onDone();
  }
  return (
    <div className="auth">
      <div className="auth-card">
        <form className="auth-form" onSubmit={submit} noValidate>
          <h1 className="auth-title">Choose a new password</h1>
          <PasswordField id="new-password" label="New password (8+ characters)" value={password} onChange={setPassword} autoComplete="new-password" />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
        </form>
      </div>
    </div>
  );
}

/** Shows the app only to a signed-in person, and scopes all saving to their account. */
export function AuthGate({ children }) {
  const [session, setSession] = useState(undefined);
  const [recovery, setRecovery] = useState(false);
  const [ready, setReady] = useState(null); // user id whose profile has loaded

  useEffect(() => {
    askToKeepStorage();
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s || null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id || null;
  useEffect(() => {
    setUser(userId);
    if (!userId) { setReady(null); return; }
    let live = true;
    loadProfile().then((p) => {
      try { if (p && p.display_name) localStorage.setItem('muse-name', p.display_name); localStorage.setItem('muse-welcomed', '1'); } catch { /* optional */ }
    }).catch(() => {}).finally(() => { if (live) setReady(userId); });
    return () => { live = false; };
  }, [userId]);

  if (session === undefined || (userId && ready !== userId)) return <div className="auth-loading" role="status">Opening MUSE…</div>;
  if (recovery && session) return <NewPassword onDone={() => setRecovery(false)} />;
  if (!session) return <AuthScreen />;
  return <React.Fragment key={userId}>{children(session.user)}</React.Fragment>;
}

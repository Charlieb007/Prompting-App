/**
 * Authentication UI for Prompt Refina — anonymous-first.
 *
 * The app is fully usable without an account; these components only render /
 * activate when Supabase is configured. Signing in (email-password, Google, or
 * GitHub) currently just establishes a session — cloud data sync arrives in the
 * next milestone.
 */

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { CloseIcon } from './icons.jsx';

// Tracks the Supabase auth session. Returns { session, user, ready }.
// When Supabase isn't configured, it's immediately "ready" with no user
// (anonymous/local-only mode).
export function useSupabaseSession() {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);
  const [plan, setPlan] = useState('free');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Load the user's plan (free | pro) from their profile.
  const userId = session?.user?.id;
  useEffect(() => {
    if (!supabase || !userId) { setPlan('free'); return; }
    let active = true;
    supabase.from('profiles').select('plan').eq('id', userId).maybeSingle()
      .then(({ data }) => { if (active) setPlan(data?.plan || 'free'); });
    return () => { active = false; };
  }, [userId]);

  return { session, user: session?.user ?? null, ready, plan };
}

export function AuthModal({ onClose, initialMode = 'signin' }) {
  const [mode, setMode]         = useState(initialMode); // 'signin' | 'signup'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');

  async function handleEmail(e) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleOAuth(provider) {
    if (!supabase) return;
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    // On success the browser redirects to the provider; only errors return here.
    if (error) setError(error.message);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
          <button className="modal-close" onClick={onClose}><CloseIcon /></button>
        </div>
        <div className="modal-body">
          <p className="modal-section-hint">
            Sign in to sync your prompts across devices. You can keep using Prompt Refina without an account.
          </p>

          <div className="auth-oauth">
            <button className="auth-oauth-btn" onClick={() => handleOAuth('google')} disabled={busy}>
              Continue with Google
            </button>
            <button className="auth-oauth-btn" onClick={() => handleOAuth('github')} disabled={busy}>
              Continue with GitHub
            </button>
          </div>

          <div className="auth-divider"><span>or</span></div>

          <form onSubmit={handleEmail} className="auth-form">
            <input
              type="email" className="auth-input" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email"
            />
            <input
              type="password" className="auth-input" placeholder="Password"
              value={password} onChange={e => setPassword(e.target.value)}
              required minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {error  && <div className="auth-error">{error}</div>}
            {notice && <div className="auth-notice">{notice}</div>}
            <button type="submit" className="send-btn auth-submit" disabled={busy}>
              {busy ? 'Working…' : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>

          <button
            className="text-btn auth-toggle"
            onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setNotice(''); }}
          >
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountButton({ user, expanded, plan = 'free', onUpgrade, onManage }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Sign-in lives in the content-area CTA, not the sidebar. The sidebar only
  // shows the account row (with sign-out) once the user is signed in.
  if (!isSupabaseConfigured || !user) return null;

  const email = user.email || 'Account';
  const initial = (email[0] || 'U').toUpperCase();
  const isPro = plan === 'pro';

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <div className="sidebar-account">
      {menuOpen && (
        <div className="sidebar-account-menu">
          <div className="sidebar-account-email">{email}</div>
          <div className={`plan-badge plan-badge-${isPro ? 'pro' : 'free'}`}>{isPro ? 'Pro' : 'Free'} plan</div>
          {isPro ? (
            <button className="sidebar-account-action" onClick={() => { setMenuOpen(false); onManage?.(); }}>Manage subscription</button>
          ) : (
            <button className="sidebar-account-action upgrade" onClick={() => { setMenuOpen(false); onUpgrade?.(); }}>Upgrade to Pro ✨</button>
          )}
          <button className="sidebar-account-signout" onClick={signOut}>Sign out</button>
        </div>
      )}
      <button className="sidebar-account-btn" onClick={() => setMenuOpen(o => !o)} title={email}>
        <span className="sidebar-account-avatar" aria-hidden="true">{initial}</span>
        {expanded && <span className="sidebar-account-label">{email}</span>}
        {expanded && isPro && <span className="plan-badge plan-badge-pro plan-badge-inline">Pro</span>}
      </button>
    </div>
  );
}

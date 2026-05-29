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

  return { session, user: session?.user ?? null, ready };
}

export function AuthModal({ onClose }) {
  const [mode, setMode]         = useState('signin'); // 'signin' | 'signup'
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

export function AccountButton({ user, expanded, onSignIn }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // No auth backend configured → no account UI at all (pure anonymous mode).
  if (!isSupabaseConfigured) return null;

  if (!user) {
    return (
      <button className="sidebar-account-btn" onClick={onSignIn} title="Sign in">
        <span className="sidebar-account-avatar" aria-hidden="true">↪</span>
        {expanded && <span className="sidebar-account-label">Sign in</span>}
      </button>
    );
  }

  const email = user.email || 'Account';
  const initial = (email[0] || 'U').toUpperCase();

  async function signOut() {
    setMenuOpen(false);
    await supabase.auth.signOut();
  }

  return (
    <div className="sidebar-account">
      {menuOpen && (
        <div className="sidebar-account-menu">
          <div className="sidebar-account-email">{email}</div>
          <button className="sidebar-account-signout" onClick={signOut}>Sign out</button>
        </div>
      )}
      <button className="sidebar-account-btn" onClick={() => setMenuOpen(o => !o)} title={email}>
        <span className="sidebar-account-avatar" aria-hidden="true">{initial}</span>
        {expanded && <span className="sidebar-account-label">{email}</span>}
      </button>
    </div>
  );
}

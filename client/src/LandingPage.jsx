/**
 * LandingPage — shown to first-time visitors before the main app.
 * Once the user clicks "Start Refining", we set localStorage flag
 * and the parent swaps in the full app.
 */

import { useState } from 'react';
import { FunnelLogo } from './icons.jsx';

const FEATURES = [
  {
    emoji: '✨',
    title: 'Instant refinement',
    desc: 'Paste any rough idea. Get a well-structured, specific prompt back in seconds — powered by Claude.',
  },
  {
    emoji: '📊',
    title: 'Quality scorecard',
    desc: 'Every refinement includes scores across five dimensions: specificity, audience, format, constraints, and examples.',
  },
  {
    emoji: '🔁',
    title: 'Iterate with feedback',
    desc: 'Not quite right? Add a note — "make it shorter" or "more formal" — and refine again in one click.',
  },
  {
    emoji: '⚖️',
    title: 'Compare models',
    desc: 'Run the same prompt through Opus, Sonnet, and Haiku side-by-side. Pick the output that works best.',
  },
  {
    emoji: '🔗',
    title: 'Prompt chains',
    desc: 'Build multi-step pipelines where each prompt feeds into the next. Automate complex workflows.',
  },
  {
    emoji: '📤',
    title: 'Export anywhere',
    desc: 'Save to history, export as PDF or Markdown, share a link, or push directly to Notion and Slack.',
  },
];

const EXAMPLES = [
  { rough: 'write an email', refined: 'Write a concise follow-up email to a potential client who attended our product demo last Tuesday. The email should thank them for their time, address the two concerns they raised about pricing and onboarding, and include a clear next step (schedule a 30-minute call). Tone: professional but warm. Length: under 150 words.' },
  { rough: 'explain machine learning', refined: 'Explain how supervised machine learning works to a software engineer who is comfortable with Python and statistics but has no ML background. Use a concrete example (e.g., predicting house prices). Cover: what training data is, how a model learns from it, and what overfitting means. Avoid jargon. Length: 3–4 paragraphs.' },
  { rough: 'help me brainstorm', refined: 'Generate 10 creative product name ideas for a B2B SaaS tool that helps remote teams track and improve team morale. Names should be: memorable (1–2 words), domain-available friendly, and avoid overused tech prefixes like "Smart" or "Pro". For each name, add a one-sentence tagline.' },
];

export function LandingPage({ onGetStarted }) {
  const [activeExample, setActiveExample] = useState(0);
  const [animating, setAnimating] = useState(false);

  function handleGetStarted() {
    localStorage.setItem('prompt-refina-seen-landing', '1');
    onGetStarted();
  }

  function cycleExample(idx) {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setActiveExample(idx);
      setAnimating(false);
    }, 180);
  }

  const ex = EXAMPLES[activeExample];

  return (
    <div className="landing">

      {/* ── Nav ── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <FunnelLogo />
          <span>Prompt Refina</span>
        </div>
        <button className="landing-cta-sm" onClick={handleGetStarted}>
          Open app →
        </button>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-badge">Powered by Claude AI</div>
        <h1 className="landing-hero-title">
          Turn rough ideas into<br />
          <span className="landing-hero-accent">prompts that work</span>
        </h1>
        <p className="landing-hero-sub">
          Paste any rough, vague prompt. Get back a well-structured version with
          quality scores, change explanations, and iteration tools — in seconds.
        </p>
        <div className="landing-hero-actions">
          <button className="landing-cta-primary" onClick={handleGetStarted}>
            Start refining — it's free →
          </button>
          <span className="landing-hero-hint">No account needed</span>
        </div>
      </section>

      {/* ── Before / After example ── */}
      <section className="landing-example-section">
        <div className="landing-example-tabs">
          {EXAMPLES.map((e, i) => (
            <button
              key={i}
              className={`landing-example-tab ${activeExample === i ? 'active' : ''}`}
              onClick={() => cycleExample(i)}
            >
              {['Email', 'Explanation', 'Brainstorm'][i]}
            </button>
          ))}
        </div>
        <div className={`landing-example ${animating ? 'fading' : ''}`}>
          <div className="landing-example-col">
            <div className="landing-example-label rough">Before</div>
            <div className="landing-example-box rough-box">"{ex.rough}"</div>
          </div>
          <div className="landing-example-arrow">→</div>
          <div className="landing-example-col">
            <div className="landing-example-label refined">After</div>
            <div className="landing-example-box refined-box">{ex.refined}</div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-features">
        <h2 className="landing-section-title">Everything you need to prompt better</h2>
        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-emoji">{f.emoji}</div>
              <div className="landing-feature-title">{f.title}</div>
              <div className="landing-feature-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="landing-cta-section">
        <h2 className="landing-cta-title">Ready to write better prompts?</h2>
        <p className="landing-cta-sub">Free to use. No sign-up. Works in your browser.</p>
        <button className="landing-cta-primary large" onClick={handleGetStarted}>
          Open Prompt Refina →
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© 2026 Prompt Refina</span>
        <span>·</span>
        <span>Powered by Anthropic Claude</span>
      </footer>
    </div>
  );
}

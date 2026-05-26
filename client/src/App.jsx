import { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import { lintPrompt } from './lint.js';
import { scanForPII } from './scan.js';
import { RunDrawer, autoTitle } from './RunDrawer.jsx';

// Constants and utilities (extracted modules)
import {
  API_URL, CATEGORIES, SCORE_DIMENSIONS, MODELS,
  STORAGE_HISTORY, STORAGE_SETTINGS, STORAGE_SAVED, STORAGE_USAGE,
  STORAGE_CURRENT_CONVO, STORAGE_CONVERSATIONS, STORAGE_FOLDERS, STORAGE_CHAIN,
  MAX_HISTORY, MAX_USAGE_RECORDS, MAX_CONVERSATIONS,
  DEFAULT_MODEL, DEFAULT_SETTINGS, QUICK_STARTS,
} from './constants.js';
import {
  formatTime, makeId, averageScore, modelShortName, computeCost, formatCost,
  formatLatency, getSpeechRecognition, defaultPDFFilename, sanitizeFilename,
  extractVariables, fillVariables,
} from './utils.js';
import { streamRefinement, streamComparison, streamTest, streamRunPrompt } from './sse.js';

// Icons
import {
  SidebarIcon, HistoryIcon, TemplatesIcon, StarIcon, HelpIcon, SettingsIcon,
  UsageIcon, SendIcon, MicIcon, MicOffIcon, PDFIcon, ExternalLinkIcon, PlayCircleIcon,
  ConversationsIcon, ChartIcon, ShareIcon, ChainIcon, LoopIcon, PlusIcon, PencilIcon,
} from './icons.jsx';

// Components (extracted modules)
import { PDFPreviewModal } from './PDFPreviewModal.jsx';
import {
  DrawerLogo, HistoryView, SavedView, TemplatesView, UsageView, AnalyticsView,
  ChainView, HelpView, SettingsView, ImportExportModal,
} from './LeftRailViews.jsx';
import {
  PIIWarningModal, TemplateVariablesModal, ShareModal,
  PromptDiffPanel, ConfirmDialog, ToastList,
} from './Modals.jsx';
import {
  SkeletonBar, ChangesSkeleton, ScoresSkeleton, ComparisonColumnSkeleton,
  LintHintsPanel, RoughPromptMessage, ChangesPanel, RadarChart, ScoresPanel,
} from './ScoreComponents.jsx';
import { CompareInvite, ComparisonStrip } from './ComparisonPanels.jsx';
import { ABTestInvite, ABTestPanel, FollowUpPanel } from './ABTestPanels.jsx';

/* ── Left-rail items (uses icon components — stays in App.jsx) ── */

const LEFT_RAIL_ITEMS = [
  { id: 'history',       label: 'History',               icon: HistoryIcon        },
  { id: 'conversations', label: 'Conversations',         icon: ConversationsIcon  },
  { id: 'saved',         label: 'Saved prompts',         icon: StarIcon           },
  { id: 'templates',     label: 'Templates',             icon: TemplatesIcon      },
  { id: 'analytics',     label: 'Analytics',             icon: ChartIcon          },
  { id: 'chain',         label: 'Prompt Chain',          icon: ChainIcon          },
  { id: 'usage',         label: 'Usage & cost',          icon: UsageIcon          },
  { id: 'help',          label: 'Help & Documentation',  icon: HelpIcon           },
  { id: 'settings',      label: 'Settings',              icon: SettingsIcon       },
];

/* ── App ─────────────────────────────────────────────────── */

function App() {
  const [roughPrompt, setRoughPrompt] = useState('');
  const [submittedPrompt, setSubmittedPrompt] = useState('');
  const [submittedFeedback, setSubmittedFeedback] = useState('');
  const [category, setCategory] = useState('general');
  const [improvedPrompt, setImprovedPrompt] = useState('');
  const [changes, setChanges] = useState([]);
  const [scores, setScores] = useState(null);
  const [primaryModel, setPrimaryModel] = useState(DEFAULT_MODEL);
  const [primaryUsage, setPrimaryUsage] = useState(null);
  const [primaryLatencyMs, setPrimaryLatencyMs] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [refinedComplete, setRefinedComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState([]);
  const [currentSavedId, setCurrentSavedId] = useState(null);
  const [activeView, setActiveView] = useState(null);
  const [railExpanded, setRailExpanded] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [usage, setUsage] = useState([]);
  const [lintHints, setLintHints] = useState([]);
  const [dismissedHints, setDismissedHints] = useState([]);
  const [piiFindings, setPiiFindings] = useState(null);
  const [piiPendingFeedback, setPiiPendingFeedback] = useState(null);
  const [abTestOpen, setAbTestOpen] = useState(false);
  const [abTest, setAbTest] = useState(null);
  const [abTesting, setAbTesting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), []);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);

  // Run Prompt panel state.
  // - currentConvo: the active conversation (null if none started yet)
  // - conversations: list of past conversations (excludes currentConvo)
  // - panelMode: 'conversation' or 'list'
  // - running: true while a turn is streaming
  // - convoDrawerOpen: whether the run drawer is currently open
  const [currentConvo, setCurrentConvo] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [panelMode, setPanelMode] = useState('conversation');
  const [running, setRunning] = useState(false);
  const [convoDrawerOpen, setConvoDrawerOpen] = useState(false);

  // Folders for saved prompts
  const [folders, setFolders] = useState([]);

  // Template variables modal
  const [templateVarsOpen, setTemplateVarsOpen] = useState(false);
  const [templateVarNames, setTemplateVarNames] = useState([]);
  const [templateVarValues, setTemplateVarValues] = useState({});
  const [templateVarsPendingFeedback, setTemplateVarsPendingFeedback] = useState(null);

  // Share modal
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Prompt chain
  const [chainSteps, setChainSteps] = useState([]);
  const [chainRunning, setChainRunning] = useState(false);
  const chainAbortRef = useRef(null);

  // Multi-pass refinement
  const [multiPassEnabled, setMultiPassEnabled] = useState(false);
  const [multiPassCount, setMultiPassCount] = useState(3);
  const [multiPassCurrent, setMultiPassCurrent] = useState(0);

  const textareaRef = useRef(null);
  const conversationRef = useRef(null);
  const abortRef = useRef(null);
  const compareAbortRef = useRef(null);
  const testAbortRef = useRef(null);
  const runAbortRef = useRef(null);
  const lintTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionBaseRef = useRef('');
  const scoresChartRef = useRef(null);
  // Stores the desired pass count across the template-var / PII modal interruptions
  // so multi-pass is preserved even when those checks show a modal before executing.
  const pendingPassTotalRef = useRef(1);

  // ── Prompt versioning ─────────────────────────────────────
  // Tracks all refined outputs for the current session so the user can
  // flip between v1, v2, v3 etc. Resets on each fresh initial refinement.
  const [promptVersions, setPromptVersions] = useState([]);
  const [viewingVersionId, setViewingVersionId] = useState(null);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);

  // ── Inline edit of the refined prompt ─────────────────────
  const [editingRefined, setEditingRefined] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const editTextareaRef = useRef(null);

  // ── Toast notifications ────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  function addToast(message, type = 'success') {
    const id = makeId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }
  function dismissToast(id) { setToasts(prev => prev.filter(t => t.id !== id)); }

  // ── Confirm dialog (replaces native confirm()) ─────────────
  const [confirmState, setConfirmState] = useState(null);
  function showConfirm(message, onConfirm, confirmLabel = 'Delete') {
    setConfirmState({ message, onConfirm, confirmLabel });
  }
  function closeConfirm() { setConfirmState(null); }

  useEffect(() => {
    const savedHistory = localStorage.getItem(STORAGE_HISTORY);
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); }
      catch { setHistory([]); }
    }
    const savedSettings = localStorage.getItem(STORAGE_SETTINGS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch { setSettings(DEFAULT_SETTINGS); }
    }
    const savedStarred = localStorage.getItem(STORAGE_SAVED);
    if (savedStarred) {
      try { setSaved(JSON.parse(savedStarred)); }
      catch { setSaved([]); }
    }
    const savedUsage = localStorage.getItem(STORAGE_USAGE);
    if (savedUsage) {
      try { setUsage(JSON.parse(savedUsage)); }
      catch { setUsage([]); }
    }
    const savedConvo = localStorage.getItem(STORAGE_CURRENT_CONVO);
    if (savedConvo) {
      try { setCurrentConvo(JSON.parse(savedConvo)); }
      catch { setCurrentConvo(null); }
    }
    const savedConvos = localStorage.getItem(STORAGE_CONVERSATIONS);
    if (savedConvos) {
      try { setConversations(JSON.parse(savedConvos)); }
      catch { setConversations([]); }
    }
    const savedFolders = localStorage.getItem(STORAGE_FOLDERS);
    if (savedFolders) {
      try { setFolders(JSON.parse(savedFolders)); }
      catch { setFolders([]); }
    }
    const savedChain = localStorage.getItem(STORAGE_CHAIN);
    if (savedChain) {
      try { setChainSteps(JSON.parse(savedChain)); }
      catch { setChainSteps([]); }
    }
  }, []);

  useEffect(() => {
    if (currentConvo) {
      localStorage.setItem(STORAGE_CURRENT_CONVO, JSON.stringify(currentConvo));
    } else {
      localStorage.removeItem(STORAGE_CURRENT_CONVO);
    }
  }, [currentConvo]);

  useEffect(() => {
    localStorage.setItem(STORAGE_CONVERSATIONS, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!importExportOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape') setImportExportOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [importExportOpen]);

  useEffect(() => {
    if (!piiFindings) return;
    function onEsc(e) {
      if (e.key === 'Escape') {
        setPiiFindings(null);
        setPiiPendingFeedback(null);
      }
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [piiFindings]);

  useEffect(() => {
    if (!pdfModalOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape') setPdfModalOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [pdfModalOpen]);

  useEffect(() => {
    if (!convoDrawerOpen) return;
    function onEsc(e) {
      if (e.key === 'Escape' && !running) setConvoDrawerOpen(false);
    }
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [convoDrawerOpen, running]);

  function autoResize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }

  useEffect(() => { autoResize(); }, [roughPrompt]);

  useEffect(() => {
    if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    setDismissedHints([]);

    if (!settings.linterEnabled) {
      setLintHints([]);
      return;
    }
    if (!roughPrompt.trim()) {
      setLintHints([]);
      return;
    }
    lintTimerRef.current = setTimeout(() => {
      setLintHints(lintPrompt(roughPrompt));
    }, 400);
    return () => {
      if (lintTimerRef.current) clearTimeout(lintTimerRef.current);
    };
  }, [roughPrompt, settings.linterEnabled]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) { /* noop */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  // ── Global keyboard shortcuts ──────────────────────────────
  useEffect(() => {
    function onKey(e) {
      // Escape: close active panel (only when no modal is blocking)
      if (e.key === 'Escape' && !confirmState && !piiFindings && !templateVarsOpen && !shareModalOpen && !pdfModalOpen && !importExportOpen) {
        if (activeView !== null) { e.preventDefault(); setActiveView(null); }
      }
      // /: focus composer when not in an input or textarea
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setActiveView(null);
        setTimeout(() => textareaRef.current?.focus(), 60);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeView, confirmState, piiFindings, templateVarsOpen, shareModalOpen, pdfModalOpen, importExportOpen]);

  function updateSettings(partial) {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(updated));
  }

  function resetSettings() {
    showConfirm('Reset all settings to defaults?', () => {
      setSettings(DEFAULT_SETTINGS);
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      addToast('Settings reset to defaults');
    }, 'Reset');
  }

  function recordUsage({ model, usage: u, latencyMs, kind }) {
    if (!u || (u.inputTokens === 0 && u.outputTokens === 0)) return;
    const cost = computeCost(model, u);
    const record = {
      timestamp: Date.now(),
      model,
      inputTokens: u.inputTokens || 0,
      outputTokens: u.outputTokens || 0,
      costUSD: cost,
      latencyMs: latencyMs || null,
      kind: kind || 'refinement',
    };
    setUsage((prev) => {
      const next = [record, ...prev].slice(0, MAX_USAGE_RECORDS);
      localStorage.setItem(STORAGE_USAGE, JSON.stringify(next));
      return next;
    });
  }

  function clearUsage() {
    showConfirm('Reset all usage data? This cannot be undone.', () => {
      setUsage([]);
      localStorage.removeItem(STORAGE_USAGE);
      addToast('Usage data cleared');
    }, 'Reset');
  }

  function saveToHistory(entry) {
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(updated);
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
  }

  function clearHistory() {
    showConfirm('Clear all history? This cannot be undone.', () => {
      setHistory([]);
      localStorage.removeItem(STORAGE_HISTORY);
      addToast('History cleared');
    }, 'Clear');
  }

  function deleteHistoryEntry(timestamp) {
    const updated = history.filter(e => e.timestamp !== timestamp);
    setHistory(updated);
    if (updated.length === 0) {
      localStorage.removeItem(STORAGE_HISTORY);
    } else {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
    }
  }

  function clearCurrentRefinement() {
    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setPrimaryUsage(null);
    setPrimaryLatencyMs(null);
    setComparison(null);
    setRefinedComplete(false);
    setCurrentSavedId(null);
    setAbTest(null);
    setAbTestOpen(false);
    setPromptVersions([]);
    setViewingVersionId(null);
    setVersionsOpen(false);
    setDiffOpen(false);
    setEditingRefined(false);
    setEditDraft('');
  }

  function loadFromHistory(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback(entry.feedback || '');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setPrimaryUsage(entry.usage || null);
    setPrimaryLatencyMs(entry.latencyMs || null);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(null);
    setAbTest(null);
    setAbTestOpen(false);
    setActiveView(null); // navigate back to refinery view
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function loadFromTemplate(template) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt(template.rough);
    setSubmittedPrompt('');
    setSubmittedFeedback('');
    setCategory(template.category);
    clearCurrentRefinement();
    setError('');
    setActiveView(null);
    setTimeout(() => { textareaRef.current?.focus(); }, 250);
  }

  function loadFromSaved(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt('');
    setSubmittedPrompt(entry.rough);
    setSubmittedFeedback('');
    setCategory(entry.category);
    setImprovedPrompt(entry.improved);
    setChanges(entry.changes || []);
    setScores(entry.scores || null);
    setPrimaryModel(entry.model || DEFAULT_MODEL);
    setPrimaryUsage(entry.usage || null);
    setPrimaryLatencyMs(entry.latencyMs || null);
    setComparison(entry.comparison || null);
    setRefinedComplete(true);
    setError('');
    setCurrentSavedId(entry.id);
    setAbTest(null);
    setAbTestOpen(false);
    setActiveView(null); // navigate back to refinery view
    if (conversationRef.current) {
      conversationRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function persistSaved(next) {
    setSaved(next);
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(next));
  }

  function toggleSaveCurrent() {
    if (!improvedPrompt || !refinedComplete) return;
    if (currentSavedId) {
      const next = saved.filter((s) => s.id !== currentSavedId);
      persistSaved(next);
      setCurrentSavedId(null);
      return;
    }
    const newEntry = {
      id: makeId(),
      name: '',
      rough: submittedPrompt,
      improved: improvedPrompt,
      changes,
      scores,
      category,
      model: primaryModel,
      usage: primaryUsage,
      latencyMs: primaryLatencyMs,
      comparison,
      savedAt: Date.now(),
    };
    persistSaved([newEntry, ...saved]);
    setCurrentSavedId(newEntry.id);
  }

  function renameSaved(id, newName) {
    const next = saved.map((s) => (s.id === id ? { ...s, name: newName } : s));
    persistSaved(next);
  }

  function removeSaved(id) {
    showConfirm('Remove this saved prompt?', () => {
      const next = saved.filter((s) => s.id !== id);
      persistSaved(next);
      if (currentSavedId === id) setCurrentSavedId(null);
      addToast('Prompt removed from saved');
    }, 'Remove');
  }

  /* ── Folder management ───────────────────────────────── */

  function persistFolders(next) {
    setFolders(next);
    localStorage.setItem(STORAGE_FOLDERS, JSON.stringify(next));
  }

  function addFolder(name) {
    const f = { id: makeId(), name, createdAt: Date.now() };
    persistFolders([...folders, f]);
  }

  function renameFolder(id, name) {
    persistFolders(folders.map(f => f.id === id ? { ...f, name } : f));
  }

  function deleteFolder(id) {
    const folder = folders.find(f => f.id === id);
    showConfirm(`Delete folder "${folder?.name || 'this folder'}"? Prompts inside will move to Uncategorized.`, () => {
      persistFolders(folders.filter(f => f.id !== id));
      persistSaved(saved.map(s => s.folderId === id ? { ...s, folderId: null } : s));
      addToast('Folder deleted');
    });
  }

  function moveSavedToFolder(entryId, folderId) {
    persistSaved(saved.map(s => s.id === entryId ? { ...s, folderId: folderId || null } : s));
  }

  /* ── Re-refine from history ──────────────────────────── */

  function reRefineFromHistory(entry) {
    if (streaming || comparing || abTesting || running) return;
    setRoughPrompt(entry.rough);
    setCategory(entry.category);
    clearCurrentRefinement();
    setSubmittedPrompt('');
    setError('');
    setActiveView(null);
    setTimeout(() => textareaRef.current?.focus(), 250);
  }

  /* ── Template variables ──────────────────────────────── */

  function handleTemplateVarsContinue() {
    const filledPrompt = fillVariables(roughPrompt, templateVarValues);
    setRoughPrompt(filledPrompt);
    setTemplateVarsOpen(false);
    setTemplateVarNames([]);
    setTemplateVarValues({});
    const feedback = templateVarsPendingFeedback;
    setTemplateVarsPendingFeedback(null);
    // Proceed with the filled prompt
    setTimeout(() => runRefinement({ feedback, overridePrompt: filledPrompt }), 0);
  }

  function handleTemplateVarsCancel() {
    setTemplateVarsOpen(false);
    setTemplateVarNames([]);
    setTemplateVarValues({});
    setTemplateVarsPendingFeedback(null);
  }

  function updateTemplateVarValue(name, value) {
    setTemplateVarValues(prev => ({ ...prev, [name]: value }));
  }

  /* ── Share prompt ────────────────────────────────────── */

  async function handleShare() {
    if (!improvedPrompt || !refinedComplete) return;
    try {
      const res = await fetch(`${API_URL}/api/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rough: submittedPrompt,
          improved: improvedPrompt,
          changes,
          scores,
          category,
          model: primaryModel,
        }),
      });
      const data = await res.json();
      if (data.url) {
        setShareUrl(data.url);
        setShareModalOpen(true);
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  /* ── Export to Notion / Slack ────────────────────────── */

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  async function handleExportNotion() {
    setExportDropdownOpen(false);
    const { notionToken, notionDatabaseId } = settings;
    if (!notionToken || !notionDatabaseId) {
      addToast('Add your Notion token & database ID in Settings → Integrations first.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/export/notion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rough: submittedPrompt,
          improved: improvedPrompt,
          changes,
          category,
          model: primaryModel,
          token: notionToken,
          databaseId: notionDatabaseId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('Exported to Notion ✓', 'success');
      } else {
        addToast(`Notion export failed: ${data.error || 'unknown error'}`, 'error');
      }
    } catch (err) {
      addToast(`Notion export error: ${err.message}`, 'error');
    }
  }

  async function handleExportSlack() {
    setExportDropdownOpen(false);
    const { slackWebhookUrl } = settings;
    if (!slackWebhookUrl) {
      addToast('Add your Slack Incoming Webhook URL in Settings → Integrations first.', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/export/slack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rough: submittedPrompt,
          improved: improvedPrompt,
          changes,
          category,
          model: primaryModel,
          webhookUrl: slackWebhookUrl,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast('Posted to Slack ✓', 'success');
      } else {
        addToast(`Slack export failed: ${data.error || 'unknown error'}`, 'error');
      }
    } catch (err) {
      addToast(`Slack export error: ${err.message}`, 'error');
    }
  }

  /* ── Prompt chain ────────────────────────────────────── */

  function updateChainSteps(steps) {
    setChainSteps(steps);
    localStorage.setItem(STORAGE_CHAIN, JSON.stringify(steps));
  }

  async function runChain() {
    if (chainRunning || !chainSteps.every(s => s.prompt.trim())) return;
    setChainRunning(true);

    const controller = new AbortController();
    chainAbortRef.current = controller;

    // Reset all step outputs
    const working = chainSteps.map(s => ({ ...s, output: '', status: 'idle' }));
    updateChainSteps(working);

    let previousOutput = '';

    for (let i = 0; i < working.length; i++) {
      if (controller.signal.aborted) break;

      // Mark as running
      working[i] = { ...working[i], status: 'running' };
      updateChainSteps([...working]);

      const prompt = previousOutput
        ? working[i].prompt.replace(/\{\{previous_output\}\}/g, previousOutput)
        : working[i].prompt;

      let stepOutput = '';
      try {
        const response = await fetch(`${API_URL}/api/run-prompt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            model: settings.testModel,
          }),
          signal: controller.signal,
        });

        await consumeSSE(response, {
          'run-chunk': (p) => {
            stepOutput += p.text;
            working[i] = { ...working[i], output: stepOutput };
            updateChainSteps([...working]);
          },
          'run-done': () => {},
          'run-error': (p) => { throw new Error(p.error || 'Run failed'); },
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          working[i] = { ...working[i], status: 'error', output: `Error: ${err.message}` };
          updateChainSteps([...working]);
          break;
        }
      }

      previousOutput = stepOutput;
      working[i] = { ...working[i], status: 'done' };
      updateChainSteps([...working]);
    }

    setChainRunning(false);
    chainAbortRef.current = null;
  }

  // Left rail icon click. The "conversations" item opens the right-side
  // run drawer; all others toggle the left-side drawer view.
  function toggleView(id) {
    if (id === 'conversations') {
      const opening = !convoDrawerOpen;
      setConvoDrawerOpen(opening);
      if (opening) setPanelMode('conversation');
      return;
    }
    setActiveView(activeView === id ? null : id);
  }

  function toggleSidebar() {
    setRailExpanded(v => !v);
  }

  function handleNewPrompt() {
    setActiveView(null);
    setConvoDrawerOpen(false);
    setRoughPrompt('');
    setSubmittedPrompt('');
    setSubmittedFeedback('');
    setError('');
    clearCurrentRefinement();
    setTimeout(() => textareaRef.current?.focus(), 80);
  }

  function handleImport(importedHistory, importedSaved) {
    let count = 0;
    if (importedHistory.length > 0) {
      const next = [...history, ...importedHistory].slice(0, MAX_HISTORY);
      setHistory(next);
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(next));
      count += importedHistory.length;
    }
    if (importedSaved.length > 0) {
      const next = [...saved, ...importedSaved];
      persistSaved(next);
      count += importedSaved.length;
    }
    if (count > 0) addToast(`Imported ${count} prompt${count !== 1 ? 's' : ''}`);
  }

  function dismissLintHint(hintId) {
    setDismissedHints((prev) => [...prev, hintId]);
  }

  function startRecording() {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition not supported in this browser.');
      return;
    }
    if (isRecording) return;

    setVoiceError('');
    recognitionBaseRef.current = roughPrompt.trim() ? roughPrompt.trimEnd() + ' ' : '';

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let allText = '';
      for (let i = 0; i < event.results.length; i++) {
        allText += event.results[i][0].transcript;
      }
      setRoughPrompt(recognitionBaseRef.current + allText);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setVoiceError('Microphone access denied. Enable it in your browser settings.');
      } else if (event.error === 'no-speech') {
        setVoiceError('No speech detected. Try again, closer to the microphone.');
      } else if (event.error === 'audio-capture') {
        setVoiceError('No microphone found. Check your audio devices.');
      } else if (event.error === 'network') {
        setVoiceError('Speech recognition needs an internet connection.');
      } else if (event.error === 'aborted') {
        /* noop */
      } else {
        setVoiceError(`Speech recognition error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      setVoiceError('Could not start microphone. Try again.');
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
    setIsRecording(false);
  }

  function toggleRecording() {
    if (isRecording) stopRecording();
    else startRecording();
  }

  async function executeRefinement({ feedback = null, overridePrompt = null, passNum = 1, passTotal = 1 } = {}) {
    const sourcePrompt = overridePrompt || (feedback ? submittedPrompt : roughPrompt);
    if (!sourcePrompt.trim() || streaming || comparing) return;

    if (isRecording) stopRecording();

    setLoading(true);
    setStreaming(true);
    setError('');
    setRefinedComplete(false);
    setCopied(false);
    setCurrentSavedId(null);
    setComparison(null);
    setPrimaryUsage(null);
    setPrimaryLatencyMs(null);
    setAbTest(null);
    setAbTestOpen(false);
    if (passTotal > 1) setMultiPassCurrent(passNum);

    const previousRefined = feedback ? improvedPrompt : null;

    if (feedback) {
      setSubmittedFeedback(feedback);
    } else {
      setSubmittedPrompt(overridePrompt || roughPrompt);
      setSubmittedFeedback('');
      if (!overridePrompt) setRoughPrompt('');
      // Fresh initial refinement (not a multi-pass continuation) — reset version history
      if (passNum === 1) {
        setPromptVersions([]);
        setViewingVersionId(null);
        setVersionsOpen(false);
      }
    }

    setImprovedPrompt('');
    setChanges([]);
    setScores(null);
    setPrimaryModel(settings.model);

    const controller = new AbortController();
    abortRef.current = controller;

    // Build active dimensions list for the backend
    const removedSet = new Set(settings.removedDimensions || []);
    const activeDimensions = [
      ...SCORE_DIMENSIONS.filter(d => !removedSet.has(d.id)),
      ...(settings.customDimensions || []),
    ];

    let accumulatedRefined = '';
    let accumulatedChanges = [];
    let accumulatedScores = null;
    let accumulatedUsage = null;
    let accumulatedLatency = null;

    try {
      await streamRefinement({
        url: `${API_URL}/api/improve`,
        body: {
          prompt: sourcePrompt,
          category,
          model: settings.model,
          previousRefined: previousRefined || undefined,
          feedback: feedback || undefined,
          dimensions: activeDimensions.length !== SCORE_DIMENSIONS.length ? activeDimensions : undefined,
        },
        signal: controller.signal,
        onChunk: (text) => {
          if (loading) setLoading(false);
          accumulatedRefined += text;
          setImprovedPrompt(accumulatedRefined);
        },
        onRefinedDone: () => { setRefinedComplete(true); },
        onChanges: (received) => {
          accumulatedChanges = received;
          setChanges(received);
        },
        onScores: (received) => {
          accumulatedScores = received;
          setScores(received);
        },
        onDone: (payload) => {
          if (payload?.usage) {
            accumulatedUsage = payload.usage;
            setPrimaryUsage(payload.usage);
          }
          if (payload?.latencyMs) {
            accumulatedLatency = payload.latencyMs;
            setPrimaryLatencyMs(payload.latencyMs);
          }
          if (accumulatedRefined) {
            saveToHistory({
              rough: sourcePrompt,
              improved: accumulatedRefined,
              changes: accumulatedChanges,
              scores: accumulatedScores,
              category,
              model: settings.model,
              usage: accumulatedUsage,
              latencyMs: accumulatedLatency,
              timestamp: Date.now(),
              isFollowUp: Boolean(feedback),
              feedback: feedback || undefined,
            });
            recordUsage({
              model: settings.model,
              usage: accumulatedUsage,
              latencyMs: accumulatedLatency,
              kind: feedback ? 'follow-up' : 'refinement',
            });
            // Track as a named version (only on the final pass of multi-pass)
            if (passNum === passTotal) {
              setPromptVersions(prev => {
                const n = prev.length + 1;
                return [...prev.slice(-9), {
                  id: makeId(),
                  label: `v${n}`,
                  improved: accumulatedRefined,
                  changes: accumulatedChanges,
                  scores: accumulatedScores,
                  model: settings.model,
                  feedback: feedback || null,
                  ts: Date.now(),
                }];
              });
            }
          }
        },
        onError: (msg) => { setError(msg); },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Something went wrong. Is the backend running?');
        console.error(err);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      setRefinedComplete(true);
      abortRef.current = null;

      // Multi-pass: if more passes remain, run the next pass with the refined output
      if (passTotal > 1 && passNum < passTotal && accumulatedRefined && !controller.signal.aborted) {
        setTimeout(() => {
          executeRefinement({
            overridePrompt: accumulatedRefined,
            passNum: passNum + 1,
            passTotal,
          });
        }, 300);
      } else if (passTotal > 1) {
        setMultiPassCurrent(0);
      }
    }
  }

  async function runRefinement({ feedback = null, overridePrompt = null } = {}) {
    const sourcePrompt = overridePrompt || (feedback ? submittedPrompt : roughPrompt);
    if (!sourcePrompt.trim() || streaming || comparing) return;

    // Check for template variables (only on initial submit, not follow-ups)
    if (!feedback && !overridePrompt) {
      const vars = extractVariables(sourcePrompt);
      if (vars.length > 0) {
        setTemplateVarNames(vars);
        setTemplateVarValues({});
        setTemplateVarsPendingFeedback(feedback);
        setTemplateVarsOpen(true);
        return;
      }
    }

    if (settings.piiScannerEnabled) {
      const findings = scanForPII(sourcePrompt);
      if (findings.length > 0) {
        setPiiFindings(findings);
        setPiiPendingFeedback(feedback);
        return;
      }
    }

    // For follow-ups, multi-pass doesn't apply (passTotal = 1).
    // For initial submits (including post-template-var continuation),
    // carry through the pass count the user chose when they hit Refine.
    const passTotal = feedback ? 1 : pendingPassTotalRef.current;
    executeRefinement({ feedback, overridePrompt, passNum: 1, passTotal });
  }

  function handlePIIContinue() {
    const feedback = piiPendingFeedback;
    setPiiFindings(null);
    setPiiPendingFeedback(null);
    // Preserve the pass count that was set when the user clicked Refine.
    const passTotal = feedback ? 1 : pendingPassTotalRef.current;
    executeRefinement({ feedback, passNum: 1, passTotal });
  }

  function handlePIICancel() {
    setPiiFindings(null);
    setPiiPendingFeedback(null);
  }

  async function runComparison(modelIds) {
    if (!submittedPrompt.trim() || comparing || streaming) return;

    setComparing(true);
    setError('');

    const initialColumns = modelIds.map((modelId) => ({
      modelId, refined: '', changes: [], scores: null,
      usage: null, latencyMs: null, complete: false, error: null,
    }));
    setComparison({ columns: initialColumns });

    const controller = new AbortController();
    compareAbortRef.current = controller;

    let workingColumns = [...initialColumns];

    function updateColumn(modelId, updates) {
      workingColumns = workingColumns.map((col) =>
        col.modelId === modelId ? { ...col, ...updates } : col
      );
      setComparison({ columns: workingColumns });
    }

    try {
      await streamComparison({
        url: `${API_URL}/api/improve-compare`,
        body: { prompt: submittedPrompt, category, models: modelIds },
        signal: controller.signal,
        onStart: () => { /* noop */ },
        onModelChunk: (modelId, text) => {
          const col = workingColumns.find((c) => c.modelId === modelId);
          if (col) updateColumn(modelId, { refined: col.refined + text });
        },
        onModelChanges: (modelId, modelChanges) => updateColumn(modelId, { changes: modelChanges }),
        onModelScores: (modelId, modelScores) => updateColumn(modelId, { scores: modelScores }),
        onModelDone: (modelId, modelUsage, modelLatencyMs) => {
          updateColumn(modelId, {
            complete: true,
            usage: modelUsage || null,
            latencyMs: modelLatencyMs || null,
          });
          if (modelUsage) {
            recordUsage({ model: modelId, usage: modelUsage, latencyMs: modelLatencyMs, kind: 'comparison' });
          }
        },
        onModelError: (modelId, errMsg) => updateColumn(modelId, { error: errMsg, complete: true }),
        onDone: () => {
          setHistory((current) => {
            const updated = [...current];
            if (updated.length > 0) {
              updated[0] = { ...updated[0], comparison: { columns: workingColumns } };
              localStorage.setItem(STORAGE_HISTORY, JSON.stringify(updated));
            }
            return updated;
          });
        },
        onError: (msg) => { setError(msg); },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Comparison failed.');
        console.error(err);
      }
    } finally {
      setComparing(false);
      compareAbortRef.current = null;
    }
  }

  function useComparisonVersion(column) {
    if (!column?.refined) return;
    setImprovedPrompt(column.refined);
    setChanges(column.changes || []);
    setScores(column.scores || null);
    setPrimaryModel(column.modelId);
    setPrimaryUsage(column.usage || null);
    setPrimaryLatencyMs(column.latencyMs || null);
    setComparison(null);
    setCurrentSavedId(null);
  }

  function closeComparison() {
    if (compareAbortRef.current) compareAbortRef.current.abort();
    setComparison(null);
  }

  async function runABTest(mode) {
    if (!improvedPrompt || abTesting) return;
    setAbTesting(true);

    const initialTest = {
      mode,
      rough: { text: '', complete: false, error: null, usage: null, latencyMs: null },
      refined: { text: '', complete: false, error: null, usage: null, latencyMs: null },
    };
    setAbTest(initialTest);

    const prompts = [];
    if (mode === 'both') prompts.push({ id: 'rough', prompt: submittedPrompt });
    prompts.push({ id: 'refined', prompt: improvedPrompt });
    if (mode === 'refined-only') initialTest.rough = null;

    const controller = new AbortController();
    testAbortRef.current = controller;

    let working = { ...initialTest };

    function updateResult(id, updates) {
      working = { ...working, [id]: { ...(working[id] || {}), ...updates } };
      setAbTest(working);
    }

    try {
      await streamTest({
        url: `${API_URL}/api/test-prompt`,
        body: { prompts, model: settings.testModel },
        signal: controller.signal,
        onChunk: (id, text) => {
          const current = working[id] || {};
          updateResult(id, { text: (current.text || '') + text });
        },
        onDone: (id, u, latencyMs) => {
          updateResult(id, { complete: true, usage: u || null, latencyMs: latencyMs || null });
          if (u) {
            recordUsage({ model: settings.testModel, usage: u, latencyMs, kind: `test-${id}` });
          }
        },
        onError: (id, errMsg) => {
          if (id) updateResult(id, { complete: true, error: errMsg });
          else console.error('Test stream error:', errMsg);
        },
        onComplete: () => { /* noop */ },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setAbTest((prev) => prev ? { ...prev, fatalError: err.message } : null);
      }
    } finally {
      setAbTesting(false);
      testAbortRef.current = null;
    }
  }

  function closeABTest() {
    if (testAbortRef.current) testAbortRef.current.abort();
    setAbTestOpen(false);
  }

  function openABTest() {
    setAbTestOpen(true);
    if (!abTest) setAbTest(null);
  }

  /* ── Conversation lifecycle ──────────────────────────────── */

  // Archive the current conversation into the conversations list.
  function archiveCurrent(workingConvo) {
    if (!workingConvo || !workingConvo.messages?.length) return conversations;
    const toArchive = { ...workingConvo, lastUsedAt: Date.now() };
    const withoutDupe = conversations.filter((c) => c.id !== toArchive.id);
    const next = [toArchive, ...withoutDupe].slice(0, MAX_CONVERSATIONS);
    setConversations(next);
    return next;
  }

  function openRunDrawerWithRefined() {
    if (!improvedPrompt || !refinedComplete) return;

    archiveCurrent(currentConvo);

    const initialUserMsg = {
      id: makeId(),
      role: 'user',
      content: improvedPrompt,
      timestamp: Date.now(),
    };
    const newConvo = {
      id: makeId(),
      title: '',
      startedAt: Date.now(),
      lastUsedAt: Date.now(),
      model: settings.testModel,
      messages: [initialUserMsg],
    };
    setCurrentConvo(newConvo);
    setConvoDrawerOpen(true);
    setPanelMode('conversation');
    runAssistantTurn(newConvo);
  }

  function startNewRunConversation() {
    if (running) return;
    archiveCurrent(currentConvo);
    setCurrentConvo(null);
    setPanelMode('conversation');
  }

  function sendRunMessage(text) {
    if (!text.trim() || running) return;

    const userMsg = {
      id: makeId(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    let workingConvo;
    if (!currentConvo) {
      workingConvo = {
        id: makeId(),
        title: '',
        startedAt: Date.now(),
        lastUsedAt: Date.now(),
        model: settings.testModel,
        messages: [userMsg],
      };
    } else {
      workingConvo = {
        ...currentConvo,
        lastUsedAt: Date.now(),
        messages: [...(currentConvo.messages || []), userMsg],
      };
    }
    setCurrentConvo(workingConvo);
    runAssistantTurn(workingConvo);
  }

  async function runAssistantTurn(convo) {
    if (running) return;
    setRunning(true);

    const assistantMsg = {
      id: makeId(),
      role: 'assistant',
      content: '',
      model: settings.testModel,
      streaming: true,
      complete: false,
      timestamp: Date.now(),
    };

    let workingConvo = {
      ...convo,
      messages: [...convo.messages, assistantMsg],
    };
    setCurrentConvo(workingConvo);

    const controller = new AbortController();
    runAbortRef.current = controller;

    const apiMessages = convo.messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.content && m.content.trim() !== '')
      .map((m) => ({ role: m.role, content: m.content }));

    let accumulated = '';
    let finalUsage = null;
    let finalLatency = null;
    let receivedError = null;

    try {
      await streamRunPrompt({
        url: `${API_URL}/api/run-prompt`,
        body: { messages: apiMessages, model: settings.testModel },
        signal: controller.signal,
        onChunk: (text) => {
          accumulated += text;
          workingConvo = {
            ...workingConvo,
            messages: workingConvo.messages.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: accumulated } : m
            ),
          };
          setCurrentConvo(workingConvo);
        },
        onDone: (payload) => {
          if (payload?.usage) finalUsage = payload.usage;
          if (payload?.latencyMs) finalLatency = payload.latencyMs;
        },
        onError: (msg) => { receivedError = msg; },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Run-prompt error:', err);
        receivedError = err.message || 'Run failed.';
      }
    } finally {
      const cost = finalUsage ? computeCost(settings.testModel, finalUsage) : null;
      const firstUserMsg = workingConvo.messages.find((m) => m.role === 'user');
      const generatedTitle = workingConvo.title || autoTitle(firstUserMsg?.content || '');

      workingConvo = {
        ...workingConvo,
        title: generatedTitle,
        lastUsedAt: Date.now(),
        messages: workingConvo.messages.map((m) => {
          if (m.id !== assistantMsg.id) return m;
          return {
            ...m,
            content: accumulated,
            streaming: false,
            complete: true,
            error: receivedError || null,
            usage: finalUsage,
            latencyMs: finalLatency,
            cost,
          };
        }),
      };
      setCurrentConvo(workingConvo);

      if (finalUsage) {
        recordUsage({ model: settings.testModel, usage: finalUsage, latencyMs: finalLatency, kind: 'run' });
      }

      setRunning(false);
      runAbortRef.current = null;
    }
  }

  function stopRun() {
    if (runAbortRef.current) runAbortRef.current.abort();
  }

  function loadConversation(convo) {
    if (running) return;
    if (currentConvo && currentConvo.id !== convo.id && currentConvo.messages?.length > 0) {
      archiveCurrent(currentConvo);
    }
    setConversations(conversations.filter((c) => c.id !== convo.id));
    setCurrentConvo({ ...convo, lastUsedAt: Date.now() });
    setPanelMode('conversation');
  }

  function renameConversation(id, newTitle) {
    if (!newTitle?.trim()) return;
    if (currentConvo?.id === id) {
      setCurrentConvo({ ...currentConvo, title: newTitle });
    } else {
      setConversations(conversations.map((c) =>
        c.id === id ? { ...c, title: newTitle } : c
      ));
    }
  }

  function removeConversation(id) {
    showConfirm('Delete this conversation?', () => {
      if (currentConvo?.id === id) {
        setCurrentConvo(null);
      } else {
        setConversations(conversations.filter((c) => c.id !== id));
      }
      addToast('Conversation deleted');
    });
  }

  function clearAllConversations() {
    if (conversations.length === 0) return;
    showConfirm(`Delete all ${conversations.length} saved conversation${conversations.length !== 1 ? 's' : ''}? Your active conversation is kept.`, () => {
      setConversations([]);
      addToast('Conversations cleared');
    }, 'Clear all');
  }

  function showConversationList() {
    setPanelMode('list');
  }

  function showCurrentConversation() {
    setPanelMode('conversation');
  }

  /* ── Other handlers ──────────────────────────────────────── */

  function handleImprove() {
    // Always route through runRefinement so template-variable and PII checks
    // run first, even when multi-pass is on.
    pendingPassTotalRef.current = multiPassEnabled && multiPassCount > 1 ? multiPassCount : 1;
    runRefinement();
  }
  function handleFollowUp(feedback) { runRefinement({ feedback }); }

  function handleStop() {
    if (abortRef.current) abortRef.current.abort();
    if (compareAbortRef.current) compareAbortRef.current.abort();
    if (testAbortRef.current) testAbortRef.current.abort();
    if (chainAbortRef.current) chainAbortRef.current.abort();
    setMultiPassCurrent(0);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(improvedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleStartEdit() {
    if (!displayImproved || busy) return;
    setEditDraft(displayImproved);
    setEditingRefined(true);
    setTimeout(() => { editTextareaRef.current?.focus(); }, 30);
  }

  function handleSaveEdit() {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    const versionLabel = `v${promptVersions.length + 1} (edited)`;
    const newVersion = {
      id: makeId(),
      label: versionLabel,
      improved: trimmed,
      changes,
      scores,
      model: primaryModel,
      feedback: null,
      ts: Date.now(),
    };
    setPromptVersions(prev => [...prev, newVersion]);
    setImprovedPrompt(trimmed);
    setViewingVersionId(null);
    setEditingRefined(false);
    setEditDraft('');
    addToast(`Edit saved as ${versionLabel}`);
  }

  function handleCancelEdit() {
    setEditingRefined(false);
    setEditDraft('');
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleImprove();
    }
  }

  function openPDFExport() { setPdfModalOpen(true); }
  function closePDFExport() { setPdfModalOpen(false); }

  const showEmpty = !improvedPrompt && !submittedPrompt && !loading && !error && !streaming;

  // Versioning: when the user is browsing an older version, display its data instead of live state
  const viewingVersion = viewingVersionId ? promptVersions.find(v => v.id === viewingVersionId) : null;
  const displayImproved = viewingVersion ? viewingVersion.improved : improvedPrompt;
  const displayChanges  = viewingVersion ? viewingVersion.changes  : changes;
  const displayScores   = viewingVersion ? viewingVersion.scores   : scores;
  const isSaved = Boolean(currentSavedId);
  const busy = streaming || comparing || abTesting;
  const isRefinementInProgress = Boolean(submittedPrompt) && !error && !comparing;
  const showChangesSkeleton = isRefinementInProgress && Boolean(improvedPrompt) && changes.length === 0;
  const showScoresSkeleton = isRefinementInProgress && Boolean(improvedPrompt) && !scores;

  const refinementReady = Boolean(improvedPrompt) && refinedComplete && !busy && changes.length > 0 && scores !== null;
  const showFollowUp = refinementReady && !abTestOpen;
  const showCompareInvite = refinementReady && !comparison;
  const showABTestInvite = refinementReady && !abTestOpen;

  const hasABTestResults = Boolean(abTest && (abTest.rough?.complete || abTest.refined?.complete));

  const showLintHints = settings.linterEnabled && !busy && lintHints.length > 0;
  const showMicButton = speechSupported && settings.voiceEnabled;
  const canExportPDF = Boolean(improvedPrompt) && refinedComplete && !busy && changes.length > 0 && scores !== null;
  const canRunPrompt = refinementReady;

  const primaryCost = primaryUsage ? computeCost(primaryModel, primaryUsage) : null;

  // Badge on the Conversations icon if a run is streaming and the panel isn't open.
  const showConversationsBadge = running && !convoDrawerOpen;

  // Group recent history by date for the sidebar recent list.
  const groupedRecents = (() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysAgo = todayStart - 7 * 86400000;
    const groups = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 days', items: [] },
    ];
    history.slice(0, 20).forEach(entry => {
      const t = new Date(entry.timestamp);
      const day = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
      if (day >= todayStart) groups[0].items.push(entry);
      else if (day >= yesterdayStart) groups[1].items.push(entry);
      else if (day >= sevenDaysAgo) groups[2].items.push(entry);
    });
    return groups.filter(g => g.items.length > 0);
  })();

  return (
    <div className="shell">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <nav className={`sidebar ${railExpanded ? 'expanded' : 'collapsed'}`}>

        {/* Header: logo + collapse toggle */}
        <div className="sidebar-header">
          {railExpanded && (
            <div className="sidebar-logo">
              <div className="sidebar-logo-mark">
                <FunnelLogo />
              </div>
              <div className="sidebar-logo-text">
                <div className="sidebar-logo-name">Prompt Refinery</div>
              </div>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={railExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <SidebarIcon />
          </button>
        </div>

        {/* New rough prompt — mirrors claude.ai's "New chat" button */}
        <div className="sidebar-new-wrap">
          <button
            className="sidebar-new-btn"
            onClick={handleNewPrompt}
            title="New rough prompt"
            aria-label="New rough prompt"
          >
            <span className="sidebar-new-icon"><PlusIcon /></span>
            {railExpanded && <span className="sidebar-new-label">New rough prompt</span>}
          </button>
        </div>

        {/* Nav items */}
        <div className="sidebar-nav">
          {LEFT_RAIL_ITEMS.map((item) => {
            const Icon = item.icon;
            const isConversationsItem = item.id === 'conversations';
            const isActive = isConversationsItem ? convoDrawerOpen : activeView === item.id;
            const showBadge = isConversationsItem && showConversationsBadge;
            return (
              <button
                key={item.id}
                className={`sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => toggleView(item.id)}
                aria-label={item.label}
                title={!railExpanded ? item.label : undefined}
              >
                <span className="sidebar-item-icon">
                  <Icon />
                  {showBadge && <span className="rail-btn-badge" />}
                </span>
                {railExpanded && (
                  <span className="sidebar-item-label">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Starred prompts — shown when expanded and any saved prompts exist */}
        {railExpanded && saved.length > 0 && (
          <div className="sidebar-starred">
            <div className="sidebar-starred-head">
              <StarIcon filled={true} />
              <span>Starred</span>
            </div>
            {saved.slice(0, 5).map(entry => {
              const label = entry.name || entry.rough;
              return (
                <button
                  key={entry.id}
                  className={`sidebar-starred-item ${currentSavedId === entry.id ? 'active' : ''}`}
                  onClick={() => loadFromSaved(entry)}
                  title={entry.rough}
                >
                  {label.length > 36 ? label.slice(0, 36).trimEnd() + '…' : label}
                </button>
              );
            })}
            {saved.length > 5 && (
              <button className="sidebar-starred-more" onClick={() => toggleView('saved')}>
                +{saved.length - 5} more
              </button>
            )}
          </div>
        )}

        {/* Recent refinements — only shown when expanded and history exists */}
        {railExpanded && groupedRecents.length > 0 && (
          <div className="sidebar-recents">
            {groupedRecents.map(group => (
              <div key={group.label}>
                <div className="sidebar-recents-date">{group.label}</div>
                {group.items.map(entry => (
                  <div key={entry.timestamp} className="sidebar-recent-row">
                    <button
                      className="sidebar-recent-item"
                      onClick={() => loadFromHistory(entry)}
                      title={entry.rough}
                    >
                      {entry.rough.length > 38
                        ? entry.rough.slice(0, 38).trimEnd() + '…'
                        : entry.rough}
                    </button>
                    <button
                      className="sidebar-recent-delete"
                      onClick={(e) => { e.stopPropagation(); deleteHistoryEntry(entry.timestamp); }}
                      title="Remove from history"
                      aria-label="Remove from history"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* ── Main area ───────────────────────────────────────── */}
      <main className="main">
        {activeView !== null ? (
          /* Panel view: replaces refinery when a nav item is active */
          <div className="panel-page">
            {activeView === 'history' && (
              <HistoryView
                history={history}
                onLoad={loadFromHistory}
                onReRefine={reRefineFromHistory}
                onClear={clearHistory}
                onOpenImportExport={() => setImportExportOpen(true)}
              />
            )}
            {activeView === 'saved' && (
              <SavedView
                saved={saved}
                folders={folders}
                onLoad={loadFromSaved}
                onRename={renameSaved}
                onRemove={removeSaved}
                onMoveToFolder={moveSavedToFolder}
                onAddFolder={addFolder}
                onRenameFolder={renameFolder}
                onDeleteFolder={deleteFolder}
              />
            )}
            {activeView === 'templates' && <TemplatesView onSelect={loadFromTemplate} />}
            {activeView === 'analytics' && <AnalyticsView history={history} />}
            {activeView === 'chain' && (
              <ChainView
                chainSteps={chainSteps}
                onUpdateSteps={updateChainSteps}
                onRunChain={runChain}
                chainRunning={chainRunning}
                testModel={settings.testModel}
              />
            )}
            {activeView === 'usage' && <UsageView usage={usage} onClear={clearUsage} />}
            {activeView === 'help' && <HelpView />}
            {activeView === 'settings' && (
              <SettingsView
                settings={settings}
                onChange={updateSettings}
                onReset={resetSettings}
                speechSupported={speechSupported}
              />
            )}
          </div>
        ) : (
          /* Refinery view: shown when no panel is active */
          <>
            <div className="conversation" ref={conversationRef}>
          <div className="conversation-inner">
            {showEmpty && (
              <div className="empty-state">
                <h2>What can I help you refine?</h2>
                <p>Type a rough prompt below, or start from one of these:</p>
                <div className="empty-state-starts">
                  {QUICK_STARTS.map(qs => (
                    <button
                      key={qs.label}
                      className="empty-state-start-btn"
                      onClick={() => {
                        setRoughPrompt(qs.prompt);
                        setCategory(qs.category);
                        setTimeout(() => textareaRef.current?.focus(), 50);
                      }}
                    >
                      {qs.label}
                    </button>
                  ))}
                </div>
                <p className="empty-state-hint">
                  <kbd>⌘</kbd><kbd>↵</kbd> to refine &nbsp;·&nbsp; <kbd>/</kbd> to focus composer
                </p>
              </div>
            )}

            {submittedPrompt && (
              <RoughPromptMessage text={submittedPrompt} category={category} isFollowUp={false} />
            )}

            {submittedFeedback && (
              <RoughPromptMessage text={submittedFeedback} category={null} isFollowUp={true} />
            )}

            {loading && !improvedPrompt && (
              <div className="message">
                <div className="message-header">
                  <span className="message-label">Refined prompt</span>
                </div>
                <div className="thinking-block">
                  <span className="thinking-dots">
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                    <span className="thinking-dot"></span>
                  </span>
                  Refining prompt…
                </div>
              </div>
            )}

            {improvedPrompt && (
              <div className="message">
                <div className="message-header">
                  <span className="message-label">
                    Refined prompt
                    <span className="primary-model-tag">{modelShortName(primaryModel)}</span>
                    {primaryCost !== null && (
                      <span className="primary-cost-tag" title="Estimated cost based on token usage">
                        {formatCost(primaryCost)}
                      </span>
                    )}
                    {primaryLatencyMs !== null && (
                      <span className="primary-latency-tag" title="Time to complete this refinement">
                        {formatLatency(primaryLatencyMs)}
                      </span>
                    )}
                    {streaming && <span className="streaming-pulse" />}
                  </span>
                  <div className="message-actions">
                    {editingRefined ? (
                      <>
                        <button
                          className="edit-save-btn"
                          onClick={handleSaveEdit}
                          disabled={!editDraft.trim()}
                          title="Save edits (⌘↵)"
                        >
                          Save edits
                        </button>
                        <button
                          className="copy-btn"
                          onClick={handleCancelEdit}
                          title="Discard edits (Esc)"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {promptVersions.length > 1 && (
                          <button
                            className={`version-badge-btn ${versionsOpen ? 'open' : ''}`}
                            onClick={() => setVersionsOpen(v => !v)}
                            title={`${promptVersions.length} versions — click to browse`}
                          >
                            {viewingVersion ? viewingVersion.label : `v${promptVersions.length}`}
                          </button>
                        )}
                        <button
                          className={`icon-action ${isSaved ? 'saved' : ''}`}
                          onClick={toggleSaveCurrent}
                          disabled={!refinedComplete || busy}
                          aria-label={isSaved ? 'Remove from saved' : 'Save prompt'}
                          title={isSaved ? 'Remove from saved' : 'Save prompt'}
                        >
                          <StarIcon filled={isSaved} />
                        </button>
                        <button
                          className="icon-action primary-action"
                          onClick={openRunDrawerWithRefined}
                          disabled={!canRunPrompt}
                          aria-label="Run prompt"
                          title="Run this refined prompt and chat with the model"
                        >
                          <PlayCircleIcon />
                        </button>
                        <button
                          className="icon-action"
                          onClick={openPDFExport}
                          disabled={!canExportPDF}
                          aria-label="Export to PDF"
                          title="Export to PDF"
                        >
                          <PDFIcon />
                        </button>
                        <button
                          className="icon-action"
                          onClick={handleShare}
                          disabled={!refinedComplete || busy}
                          aria-label="Share prompt"
                          title="Share this refined prompt"
                        >
                          <ShareIcon />
                        </button>
                        <div className="export-dropdown-wrap" ref={exportDropdownRef}>
                          <button
                            className={`icon-action ${exportDropdownOpen ? 'active' : ''}`}
                            onClick={() => setExportDropdownOpen(o => !o)}
                            disabled={!refinedComplete || busy}
                            aria-label="Export to…"
                            title="Export to Notion or Slack"
                          >
                            <ExternalLinkIcon />
                          </button>
                          {exportDropdownOpen && (
                            <div className="export-dropdown">
                              <button className="export-dropdown-item" onClick={handleExportNotion}>
                                <span className="export-dropdown-icon">📄</span>
                                Export to Notion
                              </button>
                              <button className="export-dropdown-item" onClick={handleExportSlack}>
                                <span className="export-dropdown-icon">💬</span>
                                Post to Slack
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          className={`copy-btn diff-toggle-btn ${diffOpen ? 'diff-toggle-active' : ''}`}
                          onClick={() => setDiffOpen(o => !o)}
                          disabled={!refinedComplete || !submittedPrompt}
                          title="Show word-level diff between original and refined"
                        >
                          Diff
                        </button>
                        <button
                          className="icon-action"
                          onClick={handleStartEdit}
                          disabled={!refinedComplete || busy}
                          aria-label="Edit refined prompt"
                          title="Edit refined prompt"
                        >
                          <PencilIcon />
                        </button>
                        <button className="copy-btn" onClick={handleCopy} disabled={busy}>
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {versionsOpen && promptVersions.length > 1 && (
                  <div className="versions-panel">
                    <div className="versions-panel-head">Version history</div>
                    {[...promptVersions].reverse().map(v => (
                      <div
                        key={v.id}
                        className={`version-item ${viewingVersionId === v.id ? 'active' : ''}`}
                        onClick={() => setViewingVersionId(id => id === v.id ? null : v.id)}
                      >
                        <span className="version-item-label">{v.label}</span>
                        <span className="version-item-meta">
                          {v.feedback ? 'follow-up' : 'initial'} · {modelShortName(v.model)} · {formatTime(v.ts)}
                        </span>
                        {viewingVersionId === v.id && (
                          <button
                            className="version-use-btn"
                            onClick={e => {
                              e.stopPropagation();
                              setImprovedPrompt(v.improved);
                              setChanges(v.changes);
                              setScores(v.scores);
                              setPrimaryModel(v.model);
                              setViewingVersionId(null);
                              setVersionsOpen(false);
                            }}
                          >
                            Use this version
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {editingRefined ? (
                  <textarea
                    ref={editTextareaRef}
                    className="refined-edit-textarea"
                    value={editDraft}
                    onChange={e => setEditDraft(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    spellCheck={false}
                    aria-label="Edit refined prompt"
                  />
                ) : (
                  <div className="message-body">
                    {displayImproved}
                    {streaming && <span className="caret" />}
                  </div>
                )}
                {!editingRefined && diffOpen && refinedComplete && submittedPrompt && (
                  <PromptDiffPanel rough={submittedPrompt} improved={displayImproved} />
                )}
              </div>
            )}

            {showChangesSkeleton && <ChangesSkeleton />}
            {displayChanges.length > 0 && <ChangesPanel changes={displayChanges} />}

            {showScoresSkeleton && <ScoresSkeleton />}
            {displayScores && <ScoresPanel scores={displayScores} chartContainerRef={scoresChartRef} />}

            {showABTestInvite && (
              <ABTestInvite disabled={busy} onOpen={openABTest} hasResults={hasABTestResults} />
            )}

            {abTestOpen && (
              <ABTestPanel
                roughPrompt={submittedPrompt}
                refinedPrompt={improvedPrompt}
                testModel={settings.testModel}
                onClose={closeABTest}
                onRun={runABTest}
                test={abTest}
                busy={abTesting}
              />
            )}

            {showCompareInvite && (
              <CompareInvite primaryModel={primaryModel} onCompare={runComparison} disabled={busy} />
            )}

            {(comparison || comparing) && (
              <ComparisonStrip
                comparison={comparison}
                primaryModel={primaryModel}
                primaryRefined={improvedPrompt}
                primaryScores={scores}
                primaryChanges={changes}
                primaryUsage={primaryUsage}
                primaryLatencyMs={primaryLatencyMs}
                onUseVersion={useComparisonVersion}
                onClose={closeComparison}
                busy={busy}
              />
            )}

            {showFollowUp && <FollowUpPanel disabled={busy} onSubmit={handleFollowUp} />}

            {error && (
              <div className="message">
                <div className="error">{error}</div>
              </div>
            )}
          </div>
        </div>

        <div className="composer-wrap">
          <div className={`composer ${isRecording ? 'recording' : ''}`}>
            <div className="composer-chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${category === c.id ? 'active' : ''}`}
                  onClick={() => setCategory(c.id)}
                  disabled={busy}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={roughPrompt}
              onChange={(e) => setRoughPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? 'Listening — speak now…'
                  : submittedPrompt
                  ? 'Type another rough prompt...'
                  : 'Type a rough prompt... (Cmd+Enter to submit)'
              }
              rows={1}
              disabled={busy}
            />

            <div className="composer-actions">
              <span className="char-count">
                {isRecording && <span className="recording-indicator"><span className="recording-dot" /> Recording</span>}
                {!isRecording && roughPrompt.length > 0 && `${roughPrompt.length} characters`}
              </span>
              <div className="composer-buttons">
                {showMicButton && !busy && (
                  <button
                    type="button"
                    className={`mic-btn ${isRecording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
                    title={isRecording ? 'Stop recording' : 'Dictate prompt'}
                  >
                    {isRecording ? <MicOffIcon /> : <MicIcon />}
                  </button>
                )}
                {busy ? (
                  <button
                    className="send-btn stop"
                    onClick={handleStop}
                    aria-label="Stop generating"
                    title="Stop generating"
                  >
                    <span className="stop-square" />
                  </button>
                ) : (
                  <button
                    className="send-btn"
                    onClick={handleImprove}
                    disabled={loading || !roughPrompt.trim()}
                    aria-label="Refine prompt"
                  >
                    <SendIcon />
                  </button>
                )}
              </div>
            </div>
          </div>

          {voiceError && <div className="voice-error">{voiceError}</div>}

          {/* Multi-pass refinement toggle */}
          <div className="multipass-bar">
            <button
              type="button"
              className={`multipass-toggle ${multiPassEnabled ? 'on' : ''}`}
              onClick={() => setMultiPassEnabled(v => !v)}
              title="Auto-refine multiple passes for a more polished result"
            >
              <LoopIcon />
              Multi-pass
            </button>
            {multiPassEnabled && (
              <select
                className="multipass-select"
                value={multiPassCount}
                onChange={e => setMultiPassCount(Number(e.target.value))}
                disabled={busy}
              >
                {[2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n} passes</option>
                ))}
              </select>
            )}
            {multiPassEnabled && multiPassCurrent > 0 && (
              <span className="multipass-progress">Pass {multiPassCurrent} of {multiPassCount}…</span>
            )}
          </div>

          {showLintHints && (
            <LintHintsPanel
              hints={lintHints}
              dismissed={dismissedHints}
              onDismiss={dismissLintHint}
            />
          )}
        </div>
          </>
        )}
      </main>

      {importExportOpen && (
        <ImportExportModal
          history={history}
          saved={saved}
          onClose={() => setImportExportOpen(false)}
          onImport={handleImport}
        />
      )}

      {piiFindings && (
        <PIIWarningModal
          findings={piiFindings}
          onContinue={handlePIIContinue}
          onCancel={handlePIICancel}
        />
      )}

      {templateVarsOpen && (
        <TemplateVariablesModal
          variables={templateVarNames}
          values={templateVarValues}
          onChange={updateTemplateVarValue}
          onContinue={handleTemplateVarsContinue}
          onCancel={handleTemplateVarsCancel}
        />
      )}

      {shareModalOpen && (
        <ShareModal
          shareUrl={shareUrl}
          rough={submittedPrompt}
          improved={improvedPrompt}
          changes={changes}
          onClose={() => setShareModalOpen(false)}
        />
      )}

      {pdfModalOpen && (
        <PDFPreviewModal
          roughPrompt={submittedPrompt}
          category={category}
          refinedPrompt={improvedPrompt}
          changes={changes}
          scores={scores}
          primaryModel={primaryModel}
          primaryUsage={primaryUsage}
          primaryLatencyMs={primaryLatencyMs}
          abTest={abTest}
          testModel={settings.testModel}
          comparison={comparison}
          scoresChartRef={scoresChartRef}
          onClose={closePDFExport}
        />
      )}

      {convoDrawerOpen && (
        <RunDrawer
          panelMode={panelMode}
          conversation={currentConvo}
          conversations={conversations}
          testModel={settings.testModel}
          modelShortName={modelShortName}
          onClose={() => setConvoDrawerOpen(false)}
          onSend={sendRunMessage}
          onStop={stopRun}
          onNewConversation={startNewRunConversation}
          onShowList={showConversationList}
          onShowConversation={showCurrentConversation}
          onLoadConversation={loadConversation}
          onRenameConversation={renameConversation}
          onRemoveConversation={removeConversation}
          onClearAllConversations={clearAllConversations}
          busy={running}
        />
      )}

      {confirmState && (
        <ConfirmDialog
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }}
          onCancel={closeConfirm}
        />
      )}

      <ToastList toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;

// RunDrawer and everything inside it: message bubbles, conversation list,
// markdown rendering, code blocks. This component is the slide-out panel
// that opens from the conversations rail icon.

import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  CloseIcon,
  PlusIcon,
  ListIcon,
  ArrowLeftIcon,
  PencilIcon,
  TrashIcon,
  SendIcon,
  ExpandIcon,
  CompressIcon,
} from './icons.jsx';
import { autoTitle } from './utils.js';

function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString();
}

function formatCost(usd) {
  if (usd === null || usd === undefined) return null;
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

function formatLatency(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ── Code block with copy button ─────────────────────── */

function CodeBlock({ language, value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="run-code-block-wrap">
      <div className="run-code-block-head">
        <span>{language || 'code'}</span>
        <button
          type="button"
          className="run-code-block-copy"
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="run-code-block-body">
        <SyntaxHighlighter
          language={language || 'text'}
          style={oneDark}
          PreTag="pre"
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '12px',
            lineHeight: '1.5',
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

/* ── Markdown renderer ────────────────────────────────── */

function RunMarkdown({ children }) {
  return (
    <div className="run-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const value = String(children).replace(/\n$/, '');
            if (!inline && match) {
              return <CodeBlock language={match[1]} value={value} />;
            }
            if (!inline) {
              return <CodeBlock language={null} value={value} />;
            }
            return <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/* ── Copy button for assistant message body ───────────── */
// Replaces the old Save button. Lives in the message header on the right.

function MessageCopyButton({ content, disabled }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!content || disabled) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (err) {
      console.warn('Copy failed:', err);
    }
  }

  return (
    <button
      type="button"
      className={`run-msg-action ${copied ? 'saved' : ''}`}
      onClick={handleCopy}
      disabled={disabled}
      title="Copy this response to clipboard"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/* ── Single message ───────────────────────────────────── */

function RunMessage({ message, busy, modelShortName }) {
  const isUser = message.role === 'user';

  if (message.error) {
    return (
      <div className="run-msg run-msg-assistant">
        <div className="run-msg-head">
          <span>Assistant</span>
          <span>{modelShortName(message.model)}</span>
        </div>
        <div className="run-msg-error">{message.error}</div>
      </div>
    );
  }

  if (!message.content && message.streaming) {
    return (
      <div className="run-msg run-msg-assistant">
        <div className="run-msg-head">
          <span>Assistant</span>
          <span>{modelShortName(message.model)}</span>
        </div>
        <div className="run-msg-streaming">
          <span className="thinking-dots">
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
            <span className="thinking-dot"></span>
          </span>
          <span>Thinking…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`run-msg ${isUser ? 'run-msg-user' : 'run-msg-assistant'}`}>
      <div className="run-msg-head">
        <span>{isUser ? 'You' : 'Assistant'}</span>
        {!isUser && <span>{modelShortName(message.model)}</span>}
        {!isUser && !message.streaming && message.content && (
          <div className="run-msg-actions">
            <MessageCopyButton content={message.content} disabled={busy} />
          </div>
        )}
      </div>
      <div className="run-msg-body">
        {isUser ? (
          message.content
        ) : (
          <RunMarkdown>{message.content || ''}</RunMarkdown>
        )}
      </div>
      {!isUser && message.complete && (message.cost !== null || message.latencyMs) && (
        <div className="run-msg-meta">
          {message.cost !== null && message.cost !== undefined && (
            <span className="run-msg-meta-cost">{formatCost(message.cost)}</span>
          )}
          {message.latencyMs && <span>{formatLatency(message.latencyMs)}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Conversation list item ───────────────────────────── */

function ConversationListItem({ convo, isCurrent, onLoad, onRename, onRemove, modelShortName }) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(convo.title || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commitTitle() {
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(convo.id, trimmed);
    setEditing(false);
  }

  function cancelEdit() {
    setDraftTitle(convo.title || '');
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  const messageCount = convo.messages?.filter((m) => m.role !== 'system').length || 0;
  const firstUser = convo.messages?.find((m) => m.role === 'user');
  const preview = firstUser?.content || '';

  return (
    <li className={`convo-item ${isCurrent ? 'current' : ''}`}>
      {editing ? (
        <input
          ref={inputRef}
          className="convo-rename-input"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitTitle}
          placeholder="Conversation title"
          maxLength={120}
        />
      ) : (
        <button className="convo-item-main" onClick={() => onLoad(convo)}>
          <div className="convo-item-row">
            <span className="convo-item-model">{modelShortName(convo.model)}</span>
            <span className="convo-item-count">
              {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
            </span>
            <span className="convo-item-time">{formatTime(convo.lastUsedAt || convo.startedAt)}</span>
          </div>
          <span className="convo-item-title">{convo.title || autoTitle(preview)}</span>
          {convo.title && preview && convo.title !== autoTitle(preview) && (
            <span className="convo-item-preview">{preview}</span>
          )}
        </button>
      )}
      <div className="convo-item-actions">
        <button
          className="convo-item-action-btn"
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          aria-label="Rename"
          title="Rename"
        >
          <PencilIcon />
        </button>
        <button
          className="convo-item-action-btn delete"
          onClick={(e) => { e.stopPropagation(); onRemove(convo.id); }}
          aria-label="Delete"
          title="Delete"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

/* ── Conversation list view ───────────────────────────── */

function ConversationListView({
  conversations,
  currentConvo,
  onLoad,
  onRename,
  onRemove,
  onClearAll,
  modelShortName,
}) {
  const items = [];
  if (currentConvo && currentConvo.messages?.length > 0) {
    items.push({ ...currentConvo, _isCurrent: true });
  }
  for (const c of conversations) {
    if (currentConvo && c.id === currentConvo.id) continue;
    items.push({ ...c, _isCurrent: false });
  }

  const total = items.length;

  return (
    <>
      <div className="convo-list-head">
        <span className="convo-list-label">All conversations</span>
        {total > 0 && (
          <span className="convo-list-count">
            {total} {total === 1 ? 'conversation' : 'conversations'}
          </span>
        )}
      </div>
      <div className="convo-list-body">
        {items.length === 0 ? (
          <div className="convo-list-empty">
            <strong>No conversations yet</strong>
            Click "Run prompt" on a refined prompt, or use the + button to start one.
          </div>
        ) : (
          <>
            <ul className="convo-list">
              {items.map((convo) => (
                <ConversationListItem
                  key={convo.id}
                  convo={convo}
                  isCurrent={convo._isCurrent}
                  onLoad={onLoad}
                  onRename={onRename}
                  onRemove={onRemove}
                  modelShortName={modelShortName}
                />
              ))}
            </ul>
            {conversations.length > 0 && (
              <button
                type="button"
                className="convo-list-clear-btn"
                onClick={onClearAll}
              >
                Clear all past conversations
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ── The drawer ───────────────────────────────────────── */

export function RunDrawer({
  panelMode,
  conversation,
  conversations,
  testModel,
  modelShortName,
  onClose,
  onSend,
  onStop,
  onNewConversation,
  onShowList,
  onShowConversation,
  onLoadConversation,
  onRenameConversation,
  onRemoveConversation,
  onClearAllConversations,
  busy,
  summary,
  summarising,
  onSummarise,
  onClearSummary,
}) {
  const [composer, setComposer] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const bodyRef = useRef(null);
  const textareaRef = useRef(null);

  // Escape key exits fullscreen; does not close the drawer.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && fullscreen) {
        e.stopPropagation();
        setFullscreen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fullscreen]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTo({
      top: bodyRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [
    panelMode,
    conversation,
    conversation?.messages?.length,
    conversation?.messages?.[conversation.messages.length - 1]?.content,
  ]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [composer]);

  function handleSend() {
    const text = composer.trim();
    if (!text || busy) return;
    onSend(text);
    setComposer('');
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  const hasMessages = conversation?.messages?.length > 0;
  const messageCount = conversation?.messages?.filter((m) => m.role !== 'system').length || 0;
  const isListMode = panelMode === 'list';

  let headerTitle;
  if (isListMode) {
    headerTitle = 'Conversations';
  } else if (conversation?.title) {
    headerTitle = conversation.title;
  } else if (conversation?.messages?.length > 0) {
    const first = conversation.messages.find((m) => m.role === 'user');
    headerTitle = autoTitle(first?.content);
  } else {
    headerTitle = 'New conversation';
  }

  return (
    <aside
      className={`run-drawer${fullscreen ? ' run-drawer--fullscreen' : ''}`}
      role="dialog"
      aria-label="Run prompt panel"
    >
        <div className="run-drawer-head">
          {isListMode ? (
            <button
              type="button"
              className="run-drawer-action-btn"
              onClick={onShowConversation}
              aria-label="Back to conversation"
              title="Back to current conversation"
            >
              <ArrowLeftIcon />
            </button>
          ) : (
            <button
              type="button"
              className="run-drawer-action-btn"
              onClick={onShowList}
              aria-label="Show all conversations"
              title="Show all conversations"
            >
              <ListIcon />
            </button>
          )}
          <div className="run-drawer-title">
            <div className="run-drawer-title-row">
              <h3>{headerTitle}</h3>
              {!isListMode && <span className="run-drawer-model-tag">{modelShortName(testModel)}</span>}
            </div>
            {!isListMode && hasMessages && (
              <div className="run-drawer-subtitle">
                {messageCount} {messageCount === 1 ? 'message' : 'messages'}
                {' • '}
                Change model in Settings → Test runner model
              </div>
            )}
            {!isListMode && !hasMessages && (
              <div className="run-drawer-subtitle">
                Type a message below to start, or click Run prompt on a refined prompt.
              </div>
            )}
          </div>
          <div className="run-drawer-actions">
            {!isListMode && hasMessages && (
              <button
                type="button"
                className={`run-drawer-action-btn ${summarising ? 'active' : ''}`}
                onClick={summary ? onClearSummary : onSummarise}
                disabled={busy || summarising}
                aria-label={summary ? 'Clear summary' : 'Summarise conversation'}
                title={summary ? 'Clear summary' : 'Summarise conversation'}
              >
                <span style={{ fontSize: 13 }}>∑</span>
              </button>
            )}
            <button
              type="button"
              className="run-drawer-action-btn"
              onClick={onNewConversation}
              disabled={busy}
              aria-label="New conversation"
              title="New conversation"
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="run-drawer-action-btn"
              onClick={() => setFullscreen(v => !v)}
              aria-label={fullscreen ? 'Exit fullscreen' : 'Expand to fullscreen'}
              title={fullscreen ? 'Exit fullscreen (Esc)' : 'Expand to fullscreen'}
            >
              {fullscreen ? <CompressIcon /> : <ExpandIcon />}
            </button>
            <button
              type="button"
              className="run-drawer-action-btn"
              onClick={onClose}
              aria-label="Close panel"
              title="Close panel"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {isListMode ? (
          <ConversationListView
            conversations={conversations}
            currentConvo={conversation}
            onLoad={onLoadConversation}
            onRename={onRenameConversation}
            onRemove={onRemoveConversation}
            onClearAll={onClearAllConversations}
            modelShortName={modelShortName}
          />
        ) : (
          <>
            <div className="run-drawer-body" ref={bodyRef}>
              {(summary || summarising) && (
                <div className="run-summary-banner">
                  <div className="run-summary-head">
                    <span className="run-summary-label">∑ Summary</span>
                    {summary && !summarising && (
                      <button className="run-summary-close" onClick={onClearSummary} aria-label="Close summary">×</button>
                    )}
                  </div>
                  {summarising && !summary ? (
                    <div className="run-summary-thinking">
                      <span className="thinking-dots">
                        <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
                      </span>
                      Summarising…
                    </div>
                  ) : (
                    <div className="run-summary-body">
                      {summary}
                      {summarising && <span className="caret" />}
                    </div>
                  )}
                </div>
              )}
              {!hasMessages && (
                <div className="run-drawer-empty">
                  <strong>Start a new conversation</strong>
                  Type a message below to begin chatting with {modelShortName(testModel)}.
                </div>
              )}
              {conversation?.messages?.map((message) => (
                <RunMessage
                  key={message.id}
                  message={message}
                  busy={busy}
                  modelShortName={modelShortName}
                />
              ))}
            </div>

            <div className="run-drawer-foot">
              <div className="run-composer">
                <textarea
                  ref={textareaRef}
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    busy
                      ? 'Wait for the response to finish…'
                      : hasMessages
                      ? 'Ask a follow-up… (Ctrl+Enter to send)'
                      : 'Type a message to start…'
                  }
                  rows={1}
                  disabled={busy}
                />
                <div className="run-composer-actions">
                  <span className="run-composer-hint">
                    {composer.length > 0 && `${composer.length} chars`}
                  </span>
                  {busy ? (
                    <button
                      className="run-composer-send stop"
                      onClick={onStop}
                      aria-label="Stop generating"
                      title="Stop generating"
                    >
                      <span className="stop-square" />
                    </button>
                  ) : (
                    <button
                      className="run-composer-send"
                      onClick={handleSend}
                      disabled={!composer.trim()}
                      aria-label="Send"
                      title="Send (Ctrl+Enter)"
                    >
                      <SendIcon />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
    </aside>
  );
}

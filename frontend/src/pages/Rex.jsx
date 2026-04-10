import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, MessageSquare } from 'lucide-react';

const API = (path, opts = {}) => {
  const token = localStorage.getItem('token');
  return fetch(`/api/rex${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function RexPage({ lang = 'en' }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [convLoading, setConvLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const isAr = lang === 'ar';

  const placeholder = {
    en: 'Ask Rex anything about your business...',
    fr: 'Posez une question à Rex...',
    ar: 'اسأل ريكس عن أي شيء...',
  }[lang] || 'Ask Rex anything...';

  // Load conversations on mount
  useEffect(() => {
    API('/conversations').then(r => r.json()).then(setConversations).catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const loadConversation = useCallback(async (id) => {
    setConvLoading(true);
    setActiveId(id);
    setMessages([]);
    setStatus('');
    try {
      const res = await API(`/conversations/${id}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {}
    setConvLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const newConversation = async () => {
    const res = await API('/conversations', { method: 'POST' });
    const conv = await res.json();
    setConversations(prev => [conv, ...prev]);
    setActiveId(conv.id);
    setMessages([]);
    setStatus('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const deleteConversation = async (e, id) => {
    e.stopPropagation();
    await API(`/conversations/${id}`, { method: 'DELETE' });
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading || !activeId) return;

    const userMsg = { role: 'user', content: q, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStatus('');

    const token = localStorage.getItem('token');
    let rexContent = '';

    try {
      const response = await fetch(`/api/rex/conversations/${activeId}/ask`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      if (!response.ok) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Add empty rex message that we'll fill token by token
      setMessages(prev => [...prev, { role: 'rex', content: '', streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'status') {
              setStatus(data.text);
            } else if (data.type === 'token') {
              rexContent += data.text;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'rex', content: rexContent, streaming: true };
                return updated;
              });
            } else if (data.type === 'error') {
              console.error('Rex backend error:', data.text);
              throw new Error(data.text);
            } else if (data.type === 'done') {
              setStatus('');
              rexContent = data.answer || rexContent;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'rex', content: rexContent, streaming: false };
                return updated;
              });
              // Update conversation in sidebar (title + timestamp)
              setConversations(prev =>
                prev.map(c =>
                  c.id === activeId
                    ? { ...c, title: c.title || q.slice(0, 60), updated_at: new Date().toISOString() }
                    : c
                )
              );
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error('Rex error:', err);
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.streaming) {
          updated[updated.length - 1] = { role: 'rex', content: 'Something went wrong. Please try again.', error: true };
        } else {
          updated.push({ role: 'rex', content: 'Something went wrong. Please try again.', error: true });
        }
        return updated;
      });
      setStatus('');
    }

    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="rex-page" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── Sidebar ── */}
      <aside className="rex-page-sidebar">
        <div className="rex-page-sidebar-header">
          <div className="rex-page-title">
            <div className="rex-page-avatar">R</div>
            <span>Rex</span>
          </div>
          <button className="rex-page-new-btn" onClick={newConversation} title="New conversation">
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="rex-page-conv-list">
          {conversations.length === 0 && (
            <div className="rex-page-empty-convs">No conversations yet</div>
          )}
          {conversations.map(c => (
            <div
              key={c.id}
              className={`rex-page-conv-item${activeId === c.id ? ' active' : ''}`}
              onClick={() => loadConversation(c.id)}
            >
              <MessageSquare size={13} strokeWidth={1.75} className="rex-page-conv-icon" />
              <div className="rex-page-conv-info">
                <div className="rex-page-conv-title">{c.title || 'New conversation'}</div>
                <div className="rex-page-conv-time">{timeAgo(c.updated_at)}</div>
              </div>
              <button
                className="rex-page-conv-delete"
                onClick={(e) => deleteConversation(e, c.id)}
                title="Delete"
              >
                <Trash2 size={12} strokeWidth={1.75} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="rex-page-main">
        {!activeId ? (
          <div className="rex-page-welcome">
            <div className="rex-page-welcome-avatar">R</div>
            <h2 className="rex-page-welcome-title">Hey, I'm Rex</h2>
            <p className="rex-page-welcome-sub">Your business intelligence layer. I have full visibility into your store — orders, stock, financials, team, ads, and more.</p>
            <button className="btn btn-primary" onClick={newConversation}>
              <Plus size={15} strokeWidth={2} />
              Start a conversation
            </button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="rex-page-messages">
              {convLoading && (
                <div className="rex-page-loading">Loading...</div>
              )}
              {messages.length === 0 && !convLoading && (
                <div className="rex-page-empty-msgs">Ask Rex anything about your business.</div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`rex-page-msg rex-page-msg-${m.role}${m.error ? ' rex-page-msg-error' : ''}`}>
                  {m.role === 'rex' && <div className="rex-page-msg-avatar">R</div>}
                  <div className="rex-page-msg-bubble">
                    {m.content || (m.streaming && !m.content ? (
                      <span className="rex-typing"><span /><span /><span /></span>
                    ) : '')}
                    {m.streaming && m.content && <span className="rex-cursor" />}
                  </div>
                </div>
              ))}
              {status && (
                <div className="rex-page-status">
                  <span className="rex-status-dot" />
                  {status}
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="rex-page-input-row">
              <textarea
                ref={inputRef}
                className="rex-page-input"
                placeholder={placeholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                disabled={loading}
              />
              <button
                className="rex-page-send"
                onClick={send}
                disabled={!input.trim() || loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

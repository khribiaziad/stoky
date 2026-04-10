import { useState, useEffect, useRef } from 'react';
import { askRex } from '../api';
import { useT } from '../i18n';

const PLACEHOLDER = {
  en: 'Ask Rex anything about your business...',
  fr: 'Posez une question à Rex sur votre activité...',
  ar: 'اسأل ريكس عن أي شيء في تجارتك...',
};

const WELCOME = {
  en: "Hey! I'm Rex, your business assistant. I have full visibility into your store — orders, stock, financials, team, and more. What would you like to know?",
  fr: "Salut ! Je suis Rex, votre assistant business. J'ai une vue complète sur votre boutique — commandes, stock, finances, équipe et plus encore. Que voulez-vous savoir ?",
  ar: "مرحباً! أنا ريكس، مساعدك التجاري. لدي رؤية كاملة على متجرك — الطلبات، المخزون، الماليات، الفريق والمزيد. ماذا تريد أن تعرف؟",
};

export default function RexChat({ lang = 'en', isConfirmer = false }) {
  const t = useT(lang);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const isAr = lang === 'ar';

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'rex', text: WELCOME[lang] || WELCOME.en }]);
    }
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;

    const userMsg = { role: 'user', text: q };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Build history for context (exclude welcome message)
    const history = newMessages
      .filter(m => m.role !== 'rex' || messages.indexOf(m) > 0)
      .slice(-10) // last 10 turns
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    try {
      const res = await askRex({ question: q, history: history.slice(0, -1) });
      setMessages(prev => [...prev, { role: 'rex', text: res.data.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'rex', text: 'Something went wrong. Please try again.', error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Don't show for confirmers
  if (isConfirmer) return null;

  return (
    <>
      {/* ── Floating button ── */}
      <button
        className={`rex-fab${open ? ' rex-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Open Rex"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <span className="rex-fab-label">Rex</span>
        )}
      </button>

      {/* ── Chat panel ── */}
      {open && (
        <div className={`rex-panel${isAr ? ' rex-rtl' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>

          {/* Header */}
          <div className="rex-header">
            <div className="rex-header-info">
              <div className="rex-avatar">R</div>
              <div>
                <div className="rex-name">Rex</div>
                <div className="rex-status">
                  <span className="rex-status-dot" />
                  {t('rex_business_ai')}
                </div>
              </div>
            </div>
            <button className="rex-close" onClick={() => setOpen(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="rex-messages">
            {messages.map((m, i) => (
              <div key={i} className={`rex-msg rex-msg-${m.role}${m.error ? ' rex-msg-error' : ''}`}>
                {m.role === 'rex' && <div className="rex-msg-avatar">R</div>}
                <div className="rex-msg-bubble">{m.text}</div>
              </div>
            ))}
            {loading && (
              <div className="rex-msg rex-msg-rex">
                <div className="rex-msg-avatar">R</div>
                <div className="rex-msg-bubble rex-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="rex-input-row">
            <textarea
              ref={inputRef}
              className="rex-input"
              placeholder={PLACEHOLDER[lang] || PLACEHOLDER.en}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              disabled={loading}
            />
            <button className="rex-send" onClick={send} disabled={!input.trim() || loading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>

        </div>
      )}
    </>
  );
}

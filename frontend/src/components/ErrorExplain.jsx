import { useState } from 'react';
import { explainError } from '../api';

const L = {
  en: { btn: 'Explain', gotIt: 'Got it', thinking: 'Thinking…', failed: 'Could not get an explanation right now.' },
  fr: { btn: 'Expliquer', gotIt: 'Compris', thinking: 'Réflexion…', failed: "Impossible d'obtenir une explication." },
  ar: { btn: 'اشرح لي', gotIt: 'فهمت', thinking: '…جاري التفكير', failed: 'تعذّر الحصول على تفسير.' },
};

export default function ErrorExplain({ message, page = '' }) {
  const [open, setOpen]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [explanation, setExplan]  = useState('');

  const lang = localStorage.getItem('app_lang') || 'en';
  const t    = L[lang] || L.en;

  const handleExplain = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const r = await explainError({ message, page, lang });
      setExplan(r.data.explanation);
    } catch {
      setExplan(t.failed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="alert alert-error" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ flex: 1 }}>{message}</span>
        {!open && (
          <button
            onClick={handleExplain}
            style={{
              flexShrink: 0, fontSize: 12, padding: '3px 10px', borderRadius: 6,
              background: 'transparent', border: '1px solid #f8717166',
              color: '#f87171', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t.btn}
          </button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #f8717122' }}>
          {loading ? (
            <span style={{ fontSize: 13, color: '#8892b0' }}>{t.thinking}</span>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.65, marginBottom: 10 }}>
                💡 {explanation}
              </div>
              <button
                onClick={() => { setOpen(false); setExplan(''); }}
                style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 6,
                  background: 'transparent', border: '1px solid #4ade8044',
                  color: '#4ade80', cursor: 'pointer',
                }}
              >
                {t.gotIt}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Store, Globe, Truck, Check, ChevronRight, Copy } from 'lucide-react';
import { updateStoreName, updateUsername, setSetting, getSetting } from '../api';

const ECOM_PLATFORMS = [
  { id: 'youcan',      label: 'YouCan',       note: 'Paste a header JS script in your store' },
  { id: 'shopify',     label: 'Shopify',      note: 'Connect via webhook URL' },
  { id: 'woocommerce', label: 'WooCommerce',  note: 'Connect via webhook URL' },
];

const DELIVERY_COMPANIES = [
  { id: 'olivraison', label: 'Olivraison', fields: ['api_key', 'secret_key', 'pickup_city', 'pickup_street', 'pickup_phone'], labels: ['API Key', 'Secret Key', 'Pickup City', 'Pickup Street', 'Pickup Phone'] },
  { id: 'forcelog',   label: 'Forcelog',   fields: ['api_key'], labels: ['API Key'] },
];

const STEPS = [
  { id: 'identity',  title: 'Store Identity',       Icon: Store },
  { id: 'platforms', title: 'E-commerce Platforms', Icon: Globe },
  { id: 'delivery',  title: 'Delivery Company',     Icon: Truck },
];

function CopyBox({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: 'var(--t1)' }}>
        {value}
      </div>
      <button className="btn btn-secondary btn-sm" onClick={copy} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
        <Copy size={13} strokeWidth={2} /> {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

export default function Setup({ user, onComplete }) {
  const origin = window.location.origin;

  // completed steps: {identity: true, platforms: true, ...}
  const [done, setDone]         = useState({});
  const [active, setActive]     = useState('identity');
  const [error, setError]       = useState('');
  const [saving, setSaving]     = useState(false);

  // Step 1 — identity
  const [username,  setUsername]  = useState(user?.username  || '');
  const [storeName, setStoreName] = useState(user?.store_name || '');

  // Step 2 — platforms
  const [selPlatforms, setSelPlatforms] = useState([]);

  // Step 3 — delivery
  const [selDelivery, setSelDelivery] = useState([]);
  const [deliveryCreds, setDeliveryCreds] = useState({
    olivraison: { api_key: '', secret_key: '', pickup_city: '', pickup_street: '', pickup_phone: '' },
    forcelog:   { api_key: '' },
  });


  useEffect(() => {
    // Load existing progress
    getSetting('onboarding_progress').then(r => {
      try {
        const p = JSON.parse(r.data?.value || '{}');
        setDone(p);
        // find first incomplete step
        const first = STEPS.find(s => !p[s.id]);
        if (first) setActive(first.id);
        else {
          // All steps already done — ensure onboarding_done is saved then exit
          setSetting('onboarding_done', 'true').catch(() => {}).finally(() => onComplete());
        }
      } catch {}
    }).catch(() => {});
  }, []);

  const markDone = async (stepId) => {
    const next = { ...done, [stepId]: true };
    setDone(next);
    try {
      await setSetting('onboarding_progress', JSON.stringify(next));
    } catch {
      // non-fatal: keep going
    }
    // check if all done
    const allDone = STEPS.every(s => next[s.id]);
    if (allDone) {
      try {
        await setSetting('onboarding_done', 'true');
      } catch {
        // non-fatal: the useEffect safety net will save it on next load
      }
      onComplete();
    } else {
      const nextStep = STEPS.find(s => !next[s.id]);
      if (nextStep) setActive(nextStep.id);
    }
  };

  const toggleArr = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

  // ── Step handlers ────────────────────────────────────────────

  const handleIdentity = async () => {
    if (!username.trim() || !storeName.trim()) { setError('Both fields are required'); return; }
    setSaving(true); setError('');
    try {
      await updateUsername({ username: username.trim() });
      await updateStoreName({ store_name: storeName.trim() });
      // patch localStorage
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...u, username: username.trim(), store_name: storeName.trim() }));
      } catch {}
      await markDone('identity');
    } catch (e) {
      setError(e.response?.data?.detail || 'Error saving');
    } finally { setSaving(false); }
  };

  const handlePlatforms = async (skip = false) => {
    // nothing to save server-side — webhook URLs are static
    await markDone('platforms');
  };

  const handleDelivery = async (skip = false) => {
    if (!skip && selDelivery.length > 0) {
      setSaving(true); setError('');
      try {
        const saves = [];
        if (selDelivery.includes('olivraison')) {
          const c = deliveryCreds.olivraison;
          saves.push(setSetting('olivraison_api_key', c.api_key));
          saves.push(setSetting('olivraison_secret_key', c.secret_key));
          saves.push(setSetting('olivraison_pickup_city', c.pickup_city));
          saves.push(setSetting('olivraison_pickup_street', c.pickup_street));
          saves.push(setSetting('olivraison_pickup_phone', c.pickup_phone));
        }
        if (selDelivery.includes('forcelog')) {
          saves.push(setSetting('forcelog_api_key', deliveryCreds.forcelog.api_key));
        }
        await Promise.all(saves);
      } catch (e) {
        setError(e.response?.data?.detail || 'Error saving');
        setSaving(false); return;
      } finally { setSaving(false); }
    }
    await markDone('delivery');
  };


  // ── Step content ─────────────────────────────────────────────

  const stepContent = {
    identity: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0 }}>
          Confirm your username and store name. You can change these anytime in Settings.
        </p>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>USERNAME</label>
          <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 6 }}>STORE NAME</label>
          <input className="form-input" value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="My Store" />
        </div>
        <button className="btn btn-primary" onClick={handleIdentity} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} strokeWidth={2.5} /> {saving ? 'Saving…' : 'Confirm & Continue'}
        </button>
      </div>
    ),

    platforms: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0 }}>
          Select the platforms you sell on. You'll get a webhook URL to paste into each one.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ECOM_PLATFORMS.map(p => {
            const sel = selPlatforms.includes(p.id);
            return (
              <div key={p.id}
                onClick={() => toggleArr(selPlatforms, setSelPlatforms, p.id)}
                style={{ padding: '12px 16px', borderRadius: 'var(--r-sm)', border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent-c)' : 'var(--card-2)', cursor: 'pointer', transition: 'all .15s' }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>{p.note}</div>
              </div>
            );
          })}
        </div>
        {selPlatforms.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selPlatforms.includes('youcan') && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>YOUCAN — Paste this in Settings → Header JS</div>
                <CopyBox value={`${origin}/api/leads/inbound`} />
              </div>
            )}
            {selPlatforms.includes('shopify') && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>SHOPIFY — Webhook URL</div>
                <CopyBox value={`${origin}/api/shopify/webhook`} />
              </div>
            )}
            {selPlatforms.includes('woocommerce') && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>WOOCOMMERCE — Webhook URL</div>
                <CopyBox value={`${origin}/api/woocommerce/webhook`} />
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => handlePlatforms(false)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} strokeWidth={2.5} /> {selPlatforms.length > 0 ? 'Done' : 'Continue'}
          </button>
          <button className="btn btn-secondary" onClick={() => handlePlatforms(true)} style={{ fontSize: 13 }}>
            I don't have one for now
          </button>
        </div>
      </div>
    ),

    delivery: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0 }}>
          Select your delivery company and enter your API credentials.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DELIVERY_COMPANIES.map(d => {
            const sel = selDelivery.includes(d.id);
            return (
              <div key={d.id} style={{ borderRadius: 'var(--r-sm)', border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden', transition: 'border-color .15s' }}>
                <div
                  onClick={() => toggleArr(selDelivery, setSelDelivery, d.id)}
                  style={{ padding: '12px 16px', background: sel ? 'var(--accent-c)' : 'var(--card-2)', cursor: 'pointer', fontWeight: 600 }}>
                  {d.label}
                </div>
                {sel && (
                  <div style={{ padding: '12px 16px', background: 'var(--card)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.fields.map((field, i) => (
                      <div key={field}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', display: 'block', marginBottom: 4 }}>{d.labels[i].toUpperCase()}</label>
                        <input
                          className="form-input"
                          placeholder={d.labels[i]}
                          value={deliveryCreds[d.id][field]}
                          onChange={e => setDeliveryCreds(prev => ({ ...prev, [d.id]: { ...prev[d.id], [field]: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => handleDelivery(false)} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} strokeWidth={2.5} /> {saving ? 'Saving…' : selDelivery.length > 0 ? 'Save & Finish' : 'Finish Setup'}
          </button>
          <button className="btn btn-secondary" onClick={() => handleDelivery(true)} style={{ fontSize: 13 }}>
            I don't have one for now
          </button>
        </div>
      </div>
    ),
  };

  const unlockedFrom = done.identity ? 0 : 99;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: '40px 16px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.1em', color: 'var(--accent)', marginBottom: 6 }}>STOCKY</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)' }}>Let's get you set up</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>Complete each step to start using Stocky fully</div>
      </div>

      <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 860, alignItems: 'flex-start' }}>

        {/* Step list */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {STEPS.map((s, i) => {
            const isDone    = done[s.id];
            const isActive  = active === s.id;
            const isLocked  = i > 0 && !done.identity;
            return (
              <div
                key={s.id}
                onClick={() => !isLocked && setActive(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 'var(--r-sm)',
                  background: isActive ? 'var(--accent-c)' : 'transparent',
                  border: `1px solid ${isActive ? 'var(--accent-b)' : 'transparent'}`,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.35 : 1,
                  transition: 'all .15s',
                }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? 'var(--accent)' : isActive ? 'var(--accent-b)' : 'var(--card-2)',
                  border: `1.5px solid ${isDone ? 'var(--accent)' : isActive ? 'var(--accent)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone
                    ? <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />
                    : <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? 'var(--accent)' : 'var(--t2)' }}>{i + 1}</span>
                  }
                </div>
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--t1)' : isDone ? 'var(--t2)' : 'var(--t2)' }}>
                  {s.title}
                </span>
                {isActive && <ChevronRight size={13} style={{ color: 'var(--accent)', marginLeft: 'auto' }} />}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          {(() => {
            const s = STEPS.find(s => s.id === active);
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <s.Icon size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</span>
                </div>
                {error && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 14, padding: '8px 12px', background: 'rgba(248,113,113,0.1)', borderRadius: 6 }}>{error}</div>}
                {stepContent[active]}
              </>
            );
          })()}
        </div>

      </div>
    </div>
  );
}

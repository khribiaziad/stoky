import { useState, useEffect, useRef } from 'react';
import {
  Sun, Moon, Globe, Lock, User, Store, ShieldCheck,
  Upload, Package, DollarSign, Truck, AlertTriangle, Edit2, Check,
  MapPin, Plus, Trash2, Search, X, Link, RotateCcw, Copy, Zap, MessageCircle, Warehouse,
} from 'lucide-react';
import { changePassword, updateStoreName, updateProfile, getSetting, setSetting, getCityList, createCity, updateCity, deleteCity, uploadCityPDF, getCityPdfJob, getApiKey, rotateApiKey, errorMessage, getBotStatus, getBotQR, connectBot, disconnectBot, getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse, syncWarehousePrices } from '../api';

const LANGUAGES = [
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية',  flag: '🇲🇦' },
];

const ACCENTS = [
  { name: 'Emerald', value: '#00d48f' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Purple',  value: '#a855f7' },
  { name: 'Orange',  value: '#f97316' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Cyan',    value: '#06b6d4' },
];

// ── Small reusable row ──────────────────────────────────────
function InfoRow({ Icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)' }}>
      <Icon size={16} strokeWidth={1.75} style={{ color: 'var(--t2)', flexShrink: 0 }} />
      <span style={{ color: 'var(--t2)', fontSize: 13, width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ── Section header ──────────────────────────────────────────
function SectionHeader({ Icon, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <Icon size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
      <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
    </div>
  );
}

// ── Contact info (email + whatsapp) ─────────────────────────
function ProfileContact({ user }) {
  const [email,    setEmail]    = useState(user?.email    || '');
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || '');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [err,      setErr]      = useState('');

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await updateProfile({ email, whatsapp });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { setErr(errorMessage(e)); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Contact Info</div>
      {err && <div style={{ fontSize: 13, color: '#f87171' }}>{err}</div>}
      <div>
        <label className="form-label">Email</label>
        <input className="form-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="form-label">WhatsApp Number</label>
        <input className="form-input" placeholder="+212600000000" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}>
        <Check size={14} strokeWidth={2.5} /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Contact Info'}
      </button>
    </div>
  );
}

// ── Sub-label ───────────────────────────────────────────────
function SubLabel({ text }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.07em', fontWeight: 600 }}>
      {text}
    </div>
  );
}

// ── City row with inline edit ────────────────────────────────
function CityRow({ city, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: city.name,
    delivery_fee: city.delivery_fee,
    return_fee: city.return_fee,
    is_casa: city.is_casa,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(city.id, {
      name: form.name.trim(),
      delivery_fee: parseFloat(form.delivery_fee) || 0,
      return_fee: parseFloat(form.return_fee) || 0,
      is_casa: form.is_casa,
    });
    setSaving(false);
    setEditing(false);
  };

  const tdStyle = { padding: '9px 14px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

  if (editing) {
    return (
      <tr style={{ background: 'var(--accent-c)' }}>
        <td style={tdStyle}>
          <input className="form-input" style={{ padding: '4px 8px', fontSize: 13 }}
            value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input className="form-input" type="number" min="0" step="0.5" style={{ padding: '4px 8px', fontSize: 13, width: 70, textAlign: 'right' }}
            value={form.delivery_fee} onChange={e => setForm({ ...form, delivery_fee: e.target.value })} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <input className="form-input" type="number" min="0" step="0.5" style={{ padding: '4px 8px', fontSize: 13, width: 70, textAlign: 'right' }}
            value={form.return_fee} onChange={e => setForm({ ...form, return_fee: e.target.value })} />
        </td>
        <td style={{ ...tdStyle, textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={12} strokeWidth={2.5} />
              {saving ? '…' : 'Save'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setForm({ name: city.name, delivery_fee: city.delivery_fee, return_fee: city.return_fee, is_casa: city.is_casa }); }}>
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--card-2)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}>
      <td style={tdStyle}>
        <span style={{ fontSize: 13 }}>{city.name}</span>
        {city.is_casa && (
          <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent-b)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
            CASA
          </span>
        )}
      </td>
      <td style={{ ...tdStyle, textAlign: 'right', fontSize: 13, fontWeight: 500 }}>{city.delivery_fee} MAD</td>
      <td style={{ ...tdStyle, textAlign: 'right', fontSize: 13, color: 'var(--t2)' }}>{city.return_fee} MAD</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button className="btn-icon" title="Edit" onClick={() => setEditing(true)}
            style={{ width: 28, height: 28, borderRadius: 6 }}>
            <Edit2 size={13} strokeWidth={1.75} />
          </button>
          <button className="btn-icon" title="Delete" onClick={() => onDelete(city.id)}
            style={{ width: 28, height: 28, borderRadius: 6, color: 'var(--danger)' }}>
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── WhatsApp Bot Card ───────────────────────────────────────
function WhatsAppBotCard() {
  const [status,      setStatus]      = useState('disconnected'); // disconnected | connecting | qr_pending | connected
  const [qr,          setQr]          = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [err,         setErr]         = useState('');
  const pollRef = useRef(null);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const poll = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const r = await getBotQR();
        const d = r.data;
        if (d.status === 'connected') {
          setStatus('connected'); setQr(null); stopPolling();
        } else if (d.status === 'qr_pending' && d.qr) {
          setStatus('qr_pending'); setQr(d.qr);
        } else if (d.status === 'disconnected') {
          setStatus('disconnected'); setQr(null); stopPolling();
        }
      } catch {}
    }, 2500);
  };

  useEffect(() => {
    getBotStatus().then(r => {
      const s = r.data.status;
      setStatus(s);
      if (s === 'qr_pending' || s === 'connecting') poll();
    }).catch(() => {});
    return stopPolling;
  }, []);

  const handleConnect = async () => {
    setLoading(true); setErr('');
    try {
      await connectBot();
      setStatus('connecting');
      poll();
    } catch (e) { setErr(errorMessage(e)); }
    finally { setLoading(false); }
  };

  const handleDisconnect = async () => {
    setLoading(true); setErr('');
    try {
      await disconnectBot();
      setStatus('disconnected'); setQr(null); stopPolling();
    } catch (e) { setErr(errorMessage(e)); }
    finally { setLoading(false); }
  };

  const statusColor = status === 'connected' ? '#22c55e' : status === 'qr_pending' ? '#f59e0b' : '#6b7280';
  const statusLabel = { connected: 'Connected', qr_pending: 'Scan QR Code', connecting: 'Connecting…', disconnected: 'Disconnected' }[status] || status;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <MessageCircle size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>WhatsApp AI Bot</span>
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
          background: statusColor + '22', color: statusColor,
        }}>● {statusLabel}</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
        Connect your WhatsApp number to let an AI assistant handle customer inquiries and create orders automatically.
      </p>

      {err && <div className="alert alert-error" style={{ marginBottom: 14, fontSize: 13 }}>{err}</div>}

      {status === 'qr_pending' && qr && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <img src={qr} alt="WhatsApp QR Code" style={{ width: 200, height: 200, borderRadius: 12, border: '2px solid var(--border)' }} />
          <p style={{ fontSize: 12, color: 'var(--t2)', textAlign: 'center' }}>
            Open WhatsApp → Settings → Linked Devices → Link a Device
          </p>
        </div>
      )}

      {(status === 'qr_pending' || status === 'connecting') && !qr && (
        <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 18 }}>Waiting for QR code…</div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        {status === 'disconnected' && (
          <button className="btn btn-primary" onClick={handleConnect} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MessageCircle size={14} strokeWidth={2} />
            {loading ? 'Connecting…' : 'Connect WhatsApp'}
          </button>
        )}
        {status === 'connected' && (
          <button className="btn btn-secondary" onClick={handleDisconnect} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
            {loading ? 'Disconnecting…' : 'Disconnect'}
          </button>
        )}
        {(status === 'connecting' || status === 'qr_pending') && (
          <button className="btn btn-secondary" onClick={handleDisconnect} disabled={loading}
            style={{ fontSize: 13, color: 'var(--t3)' }}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings({ user, theme, setTheme, lang, setLang, accent, setAccent, logo, setLogo, onStoreName }) {
  const isAdmin = user?.role !== 'confirmer';
  const [tab, setTab] = useState('account');

  // ── Password ──
  const [pwForm, setPwForm]       = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError]     = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // ── Store name ──
  const [storeName, setStoreName]     = useState(user?.store_name || '');
  const [storeNameEdit, setStoreNameEdit] = useState(false);
  const [storeNameLoading, setStoreNameLoading] = useState(false);
  const [storeError, setStoreError]   = useState('');
  const [storeSuccess, setStoreSuccess] = useState('');

  // ── Store settings (loaded from AppSettings) ──
  const [defaults, setDefaults] = useState({
    usd_rate: '10',
    base_capital: '0',
    default_packaging: '1',
    default_low_stock: '5',
    default_delivery_fee: '35',
    default_return_fee: '7',
  });
  const [savingKey, setSavingKey] = useState(null);

  // ── Webhook / API Key ──
  const [apiKey, setApiKey]           = useState('');
  const [rotatingKey, setRotatingKey] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  // ── Olivraison ──
  const [oliv, setOliv] = useState({ api_key: '', secret_key: '', pickup_city: '', pickup_street: '', pickup_phone: '' });
  const [olivSaving, setOlivSaving] = useState(false);
  const [olivSaved, setOlivSaved]   = useState(false);

  // ── Forcelog ──
  const [forcelogKey,           setForcelogKey]           = useState('');
  const [forcelogSecret,        setForcelogSecret]        = useState('');
  const [forcelogPickupPhone,   setForcelogPickupPhone]   = useState('');
  const [forcelogPickupCity,    setForcelogPickupCity]    = useState('');
  const [forcelogPickupAddress, setForcelogPickupAddress] = useState('');
  const [forcelogSaving, setForcelogSaving] = useState(false);
  const [forcelogSaved,  setForcelogSaved]  = useState(false);

  // ── Warehouses ──
  const [warehouses,      setWarehouses]      = useState([]);
  const [whLoading,       setWhLoading]       = useState(false);
  const [whError,         setWhError]         = useState('');
  const [newWh,           setNewWh]           = useState({ name: '', city: '' });
  const [addingWh,        setAddingWh]        = useState(false);
  const [editingWhId,     setEditingWhId]     = useState(null);
  const [editingWhForm,   setEditingWhForm]   = useState({ name: '', city: '' });
  const [syncingPrices,   setSyncingPrices]   = useState(false);
  const [syncPricesDone,  setSyncPricesDone]  = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    getApiKey().then(r => setApiKey(r.data.key)).catch(() => {});
    // Load Olivraison settings
    const keys = ['olivraison_api_key', 'olivraison_secret_key', 'olivraison_pickup_city', 'olivraison_pickup_street', 'olivraison_pickup_phone'];
    Promise.all(keys.map(k => getSetting(k).catch(() => ({ data: { value: '' } })))).then(results => {
      setOliv({
        api_key:       results[0].data?.value || '',
        secret_key:    results[1].data?.value || '',
        pickup_city:   results[2].data?.value || '',
        pickup_street: results[3].data?.value || '',
        pickup_phone:  results[4].data?.value || '',
      });
    });
    // Load Forcelog settings
    Promise.all([
      getSetting('forcelog_api_key').catch(() => ({ data: { value: '' } })),
      getSetting('forcelog_webhook_secret').catch(() => ({ data: { value: '' } })),
      getSetting('forcelog_pickup_phone').catch(() => ({ data: { value: '' } })),
      getSetting('forcelog_pickup_city').catch(() => ({ data: { value: '' } })),
      getSetting('forcelog_pickup_address').catch(() => ({ data: { value: '' } })),
    ]).then(([k, s, ph, ct, addr]) => {
      setForcelogKey(k.data?.value || '');
      setForcelogSecret(s.data?.value || '');
      setForcelogPickupPhone(ph.data?.value || '');
      setForcelogPickupCity(ct.data?.value || '');
      setForcelogPickupAddress(addr.data?.value || '');
    });
    // Load Warehouses
    getWarehouses().then(r => setWarehouses(r.data)).catch(() => {});
  }, [isAdmin]);

  const handleSaveOlivraison = async () => {
    setOlivSaving(true);
    await Promise.all([
      setSetting('olivraison_api_key',      oliv.api_key),
      setSetting('olivraison_secret_key',   oliv.secret_key),
      setSetting('olivraison_pickup_city',  oliv.pickup_city),
      setSetting('olivraison_pickup_street', oliv.pickup_street),
      setSetting('olivraison_pickup_phone', oliv.pickup_phone),
    ]);
    setOlivSaving(false);
    setOlivSaved(true);
    setTimeout(() => setOlivSaved(false), 2500);
  };

  const handleSaveForcelog = async () => {
    setForcelogSaving(true);
    await Promise.all([
      setSetting('forcelog_api_key',        forcelogKey),
      setSetting('forcelog_webhook_secret', forcelogSecret),
      setSetting('forcelog_pickup_phone',   forcelogPickupPhone),
      setSetting('forcelog_pickup_city',    forcelogPickupCity),
      setSetting('forcelog_pickup_address', forcelogPickupAddress),
    ]);
    setForcelogSaving(false);
    setForcelogSaved(true);
    setTimeout(() => setForcelogSaved(false), 2500);
  };

  const handleRotateKey = async () => {
    if (!window.confirm('Rotating the key will invalidate the old one. Continue?')) return;
    setRotatingKey(true);
    try {
      const r = await rotateApiKey();
      setApiKey(r.data.key);
    } finally { setRotatingKey(false); }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const webhookUrl = apiKey
    ? `${window.location.origin}/api/leads/inbound?api_key=${apiKey}`
    : '';

  const youcanWebhookUrl = apiKey
    ? `${window.location.origin}/api/youcan/webhook?api_key=${apiKey}`
    : '';

  const youcanScript = apiKey ? `<script>
(function () {
  var WEBHOOK = '${window.location.origin}/api/leads/inbound?api_key=${apiKey}';
  var _sent = false;
  var _cache = {};
  var CITIES = ['Casablanca','Mohammedia','Dar Bouazza','Bouskoura','Tit Mellil','Mediouna','Nouaceur','Sbata','Ain Sebaa','Sidi Bernoussi','Sidi Maarouf','Lahraouiyine','Oulfa','Had Soualem','Ouled Saleh','Bouznika','Benslimane','Berrechid','Ben Ahmed','Settat','El Jadida','Azemmour','Sidi Bennour','Khouribga','Oued Zem','Bejaad','El Borouj','Rabat','Sale','Temara','Skhirat','Kenitra','Khemisset','Sidi Slimane','Sidi Kacem','Tiflet','Souk El Arbaa','Mechra Bel Ksiri','Sidi Yahia El Gharb','Moulay Bousselham','Jorf El Melha','Marrakech','Safi','Essaouira','El Kelaa Des Sraghna','Youssoufia','Chichaoua','Imintanoute','Tahannaout','Amizmiz','Benguerir','Ait Ourir','Ourika','Fes','Meknes','Ifrane','Azrou','Sefrou','Imouzzer Kandar','Moulay Yacoub','Taza','El Hajeb','Ain Taoujdate','Bhalil','Boulmane','Tanger','Tetouan','Al Hoceima','Larache','Ksar El Kebir','Chefchaouen','Asilah','Fnideq','Martil','Ouezzane','Oujda','Nador','Berkane','Taourirt','Jerada','Guercif','Driouch','Zaio','Ahfir','Figuig','Agadir','Inezgane','Tiznit','Taroudant','Ouarzazate','Zagora','Ait Melloul','Biougra','Tafraout','Oulad Teima','Aourir','Sidi Ifni','Beni Mellal','Khenifra','Fquih Ben Salah','Azilal','Kasba Tadla','Demnate','Errachidia','Midelt','Tinghir','Rich','Erfoud','Rissani','Boumalne Dades','Guelmim','Tan-Tan','Laayoune','Boujdour','Smara','Dakhla'];

  function findCity(text) {
    if (!text) return '';
    var t = text.toLowerCase();
    for (var i = 0; i < CITIES.length; i++) {
      if (t.indexOf(CITIES[i].toLowerCase()) !== -1) return CITIES[i];
    }
    return '';
  }

  // ── 1. Capture all visible inputs into cache ──────────────────────────────
  function captureInputs() {
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (!el.value || !el.value.trim()) return;
      [el.name, el.id, el.placeholder, el.getAttribute('autocomplete')].forEach(function (k) {
        if (k && k.trim()) _cache[k.toLowerCase().replace(/\\s+/g, '-')] = el.value.trim();
      });
      if (el.type === 'tel')   _cache['_phone'] = el.value.trim();
      if (el.type === 'email') _cache['_email'] = el.value.trim();
    });
    if (Object.keys(_cache).length >= 2) localStorage.setItem('_sq', JSON.stringify(_cache));
  }

  function get(keys, extra) {
    var saved = extra || {};
    try { saved = Object.assign({}, JSON.parse(localStorage.getItem('_sq') || '{}'), _cache, extra || {}); } catch (e) {}
    for (var i = 0; i < keys.length; i++) {
      var v = saved[keys[i]] || saved[keys[i].toLowerCase()];
      if (v) return v;
    }
    return '';
  }

  function scrapeItems(bodyItems) {
    // 1. Items from intercepted API body (most reliable)
    if (bodyItems && bodyItems.length) return bodyItems;
    // 2. Cart/order summary DOM elements
    var items = [];
    document.querySelectorAll('.cart-item, .order-item, .checkout-item, [class*="cart-item"], [class*="order-item"], ul.items li').forEach(function (el) {
      var nameEl = el.querySelector('.name, .product-name, .item-name, .title, h3, h4, strong');
      var qtyEl  = el.querySelector('.quantity, .qty, [class*="qty"], [class*="quantity"]');
      if (nameEl && nameEl.innerText.trim()) {
        items.push({ product_name: nameEl.innerText.trim().split('\\n')[0], quantity: qtyEl ? parseInt(qtyEl.innerText.replace(/\\D/g, '')) || 1 : 1 });
      }
    });
    if (items.length) return items;
    // 3. Product title on the page (h1, og:title, page title)
    var h1 = document.querySelector('.product-title, h1.name, h1');
    if (h1 && h1.innerText.trim().length < 120) return [{ product_name: h1.innerText.trim().split('\\n')[0], quantity: 1 }];
    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return [{ product_name: og.content.split('|')[0].split('–')[0].trim(), quantity: 1 }];
    var t = document.title.split('|')[0].split('–')[0].split('-')[0].trim();
    if (t && t.length < 100) return [{ product_name: t, quantity: 1 }];
    return [];
  }

  function scrapeAmount() {
    // Try visible price elements on the page
    var el = document.querySelector('.product-price .price, .price .amount, [class*="selling-price"], [class*="product-price"], .price');
    if (el) {
      var n = parseFloat(el.innerText.replace(/[^\\d.]/g, ''));
      if (n > 0) return n;
    }
    var og = document.querySelector('meta[property="product:price:amount"]');
    if (og && og.content) { var n2 = parseFloat(og.content); if (n2 > 0) return n2; }
    return null;
  }

  function extractBodyItems(body) {
    var items = [];
    var variants = body.variants || body.items || body.line_items || body.products || body.cart || [];
    if (!Array.isArray(variants)) variants = [];
    variants.forEach(function (v) {
      var name = (v.product && (v.product.name || v.product.title)) || v.name || v.title || v.product_name || '';
      var qty  = parseInt(v.quantity || v.qty || 1) || 1;
      if (name) items.push({ product_name: name, quantity: qty });
    });
    return items;
  }

  // ── 2. Send lead (deduped) ────────────────────────────────────────────────
  function sendLead(ref, extra, bodyItems, bodyAmount) {
    if (_sent) return;
    captureInputs();
    var firstName = get(['first_name', 'firstname', 'given-name', 'prenom'], extra);
    var lastName  = get(['last_name',  'lastname',  'family-name', 'nom'],   extra);
    var phone     = get(['phone', '_phone', 'telephone', 'tel', 'mobile'],   extra);
    var email     = get(['email', '_email'],                                   extra);
    var city      = get(['city', 'ville', 'province', 'region', 'wilaya'],   extra);
    var address   = get(['address', 'address1', 'adresse', 'address-line1', 'street', 'rue', 'shipping-address', 'line1', 'first_line', 'shipping_address'], extra);
    var fullName  = (firstName + ' ' + lastName).trim() || get(['name', 'full-name', 'fullname'], extra);
    // City: try extra fields, then scan address, then scan all cached values, then scan all select options
    if (!city) city = findCity(address);
    if (!city) city = findCity(Object.values(_cache).join(' '));
    if (!city) {
      document.querySelectorAll('select').forEach(function(sel) {
        if (!city && sel.value) city = findCity(sel.value) || findCity(sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text || '');
      });
    }
    var amount = bodyAmount || scrapeAmount();
    var items  = scrapeItems(bodyItems);
    if (!phone && !fullName) return;
    _sent = true;
    fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name:    fullName || 'Unknown',
        customer_phone:   phone,
        customer_email:   email || null,
        customer_city:    city || null,
        customer_address: address || null,
        total_amount:     amount || null,
        notes:            'YouCan' + (ref ? ' #' + ref : ''),
        items:            items,
        website:          ''
      })
    });
  }

  // ── 3. Intercept fetch (popup AJAX orders) ────────────────────────────────
  var _origFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = (typeof input === 'string' ? input : (input || {}).url) || '';
    var method = ((init || {}).method || 'GET').toUpperCase();
    if (method === 'POST' && /order|checkout|purchase|cart|buy|payment/i.test(url)) {
      try {
        var body = JSON.parse((init || {}).body || '{}');
        var c  = body.customer || body.shipping || body;
        var sa = body.shipping_address || body.address || {};
        var extra = {
          'first_name': c.first_name, 'last_name': c.last_name, 'name': c.name,
          '_phone':  c.phone || c.telephone || sa.phone,
          'city':    c.city  || sa.city || sa.region || sa.province,
          'address': c.address || c.address1 || sa.address1 || sa.first_line || sa.street || [sa.first_line, sa.second_line].filter(Boolean).join(', '),
        };
        var bodyItems  = extractBodyItems(body);
        var bodyAmount = parseFloat(body.total || body.amount || body.price || body.grand_total || 0) || null;
        setTimeout(function () { sendLead('ajax', extra, bodyItems, bodyAmount); }, 500);
      } catch (e) {}
    }
    return _origFetch.apply(this, arguments);
  };

  // ── 4. Intercept XHR (popup AJAX orders) ─────────────────────────────────
  var _oOpen = XMLHttpRequest.prototype.open;
  var _oSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this._m = m; this._u = u; return _oOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    if (this._m === 'POST' && /order|checkout|purchase|cart|buy|payment/i.test(this._u)) {
      try {
        var d  = JSON.parse(body || '{}');
        var c  = d.customer || d.shipping || d;
        var sa = d.shipping_address || d.address || {};
        var extra = { 'first_name': c.first_name, 'last_name': c.last_name, '_phone': c.phone || c.telephone || sa.phone, 'city': c.city || sa.city || sa.region || sa.province, 'address': c.address || c.address1 || sa.address1 || sa.first_line || sa.street };
        var bodyItems  = extractBodyItems(d);
        var bodyAmount = parseFloat(d.total || d.amount || d.price || 0) || null;
        setTimeout(function () { sendLead('xhr', extra, bodyItems, bodyAmount); }, 500);
      } catch (e) {}
    }
    return _oSend.apply(this, arguments);
  };

  // ── 5. Always capture inputs (polling + events) ───────────────────────────
  setInterval(captureInputs, 2000);
  document.addEventListener('input',  captureInputs, true);
  document.addEventListener('change', captureInputs, true);
  document.addEventListener('submit', function ()   { captureInputs(); setTimeout(function () { sendLead('form'); }, 600); }, true);

  // ── YouCan express checkout button (most reliable trigger) ────────────────
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.express-checkout-button, [class*="express-checkout"], [class*="checkout-btn"], [class*="order-btn"]');
    if (btn) {
      captureInputs();
      setTimeout(function () { sendLead('btn'); }, 800);
    }
  }, true);

  // ── 6. MutationObserver — catches popup success messages ─────────────────
  var _obs = new MutationObserver(function (mutations) {
    var path = window.location.pathname;
    if (path.includes('/thankyou') || path.includes('/thank-you') || path.match(/\\/orders\\/[a-z0-9-]+/)) {
      sendLead((path.split('/orders/')[1] || '').replace('?', ''));
    }
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (/merci|thank you|commande confirm|order confirm/i.test(node.innerText || '')) {
          setTimeout(function () { sendLead('popup-confirm'); }, 300);
        }
      });
    });
  });
  _obs.observe(document.body, { childList: true, subtree: true });

  // ── 7. SPA route changes ──────────────────────────────────────────────────
  function checkRoute(path) {
    path = path || window.location.pathname;
    if (path.includes('/checkout/thankyou') || path.match(/\\/orders\\/[a-z0-9-]+/)) {
      sendLead((path.split('/orders/')[1] || '').replace('?', ''));
    }
  }
  window.addEventListener('load', function () { checkRoute(); });
  var _push = history.pushState;
  history.pushState = function (s, t, url) { _push.apply(this, arguments); if (url) checkRoute(url.toString()); };
  window.addEventListener('popstate', function () { checkRoute(); });
})();
<\/script>` : '';

  const wooWebhookUrl = apiKey
    ? `${window.location.origin}/api/woocommerce/webhook?api_key=${apiKey}`
    : '';

  const shopifyWebhookUrl = apiKey
    ? `${window.location.origin}/api/shopify/webhook?api_key=${apiKey}`
    : '';

  // ── Cities ──
  const [cities, setCities] = useState([]);
  const [citySearch, setCitySearch] = useState('');
  const [showAddCity, setShowAddCity] = useState(false);
  const [newCity, setNewCity] = useState({ name: '', delivery_fee: '35', return_fee: '7', is_casa: false });
  const [cityLoading, setCityLoading] = useState(false);
  const [cityError, setCityError] = useState('');
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [pdfPages, setPdfPages] = useState({ done: 0, total: null });
  const [pdfResult, setPdfResult] = useState(null); // { added, updated, total }

  const logoInputRef = useRef();
  const pdfInputRef = useRef();
  const pdfPollRef = useRef(null);

  // Load store settings
  useEffect(() => {
    if (!isAdmin) return;
    const keys = Object.keys(defaults);
    Promise.all(keys.map(k => getSetting(k).catch(() => ({ data: { value: null } }))))
      .then(results => {
        const loaded = {};
        keys.forEach((k, i) => {
          if (results[i].data?.value !== null && results[i].data?.value !== undefined) {
            loaded[k] = results[i].data.value;
          }
        });
        setDefaults(d => ({ ...d, ...loaded }));
      });
  }, [isAdmin]);

  // Load cities
  useEffect(() => {
    if (!isAdmin) return;
    getCityList().then(r => setCities(r.data)).catch(() => {});
  }, [isAdmin]);

  const filteredCities = cities.filter(c =>
    c.name.toLowerCase().includes(citySearch.toLowerCase())
  );

  const handleAddCity = async () => {
    setCityError('');
    if (!newCity.name.trim()) { setCityError('City name is required'); return; }
    setCityLoading(true);
    try {
      const res = await createCity({
        name: newCity.name.trim(),
        delivery_fee: parseFloat(newCity.delivery_fee) || 0,
        return_fee: parseFloat(newCity.return_fee) || 0,
        is_casa: newCity.is_casa,
      });
      setCities(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCity({ name: '', delivery_fee: '35', return_fee: '7', is_casa: false });
      setShowAddCity(false);
    } catch (e) {
      setCityError(errorMessage(e));
    } finally { setCityLoading(false); }
  };

  const handleUpdateCity = async (id, data) => {
    try {
      const res = await updateCity(id, data);
      setCities(prev => prev.map(c => c.id === id ? res.data : c).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setCityError(errorMessage(e));
    }
  };

  const handleDeleteCity = async (id) => {
    try {
      await deleteCity(id);
      setCities(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      setCityError(errorMessage(e));
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setCityError('');
    setPdfResult(null);
    setPdfUploading(true);
    setPdfProgress(0);
    setPdfPages({ done: 0, total: null });

    try {
      // 1. Upload file — backend returns a job_id immediately
      const res = await uploadCityPDF(file);
      const { job_id } = res.data;

      // 2. Poll the job every 1.5 s for real progress
      await new Promise((resolve, reject) => {
        pdfPollRef.current = setInterval(async () => {
          try {
            const { data: job } = await getCityPdfJob(job_id);
            setPdfProgress(job.progress ?? 0);
            setPdfPages({ done: job.pages_done ?? 0, total: job.pages_total });

            if (job.status === 'done') {
              clearInterval(pdfPollRef.current);
              setPdfResult(job.result);
              setPdfProgress(100);
              resolve();
            } else if (job.status === 'error') {
              clearInterval(pdfPollRef.current);
              reject(new Error(job.error));
            }
          } catch (pollErr) {
            clearInterval(pdfPollRef.current);
            reject(pollErr);
          }
        }, 1500);
      });

      // 3. Refresh city list
      const refreshed = await getCityList();
      setCities(refreshed.data);
      setTimeout(() => { setPdfProgress(0); setPdfUploading(false); }, 900);
    } catch (err) {
      clearInterval(pdfPollRef.current);
      setPdfProgress(0);
      setPdfUploading(false);
      setCityError(err.message || err.response?.data?.detail || 'Could not parse PDF.');
    }
  };

  // ── Handlers ──────────────────────────────────────────────

  const handleTheme = (t) => {
    setTheme(t);
    localStorage.setItem('app_theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  const handleLang = (l) => {
    setLang(l);
    localStorage.setItem('app_lang', l);
  };

  const handleAccent = (color) => {
    setAccent(color);
    localStorage.setItem('app_accent', color);
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-a', color + '1f');
    document.documentElement.style.setProperty('--accent-b', color + '38');
    document.documentElement.style.setProperty('--accent-c', color + '0f');
  };

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('');
    if (!pwForm.current_password) { setPwError('Enter your current password'); return; }
    if (pwForm.new_password.length < 6) { setPwError('New password must be at least 6 characters'); return; }
    if (pwForm.new_password !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await changePassword({ current_password: pwForm.current_password, new_password: pwForm.new_password });
      setPwSuccess('Password changed successfully');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (e) {
      setPwError(errorMessage(e));
    } finally { setPwLoading(false); }
  };

  const handleSaveStoreName = async () => {
    setStoreError(''); setStoreSuccess('');
    if (!storeName.trim()) { setStoreError('Store name cannot be empty'); return; }
    setStoreNameLoading(true);
    try {
      const res = await updateStoreName({ store_name: storeName.trim() });
      setStoreNameEdit(false);
      setStoreSuccess('Store name updated');
      onStoreName(res.data.store_name); // update App.jsx state
      setTimeout(() => setStoreSuccess(''), 3000);
    } catch (e) {
      setStoreError(errorMessage(e));
    } finally { setStoreNameLoading(false); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800 * 1024) { setStoreError('Logo must be under 800 KB'); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      setLogo(base64);
      localStorage.setItem('store_logo', base64);
      await setSetting('store_logo', base64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setLogo(null);
    localStorage.removeItem('store_logo');
    await setSetting('store_logo', '');
  };

  const saveDefault = async (key, value) => {
    setSavingKey(key);
    setDefaults(d => ({ ...d, [key]: value }));
    await setSetting(key, value).catch(() => {});
    setSavingKey(null);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--card)', borderRadius: 'var(--r-sm)', padding: 4, width: 'fit-content' }}>
        {[
          { id: 'account', label: 'Account Settings' },
          ...(isAdmin ? [{ id: 'store', label: 'Store Settings' }] : []),
          ...(isAdmin ? [{ id: 'integrations', label: 'Integrations' }] : []),
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? '#000' : 'var(--t2)',
              transition: 'all .15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 680 }}>

        {/* ════════════ ACCOUNT SETTINGS ════════════ */}
        {tab === 'account' && <>

          {/* Appearance */}
          <div className="card">
            <SectionHeader Icon={Sun} title="Appearance" />

            <SubLabel text="Theme" />
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {[
                { id: 'dark',  label: 'Dark',  Icon: Moon, desc: 'Easy on the eyes' },
                { id: 'light', label: 'Light', Icon: Sun,  desc: 'Bright & clean' },
              ].map(({ id, label, Icon, desc }) => (
                <button key={id} onClick={() => handleTheme(id)} style={{
                  flex: 1, padding: '14px 12px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                  border: `2px solid ${theme === id ? 'var(--accent)' : 'var(--border)'}`,
                  background: theme === id ? 'var(--accent-c)' : 'var(--card-2)',
                  color: 'var(--t1)', textAlign: 'left', transition: 'all .15s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                    background: id === 'dark' ? '#12121a' : '#f0f2f7',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={17} strokeWidth={1.75} style={{ color: id === 'dark' ? '#00d48f' : '#f59e0b' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 1 }}>{desc}</div>
                  </div>
                  {theme === id && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>

            <SubLabel text="Accent Color" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ACCENTS.map(a => (
                <button key={a.value} title={a.name} onClick={() => handleAccent(a.value)} style={{
                  width: 34, height: 34, borderRadius: 8, border: `2px solid ${accent === a.value ? a.value : 'transparent'}`,
                  background: a.value, cursor: 'pointer',
                  outline: accent === a.value ? `3px solid ${a.value}40` : 'none',
                  outlineOffset: 2, transition: 'all .15s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {accent === a.value && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="card">
            <SectionHeader Icon={Globe} title="Language" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {LANGUAGES.map(l => (
                <button key={l.code} onClick={() => handleLang(l.code)} style={{
                  padding: '10px 20px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
                  border: `2px solid ${lang === l.code ? 'var(--accent)' : 'var(--border)'}`,
                  background: lang === l.code ? 'var(--accent-c)' : 'var(--card-2)',
                  color: lang === l.code ? 'var(--accent)' : 'var(--t1)',
                  transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{l.flag}</span>
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile info */}
          <div className="card">
            <SectionHeader Icon={User} title="Profile" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <InfoRow Icon={User}        label="Username" value={`@${user?.username}`} />
              <InfoRow Icon={Store}       label="Store"    value={user?.store_name} />
              <InfoRow Icon={ShieldCheck} label="Role"     value={isAdmin ? 'Admin' : 'Confirmer'} />
            </div>
            <ProfileContact user={user} />
          </div>

          {/* Change Password */}
          <div className="card">
            <SectionHeader Icon={Lock} title="Change Password" />
            {pwError   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{pwError}</div>}
            {pwSuccess && <div className="alert alert-success" style={{ marginBottom: 14 }}>{pwSuccess}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Current Password</label>
                <input className="form-input" type="password" placeholder="••••••••"
                  value={pwForm.current_password}
                  onChange={e => setPwForm({ ...pwForm, current_password: e.target.value })} />
              </div>
              <div>
                <label className="form-label">New Password</label>
                <input className="form-input" type="password" placeholder="Min. 6 characters"
                  value={pwForm.new_password}
                  onChange={e => setPwForm({ ...pwForm, new_password: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Confirm New Password</label>
                <input className="form-input" type="password" placeholder="Repeat new password"
                  value={pwForm.confirm}
                  onChange={e => setPwForm({ ...pwForm, confirm: e.target.value })}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()} />
              </div>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: 4 }}
                onClick={handleChangePassword} disabled={pwLoading}>
                {pwLoading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </div>
        </>}

        {/* ════════════ STORE SETTINGS (admin only) ════════════ */}
        {tab === 'store' && isAdmin && <>

          {/* Store Identity */}
          <div className="card">
            <SectionHeader Icon={Store} title="Store Identity" />
            {storeError   && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{storeError}</div>}
            {storeSuccess && <div className="alert alert-success" style={{ marginBottom: 14 }}>{storeSuccess}</div>}

            {/* Logo upload */}
            <SubLabel text="Store Logo" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 80, height: 80, borderRadius: 16, border: '2px dashed var(--border)',
                background: 'var(--card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {logo
                  ? <img src={logo} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Store size={28} strokeWidth={1.25} style={{ color: 'var(--t3)' }} />
                }
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={handleLogoUpload} />
                <button className="btn btn-secondary btn-sm"
                  onClick={() => logoInputRef.current.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Upload size={13} strokeWidth={2} />
                  {logo ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logo && (
                  <button className="btn btn-danger btn-sm" onClick={handleRemoveLogo}>
                    Remove
                  </button>
                )}
                <span style={{ fontSize: 11, color: 'var(--t2)' }}>PNG, JPG · max 800 KB</span>
              </div>
            </div>

            {/* Store name */}
            <SubLabel text="Store Name" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {storeNameEdit ? (
                <>
                  <input className="form-input" value={storeName}
                    onChange={e => setStoreName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveStoreName()}
                    style={{ flex: 1 }} autoFocus />
                  <button className="btn btn-primary btn-sm" onClick={handleSaveStoreName} disabled={storeNameLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Check size={13} strokeWidth={2.5} />
                    {storeNameLoading ? 'Saving…' : 'Save'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setStoreNameEdit(false); setStoreName(user?.store_name || ''); }}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, padding: '10px 14px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)', fontWeight: 500 }}>
                    {storeName}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setStoreNameEdit(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Edit2 size={13} strokeWidth={2} />
                    Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Financial */}
          <div className="card">
            <SectionHeader Icon={DollarSign} title="Financial" />

            <SubLabel text="USD → MAD Exchange Rate" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ color: 'var(--t2)', fontSize: 13 }}>1 USD =</span>
              <input className="form-input" type="number" min="1" step="0.1" style={{ width: 90 }}
                value={defaults.usd_rate}
                onChange={e => setDefaults(d => ({ ...d, usd_rate: e.target.value }))}
                onBlur={e => saveDefault('usd_rate', e.target.value)} />
              <span style={{ color: 'var(--t2)', fontSize: 13 }}>MAD</span>
              {savingKey === 'usd_rate' && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saved ✓</span>}
            </div>
            <p style={{ fontSize: 12, color: 'var(--t2)' }}>Used across the Ads page for cost calculations. You can also set it to auto-fetch from the Ads page.</p>

            <div style={{ marginTop: 18 }}>
              <label className="form-label">Starting Capital (MAD)</label>
              <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 8 }}>The initial cash you invested in the business. Used to calculate your real cash balance.</p>
              <input
                className="form-input"
                type="number"
                min="0"
                style={{ width: 160 }}
                value={defaults.base_capital}
                onChange={e => setDefaults(d => ({ ...d, base_capital: e.target.value }))}
                onBlur={e => saveDefault('base_capital', e.target.value)}
                placeholder="0"
              />
              {savingKey === 'base_capital' && <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 10 }}>Saved ✓</span>}
            </div>
          </div>

          {/* Order Defaults */}
          <div className="card">
            <SectionHeader Icon={Package} title="Order Defaults" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              These values pre-fill when creating a new order. You can still change them per order.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'default_packaging', label: 'Packaging', unit: 'MAD' },
              ].map(({ key, label, unit }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 100, fontSize: 13, color: 'var(--t2)', flexShrink: 0 }}>{label}</span>
                  <input className="form-input" type="number" min="0" step="0.5" style={{ width: 90 }}
                    value={defaults[key]}
                    onChange={e => setDefaults(d => ({ ...d, [key]: e.target.value }))}
                    onBlur={e => saveDefault(key, e.target.value)} />
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{unit}</span>
                  {savingKey === key && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saved ✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Stock */}
          <div className="card">
            <SectionHeader Icon={AlertTriangle} title="Stock Alerts" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Default threshold applied to new product variants. Existing variants keep their own setting.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--t2)' }}>Alert when stock drops below</span>
              <input className="form-input" type="number" min="0" style={{ width: 80 }}
                value={defaults.default_low_stock}
                onChange={e => setDefaults(d => ({ ...d, default_low_stock: e.target.value }))}
                onBlur={e => saveDefault('default_low_stock', e.target.value)} />
              <span style={{ fontSize: 13, color: 'var(--t2)' }}>units</span>
              {savingKey === 'default_low_stock' && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saved ✓</span>}
            </div>
          </div>

          {/* Delivery Fees */}
          <div className="card" style={{ opacity: cities.length > 0 ? 0.45 : 1, transition: 'opacity .2s', pointerEvents: cities.length > 0 ? 'none' : 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Truck size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Delivery Fee Fallback</span>
              </div>
              {cities.length > 0 && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', letterSpacing: '.04em' }}>
                  OVERRIDDEN BY CITY LIST
                </span>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              {cities.length > 0
                ? `Not used — your city list (${cities.length} cities) takes priority. Only applies to cities not in the list.`
                : 'Used when a city is not found in the cities list.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'default_delivery_fee', label: 'Delivery fee', unit: 'MAD' },
                { key: 'default_return_fee',   label: 'Return fee',   unit: 'MAD' },
              ].map(({ key, label, unit }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 110, fontSize: 13, color: 'var(--t2)', flexShrink: 0 }}>{label}</span>
                  <input className="form-input" type="number" min="0" step="0.5" style={{ width: 90 }}
                    value={defaults[key]}
                    onChange={e => setDefaults(d => ({ ...d, [key]: e.target.value }))}
                    onBlur={e => saveDefault(key, e.target.value)} />
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{unit}</span>
                  {savingKey === key && <span style={{ fontSize: 12, color: 'var(--accent)' }}>Saved ✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Cities & Delivery Fees */}
          <div className="card">
            <SectionHeader Icon={MapPin} title="Cities & Delivery Fees" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              {cities.length > 0
                ? `${cities.length} cities active — fees are taken from this list. Add the fallback above for any city not listed here.`
                : 'No cities yet. Upload a PDF or add cities manually. Until then, the fallback fees above are used.'}
            </p>

            {/* PDF import */}
            <div style={{ marginBottom: 18, padding: '14px 16px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Import from PDF</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>
                    Upload your carrier's price list PDF — city names and fees are extracted automatically.
                  </div>
                </div>
                <input ref={pdfInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setPdfResult(null); pdfInputRef.current.click(); }}
                  disabled={pdfUploading}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                >
                  <Upload size={13} strokeWidth={2} />
                  {pdfUploading ? 'Processing…' : 'Upload PDF'}
                </button>
              </div>

              {/* Progress bar */}
              {pdfUploading && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>
                      {pdfProgress === 0
                        ? 'Uploading…'
                        : pdfProgress < 95
                          ? pdfPages.total
                            ? `Reading page ${pdfPages.done} of ${pdfPages.total}…`
                            : 'Reading pages…'
                          : pdfProgress < 100 ? 'Saving cities to database…'
                          : 'Done!'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--t2)', fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(pdfProgress)}%
                    </span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pdfProgress}%`,
                      borderRadius: 99,
                      background: 'var(--accent)',
                      transition: 'width 0.4s ease-out',
                    }} />
                  </div>
                </div>
              )}

              {/* Success result */}
              {pdfResult && !pdfUploading && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                  ✓ {pdfResult.total} cities imported — {pdfResult.added} new, {pdfResult.updated} updated
                </div>
              )}
            </div>

            {cityError && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>{cityError}
                <button onClick={() => setCityError('')} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={13} /></button>
              </div>
            )}

            {/* Search + Add button */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} strokeWidth={1.75} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)', pointerEvents: 'none' }} />
                <input className="form-input" placeholder="Search city…" value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  style={{ paddingLeft: 32 }} />
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => { setShowAddCity(true); setCityError(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <Plus size={13} strokeWidth={2.5} />
                Add City
              </button>
            </div>

            {/* Inline add form */}
            {showAddCity && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', padding: '12px 14px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-b)' }}>
                <div style={{ flex: '2 1 140px' }}>
                  <label className="form-label">City Name</label>
                  <input className="form-input" placeholder="e.g. Casablanca" value={newCity.name}
                    onChange={e => setNewCity({ ...newCity, name: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleAddCity()} autoFocus />
                </div>
                <div style={{ flex: '1 1 80px' }}>
                  <label className="form-label">Delivery (MAD)</label>
                  <input className="form-input" type="number" min="0" step="0.5" value={newCity.delivery_fee}
                    onChange={e => setNewCity({ ...newCity, delivery_fee: e.target.value })} />
                </div>
                <div style={{ flex: '1 1 80px' }}>
                  <label className="form-label">Return (MAD)</label>
                  <input className="form-input" type="number" min="0" step="0.5" value={newCity.return_fee}
                    onChange={e => setNewCity({ ...newCity, return_fee: e.target.value })} />
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, paddingBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={newCity.is_casa}
                      onChange={e => setNewCity({ ...newCity, is_casa: e.target.checked })} />
                    Casa Zone
                  </label>
                </div>
                <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAddCity} disabled={cityLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} strokeWidth={2.5} />
                    {cityLoading ? 'Adding…' : 'Add'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddCity(false); setNewCity({ name: '', delivery_fee: '35', return_fee: '7', is_casa: false }); setCityError(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cities table */}
            <div style={{ borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-2)' }}>
                      {[['City', 'left'], ['Delivery', 'right'], ['Return', 'right'], ['', 'right']].map(([h, align]) => (
                        <th key={h} style={{ textAlign: align, padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.06em', position: 'sticky', top: 0, background: 'var(--card-2)', zIndex: 1 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCities.map(city => (
                      <CityRow key={city.id} city={city} onSave={handleUpdateCity} onDelete={handleDeleteCity} />
                    ))}
                  </tbody>
                </table>
                {filteredCities.length === 0 && (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
                    {citySearch ? 'No cities match your search.' : 'No cities yet.'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--t3)' }}>
              {filteredCities.length} of {cities.length} cities
            </div>
          </div>

          {/* ── Warehouses ── */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <SectionHeader Icon={Warehouse} title="Warehouses" />
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={syncingPrices}
                onClick={async () => {
                  setSyncingPrices(true);
                  setSyncPricesDone(false);
                  try { await syncWarehousePrices(); setSyncPricesDone(true); setTimeout(() => setSyncPricesDone(false), 3000); } catch {}
                  setSyncingPrices(false);
                }}
              >
                <RotateCcw size={13} />
                {syncingPrices ? 'Syncing…' : syncPricesDone ? 'Synced!' : 'Sync Prices'}
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Define your warehouses. Stocky will automatically route orders to the warehouse with available stock and the lowest delivery cost.
            </p>

            {whError && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{whError}</div>}

            {/* Warehouse list */}
            {warehouses.length > 0 && (
              <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {warehouses.map(wh => (
                  <div key={wh.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--card-2)', borderRadius: 'var(--r-sm)',
                    border: `1px solid ${wh.is_default ? 'var(--accent)' : 'var(--border)'}`,
                    padding: '10px 14px',
                  }}>
                    {editingWhId === wh.id ? (
                      <>
                        <input
                          className="form-input" placeholder="Name"
                          value={editingWhForm.name}
                          onChange={e => setEditingWhForm(f => ({ ...f, name: e.target.value }))}
                          style={{ flex: 2 }}
                        />
                        <input
                          className="form-input" placeholder="City"
                          value={editingWhForm.city}
                          onChange={e => setEditingWhForm(f => ({ ...f, city: e.target.value }))}
                          style={{ flex: 2 }}
                        />
                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}
                          onClick={async () => {
                            try {
                              const r = await updateWarehouse(wh.id, editingWhForm);
                              setWarehouses(ws => ws.map(w => w.id === wh.id ? r.data : w));
                              setEditingWhId(null);
                            } catch (e) { setWhError('Failed to update warehouse.'); }
                          }}>
                          Save
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}
                          onClick={() => setEditingWhId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {wh.name}
                            {wh.is_default && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--accent-faint)', color: 'var(--accent)', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>Default</span>}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <MapPin size={11} /> {wh.city}
                          </div>
                        </div>
                        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px' }}
                          onClick={() => { setEditingWhId(wh.id); setEditingWhForm({ name: wh.name, city: wh.city }); }}>
                          <Edit2 size={12} />
                        </button>
                        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '5px 10px', color: '#f87171' }}
                          onClick={async () => {
                            if (!window.confirm(`Delete warehouse "${wh.name}"?`)) return;
                            try {
                              await deleteWarehouse(wh.id);
                              setWarehouses(ws => ws.filter(w => w.id !== wh.id));
                            } catch (e) { setWhError(e?.response?.data?.detail || 'Cannot delete this warehouse.'); }
                          }}>
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add warehouse form */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input" placeholder="Warehouse name (e.g. Casa Main)"
                value={newWh.name}
                onChange={e => setNewWh(f => ({ ...f, name: e.target.value }))}
                style={{ flex: 2 }}
              />
              <input
                className="form-input" placeholder="City (e.g. Casablanca)"
                value={newWh.city}
                onChange={e => setNewWh(f => ({ ...f, city: e.target.value }))}
                style={{ flex: 2 }}
              />
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
                disabled={addingWh || !newWh.name.trim() || !newWh.city.trim()}
                onClick={async () => {
                  setAddingWh(true);
                  setWhError('');
                  try {
                    const r = await createWarehouse({ name: newWh.name.trim(), city: newWh.city.trim() });
                    setWarehouses(ws => [...ws, r.data]);
                    setNewWh({ name: '', city: '' });
                  } catch (e) { setWhError(e?.response?.data?.detail || 'Failed to add warehouse.'); }
                  setAddingWh(false);
                }}
              >
                <Plus size={13} />
                {addingWh ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </>}

        {/* ════════════ INTEGRATIONS (admin only) ════════════ */}
        {tab === 'integrations' && isAdmin && <>

          {/* ── Leads ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>Leads</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Website Integration */}
          <div className="card">
            <SectionHeader Icon={Link} title="Website Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Connect your website's order form to Stocky. When a customer submits an order, a WhatsApp confirmation is sent automatically.
            </p>

            <SubLabel text="Webhook URL" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12,
                color: 'var(--t1)', wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                {webhookUrl || 'Loading…'}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(webhookUrl)}
                disabled={!webhookUrl}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                title="Copy URL"
              >
                <Copy size={13} strokeWidth={2} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <SubLabel text="Expected JSON format" />
            <pre style={{
              background: 'var(--card-2)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', padding: '12px 14px',
              fontSize: 12, color: 'var(--t2)', overflowX: 'auto',
              marginBottom: 18, lineHeight: 1.6,
            }}>{`POST ${window.location.origin}/api/leads/inbound?api_key=YOUR_KEY
Content-Type: application/json

{
  "customer_name": "Ahmed Benali",
  "customer_phone": "+212600000000",
  "customer_city": "Casablanca",
  "customer_address": "123 Rue Hassan II",
  "customer_email": "ahmed@example.com",
  "notes": "Fragile item",
  "items": [
    { "product_name": "Cap Classic", "quantity": 2 }
  ]
}`}</pre>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRotateKey}
                disabled={rotatingKey}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCcw size={13} strokeWidth={2} />
                {rotatingKey ? 'Rotating…' : 'Rotate Key'}
              </button>
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>
                Rotating the key invalidates the old one — update your website's config.
              </span>
            </div>
          </div>

          {/* WhatsApp Bot */}
          <WhatsAppBotCard />

          {/* ── Delivery Companies ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>Delivery Companies</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Olivraison Integration */}
          <div className="card">
            <SectionHeader Icon={Zap} title="Olivraison Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Connect Olivraison to send orders directly and receive automatic delivery status updates.
            </p>

            <SubLabel text="API Credentials" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div>
                <label className="form-label">API Key</label>
                <input className="form-input" type="password" placeholder="api-U2FsdGVkX1..."
                  value={oliv.api_key} onChange={e => setOliv(o => ({ ...o, api_key: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Secret Key</label>
                <input className="form-input" type="password" placeholder="U2FsdGVkX1..."
                  value={oliv.secret_key} onChange={e => setOliv(o => ({ ...o, secret_key: e.target.value }))} />
              </div>
            </div>

            <SubLabel text="Pickup Address (your store)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="e.g. Casablanca"
                    value={oliv.pickup_city} onChange={e => setOliv(o => ({ ...o, pickup_city: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+212..."
                    value={oliv.pickup_phone} onChange={e => setOliv(o => ({ ...o, pickup_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label">Street Address</label>
                <input className="form-input" placeholder="e.g. 12 Rue Mohammed V"
                  value={oliv.pickup_street} onChange={e => setOliv(o => ({ ...o, pickup_street: e.target.value }))} />
              </div>
            </div>

            <SubLabel text="Webhook URL (paste in Olivraison settings)" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <div style={{ flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                {`${window.location.origin}/api/olivraison/webhook`}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/olivraison/webhook`)}>
                <Copy size={13} strokeWidth={2} /> Copy
              </button>
            </div>

            <button className="btn btn-primary" onClick={handleSaveOlivraison} disabled={olivSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} strokeWidth={2.5} />
              {olivSaving ? 'Saving…' : olivSaved ? 'Saved ✓' : 'Save Olivraison Settings'}
            </button>
          </div>

          {/* Forcelog Integration */}
          <div className="card">
            <SectionHeader Icon={Truck} title="Forcelog Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Connect Forcelog to send orders directly and receive automatic delivery status updates.
            </p>

            <SubLabel text="API Key" />
            <div style={{ marginBottom: 18 }}>
              <input className="form-input" placeholder="Forcelog API Key"
                value={forcelogKey} onChange={e => setForcelogKey(e.target.value)} />
            </div>

            <SubLabel text="Webhook Secret" />
            <div style={{ marginBottom: 18 }}>
              <input className="form-input" placeholder="Forcelog Webhook Secret"
                value={forcelogSecret} onChange={e => setForcelogSecret(e.target.value)} />
            </div>

            <SubLabel text="Webhook URL — paste this in your Forcelog dashboard" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)',
                fontFamily: 'monospace', fontSize: 12, color: 'var(--t1)',
                wordBreak: 'break-all', border: '1px solid var(--border)',
              }}>
                {`${window.location.origin}/api/forcelog/webhook`}
              </div>
              <button className="btn btn-secondary btn-sm"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/forcelog/webhook`)}>
                Copy
              </button>
            </div>

            <SubLabel text="Pickup Address (your store)" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">City</label>
                  <input className="form-input" placeholder="e.g. Casablanca"
                    value={forcelogPickupCity} onChange={e => setForcelogPickupCity(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Phone</label>
                  <input className="form-input" placeholder="+212..."
                    value={forcelogPickupPhone} onChange={e => setForcelogPickupPhone(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="form-label">Street Address</label>
                <input className="form-input" placeholder="e.g. 12 Rue Mohammed V"
                  value={forcelogPickupAddress} onChange={e => setForcelogPickupAddress(e.target.value)} />
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleSaveForcelog} disabled={forcelogSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={14} strokeWidth={2.5} />
              {forcelogSaving ? 'Saving…' : forcelogSaved ? 'Saved ✓' : 'Save Forcelog Settings'}
            </button>
          </div>

          {/* ── E-commerce Platforms ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '.08em', textTransform: 'uppercase', flexShrink: 0 }}>E-commerce Platforms</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* YouCan Integration */}
          <div className="card">
            <SectionHeader Icon={Link} title="YouCan Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Captures customer info from the YouCan checkout page and sends it to Stocky as a lead.
            </p>

            <SubLabel text="Step 1 — Copy the script" />
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <pre style={{
                background: 'var(--card-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', padding: '12px 14px',
                fontSize: 11, fontFamily: 'monospace', color: 'var(--t2)',
                overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 160, overflow: 'auto', margin: 0,
              }}>
                {youcanScript || 'Loading…'}
              </pre>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(youcanScript).then(() => {
                    setScriptCopied(true);
                    setTimeout(() => setScriptCopied(false), 2000);
                  });
                }}
                disabled={!youcanScript}
                style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <Copy size={12} strokeWidth={2} />
                {scriptCopied ? 'Copied!' : 'Copy Script'}
              </button>
            </div>

            <SubLabel text="Step 2 — Paste it in YouCan" />
            <ol style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 2, paddingLeft: 18, marginBottom: 0 }}>
              <li>Go to your <strong style={{ color: 'var(--t1)' }}>YouCan dashboard</strong></li>
              <li>Open <strong style={{ color: 'var(--t1)' }}>Themes → Edit theme → Custom Scripts</strong></li>
              <li>Paste the script above and save — done!</li>
            </ol>
          </div>

          {/* Shopify Integration */}
          <div className="card">
            <SectionHeader Icon={Link} title="Shopify Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Connect your Shopify store to Stocky. New orders will automatically appear as leads.
            </p>

            <SubLabel text="Step 1 — Copy your webhook URL" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12,
                color: 'var(--t1)', wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                {shopifyWebhookUrl || 'Loading…'}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(shopifyWebhookUrl)}
                disabled={!shopifyWebhookUrl}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              >
                <Copy size={13} strokeWidth={2} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <SubLabel text="Step 2 — Paste it in Shopify" />
            <ol style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 2, paddingLeft: 18, marginBottom: 0 }}>
              <li>Go to your <strong style={{ color: 'var(--t1)' }}>Shopify admin</strong></li>
              <li>Open <strong style={{ color: 'var(--t1)' }}>Settings → Notifications → Webhooks</strong></li>
              <li>Click <strong style={{ color: 'var(--t1)' }}>Create webhook</strong></li>
              <li>Set event to <strong style={{ color: 'var(--accent)' }}>Order creation</strong> and format to <strong style={{ color: 'var(--accent)' }}>JSON</strong></li>
              <li>Paste the URL above and click Save</li>
            </ol>
          </div>

          {/* WooCommerce Integration */}
          <div className="card">
            <SectionHeader Icon={Link} title="WooCommerce Integration" />
            <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 18 }}>
              Connect your WooCommerce store to Stocky. New orders will automatically appear as leads.
            </p>

            <SubLabel text="Step 1 — Copy your webhook URL" />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
              <div style={{
                flex: 1, padding: '9px 12px', background: 'var(--card-2)', borderRadius: 'var(--r-sm)',
                border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: 12,
                color: 'var(--t1)', wordBreak: 'break-all', lineHeight: 1.5,
              }}>
                {wooWebhookUrl || 'Loading…'}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(wooWebhookUrl)}
                disabled={!wooWebhookUrl}
                style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              >
                <Copy size={13} strokeWidth={2} />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <SubLabel text="Step 2 — Paste it in WooCommerce" />
            <ol style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 2, paddingLeft: 18, marginBottom: 0 }}>
              <li>Go to your <strong style={{ color: 'var(--t1)' }}>WordPress dashboard</strong></li>
              <li>Open <strong style={{ color: 'var(--t1)' }}>WooCommerce → Settings → Advanced → Webhooks</strong></li>
              <li>Click <strong style={{ color: 'var(--t1)' }}>Add Webhook</strong></li>
              <li>Set topic to <strong style={{ color: 'var(--accent)' }}>Order created</strong></li>
              <li>Paste the URL above in the Delivery URL field and click Save</li>
            </ol>
          </div>

        </>}

      </div>
    </div>
  );
}

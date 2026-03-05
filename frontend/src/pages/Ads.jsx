import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Calculator, RefreshCw } from 'lucide-react';
import {
  getAdPlatforms, createAdPlatform, deleteAdPlatform,
  createAdCampaign, updateAdCampaign, deleteAdCampaign,
  getAdCostPerOrder, getSetting, setSetting,
} from '../api';
import ErrorExplain from '../components/ErrorExplain';
import { validateAmount, fieldErrorStyle } from '../utils/validate';

// ── Predefined platform catalogue ──────────────────────────
const PLATFORM_CATALOGUE = [
  { name: 'facebook', label: 'Facebook / Meta', color: '#1877f2' },
  { name: 'tiktok',   label: 'TikTok',          color: '#010101' },
  { name: 'google',   label: 'Google / YouTube', color: '#ea4335' },
  { name: 'snapchat', label: 'Snapchat',         color: '#fffc00' },
  { name: 'pinterest',label: 'Pinterest',        color: '#e60023' },
  { name: 'instagram',label: 'Instagram',        color: '#e1306c' },
  { name: 'twitter',  label: 'X / Twitter',      color: '#000000' },
  { name: 'other',    label: 'Other',            color: '#8892b0' },
];

// ── Platform brand logos (Simple Icons paths) ───────────────
const PLATFORM_ICON_DATA = {
  facebook: {
    bg: '#1877f2',
    viewBox: '0 0 24 24',
    d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
    fill: '#fff',
  },
  tiktok: {
    bg: '#010101',
    viewBox: '0 0 24 24',
    d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
    fill: '#fff',
  },
  google: {
    bg: '#fff',
    viewBox: '0 0 24 24',
    // multicolor — rendered separately below
    d: null,
  },
  snapchat: {
    bg: '#FFFC00',
    viewBox: '0 0 24 24',
    d: 'M12.166 1.783C11.424 1.79 9.402 1.99 8.147 3.84c-.66.977-.553 2.137-.553 2.98L7.55 7.578c-.18.01-.37.016-.57.016-.508 0-1.016-.063-1.508-.188a.264.264 0 0 0-.297.14.263.263 0 0 0 .023.317c.351.39.828.684 1.34.83.046.013.09.026.136.04-.198.307-.404.59-.614.87-.437.585-.877 1.17-1.21 1.823-.332.653-.523 1.384-.523 2.046 0 .27.025.52.07.749a6.83 6.83 0 0 1-2.143-.27c-.094-.024-.19.014-.24.097a.25.25 0 0 0 .04.297c.46.5 1.165.89 1.96 1.047.086.016.177.03.27.042a.47.47 0 0 1-.025.186c-.13.35-.28.697-.43 1.052-.157.37-.284.75-.36 1.136-.116.585.03 1.148.4 1.545.37.397.91.614 1.5.614.17 0 .34-.02.51-.06 1.064-.246 1.987-.397 2.673-.397h.008c.54 0 1.04.097 1.476.29.17.078.335.165.497.254.482.27.986.55 1.707.55.72 0 1.222-.28 1.703-.55.163-.09.328-.176.497-.253.437-.194.937-.29 1.476-.29h.01c.686 0 1.608.15 2.672.397.17.04.34.06.51.06.59 0 1.13-.217 1.5-.614.37-.397.517-.96.4-1.545-.075-.387-.2-.768-.358-1.136-.15-.355-.3-.7-.43-1.053a.47.47 0 0 1-.025-.186c.093-.01.184-.026.27-.042.795-.157 1.5-.547 1.96-1.047a.25.25 0 0 0 .04-.297.263.263 0 0 0-.24-.097 6.83 6.83 0 0 1-2.143.27c.045-.23.07-.48.07-.75 0-.66-.19-1.392-.523-2.045-.333-.653-.773-1.238-1.21-1.823-.21-.28-.416-.563-.614-.87.046-.014.09-.027.135-.04.513-.147.99-.44 1.34-.83a.263.263 0 0 0 .024-.318.264.264 0 0 0-.297-.14c-.492.126-1 .19-1.508.19-.2 0-.39-.006-.57-.017l-.044-.757c0-.843.107-2.003-.553-2.98C14.6 1.99 12.91 1.776 12.166 1.783z',
    fill: '#000',
  },
  pinterest: {
    bg: '#E60023',
    viewBox: '0 0 24 24',
    d: 'M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z',
    fill: '#fff',
  },
  instagram: {
    bg: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)',
    viewBox: '0 0 24 24',
    d: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.74 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
    fill: '#fff',
  },
  twitter: {
    bg: '#000',
    viewBox: '0 0 24 24',
    d: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 7.184L18.901 1.153zm-1.653 19.547h2.04L6.875 3.239H4.69L17.248 20.7z',
    fill: '#fff',
  },
};

function PlatformIcon({ name, size = 32 }) {
  const r = Math.round(size * 0.25);
  const data = PLATFORM_ICON_DATA[name];

  // Google — multicolor SVG
  if (name === 'google') {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ borderRadius: r, flexShrink: 0 }}>
        <rect width="32" height="32" rx={r} fill="#fff"/>
        <path d="M28.2 16.3c0-.9-.08-1.76-.22-2.6H16v4.92h6.84c-.3 1.65-1.18 3.05-2.52 3.98v3.3h4.08c2.38-2.19 3.76-5.42 3.76-9.6z" fill="#4285f4"/>
        <path d="M16 29c3.44 0 6.33-1.14 8.44-3.1l-4.08-3.3c-1.14.76-2.6 1.22-4.36 1.22-3.35 0-6.18-2.26-7.19-5.3H4.58v3.32A12.97 12.97 0 0 0 16 29z" fill="#34a853"/>
        <path d="M8.81 18.52A7.84 7.84 0 0 1 8.4 16c0-.88.15-1.74.41-2.52V10.16H4.58A12.97 12.97 0 0 0 3 16c0 2.1.5 4.08 1.58 5.84l4.23-3.32z" fill="#fbbc04"/>
        <path d="M16 7.22c1.88 0 3.57.65 4.9 1.92l3.66-3.66C22.33 3.26 19.44 2 16 2A12.97 12.97 0 0 0 4.58 10.16l4.23 3.32C9.82 9.48 12.65 7.22 16 7.22z" fill="#ea4335"/>
      </svg>
    );
  }

  if (!data) {
    // fallback "Other"
    return (
      <div style={{ width: size, height: size, borderRadius: r, background: '#2d3248', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#8892b0" strokeWidth="1.5"/>
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" stroke="#8892b0" strokeWidth="1.5"/>
        </svg>
      </div>
    );
  }

  const isGradient = data.bg.startsWith('linear');
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: data.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size * 0.65} height={size * 0.65} viewBox={data.viewBox} fill={data.fill}>
        <path d={data.d}/>
      </svg>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const daysBetween = (start, end) => {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 1);
};

const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

const platformTotal = (campaigns, usdRate) =>
  campaigns.reduce((sum, c) => {
    const days = daysBetween(c.start_date, c.end_date);
    return sum + days * c.daily_rate_usd * usdRate;
  }, 0);

// ── Component ───────────────────────────────────────────────
export default function Ads() {
  const [platforms, setPlatforms] = useState([]);
  const [usdRate, setUsdRate] = useState(10);
  const [rateInput, setRateInput] = useState('10');
  const [rateMode, setRateMode] = useState('manual'); // 'manual' | 'market'
  const [marketRate, setMarketRate] = useState(null);
  const [marketDate, setMarketDate] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [campaignFieldErrors, setCampaignFieldErrors] = useState({});

  // Which platform cards are expanded
  const [expanded, setExpanded] = useState({});

  // Add platform modal
  const [showAddPlatform, setShowAddPlatform] = useState(false);

  // Add/Edit campaign modal
  const [campaignModal, setCampaignModal] = useState(null); // { platformId, campaign? }
  const [campaignForm, setCampaignForm] = useState({ daily_rate_usd: '', start_date: today(), end_date: '' });

  // Cost calculator
  const [calcStart, setCalcStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [calcEnd, setCalcEnd] = useState(today());
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);

  const fetchMarketRate = async () => {
    setFetchingRate(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const rate = parseFloat(data.rates?.MAD);
      if (!rate) throw new Error('No MAD rate');
      const date = data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
        : today();
      setMarketRate(rate);
      setMarketDate(date);
      setUsdRate(rate);
      setRateInput(fmt(rate));
      await setSetting('usd_rate', rate);
    } catch {
      setError('Could not fetch market rate. Check your connection.');
    } finally {
      setFetchingRate(false);
    }
  };

  const load = async () => {
    try {
      const [pRes, rateRes, modeRes] = await Promise.all([
        getAdPlatforms(),
        getSetting('usd_rate').catch(() => ({ data: { value: '10' } })),
        getSetting('usd_rate_mode').catch(() => ({ data: { value: 'manual' } })),
      ]);
      setPlatforms(pRes.data);
      const rate = parseFloat(rateRes.data?.value || '10') || 10;
      const mode = modeRes.data?.value || 'manual';
      setUsdRate(rate);
      setRateInput(String(rate));
      setRateMode(mode);
      if (mode === 'market') {
        // Refresh market rate on load if mode is market
        fetchMarketRate();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveRate = async () => {
    const rate = parseFloat(rateInput) || 10;
    setUsdRate(rate);
    await setSetting('usd_rate', rate);
  };

  const toggleRateMode = async (mode) => {
    setRateMode(mode);
    await setSetting('usd_rate_mode', mode);
    if (mode === 'market') {
      fetchMarketRate();
    }
  };

  // ── Platform actions ──
  const addPlatform = async (p) => {
    try {
      await createAdPlatform({ name: p.name, label: p.label, color: p.color });
      setShowAddPlatform(false);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error adding platform'); }
  };

  const removePlatform = async (id) => {
    if (!confirm('Remove this platform and all its campaigns?')) return;
    try {
      await deleteAdPlatform(id);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error removing platform'); }
  };

  // ── Campaign actions ──
  const openNewCampaign = (platformId) => {
    setCampaignModal({ platformId });
    setCampaignForm({ daily_rate_usd: '', start_date: today(), end_date: '' });
    setCampaignFieldErrors({});
    setError('');
  };

  const openEditCampaign = (platformId, campaign) => {
    setCampaignModal({ platformId, campaign });
    setCampaignForm({
      daily_rate_usd: String(campaign.daily_rate_usd),
      start_date: campaign.start_date.slice(0, 10),
      end_date: campaign.end_date ? campaign.end_date.slice(0, 10) : '',
    });
    setCampaignFieldErrors({});
    setError('');
  };

  const saveCampaign = async () => {
    setError('');
    const rateErr = validateAmount(campaignForm.daily_rate_usd);
    if (rateErr) { setCampaignFieldErrors({ daily_rate_usd: rateErr }); return; }
    setCampaignFieldErrors({});
    try {
      const payload = {
        platform_id: campaignModal.platformId,
        daily_rate_usd: parseFloat(campaignForm.daily_rate_usd),
        start_date: campaignForm.start_date,
        end_date: campaignForm.end_date || null,
      };
      if (campaignModal.campaign) {
        await updateAdCampaign(campaignModal.campaign.id, payload);
      } else {
        await createAdCampaign(payload);
      }
      setCampaignModal(null);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error saving campaign'); }
  };

  const removeCampaign = async (id) => {
    if (!confirm('Delete this campaign?')) return;
    try {
      await deleteAdCampaign(id);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error deleting campaign'); }
  };

  const toggleCampaign = async (platform, campaign) => {
    const isRunning = !campaign.end_date;
    try {
      await updateAdCampaign(campaign.id, {
        platform_id: platform.id,
        daily_rate_usd: campaign.daily_rate_usd,
        start_date: campaign.start_date.slice(0, 10),
        end_date: isRunning ? today() : null,  // stop → set today, resume → clear
      });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error updating campaign'); }
  };

  // ── Cost calculator ──
  const runCalc = async () => {
    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await getAdCostPerOrder(calcStart, calcEnd);
      setCalcResult(res.data);
    } catch (e) { setError(e.response?.data?.detail || 'Error calculating'); }
    finally { setCalcLoading(false); }
  };

  // ── Summary totals ──
  const grandTotalMAD = platforms.reduce((sum, p) => sum + platformTotal(p.campaigns, usdRate), 0);
  const activeCount = platforms.reduce((sum, p) => sum + p.campaigns.filter(c => !c.end_date).length, 0);

  // Already-added platform names (to filter catalogue)
  const addedNames = new Set(platforms.map(p => p.name));

  if (loading) return <div className="loading">Loading ads...</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Ads</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowAddPlatform(true)}>
            <Plus size={14} strokeWidth={2} style={{ marginRight: 4 }} />
            Add Platform
          </button>
        </div>
      </div>

      {/* Exchange rate bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {/* Toggle */}
          <div style={{ display: 'flex', background: '#12121a', borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              onClick={() => toggleRateMode('manual')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: rateMode === 'manual' ? '#2d3248' : 'transparent',
                color: rateMode === 'manual' ? '#fff' : '#8892b0',
                transition: 'all 0.15s',
              }}
            >Manual</button>
            <button
              onClick={() => toggleRateMode('market')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: rateMode === 'market' ? '#00d48f22' : 'transparent',
                color: rateMode === 'market' ? '#00d48f' : '#8892b0',
                transition: 'all 0.15s',
              }}
            >● Market Price</button>
          </div>

          {/* Rate display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#8892b0', fontSize: 13 }}>1 USD =</span>
            {rateMode === 'manual' ? (
              <input
                className="form-input"
                type="number" min="1" step="0.1"
                style={{ width: 75, padding: '6px 10px' }}
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                onBlur={saveRate}
                onKeyDown={e => e.key === 'Enter' && saveRate()}
              />
            ) : (
              <span style={{ fontWeight: 700, fontSize: 16, color: '#00d48f' }}>
                {fetchingRate ? '…' : fmt(usdRate)}
              </span>
            )}
            <span style={{ color: '#8892b0', fontSize: 13 }}>MAD</span>
          </div>

          {/* Market mode extras */}
          {rateMode === 'market' && (
            <>
              {marketDate && !fetchingRate && (
                <span style={{ fontSize: 12, color: '#8892b0' }}>as of {marketDate}</span>
              )}
              <button
                className="btn btn-secondary btn-sm"
                onClick={fetchMarketRate}
                disabled={fetchingRate}
                style={{ display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <RefreshCw size={12} strokeWidth={2} style={{ animation: fetchingRate ? 'spin 1s linear infinite' : 'none' }} />
                {fetchingRate ? 'Fetching…' : 'Refresh'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && <ErrorExplain message={error} page="Ads" />}
      {success && <div className="alert alert-success">{success}<button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      {/* Global summary */}
      {platforms.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Spent (All Time)</div>
            <div className="stat-value">{fmt(grandTotalMAD)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD</span></div>
            <div className="stat-sub">{platforms.length} platform{platforms.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Campaigns</div>
            <div className="stat-value">{activeCount}</div>
            <div className="stat-sub">currently running</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Exchange Rate</div>
            <div className="stat-value">{fmt(usdRate)} <span style={{ fontSize: 14, color: '#8892b0' }}>MAD/USD</span></div>
            <div className="stat-sub" style={{ color: rateMode === 'market' ? '#00d48f' : '#8892b0' }}>
              {rateMode === 'market' ? `live · ${marketDate || '…'}` : 'manual'}
            </div>
          </div>
        </div>
      )}

      {/* Cost per order calculator */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Calculator size={16} strokeWidth={1.75} style={{ color: '#00d48f' }} />
          <span style={{ fontWeight: 600 }}>Cost Per Order Calculator</span>
          <span style={{ fontSize: 12, color: '#8892b0', marginLeft: 4 }}>uses order date, not upload date</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={calcStart} onChange={e => setCalcStart(e.target.value)} style={{ width: 150 }} />
          </div>
          <div>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={calcEnd} onChange={e => setCalcEnd(e.target.value)} style={{ width: 150 }} />
          </div>
          <button className="btn btn-primary" onClick={runCalc} disabled={calcLoading}>
            {calcLoading ? 'Calculating...' : 'Calculate'}
          </button>
        </div>

        {calcResult && (
          <div style={{ marginTop: 16, padding: 16, background: '#0f1117', borderRadius: 10, border: '1px solid #2d3248' }}>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 12, color: '#8892b0' }}>Orders in period</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{calcResult.order_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8892b0' }}>Total Ad Spend</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>${fmt(calcResult.total_usd)} <span style={{ fontSize: 13, color: '#8892b0' }}>USD</span></div>
                <div style={{ fontSize: 13, color: '#8892b0' }}>{fmt(calcResult.total_usd * usdRate)} MAD</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#8892b0' }}>Cost per Order</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#00d48f' }}>
                  {calcResult.order_count > 0 ? fmt(calcResult.total_usd * usdRate / calcResult.order_count) : '—'} <span style={{ fontSize: 13, color: '#8892b0' }}>MAD</span>
                </div>
              </div>
            </div>
            {calcResult.breakdown.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {calcResult.breakdown.map(b => (
                  <div key={b.platform} style={{ background: '#1d1d27', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 13 }}>{b.platform}</span>
                    <span style={{ fontSize: 13, color: '#8892b0' }}>${fmt(b.total_usd)}</span>
                  </div>
                ))}
              </div>
            )}
            {calcResult.order_count === 0 && (
              <div style={{ fontSize: 13, color: '#f59e0b' }}>No orders found in this date range (based on order date)</div>
            )}
          </div>
        )}
      </div>

      {/* Platform cards */}
      {platforms.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Megaphone size={40} strokeWidth={1} style={{ margin: '0 auto 12px', color: '#8892b0' }} />
            <h3>No platforms yet</h3>
            <p>Click "Add Platform" to start tracking your ad spend</p>
          </div>
        </div>
      ) : (
        platforms.map(platform => {
          const totalMAD = platformTotal(platform.campaigns, usdRate);
          const running = platform.campaigns.find(c => !c.end_date);
          const isExpanded = expanded[platform.id] !== false; // default open

          return (
            <div key={platform.id} className="card" style={{ marginBottom: 16, borderTop: `3px solid ${platform.color}` }}>
              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: isExpanded ? 16 : 0 }}>
                <PlatformIcon name={platform.name} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{platform.label}</div>
                  <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}>
                    {fmt(totalMAD)} MAD total ·{' '}
                    {running
                      ? <span style={{ color: '#00d48f' }}>● ${fmt(running.daily_rate_usd)}/day running</span>
                      : <span style={{ color: '#8892b0' }}>no active campaign</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => openNewCampaign(platform.id)}>
                    + Campaign
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(e => ({ ...e, [platform.id]: !isExpanded }))}>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removePlatform(platform.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Campaigns list */}
              {isExpanded && (
                platform.campaigns.length === 0 ? (
                  <div style={{ color: '#8892b0', fontSize: 13, padding: '8px 0' }}>
                    No campaigns yet. Click "+ Campaign" to add one.
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Start</th>
                          <th>Days</th>
                          <th>Rate (USD/day)</th>
                          <th>Cost since start</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {platform.campaigns.map(c => {
                          const isRunning = !c.end_date;
                          const days = daysBetween(c.start_date, c.end_date);
                          const totalMAD = days * c.daily_rate_usd * usdRate;
                          return (
                            <tr key={c.id}>
                              <td>
                                <button
                                  onClick={() => toggleCampaign(platform, c)}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                    padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                                    background: isRunning ? '#0d2a1e' : '#2d3248',
                                    color: isRunning ? '#00d48f' : '#8892b0',
                                  }}
                                >
                                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: isRunning ? '#00d48f' : '#8892b0', display: 'inline-block' }} />
                                  {isRunning ? 'Running · Stop' : 'Stopped · Resume'}
                                </button>
                              </td>
                              <td style={{ fontSize: 12, color: '#8892b0' }}>
                                {c.start_date.slice(0, 10)}
                                {!isRunning && (
                                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>→ {c.end_date.slice(0, 10)}</div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                {days}
                                <span style={{ fontSize: 11, color: '#8892b0', marginLeft: 4 }}>days</span>
                              </td>
                              <td style={{ color: '#60a5fa' }}>${fmt(c.daily_rate_usd)}</td>
                              <td>
                                <div style={{ fontWeight: 700, fontSize: 15, color: '#f59e0b' }}>{fmt(totalMAD)} MAD</div>
                                <div style={{ fontSize: 11, color: '#8892b0' }}>${fmt(days * c.daily_rate_usd)} USD</div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => openEditCampaign(platform.id, c)}>
                                    <Edit2 size={12} />
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => removeCampaign(c.id)}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          );
        })
      )}

      {/* Add Platform Modal */}
      {showAddPlatform && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add Platform</h2>
              <button className="btn-icon" onClick={() => setShowAddPlatform(false)}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {PLATFORM_CATALOGUE.filter(p => !addedNames.has(p.name)).map(p => (
                  <button
                    key={p.name}
                    onClick={() => addPlatform(p)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 8, border: '1px solid #2d3248',
                      background: '#1d1d27', cursor: 'pointer', color: 'inherit',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = p.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = '#2d3248'}
                  >
                    <PlatformIcon name={p.name} size={28} />
                    <span style={{ fontWeight: 500 }}>{p.label}</span>
                  </button>
                ))}
                {PLATFORM_CATALOGUE.every(p => addedNames.has(p.name)) && (
                  <div style={{ color: '#8892b0', textAlign: 'center', padding: 16 }}>All platforms already added</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddPlatform(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Campaign Modal */}
      {campaignModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{campaignModal.campaign ? 'Edit Campaign' : '+ New Campaign'}</h2>
              <button className="btn-icon" onClick={() => { setCampaignModal(null); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Daily Rate (USD) *</label>
                <input className="form-input" type="number" min="0" step="0.5" placeholder="e.g. 5"
                  value={campaignForm.daily_rate_usd}
                  onChange={e => setCampaignForm({ ...campaignForm, daily_rate_usd: e.target.value })} />
                {campaignFieldErrors.daily_rate_usd && <div style={fieldErrorStyle}>{campaignFieldErrors.daily_rate_usd}</div>}
                {campaignForm.daily_rate_usd && parseFloat(campaignForm.daily_rate_usd) > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#8892b0' }}>
                    ≈ {fmt(parseFloat(campaignForm.daily_rate_usd) * usdRate)} MAD/day
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="form-label">Start Date *</label>
                  <input className="form-input" type="date" value={campaignForm.start_date}
                    onChange={e => setCampaignForm({ ...campaignForm, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">End Date <span style={{ color: '#8892b0', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" type="date" value={campaignForm.end_date}
                    onChange={e => setCampaignForm({ ...campaignForm, end_date: e.target.value })} />
                </div>
              </div>
              {!campaignForm.end_date && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#8892b0', background: '#1d1d27', padding: '8px 12px', borderRadius: 6 }}>
                  No end date = runs until you add a new campaign (auto-closes this one).
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setCampaignModal(null); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCampaign}>
                {campaignModal.campaign ? 'Save Changes' : 'Add Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

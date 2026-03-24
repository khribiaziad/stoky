import { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Edit2, ChevronDown, ChevronUp, Calculator, RefreshCw, Zap, Unlink } from 'lucide-react';
import {
  getAdPlatforms, createAdPlatform, deleteAdPlatform,
  createAdCampaign, updateAdCampaign, deleteAdCampaign,
  getAdCostPerOrder, getSetting, setSetting,
  getMetaStatus, connectMeta, disconnectMeta, syncMeta,
  getProducts,
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
  { name: 'other',    label: 'Other',            color: 'var(--t2)' },
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

// ── Metric cell ────────────────────────────────────────────
function MetricCell({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 52 }}>
      <span style={{ fontSize: 10, color: 'var(--t2)', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: color || 'var(--t1)', marginTop: 2 }}>
        {value}
      </span>
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

// ── Normalize campaigns for display ───────────────────────
function normalizeCampaigns(platform, metaData, usdRate) {
  // Facebook: prefer synced data when available
  if (platform.name === 'facebook' && metaData?.campaigns?.length > 0) {
    return metaData.campaigns.map(c => {
      const spendMAD = metaData.currency === 'USD' ? c.spend * usdRate : c.spend;
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : null;
      const cpc = c.clicks > 0 ? spendMAD / c.clicks : null;
      return {
        displayName: c.name,
        status: 'active',
        spendMAD,
        impressions: c.impressions,
        clicks: c.clicks,
        ctr,
        cpc,
        localId: null,
        dailyRateUsd: null,
        startDate: null,
        endDate: null,
        linkKey: `fb__${c.name}`,
      };
    });
  }
  // All other platforms (or Facebook before first sync): local campaigns
  return platform.campaigns.map((c, i) => {
    const days = daysBetween(c.start_date, c.end_date);
    return {
      displayName: `Entry ${i + 1}`,
      status: !c.end_date ? 'active' : 'paused',
      spendMAD: days * c.daily_rate_usd * usdRate,
      impressions: null,
      clicks: null,
      ctr: null,
      cpc: null,
      localId: c.id,
      dailyRateUsd: c.daily_rate_usd,
      startDate: c.start_date.slice(0, 10),
      endDate: c.end_date ? c.end_date.slice(0, 10) : null,
      linkKey: `${platform.name}__${c.id}`,
    };
  });
}

// ── Component ───────────────────────────────────────────────
export default function Ads() {
  // ── Existing state (unchanged) ──
  const [platforms, setPlatforms] = useState([]);
  const [usdRate, setUsdRate] = useState(10);
  const [rateInput, setRateInput] = useState('10');
  const [rateMode, setRateMode] = useState('manual');
  const [marketRate, setMarketRate] = useState(null);
  const [marketDate, setMarketDate] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [campaignFieldErrors, setCampaignFieldErrors] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [campaignModal, setCampaignModal] = useState(null);
  const [campaignForm, setCampaignForm] = useState({ daily_rate_usd: '', start_date: today(), end_date: '' });
  const [calcStart, setCalcStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [calcEnd, setCalcEnd] = useState(today());
  const [calcResult, setCalcResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [metaStatus, setMetaStatus] = useState(null);
  const [metaForm, setMetaForm] = useState({ token: '', accountId: '' });
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaConnectError, setMetaConnectError] = useState('');
  const [metaShowForm, setMetaShowForm] = useState(false);
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaData, setMetaData] = useState(null);
  const [metaSyncStart, setMetaSyncStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [metaSyncEnd, setMetaSyncEnd] = useState(today());

  // ── New state ──
  const [budgetEdit, setBudgetEdit] = useState(null); // { id, value, platformId, startDate, endDate }
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [linkModal, setLinkModal] = useState(null);   // { key }
  const [linkProductSel, setLinkProductSel] = useState('');
  const [products, setProducts] = useState([]);
  const [campaignLinks, setCampaignLinks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stoky_campaign_links') || '{}'); }
    catch { return {}; }
  });

  // ── Existing handlers (unchanged) ──
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
      const [pRes, rateRes, modeRes, metaRes] = await Promise.all([
        getAdPlatforms(),
        getSetting('usd_rate').catch(() => ({ data: { value: '10' } })),
        getSetting('usd_rate_mode').catch(() => ({ data: { value: 'manual' } })),
        getMetaStatus().catch(() => ({ data: { connected: false } })),
      ]);
      setPlatforms(pRes.data);
      const rate = parseFloat(rateRes.data?.value || '10') || 10;
      const mode = modeRes.data?.value || 'manual';
      setUsdRate(rate);
      setRateInput(String(rate));
      setRateMode(mode);
      setMetaStatus(metaRes.data);
      if (mode === 'market') fetchMarketRate();
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
    if (mode === 'market') fetchMarketRate();
  };

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
        end_date: isRunning ? today() : null,
      });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error updating campaign'); }
  };

  const runCalc = async () => {
    setCalcLoading(true);
    setCalcResult(null);
    try {
      const res = await getAdCostPerOrder(calcStart, calcEnd);
      setCalcResult(res.data);
    } catch (e) { setError(e.response?.data?.detail || 'Error calculating'); }
    finally { setCalcLoading(false); }
  };

  const handleMetaConnect = async () => {
    if (!metaForm.token || !metaForm.accountId) return;
    setMetaConnecting(true);
    setMetaConnectError('');
    try {
      const res = await connectMeta({ access_token: metaForm.token, ad_account_id: metaForm.accountId });
      setMetaStatus({ connected: true, account_name: res.data.account_name, currency: res.data.currency });
      setMetaShowForm(false);
      setMetaForm({ token: '', accountId: '' });
    } catch (e) {
      setMetaConnectError(e?.response?.data?.detail || 'Connection failed. Check your token and account ID.');
    } finally {
      setMetaConnecting(false);
    }
  };

  const handleMetaDisconnect = async () => {
    if (!confirm('Disconnect Meta Ads API?')) return;
    await disconnectMeta().catch(() => {});
    setMetaStatus({ connected: false });
    setMetaData(null);
  };

  const handleMetaSync = async () => {
    setMetaSyncing(true);
    setMetaData(null);
    setError('');
    try {
      const res = await syncMeta(metaSyncStart, metaSyncEnd);
      setMetaData(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Meta sync failed.');
    } finally {
      setMetaSyncing(false);
    }
  };

  // ── New: load products for link modal ──
  useEffect(() => {
    getProducts().then(r => setProducts(r.data || [])).catch(() => {});
  }, []);

  // ── New: auto-sync Meta when date range changes ──
  useEffect(() => {
    if (!metaStatus?.connected) return;
    if (metaSyncStart > metaSyncEnd) return;
    handleMetaSync();
  }, [metaSyncStart, metaSyncEnd, metaStatus?.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── New: inline budget save ──
  const saveBudget = async () => {
    if (!budgetEdit) return;
    setBudgetSaving(true);
    try {
      await updateAdCampaign(budgetEdit.id, {
        platform_id: budgetEdit.platformId,
        daily_rate_usd: parseFloat(budgetEdit.value) || 0,
        start_date: budgetEdit.startDate,
        end_date: budgetEdit.endDate || null,
      });
      setBudgetEdit(null);
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error saving budget'); }
    finally { setBudgetSaving(false); }
  };

  // ── New: campaign-product link (localStorage) ──
  const saveCampaignLink = () => {
    if (!linkModal || !linkProductSel) return;
    const product = products.find(p => String(p.id) === linkProductSel);
    if (!product) return;
    const updated = { ...campaignLinks, [linkModal.key]: { productId: product.id, productName: product.name } };
    setCampaignLinks(updated);
    localStorage.setItem('stoky_campaign_links', JSON.stringify(updated));
    setLinkModal(null);
  };

  const removeCampaignLink = (key) => {
    const updated = { ...campaignLinks };
    delete updated[key];
    setCampaignLinks(updated);
    localStorage.setItem('stoky_campaign_links', JSON.stringify(updated));
  };

  // ── Summary totals ──
  const grandTotalMAD = platforms.reduce((sum, p) => sum + platformTotal(p.campaigns, usdRate), 0);
  const activeCount = platforms.reduce((sum, p) => sum + p.campaigns.filter(c => !c.end_date).length, 0);
  const addedNames = new Set(platforms.map(p => p.name));

  if (loading) return <div className="loading">Loading ads...</div>;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header">
        <h1 className="page-title">Ads</h1>
        <button className="btn btn-primary" onClick={() => setShowAddPlatform(true)}>
          <Plus size={14} strokeWidth={2} style={{ marginRight: 4 }} />
          Add Platform
        </button>
      </div>

      {/* ── Global Date Range Picker ── */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Period</span>
          <input
            className="form-input" type="date"
            value={metaSyncStart}
            onChange={e => setMetaSyncStart(e.target.value)}
            style={{ width: 148 }}
          />
          <span style={{ color: 'var(--t2)' }}>→</span>
          <input
            className="form-input" type="date"
            value={metaSyncEnd}
            onChange={e => setMetaSyncEnd(e.target.value)}
            style={{ width: 148 }}
          />
          {metaSyncing ? (
            <span style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
              Syncing Meta…
            </span>
          ) : metaData ? (
            <span style={{ fontSize: 12, color: '#00d48f' }}>✓ Meta synced</span>
          ) : null}
        </div>
      </div>

      {/* ── Exchange Rate Bar ── */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#12121a', borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              onClick={() => toggleRateMode('manual')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: rateMode === 'manual' ? '#2d3248' : 'transparent',
                color: rateMode === 'manual' ? '#fff' : 'var(--t2)',
                transition: 'all 0.15s',
              }}
            >Manual</button>
            <button
              onClick={() => toggleRateMode('market')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: rateMode === 'market' ? '#00d48f22' : 'transparent',
                color: rateMode === 'market' ? '#00d48f' : 'var(--t2)',
                transition: 'all 0.15s',
              }}
            >● Market Price</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--t2)', fontSize: 13 }}>1 USD =</span>
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
            <span style={{ color: 'var(--t2)', fontSize: 13 }}>MAD</span>
          </div>
          {rateMode === 'market' && (
            <>
              {marketDate && !fetchingRate && (
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>as of {marketDate}</span>
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
      {success && (
        <div className="alert alert-success">
          {success}
          <button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button>
        </div>
      )}

      {/* ── KPI Strip ── */}
      {platforms.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Spent (All Time)</div>
            <div className="stat-value">{fmt(grandTotalMAD)} <span style={{ fontSize: 14, color: 'var(--t2)' }}>MAD</span></div>
            <div className="stat-sub">{platforms.length} platform{platforms.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Active Campaigns</div>
            <div className="stat-value">{activeCount}</div>
            <div className="stat-sub">currently running</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Exchange Rate</div>
            <div className="stat-value">{fmt(usdRate)} <span style={{ fontSize: 14, color: 'var(--t2)' }}>MAD/USD</span></div>
            <div className="stat-sub" style={{ color: rateMode === 'market' ? '#00d48f' : 'var(--t2)' }}>
              {rateMode === 'market' ? `live · ${marketDate || '…'}` : 'manual'}
            </div>
          </div>
        </div>
      )}

      {/* ── Cost Per Order Calculator ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Calculator size={16} strokeWidth={1.75} style={{ color: '#00d48f' }} />
          <span style={{ fontWeight: 600 }}>Cost Per Order Calculator</span>
          <span style={{ fontSize: 12, color: 'var(--t2)', marginLeft: 4 }}>uses order date, not upload date</span>
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
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>Orders in period</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{calcResult.order_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>Total Ad Spend</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>${fmt(calcResult.total_usd)} <span style={{ fontSize: 13, color: 'var(--t2)' }}>USD</span></div>
                <div style={{ fontSize: 13, color: 'var(--t2)' }}>{fmt(calcResult.total_usd * usdRate)} MAD</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>Cost per Order</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#00d48f' }}>
                  {calcResult.order_count > 0 ? fmt(calcResult.total_usd * usdRate / calcResult.order_count) : '—'} <span style={{ fontSize: 13, color: 'var(--t2)' }}>MAD</span>
                </div>
              </div>
            </div>
            {calcResult.breakdown.length > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {calcResult.breakdown.map(b => (
                  <div key={b.platform} style={{ background: '#1d1d27', borderRadius: 8, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, display: 'inline-block' }} />
                    <span style={{ fontSize: 13 }}>{b.platform}</span>
                    <span style={{ fontSize: 13, color: 'var(--t2)' }}>${fmt(b.total_usd)}</span>
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

      {/* ── Platform Sections ── */}
      {platforms.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Megaphone size={40} strokeWidth={1} style={{ margin: '0 auto 12px', color: 'var(--t2)' }} />
            <h3>No platforms yet</h3>
            <p>Click "Add Platform" to start tracking your ad spend</p>
          </div>
        </div>
      ) : (
        platforms.map(platform => {
          const isFb = platform.name === 'facebook';
          const campaigns = normalizeCampaigns(platform, isFb ? metaData : null, usdRate);
          const totalSpend = isFb && metaData
            ? (metaData.currency === 'USD' ? metaData.total_spend * usdRate : metaData.total_spend)
            : platformTotal(platform.campaigns, usdRate);

          return (
            <div key={platform.id} className="card" style={{ marginBottom: 16, borderTop: `3px solid ${platform.color}` }}>

              {/* Platform header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <PlatformIcon name={platform.name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{platform.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {isFb ? (
                      metaStatus?.connected
                        ? <span style={{ color: '#00d48f' }}>● Connected · {metaStatus.account_name}</span>
                        : <span>○ Not connected</span>
                    ) : (
                      platform.campaigns.filter(c => !c.end_date).length > 0
                        ? <span style={{ color: '#00d48f' }}>● Active</span>
                        : <span>No active campaign</span>
                    )}
                    <span>·</span>
                    <span style={{ fontWeight: 600, color: '#f59e0b' }}>{fmt(totalSpend)} MAD</span>
                    {isFb && metaData && !metaSyncing && (
                      <span>({metaSyncStart} → {metaSyncEnd})</span>
                    )}
                    {isFb && metaStatus?.connected && metaStatus.currency && metaStatus.currency !== 'USD' && (
                      <span style={{ color: '#f59e0b' }}>⚠ Account currency: {metaStatus.currency}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {isFb && (
                    metaStatus?.connected ? (
                      <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={handleMetaDisconnect}>
                        <Unlink size={12} /> Disconnect
                      </button>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={() => setMetaShowForm(f => !f)}>
                        <Zap size={12} /> Connect
                      </button>
                    )
                  )}
                  <button className="btn btn-primary btn-sm" onClick={() => openNewCampaign(platform.id)}>
                    + Campaign
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => removePlatform(platform.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Meta connect form */}
              {isFb && metaShowForm && !metaStatus?.connected && (
                <div style={{ marginBottom: 14, padding: '14px 16px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 10 }}>
                    Get your access token from{' '}
                    <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Meta Graph API Explorer
                    </a>
                    {' '}(request <code>ads_read</code> permission). Your Ad Account ID is in{' '}
                    <a href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                      Meta Business Suite
                    </a>.
                  </div>
                  {metaConnectError && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f8717122', border: '1px solid #f8717150', color: '#f87171', fontSize: 13 }}>
                      {metaConnectError}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="form-label">Access Token</label>
                      <input className="form-input" type="password" placeholder="EAA…"
                        value={metaForm.token} onChange={e => setMetaForm(f => ({ ...f, token: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Ad Account ID</label>
                      <input className="form-input" type="text" placeholder="act_123456789 or 123456789"
                        value={metaForm.accountId} onChange={e => setMetaForm(f => ({ ...f, accountId: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleMetaConnect}
                      disabled={metaConnecting || !metaForm.token || !metaForm.accountId}>
                      {metaConnecting ? 'Connecting…' : 'Connect'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => { setMetaShowForm(false); setMetaConnectError(''); }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Campaign rows */}
              {campaigns.length === 0 ? (
                <div style={{ color: 'var(--t2)', fontSize: 13, padding: '6px 0' }}>
                  {isFb && !metaStatus?.connected
                    ? 'Connect Meta Ads API to see campaigns, or add manual entries with "+ Campaign".'
                    : isFb && metaSyncing
                    ? 'Syncing campaigns…'
                    : 'No campaigns yet. Click "+ Campaign" to add one.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {campaigns.map((campaign, idx) => {
                    const linked = campaignLinks[campaign.linkKey];
                    // Profitability dot: ⚪ always until backend profitability support added
                    const dotColor = linked ? '#6b7280' : '#6b7280';
                    const dotTitle = linked ? 'No delivered orders data yet' : 'No product linked';
                    const isEditing = budgetEdit?.id === campaign.localId && campaign.localId != null;

                    return (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'var(--bg)',
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                      }}>
                        {/* Left: dot + name + status badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 230, flexShrink: 0, minWidth: 0 }}>
                          <span
                            title={dotTitle}
                            style={{
                              width: 10, height: 10, borderRadius: '50%',
                              background: dotColor, flexShrink: 0, cursor: 'default',
                              border: '1.5px solid #6b7280',
                            }}
                          />
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            flex: 1, minWidth: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {campaign.displayName}
                          </span>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, flexShrink: 0,
                            background: campaign.status === 'active' ? '#0d2a1e' : '#1a1a2e',
                            color: campaign.status === 'active' ? '#00d48f' : 'var(--t2)',
                          }}>
                            {campaign.status === 'active' ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        {/* Middle: metrics */}
                        <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center' }}>
                          <MetricCell label="Spend" value={`${fmt(campaign.spendMAD)} MAD`} color="#f59e0b" />
                          <MetricCell label="Impr" value={campaign.impressions != null ? campaign.impressions.toLocaleString() : '—'} />
                          <MetricCell label="Reach" value="—" />
                          <MetricCell label="Clicks" value={campaign.clicks != null ? campaign.clicks.toLocaleString() : '—'} />
                          <MetricCell label="CTR" value={campaign.ctr != null ? `${campaign.ctr.toFixed(2)}%` : '—'} />
                          <MetricCell label="CPC" value={campaign.cpc != null ? `${fmt(campaign.cpc)} MAD` : '—'} />
                        </div>

                        {/* Right: actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

                          {/* Adjust Budget — local campaigns only */}
                          {campaign.localId && (
                            isEditing ? (
                              <input
                                autoFocus
                                type="number" min="0" step="0.5"
                                className="form-input"
                                value={budgetEdit.value}
                                style={{ width: 76, padding: '4px 8px', fontSize: 12 }}
                                onChange={e => setBudgetEdit(be => ({ ...be, value: e.target.value }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') saveBudget();
                                  if (e.key === 'Escape') setBudgetEdit(null);
                                }}
                                onBlur={saveBudget}
                              />
                            ) : (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => setBudgetEdit({
                                  id: campaign.localId,
                                  value: String(campaign.dailyRateUsd),
                                  platformId: platform.id,
                                  startDate: campaign.startDate,
                                  endDate: campaign.endDate,
                                })}
                                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                              >
                                <Edit2 size={10} /> ${fmt(campaign.dailyRateUsd)}/d
                              </button>
                            )
                          )}

                          {/* Pause/Resume — local campaigns only */}
                          {campaign.localId && (
                            <button
                              onClick={() => toggleCampaign(platform, {
                                id: campaign.localId,
                                daily_rate_usd: campaign.dailyRateUsd,
                                start_date: campaign.startDate,
                                end_date: campaign.endDate,
                              })}
                              style={{
                                padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                                fontSize: 11, fontWeight: 600,
                                background: campaign.status === 'active' ? '#0d2a1e' : '#2d3248',
                                color: campaign.status === 'active' ? '#00d48f' : 'var(--t2)',
                              }}
                            >
                              {campaign.status === 'active' ? 'Pause' : 'Resume'}
                            </button>
                          )}

                          {/* Product link */}
                          {linked ? (
                            <button
                              title={linked.productName}
                              onClick={() => {
                                setLinkModal({ key: campaign.linkKey });
                                setLinkProductSel(String(linked.productId));
                              }}
                              style={{
                                fontSize: 11, color: '#00d48f', background: 'none', border: 'none',
                                cursor: 'pointer', padding: 0, maxWidth: 110,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              ● {linked.productName}
                            </button>
                          ) : (
                            <button
                              onClick={() => { setLinkModal({ key: campaign.linkKey }); setLinkProductSel(''); }}
                              style={{
                                fontSize: 11, color: 'var(--t2)', background: 'none', border: 'none',
                                cursor: 'pointer', padding: 0, whiteSpace: 'nowrap',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              ⚪ Link product
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Add Platform Modal ── */}
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
                  <div style={{ color: 'var(--t2)', textAlign: 'center', padding: 16 }}>All platforms already added</div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddPlatform(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Campaign Modal ── */}
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
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--t2)' }}>
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
                  <label className="form-label">End Date <span style={{ color: 'var(--t2)', fontWeight: 400 }}>(optional)</span></label>
                  <input className="form-input" type="date" value={campaignForm.end_date}
                    onChange={e => setCampaignForm({ ...campaignForm, end_date: e.target.value })} />
                </div>
              </div>
              {!campaignForm.end_date && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--t2)', background: '#1d1d27', padding: '8px 12px', borderRadius: 6 }}>
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

      {/* ── Product Link Modal ── */}
      {linkModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 340 }}>
            <div className="modal-header">
              <h2>Link Product</h2>
              <button className="btn-icon" onClick={() => setLinkModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label">Product</label>
              <select
                className="form-input"
                value={linkProductSel}
                onChange={e => setLinkProductSel(e.target.value)}
              >
                <option value="">— Select a product —</option>
                {products.map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
              {campaignLinks[linkModal.key] && (
                <button
                  style={{ marginTop: 12, fontSize: 12, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  onClick={() => { removeCampaignLink(linkModal.key); setLinkModal(null); }}
                >
                  Remove link
                </button>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setLinkModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCampaignLink} disabled={!linkProductSel}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

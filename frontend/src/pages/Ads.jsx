import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Link, Unlink, Play, Pause, ExternalLink, ChevronDown, ChevronUp, Link2, TrendingUp } from 'lucide-react';
import MetaCampaignWizard from '../components/MetaCampaignWizard';
import CampaignConnectModal from './CampaignConnectModal';
import AdsMobile from './AdsMobile';
import {
  getSetting, setSetting,
  getMetaStatus, connectMeta, disconnectMeta,
  getMetaCampaigns, pauseMetaCampaign, resumeMetaCampaign,
  createMetaCampaign, getMetaSpend, getMetaAdAccounts,
  getGoogleStatus, connectGoogle, disconnectGoogle, getGoogleCampaigns, pauseGoogleCampaign, resumeGoogleCampaign, getGoogleSpend,
  getTikTokStatus, connectTikTok, disconnectTikTok, getTikTokCampaigns, pauseTikTokCampaign, resumeTikTokCampaign, getTikTokSpend,
  getSnapchatStatus, connectSnapchat, disconnectSnapchat, getSnapchatCampaigns, pauseSnapchatCampaign, resumeSnapchatCampaign, getSnapchatSpend,
  getPinterestStatus, connectPinterest, disconnectPinterest, getPinterestCampaigns, pausePinterestCampaign, resumePinterestCampaign, getPinterestSpend,
  getProducts, getPacks, getOffers,
  getCampaignConnections, saveCampaignConnection, deleteCampaignConnection, getCampaignBulkStats,
} from '../api';
import { useT } from '../i18n';

const META_OBJECTIVES = [
  { value: 'OUTCOME_SALES',       label: 'Sales' },
  { value: 'OUTCOME_LEADS',       label: 'Leads' },
  { value: 'OUTCOME_TRAFFIC',     label: 'Traffic' },
  { value: 'OUTCOME_AWARENESS',   label: 'Awareness' },
  { value: 'OUTCOME_ENGAGEMENT',  label: 'Engagement' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion' },
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
  google: { bg: '#fff', viewBox: '0 0 24 24', d: null },
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
  return (
    <div style={{ width: size, height: size, borderRadius: r, flexShrink: 0, background: data.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.65} height={size * 0.65} viewBox={data.viewBox} fill={data.fill}>
        <path d={data.d}/>
      </svg>
    </div>
  );
}

// Meta logo
function MetaLogo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="#0866FF"/>
      <path d="M8 18.5c0 1.933.434 3.416 1.007 4.3.418.644.924.95 1.434.95.736 0 1.415-.42 2.162-1.65.588-.966 1.196-2.413 1.637-4.151l.47-1.82c.33-1.276.773-2.25 1.27-2.894.426-.558.894-.837 1.37-.837.843 0 1.647.782 2.275 2.2.557 1.27.913 2.99.913 4.687 0 1.45-.286 2.57-.84 3.39-.452.665-1.066 1.075-1.748 1.075v-2.25c.357 0 .641-.218.875-.67.27-.52.413-1.28.413-2.18 0-1.395-.294-2.82-.763-3.782-.35-.712-.733-1.084-1.066-1.084-.38 0-.744.34-1.066.983-.24.478-.474 1.23-.664 1.97l-.475 1.84c-.48 1.86-1.15 3.43-1.872 4.572C13.38 24.463 12.28 25 11.1 25c-.872 0-1.718-.397-2.384-1.152C7.49 22.67 7 20.82 7 18.5c0-2.5.58-4.655 1.69-6.24C9.8 10.654 11.13 10 12.532 10c.896 0 1.76.358 2.536 1.06.632.572 1.178 1.39 1.644 2.38.467-.99 1.013-1.808 1.645-2.38C19.133 10.358 20 10 20.893 10c1.407 0 2.74.656 3.845 2.263C25.845 13.847 26.4 16 26.4 18.5c0 2.335-.486 4.177-1.707 5.35-.666.653-1.5 1.15-2.393 1.15v-2.25c.596 0 1.096-.33 1.508-.99.533-.845.842-2.095.842-3.76 0-2.067-.4-3.8-1.082-4.92-.518-.845-1.136-1.23-1.775-1.23-.525 0-1.022.337-1.46.983-.526.778-.968 2.035-1.218 3.447l-.227 1.3-.456-1.445c-.384-1.217-.86-2.12-1.395-2.64-.486-.472-1.01-.735-1.538-.735-.87 0-1.644.498-2.275 1.5C8.39 15.36 8 16.8 8 18.5z" fill="white"/>
    </svg>
  );
}

// ── Helpers ────────────────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n, d = 2) => Number(n || 0).toFixed(d);

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

// ── Profitability dot ──────────────────────────────────────
function getDotInfo(conn, delivered, periodSpendMAD, profit) {
  if (!conn)                                       return { color: '#6b7280', title: 'No product linked' };
  if (delivered === 0 || periodSpendMAD === null)  return { color: '#6b7280', title: 'No delivered orders yet' };
  if (profit === null)                             return { color: '#6b7280', title: 'No profitability data' };
  if (profit > 0)                                  return { color: '#22c55e', title: `Profitable · ${fmt(profit)} MAD/order` };
  if (profit >= -10)                               return { color: '#f59e0b', title: `Breaking even · ${fmt(profit)} MAD/order` };
  return                                                  { color: '#ef4444', title: `Losing · ${fmt(profit)} MAD/order` };
}

// ── Component ───────────────────────────────────────────────
export default function Ads({ readOnly = false, lang = 'en' }) {
  const t = useT(lang);
  const [usdRate, setUsdRate] = useState(10);
  const [rateInput, setRateInput] = useState('10');
  const [rateMode, setRateMode] = useState('manual');
  const [marketRate, setMarketRate] = useState(null);
  const [marketDate, setMarketDate] = useState(null);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState(null); // 'meta'|'google'|'tiktok'|'snapchat'|'pinterest'
  const [expanded, setExpanded] = useState({});

  // Date range (shared by spend sections)
  const [calcStart, setCalcStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [calcEnd, setCalcEnd] = useState(today());

  // ── Meta state ──
  const [metaStatus, setMetaStatus] = useState(null); // null = loading, { connected, account_name, ... }
  const [metaCampaigns, setMetaCampaigns] = useState([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [metaForm, setMetaForm] = useState({ access_token: '', ad_account_id: '' });
  const [metaAdAccounts, setMetaAdAccounts] = useState([]);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [showMetaCreate, setShowMetaCreate] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [metaCreateForm, setMetaCreateForm] = useState({
    name: '', objective: 'OUTCOME_SALES', daily_budget: '', status: 'PAUSED',
  });
  const [metaSpendResult, setMetaSpendResult] = useState(null);
  const [metaSpendLoading, setMetaSpendLoading] = useState(false);

  // ── Google state ──
  const [ggStatus, setGgStatus] = useState(null);
  const [ggCampaigns, setGgCampaigns] = useState([]);
  const [ggLoading, setGgLoading] = useState(false);
  const [ggConnecting, setGgConnecting] = useState(false);
  const [ggForm, setGgForm] = useState({ access_token: '', customer_id: '', developer_token: '' });

  // ── TikTok state ──
  const [ttStatus, setTtStatus] = useState(null);
  const [ttCampaigns, setTtCampaigns] = useState([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttConnecting, setTtConnecting] = useState(false);
  const [ttForm, setTtForm] = useState({ access_token: '', advertiser_id: '' });

  // ── Snapchat state ──
  const [scStatus, setScStatus] = useState(null);
  const [scCampaigns, setScCampaigns] = useState([]);
  const [scLoading, setScLoading] = useState(false);
  const [scConnecting, setScConnecting] = useState(false);
  const [scForm, setScForm] = useState({ access_token: '', ad_account_id: '' });

  // ── Pinterest state ──
  const [ptStatus, setPtStatus] = useState(null);
  const [ptCampaigns, setPtCampaigns] = useState([]);
  const [ptLoading, setPtLoading] = useState(false);
  const [ptConnecting, setPtConnecting] = useState(false);
  const [ptForm, setPtForm] = useState({ access_token: '', ad_account_id: '' });

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

  const loadMetaCampaigns = async () => {
    setMetaLoading(true);
    try {
      const res = await getMetaCampaigns();
      setMetaCampaigns(res.data);
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to load Meta campaigns');
    } finally {
      setMetaLoading(false);
    }
  };

  const load = async () => {
    try {
      const [rateRes, modeRes, metaRes, ggRes, ttRes, scRes, ptRes] = await Promise.all([
        getSetting('usd_rate').catch(() => ({ data: { value: '10' } })),
        getSetting('usd_rate_mode').catch(() => ({ data: { value: 'manual' } })),
        getMetaStatus().catch(() => ({ data: { connected: false } })),
        getGoogleStatus().catch(() => ({ data: { connected: false } })),
        getTikTokStatus().catch(() => ({ data: { connected: false } })),
        getSnapchatStatus().catch(() => ({ data: { connected: false } })),
        getPinterestStatus().catch(() => ({ data: { connected: false } })),
      ]);
      const rate = parseFloat(rateRes.data?.value || '10') || 10;
      const mode = modeRes.data?.value || 'manual';
      setUsdRate(rate);
      setRateInput(String(rate));
      setRateMode(mode);
      if (mode === 'market') fetchMarketRate();
      setMetaStatus(metaRes.data);
      if (metaRes.data?.connected) loadMetaCampaigns();
      setGgStatus(ggRes.data);
      if (ggRes.data?.connected) loadGgCampaigns();
      setTtStatus(ttRes.data);
      if (ttRes.data?.connected) loadTtCampaigns();
      setScStatus(scRes.data);
      if (scRes.data?.connected) loadScCampaigns();
      setPtStatus(ptRes.data);
      if (ptRes.data?.connected) loadPtCampaigns();
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

  // ── Meta actions ──
  const handleFetchAccounts = async () => {
    if (!metaForm.access_token) { setError('Enter your Access Token first'); return; }
    setFetchingAccounts(true); setError('');
    try {
      const res = await getMetaAdAccounts(metaForm.access_token);
      setMetaAdAccounts(res.data);
      if (res.data.length === 1) setMetaForm(f => ({ ...f, ad_account_id: res.data[0].id }));
    } catch (e) { setError(e.response?.data?.detail || 'Failed to fetch accounts'); }
    finally { setFetchingAccounts(false); }
  };

  const handleMetaConnect = async () => {
    if (!metaForm.access_token || !metaForm.ad_account_id) {
      setError('Enter both Access Token and Ad Account ID'); return;
    }
    setMetaConnecting(true);
    setError('');
    try {
      const res = await connectMeta(metaForm);
      setMetaStatus({ connected: true, ...res.data });
      setConnectingPlatform(null); setShowAddPlatform(false);
      setMetaForm({ access_token: '', ad_account_id: '' });
      setSuccess(`Connected to Meta — ${res.data.account_name}`);
      loadMetaCampaigns();
    } catch (e) {
      setError(e.response?.data?.detail || 'Connection failed. Check your token and account ID.');
    } finally {
      setMetaConnecting(false);
    }
  };

  const handleMetaDisconnect = async () => {
    if (!confirm('Disconnect your Meta account?')) return;
    try {
      await disconnectMeta();
      setMetaStatus({ connected: false });
      setMetaCampaigns([]);
      setSuccess('Meta account disconnected');
    } catch (e) {
      setError(e.response?.data?.detail || 'Error disconnecting');
    }
  };

  const handlePause = async (id) => {
    try { await pauseMetaCampaign(id); loadMetaCampaigns(); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to pause'); }
  };
  const handleResume = async (id) => {
    try { await resumeMetaCampaign(id); loadMetaCampaigns(); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to resume'); }
  };

  // ── Google handlers ──
  const loadGgCampaigns = async () => {
    setGgLoading(true);
    try { const res = await getGoogleCampaigns(); setGgCampaigns(res.data); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to load Google campaigns'); }
    finally { setGgLoading(false); }
  };
  const handleGgConnect = async () => {
    if (!ggForm.access_token || !ggForm.customer_id || !ggForm.developer_token) { setError('All three fields are required'); return; }
    setGgConnecting(true); setError('');
    try {
      const res = await connectGoogle(ggForm);
      setGgStatus({ connected: true, ...res.data });
      setConnectingPlatform(null); setShowAddPlatform(false); setGgForm({ access_token: '', customer_id: '', developer_token: '' });
      setSuccess(`Connected to Google Ads — ${res.data.account_name}`);
      loadGgCampaigns();
    } catch (e) { setError(e.response?.data?.detail || 'Google connection failed'); }
    finally { setGgConnecting(false); }
  };
  const handleGgDisconnect = async () => {
    if (!confirm('Disconnect Google Ads?')) return;
    await disconnectGoogle(); setGgStatus({ connected: false }); setGgCampaigns([]);
    setSuccess('Google Ads disconnected');
  };

  // ── TikTok handlers ──
  const loadTtCampaigns = async () => {
    setTtLoading(true);
    try { const res = await getTikTokCampaigns(); setTtCampaigns(res.data); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to load TikTok campaigns'); }
    finally { setTtLoading(false); }
  };
  const handleTtConnect = async () => {
    if (!ttForm.access_token || !ttForm.advertiser_id) { setError('Enter both fields'); return; }
    setTtConnecting(true); setError('');
    try {
      const res = await connectTikTok(ttForm);
      setTtStatus({ connected: true, ...res.data });
      setConnectingPlatform(null); setShowAddPlatform(false); setTtForm({ access_token: '', advertiser_id: '' });
      setSuccess(`Connected to TikTok — ${res.data.account_name}`);
      loadTtCampaigns();
    } catch (e) { setError(e.response?.data?.detail || 'TikTok connection failed'); }
    finally { setTtConnecting(false); }
  };
  const handleTtDisconnect = async () => {
    if (!confirm('Disconnect TikTok?')) return;
    await disconnectTikTok(); setTtStatus({ connected: false }); setTtCampaigns([]);
    setSuccess('TikTok disconnected');
  };

  // ── Snapchat handlers ──
  const loadScCampaigns = async () => {
    setScLoading(true);
    try { const res = await getSnapchatCampaigns(); setScCampaigns(res.data); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to load Snapchat campaigns'); }
    finally { setScLoading(false); }
  };
  const handleScConnect = async () => {
    if (!scForm.access_token || !scForm.ad_account_id) { setError('Enter both fields'); return; }
    setScConnecting(true); setError('');
    try {
      const res = await connectSnapchat(scForm);
      setScStatus({ connected: true, ...res.data });
      setConnectingPlatform(null); setShowAddPlatform(false); setScForm({ access_token: '', ad_account_id: '' });
      setSuccess(`Connected to Snapchat — ${res.data.account_name}`);
      loadScCampaigns();
    } catch (e) { setError(e.response?.data?.detail || 'Snapchat connection failed'); }
    finally { setScConnecting(false); }
  };
  const handleScDisconnect = async () => {
    if (!confirm('Disconnect Snapchat?')) return;
    await disconnectSnapchat(); setScStatus({ connected: false }); setScCampaigns([]);
    setSuccess('Snapchat disconnected');
  };

  // ── Pinterest handlers ──
  const loadPtCampaigns = async () => {
    setPtLoading(true);
    try { const res = await getPinterestCampaigns(); setPtCampaigns(res.data); }
    catch (e) { setError(e.response?.data?.detail || 'Failed to load Pinterest campaigns'); }
    finally { setPtLoading(false); }
  };
  const handlePtConnect = async () => {
    if (!ptForm.access_token || !ptForm.ad_account_id) { setError('Enter both fields'); return; }
    setPtConnecting(true); setError('');
    try {
      const res = await connectPinterest(ptForm);
      setPtStatus({ connected: true, ...res.data });
      setConnectingPlatform(null); setShowAddPlatform(false); setPtForm({ access_token: '', ad_account_id: '' });
      setSuccess(`Connected to Pinterest — ${res.data.account_name}`);
      loadPtCampaigns();
    } catch (e) { setError(e.response?.data?.detail || 'Pinterest connection failed'); }
    finally { setPtConnecting(false); }
  };
  const handlePtDisconnect = async () => {
    if (!confirm('Disconnect Pinterest?')) return;
    await disconnectPinterest(); setPtStatus({ connected: false }); setPtCampaigns([]);
    setSuccess('Pinterest disconnected');
  };

  const handleMetaCreate = async () => {
    setError('');
    if (!metaCreateForm.name) { setError('Campaign name is required'); return; }
    if (!metaCreateForm.daily_budget || parseFloat(metaCreateForm.daily_budget) <= 0) {
      setError('Enter a valid daily budget'); return;
    }
    try {
      await createMetaCampaign({
        name: metaCreateForm.name,
        objective: metaCreateForm.objective,
        daily_budget: parseFloat(metaCreateForm.daily_budget),
        status: metaCreateForm.status,
      });
      setShowMetaCreate(false);
      setMetaCreateForm({ name: '', objective: 'OUTCOME_SALES', daily_budget: '', status: 'PAUSED' });
      setSuccess('Campaign created in Meta');
      loadMetaCampaigns();
    } catch (e) { setError(e.response?.data?.detail || 'Failed to create campaign'); }
  };

  const runMetaSpend = async () => {
    setMetaSpendLoading(true);
    setMetaSpendResult(null);
    try {
      const res = await getMetaSpend(calcStart, calcEnd);
      setMetaSpendResult(res.data);
    } catch (e) { setError(e.response?.data?.detail || 'Failed to fetch Meta spend'); }
    finally { setMetaSpendLoading(false); }
  };

  // ── Campaign connections state ──
  const [connections,    setConnections]    = useState([]);
  const [connStats,      setConnStats]      = useState({});
  const [products,       setProducts]       = useState([]);
  const [packs,          setPacks]          = useState([]);
  const [offers,         setOffers]         = useState([]);
  const [connectSidebar, setConnectSidebar] = useState(null); // { campaign, existingConn, platform }
  const [spendById,      setSpendById]      = useState({}); // campaignId → spend_usd for selected period (all platforms)

  useEffect(() => {
    getCampaignConnections().then(r => setConnections(r.data)).catch(() => {});
    getProducts().then(r => setProducts(r.data)).catch(() => {});
    getPacks().then(r => setPacks(r.data)).catch(() => {});
    getOffers().then(r => setOffers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (connections.length === 0) { setConnStats({}); return; }
    getCampaignBulkStats(calcStart, calcEnd).then(r => setConnStats(r.data)).catch(() => {});
  }, [connections.length, calcStart, calcEnd]);

  // Auto-fetch period spend from all connected platforms whenever date range changes
  useEffect(() => {
    const fetchers = [
      metaStatus?.connected   && getMetaSpend(calcStart, calcEnd),
      ttStatus?.connected     && getTikTokSpend(calcStart, calcEnd),
      scStatus?.connected     && getSnapchatSpend(calcStart, calcEnd),
      ptStatus?.connected     && getPinterestSpend(calcStart, calcEnd),
      ggStatus?.connected     && getGoogleSpend(calcStart, calcEnd),
    ].filter(Boolean);
    if (fetchers.length === 0) return;
    Promise.allSettled(fetchers).then(results => {
      const map = {};
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          (r.value.data.breakdown || []).forEach(b => { if (b.campaign_id) map[b.campaign_id] = b.spend_usd; });
        }
      });
      setSpendById(map);
    });
  }, [metaStatus?.connected, ttStatus?.connected, scStatus?.connected, ptStatus?.connected, ggStatus?.connected, calcStart, calcEnd]);

  const handleSaveConnection = async (data) => {
    const r = await saveCampaignConnection(data);
    setConnections(prev => {
      const without = prev.filter(c => !(c.meta_campaign_id === data.meta_campaign_id && c.platform === data.platform));
      return [...without, r.data];
    });
    // Always refresh stats so inline KPIs update immediately (covers both new connections and product changes)
    getCampaignBulkStats(calcStart, calcEnd).then(res => setConnStats(res.data)).catch(() => {});
  };

  const handleDeleteConnection = async (connId) => {
    if (!confirm('Remove this connection?')) return;
    await deleteCampaignConnection(connId);
    setConnections(prev => prev.filter(c => c.id !== connId));
  };

  const getItemPrices = (itemType, itemId) => {
    if (itemType === 'product') {
      const p = products.find(x => x.id === itemId);
      const v = p?.variants?.[0];
      return v ? { selling_price: v.selling_price || 0, buy_price: v.buying_price || 0, packaging_cost: 0 } : null;
    }
    if (itemType === 'pack') {
      const pk = packs.find(x => x.id === itemId);
      if (!pk) return null;
      const presetBuy = pk.presets?.[0]?.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0);
      let buy_price = presetBuy || 0;
      if (!buy_price && pk.product_id) {
        const prod = products.find(x => x.id === pk.product_id);
        buy_price = (prod?.variants?.[0]?.buying_price || 0) * (pk.item_count || 1);
      }
      return { selling_price: pk.selling_price, buy_price, packaging_cost: pk.packaging_cost || 0 };
    }
    if (itemType === 'offer') {
      const of = offers.find(x => x.id === itemId);
      if (!of) return null;
      return { selling_price: of.selling_price, buy_price: of.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0) || 0, packaging_cost: of.packaging_cost || 0 };
    }
    return null;
  };

  const [expandedRows, setExpandedRows] = useState(new Set());
  const toggleRow = id => setExpandedRows(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  // ── Page-level KPI computations ──
  const allCampaigns = [
    ...metaCampaigns.map(c => ({ ...c, _platform: 'meta' })),
    ...ttCampaigns.map(c => ({ ...c, _platform: 'tiktok' })),
    ...scCampaigns.map(c => ({ ...c, _platform: 'snapchat' })),
    ...ptCampaigns.map(c => ({ ...c, _platform: 'pinterest' })),
    ...ggCampaigns.map(c => ({ ...c, _platform: 'google' })),
  ];
  const activeCampaignsCount = allCampaigns.filter(c => ['ACTIVE','ENABLE','ENABLED'].includes(c.status)).length;
  const platformsConnected   = [metaStatus, ttStatus, scStatus, ptStatus, ggStatus].filter(s => s?.connected).length;
  const totalPeriodSpend     = Object.values(spendById).reduce((s, v) => s + v, 0) * usdRate;
  const summaryRows = connections.map(conn => {
    const stats = connStats[conn.id] || {};
    const periodUsd = spendById[conn.meta_campaign_id] ?? null;
    const spend = periodUsd != null ? periodUsd * usdRate : 0;
    const delivered = stats.delivered_orders || 0;
    const prices = getItemPrices(conn.item_type, conn.item_id);
    const adCost = delivered > 0 ? spend / delivered : 0;
    const profit = prices ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats.avg_delivery_cost ?? 0) - adCost : null;
    return { delivered, returnRate: stats.return_rate || 0, profit, totalProfit: profit !== null ? profit * delivered : null };
  });
  const totalDelivered  = summaryRows.reduce((s, r) => s + r.delivered, 0);
  const totalRealProfit = summaryRows.reduce((s, r) => s + (r.totalProfit || 0), 0);
  const avgReturnRate   = summaryRows.length > 0 ? summaryRows.reduce((s, r) => s + r.returnRate, 0) / summaryRows.length : 0;

  const metaActive = metaCampaigns.filter(c => c.status === 'ACTIVE').length;

  if (loading) return <div className="loading">Loading ads...</div>;
  if (window.innerWidth < 768) return <AdsMobile />;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">{t('ads')}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowAddPlatform(true)}>
            <Plus size={14} strokeWidth={2} style={{ marginRight: 4 }} />
            Connect Platform
          </button>
        </div>
      </div>

      {/* ── Global Date Range Picker ── */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Period</span>
          <input className="form-input" type="date" value={calcStart} onChange={e => setCalcStart(e.target.value)} style={{ width: 148 }} />
          <span style={{ color: 'var(--t2)' }}>→</span>
          <input className="form-input" type="date" value={calcEnd} onChange={e => setCalcEnd(e.target.value)} style={{ width: 148 }} />
          {[metaStatus, ttStatus, scStatus, ptStatus, ggStatus].some(s => s?.connected) && (
            <span style={{ fontSize: 12, color: 'var(--t2)' }}>Auto-fetches spend across all connected platforms</span>
          )}
        </div>
      </div>

      {/* Exchange rate bar */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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

      {/* ── Page KPI Summary Bar ── */}
      {platformsConnected > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'Active Campaigns', value: activeCampaignsCount, color: '#00d48f', icon: '▶' },
            { label: 'Platforms Connected', value: platformsConnected, color: '#60a5fa', icon: '🔗' },
            { label: 'Period Spend', value: `${fmt(totalPeriodSpend)} MAD`, color: '#a78bfa', icon: '💸' },
            { label: 'Delivered Orders', value: totalDelivered, color: '#60a5fa', icon: '📦' },
            { label: 'Real Profit', value: `${fmt(totalRealProfit)} MAD`, color: totalRealProfit >= 0 ? '#00d48f' : '#f87171', icon: '💰' },
            { label: 'Avg Return Rate', value: `${avgReturnRate.toFixed(1)}%`, color: avgReturnRate > 30 ? '#f87171' : '#fbbf24', icon: '↩' },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: '#8892b0', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Real Profitability Dashboard ── */}
      {connections.length > 0 && (() => {
        const PLATFORM_COLORS = { meta: '#0866FF', tiktok: '#010101', snapchat: '#FFFC00', pinterest: '#E60023', google: '#ea4335' };
        const rows = connections.map(conn => {
          const campaign = allCampaigns.find(c => c.id === conn.meta_campaign_id);
          if (!campaign) return null;
          const periodUsd   = spendById[conn.meta_campaign_id] ?? null;
          const spend       = periodUsd != null ? periodUsd * usdRate : (campaign.spend_all_time_usd || 0) * usdRate;
          const stats       = connStats[conn.id] || {};
          const delivered   = stats.delivered_orders || 0;
          const adCost      = delivered > 0 ? spend / delivered : 0;
          const prices      = getItemPrices(conn.item_type, conn.item_id);
          const profit      = prices ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats.avg_delivery_cost ?? 0) - adCost : null;
          const totalProfit = profit !== null ? profit * delivered : null;
          const platformColor = PLATFORM_COLORS[conn.platform] || '#8892b0';
          return { conn, campaign, spend, delivered, stats, profit, totalProfit, platformColor };
        }).filter(Boolean);

        if (rows.length === 0) return null;

        const totalSpend     = rows.reduce((s, r) => s + r.spend, 0);
        const totalDelivered = rows.reduce((s, r) => s + r.delivered, 0);
        const totalProfit    = rows.reduce((s, r) => s + (r.totalProfit || 0), 0);
        const avgReturn      = rows.length > 0 ? rows.reduce((s, r) => s + (r.stats.return_rate || 0), 0) / rows.length : 0;
        const isOpen         = expanded['profitability'] !== false;

        return (
          <div className="card" style={{ marginBottom: 16, borderTop: '3px solid #a78bfa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: isOpen ? 16 : 0 }} onClick={() => setExpanded(e => ({ ...e, profitability: !isOpen }))}>
              <TrendingUp size={16} style={{ color: '#a78bfa' }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Real Profitability</span>
              <span style={{ fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 7px', marginLeft: 4 }}>{rows.length} connected</span>
              <div style={{ flex: 1 }} />
              <div style={{ color: '#8892b0' }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
            </div>

            {isOpen && <>
            {/* Summary */}
            <div style={{ display: 'flex', background: '#13151e', borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
              {[
                { label: 'Total Spend', value: `${fmt(totalSpend)} MAD`, color: '#a78bfa' },
                { label: 'Delivered Orders', value: totalDelivered, color: '#60a5fa' },
                { label: 'Total Real Profit', value: `${fmt(totalProfit)} MAD`, color: totalProfit >= 0 ? '#00d48f' : '#f87171' },
                { label: 'Avg Return Rate', value: `${avgReturn.toFixed(1)}%`, color: '#fbbf24' },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, padding: '12px 16px', borderRight: i < 3 ? '1px solid #222733' : 'none' }}>
                  <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Campaign rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map(({ conn, campaign, spend, delivered, stats, profit, totalProfit, platformColor }) => (
                <div key={conn.id} style={{ background: '#13151e', borderRadius: 10, padding: '12px 14px', border: `1px solid ${(totalProfit || 0) >= 0 ? '#0d2a1e' : '#2d1b1b'}`, borderLeft: `4px solid ${platformColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 10, color: platformColor, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{conn.platform || 'meta'}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{campaign.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, color: '#8892b0', textTransform: 'uppercase' }}>{conn.item_type}</span>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{conn.item_name}</div>
                    </div>
                    <button onClick={() => handleDeleteConnection(conn.id)} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', fontSize: 10, padding: 4 }}>✕</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Spend', value: `${fmt(spend)} MAD`, color: '#a78bfa' },
                      { label: 'Delivered', value: delivered, color: '#60a5fa' },
                      { label: 'Return rate', value: `${stats.return_rate || 0}%`, color: (stats.return_rate || 0) > 30 ? '#f87171' : '#fbbf24' },
                      { label: 'Profit/order', value: profit !== null ? `${fmt(profit)} MAD` : '—', color: profit === null ? '#8892b0' : profit >= 0 ? '#00d48f' : '#f87171' },
                      { label: 'Total profit', value: totalProfit !== null ? `${fmt(totalProfit)} MAD` : '—', color: totalProfit === null ? '#8892b0' : totalProfit >= 0 ? '#00d48f' : '#f87171' },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: '1 0 80px', padding: '6px 10px', borderRight: '1px solid #222733' }}>
                        <div style={{ fontSize: 10, color: '#8892b0', marginBottom: 2 }}>{s.label}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </>}
          </div>
        );
      })()}

      {error && <div className="alert alert-error">{error}<button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setError('')}>✕</button></div>}
      {success && <div className="alert alert-success">{success}<button style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }} onClick={() => setSuccess('')}>✕</button></div>}

      {/* ── PLATFORM CARDS (only shown when connected) ── */}

      {/* META */}
      {metaStatus?.connected && (() => {
        const isOpen = expanded['meta'] !== false;
        return (
        <div className="card" style={{ marginBottom: 20, borderTop: '3px solid #0866FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: isOpen ? 14 : 0 }} onClick={() => setExpanded(e => ({ ...e, meta: !isOpen }))}>
            <MetaLogo size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Meta Ads</div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}>
                <span style={{ color: '#00d48f' }}>● Connected</span> · {metaStatus.account_name} · {metaActive} active campaign{metaActive !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-primary btn-sm" onClick={() => setShowWizard(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> New Campaign</button>
              <button className="btn btn-secondary btn-sm" onClick={loadMetaCampaigns} disabled={metaLoading}><RefreshCw size={12} style={{ animation: metaLoading ? 'spin 1s linear infinite' : 'none' }} /></button>
              <button className="btn btn-danger btn-sm" onClick={handleMetaDisconnect}><Unlink size={12} /> Disconnect</button>
            </div>
            <div style={{ color: '#8892b0', marginLeft: 4 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
          </div>
          {isOpen && (metaLoading ? <div style={{ color: '#8892b0', fontSize: 13 }}>Loading campaigns…</div>
          : metaCampaigns.length === 0 ? <div style={{ color: '#8892b0', fontSize: 13 }}>No campaigns found in this account.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {metaCampaigns.map(c => {
                const isActive = c.status === 'ACTIVE';
                const conn = connections.find(cn => cn.meta_campaign_id === c.id && (cn.platform === 'meta' || !cn.platform));
                const stats = conn ? (connStats[conn.id] || {}) : null;
                const periodUsd = spendById[c.id] ?? null;
                const periodSpendMAD = periodUsd != null ? periodUsd * usdRate : null;
                const delivered = stats?.delivered_orders || 0;
                const adCostPerOrder = (periodSpendMAD != null && delivered > 0) ? periodSpendMAD / delivered : null;
                const prices = conn ? getItemPrices(conn.item_type, conn.item_id) : null;
                const profit = prices
                  ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - (adCostPerOrder ?? 0)
                  : null;
                const dot = getDotInfo(conn, delivered, periodSpendMAD, profit);
                const displaySpend = periodSpendMAD ?? (c.spend_all_time_usd || 0) * usdRate;
                const rowBg = dot.color === '#22c55e' ? '#0d2a1e22' : dot.color === '#f59e0b' ? '#1e1a0022' : dot.color === '#ef4444' ? '#2a0d0d22' : 'var(--bg)';
                const rowBorder = dot.color === '#6b7280' ? 'var(--border)' : dot.color + '55';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: rowBg, borderRadius: 8, border: `1px solid ${rowBorder}`, borderLeft: `4px solid ${dot.color}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 240, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dot.title}>{c.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: isActive ? '#0d2a1e' : '#1a1a2e', color: isActive ? '#00d48f' : '#8892b0', flexShrink: 0 }}>
                        {isActive ? 'Active' : c.status === 'PAUSED' ? 'Paused' : c.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <MetricCell label="Spend" value={`${fmt(displaySpend)} MAD`} color="#f59e0b" />
                      <MetricCell label="Impr" value={(c.impressions || 0).toLocaleString()} />
                      <MetricCell label="Reach" value={(c.reach || 0).toLocaleString()} />
                      <MetricCell label="Clicks" value={(c.clicks || 0).toLocaleString()} />
                      <MetricCell label="CTR" value={c.ctr ? `${fmt(c.ctr)}%` : '—'} />
                      <MetricCell label="CPC" value={c.cpc ? `${fmt(c.cpc * usdRate)} MAD` : '—'} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {c.daily_budget_usd != null && <span style={{ fontSize: 11, color: '#60a5fa', background: '#131c2e', padding: '3px 8px', borderRadius: 6 }}>${fmt(c.daily_budget_usd)}/d</span>}
                      {isActive
                        ? <button className="btn btn-secondary btn-sm" onClick={() => handlePause(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pause size={11} /> Pause</button>
                        : c.status === 'PAUSED' ? <button className="btn btn-primary btn-sm" onClick={() => handleResume(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</button>
                        : null}
                      {conn
                        ? <button className="btn btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: conn, platform: 'meta' })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00d48f', border: '1px solid #00d48f44', background: '#0d2a1e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link2 size={10} /> {conn.item_name}</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: null, platform: 'meta' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Link product</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        );
      })()}

      {/* TIKTOK */}
      {ttStatus?.connected && (() => {
        const isOpen = expanded['tiktok'] !== false;
        return (
        <div className="card" style={{ marginBottom: 20, borderTop: '3px solid #010101' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: isOpen ? 14 : 0 }} onClick={() => setExpanded(e => ({ ...e, tiktok: !isOpen }))}>
            <PlatformIcon name="tiktok" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>TikTok Ads</div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}><span style={{ color: '#00d48f' }}>● Connected</span> · {ttStatus.account_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary btn-sm" onClick={loadTtCampaigns} disabled={ttLoading}><RefreshCw size={12} /></button>
              <button className="btn btn-danger btn-sm" onClick={handleTtDisconnect}><Unlink size={12} /> Disconnect</button>
            </div>
            <div style={{ color: '#8892b0', marginLeft: 4 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
          </div>
          {isOpen && (ttLoading ? <div style={{ color: '#8892b0', fontSize: 13 }}>Loading campaigns…</div>
          : ttCampaigns.length === 0 ? <div style={{ color: '#8892b0', fontSize: 13 }}>No campaigns found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ttCampaigns.map(c => {
                const isActive = c.status === 'ENABLE';
                const conn = connections.find(cn => cn.meta_campaign_id === c.id && cn.platform === 'tiktok');
                const stats = conn ? (connStats[conn.id] || {}) : null;
                const periodUsd = spendById[c.id] ?? null;
                const periodSpendMAD = periodUsd != null ? periodUsd * usdRate : null;
                const delivered = stats?.delivered_orders || 0;
                const adCostPerOrder = (periodSpendMAD != null && delivered > 0) ? periodSpendMAD / delivered : null;
                const prices = conn ? getItemPrices(conn.item_type, conn.item_id) : null;
                const profit = prices
                  ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - (adCostPerOrder ?? 0)
                  : null;
                const dot = getDotInfo(conn, delivered, periodSpendMAD, profit);
                const rowBg = dot.color === '#22c55e' ? '#0d2a1e22' : dot.color === '#f59e0b' ? '#1e1a0022' : dot.color === '#ef4444' ? '#2a0d0d22' : 'var(--bg)';
                const rowBorder = dot.color === '#6b7280' ? 'var(--border)' : dot.color + '55';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: rowBg, borderRadius: 8, border: `1px solid ${rowBorder}`, borderLeft: `4px solid ${dot.color}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 240, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dot.title}>{c.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: isActive ? '#0d2a1e' : '#1a1a2e', color: isActive ? '#00d48f' : '#8892b0', flexShrink: 0 }}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      {periodSpendMAD != null && <MetricCell label="Spend" value={`${fmt(periodSpendMAD)} MAD`} color="#f59e0b" />}
                      <MetricCell label="Budget" value={c.budget ? `$${fmt(c.budget)}/d` : '—'} />
                      <MetricCell label="Objective" value={c.objective_type || '—'} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isActive
                        ? <button className="btn btn-secondary btn-sm" onClick={() => pauseTikTokCampaign(c.id).then(loadTtCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pause size={11} /> Pause</button>
                        : <button className="btn btn-primary btn-sm" onClick={() => resumeTikTokCampaign(c.id).then(loadTtCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</button>}
                      {conn
                        ? <button className="btn btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: conn, platform: 'tiktok' })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00d48f', border: '1px solid #00d48f44', background: '#0d2a1e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link2 size={10} /> {conn.item_name}</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: null, platform: 'tiktok' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Link product</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        );
      })()}

      {/* SNAPCHAT */}
      {scStatus?.connected && (() => {
        const isOpen = expanded['snapchat'] !== false;
        return (
        <div className="card" style={{ marginBottom: 20, borderTop: '3px solid #FFFC00' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: isOpen ? 14 : 0 }} onClick={() => setExpanded(e => ({ ...e, snapchat: !isOpen }))}>
            <PlatformIcon name="snapchat" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Snapchat Ads</div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}><span style={{ color: '#00d48f' }}>● Connected</span> · {scStatus.account_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary btn-sm" onClick={loadScCampaigns} disabled={scLoading}><RefreshCw size={12} /></button>
              <button className="btn btn-danger btn-sm" onClick={handleScDisconnect}><Unlink size={12} /> Disconnect</button>
            </div>
            <div style={{ color: '#8892b0', marginLeft: 4 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
          </div>
          {isOpen && (scLoading ? <div style={{ color: '#8892b0', fontSize: 13 }}>Loading campaigns…</div>
          : scCampaigns.length === 0 ? <div style={{ color: '#8892b0', fontSize: 13 }}>No campaigns found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {scCampaigns.map(c => {
                const isActive = c.status === 'ACTIVE';
                const conn = connections.find(cn => cn.meta_campaign_id === c.id && cn.platform === 'snapchat');
                const stats = conn ? (connStats[conn.id] || {}) : null;
                const periodUsd = spendById[c.id] ?? null;
                const periodSpendMAD = periodUsd != null ? periodUsd * usdRate : null;
                const delivered = stats?.delivered_orders || 0;
                const adCostPerOrder = (periodSpendMAD != null && delivered > 0) ? periodSpendMAD / delivered : null;
                const prices = conn ? getItemPrices(conn.item_type, conn.item_id) : null;
                const profit = prices
                  ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - (adCostPerOrder ?? 0)
                  : null;
                const dot = getDotInfo(conn, delivered, periodSpendMAD, profit);
                const rowBg = dot.color === '#22c55e' ? '#0d2a1e22' : dot.color === '#f59e0b' ? '#1e1a0022' : dot.color === '#ef4444' ? '#2a0d0d22' : 'var(--bg)';
                const rowBorder = dot.color === '#6b7280' ? 'var(--border)' : dot.color + '55';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: rowBg, borderRadius: 8, border: `1px solid ${rowBorder}`, borderLeft: `4px solid ${dot.color}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 240, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dot.title}>{c.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: isActive ? '#0d2a1e' : '#1a1a2e', color: isActive ? '#00d48f' : '#8892b0', flexShrink: 0 }}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      {periodSpendMAD != null && <MetricCell label="Spend" value={`${fmt(periodSpendMAD)} MAD`} color="#f59e0b" />}
                      {c.daily_budget_usd != null && <MetricCell label="Budget" value={`$${fmt(c.daily_budget_usd)}/d`} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isActive
                        ? <button className="btn btn-secondary btn-sm" onClick={() => pauseSnapchatCampaign(c.id).then(loadScCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pause size={11} /> Pause</button>
                        : <button className="btn btn-primary btn-sm" onClick={() => resumeSnapchatCampaign(c.id).then(loadScCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</button>}
                      {conn
                        ? <button className="btn btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: conn, platform: 'snapchat' })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00d48f', border: '1px solid #00d48f44', background: '#0d2a1e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link2 size={10} /> {conn.item_name}</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: null, platform: 'snapchat' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Link product</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        );
      })()}

      {/* PINTEREST */}
      {ptStatus?.connected && (() => {
        const isOpen = expanded['pinterest'] !== false;
        return (
        <div className="card" style={{ marginBottom: 20, borderTop: '3px solid #E60023' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: isOpen ? 14 : 0 }} onClick={() => setExpanded(e => ({ ...e, pinterest: !isOpen }))}>
            <PlatformIcon name="pinterest" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Pinterest Ads</div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}><span style={{ color: '#00d48f' }}>● Connected</span> · {ptStatus.account_name}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary btn-sm" onClick={loadPtCampaigns} disabled={ptLoading}><RefreshCw size={12} /></button>
              <button className="btn btn-danger btn-sm" onClick={handlePtDisconnect}><Unlink size={12} /> Disconnect</button>
            </div>
            <div style={{ color: '#8892b0', marginLeft: 4 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
          </div>
          {isOpen && (ptLoading ? <div style={{ color: '#8892b0', fontSize: 13 }}>Loading campaigns…</div>
          : ptCampaigns.length === 0 ? <div style={{ color: '#8892b0', fontSize: 13 }}>No campaigns found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ptCampaigns.map(c => {
                const isActive = c.status === 'ACTIVE';
                const conn = connections.find(cn => cn.meta_campaign_id === c.id && cn.platform === 'pinterest');
                const stats = conn ? (connStats[conn.id] || {}) : null;
                const periodUsd = spendById[c.id] ?? null;
                const periodSpendMAD = periodUsd != null ? periodUsd * usdRate : null;
                const delivered = stats?.delivered_orders || 0;
                const adCostPerOrder = (periodSpendMAD != null && delivered > 0) ? periodSpendMAD / delivered : null;
                const prices = conn ? getItemPrices(conn.item_type, conn.item_id) : null;
                const profit = prices
                  ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - (adCostPerOrder ?? 0)
                  : null;
                const dot = getDotInfo(conn, delivered, periodSpendMAD, profit);
                const rowBg = dot.color === '#22c55e' ? '#0d2a1e22' : dot.color === '#f59e0b' ? '#1e1a0022' : dot.color === '#ef4444' ? '#2a0d0d22' : 'var(--bg)';
                const rowBorder = dot.color === '#6b7280' ? 'var(--border)' : dot.color + '55';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: rowBg, borderRadius: 8, border: `1px solid ${rowBorder}`, borderLeft: `4px solid ${dot.color}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 240, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dot.title}>{c.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: isActive ? '#0d2a1e' : '#1a1a2e', color: isActive ? '#00d48f' : '#8892b0', flexShrink: 0 }}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      {periodSpendMAD != null && <MetricCell label="Spend" value={`${fmt(periodSpendMAD)} MAD`} color="#f59e0b" />}
                      {c.daily_budget_usd != null && <MetricCell label="Budget" value={`$${fmt(c.daily_budget_usd)}/d`} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isActive
                        ? <button className="btn btn-secondary btn-sm" onClick={() => pausePinterestCampaign(c.id).then(loadPtCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pause size={11} /> Pause</button>
                        : <button className="btn btn-primary btn-sm" onClick={() => resumePinterestCampaign(c.id).then(loadPtCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</button>}
                      {conn
                        ? <button className="btn btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: conn, platform: 'pinterest' })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00d48f', border: '1px solid #00d48f44', background: '#0d2a1e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link2 size={10} /> {conn.item_name}</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: null, platform: 'pinterest' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Link product</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        );
      })()}

      {/* GOOGLE */}
      {ggStatus?.connected && (() => {
        const isOpen = expanded['google'] !== false;
        return (
        <div className="card" style={{ marginBottom: 20, borderTop: '3px solid #ea4335' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginBottom: isOpen ? 14 : 0 }} onClick={() => setExpanded(e => ({ ...e, google: !isOpen }))}>
            <PlatformIcon name="google" size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Google Ads</div>
              <div style={{ fontSize: 12, color: '#8892b0', marginTop: 2 }}><span style={{ color: '#00d48f' }}>● Connected</span> · {ggStatus.account_name} · {ggStatus.customer_id}</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <button className="btn btn-secondary btn-sm" onClick={loadGgCampaigns} disabled={ggLoading}><RefreshCw size={12} /></button>
              <button className="btn btn-danger btn-sm" onClick={handleGgDisconnect}><Unlink size={12} /> Disconnect</button>
            </div>
            <div style={{ color: '#8892b0', marginLeft: 4 }}>{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
          </div>
          {isOpen && (ggLoading ? <div style={{ color: '#8892b0', fontSize: 13 }}>Loading campaigns…</div>
          : ggCampaigns.length === 0 ? <div style={{ color: '#8892b0', fontSize: 13 }}>No campaigns found.</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ggCampaigns.map(c => {
                const isActive = c.status === 'ENABLED';
                const conn = connections.find(cn => cn.meta_campaign_id === c.id && cn.platform === 'google');
                const stats = conn ? (connStats[conn.id] || {}) : null;
                const periodUsd = spendById[c.id] ?? null;
                const periodSpendMAD = periodUsd != null ? periodUsd * usdRate : null;
                const delivered = stats?.delivered_orders || 0;
                const adCostPerOrder = (periodSpendMAD != null && delivered > 0) ? periodSpendMAD / delivered : null;
                const prices = conn ? getItemPrices(conn.item_type, conn.item_id) : null;
                const profit = prices
                  ? prices.selling_price - prices.buy_price - prices.packaging_cost - (stats?.avg_delivery_cost ?? 0) - (adCostPerOrder ?? 0)
                  : null;
                const dot = getDotInfo(conn, delivered, periodSpendMAD, profit);
                const displaySpend = periodSpendMAD ?? (c.spend_all_time_usd || 0) * usdRate;
                const rowBg = dot.color === '#22c55e' ? '#0d2a1e22' : dot.color === '#f59e0b' ? '#1e1a0022' : dot.color === '#ef4444' ? '#2a0d0d22' : 'var(--bg)';
                const rowBorder = dot.color === '#6b7280' ? 'var(--border)' : dot.color + '55';
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: rowBg, borderRadius: 8, border: `1px solid ${rowBorder}`, borderLeft: `4px solid ${dot.color}`, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, width: 240, flexShrink: 0, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={dot.title}>{c.name}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700, background: isActive ? '#0d2a1e' : '#1a1a2e', color: isActive ? '#00d48f' : '#8892b0', flexShrink: 0 }}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 18, flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                      <MetricCell label="Spend" value={`${fmt(displaySpend)} MAD`} color="#f59e0b" />
                      {c.daily_budget_usd != null && <MetricCell label="Budget" value={`$${fmt(c.daily_budget_usd)}/d`} />}
                      {c.channel_type && <MetricCell label="Type" value={c.channel_type} />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {isActive
                        ? <button className="btn btn-secondary btn-sm" onClick={() => pauseGoogleCampaign(c.id).then(loadGgCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Pause size={11} /> Pause</button>
                        : <button className="btn btn-primary btn-sm" onClick={() => resumeGoogleCampaign(c.id).then(loadGgCampaigns).catch(e => setError(e.response?.data?.detail || 'Failed'))} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Play size={11} /> Resume</button>}
                      {conn
                        ? <button className="btn btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: conn, platform: 'google' })} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#00d48f', border: '1px solid #00d48f44', background: '#0d2a1e', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Link2 size={10} /> {conn.item_name}</button>
                        : <button className="btn btn-secondary btn-sm" onClick={() => setConnectSidebar({ campaign: c, existingConn: null, platform: 'google' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={10} /> Link product</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        );
      })()}

      {/* No platforms connected yet */}
      {!metaStatus?.connected && !ttStatus?.connected && !scStatus?.connected && !ptStatus?.connected && !ggStatus?.connected && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: '#8892b0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No platforms connected</div>
          <div style={{ fontSize: 13 }}>Click "Connect Platform" to link your ad accounts</div>
        </div>
      )}

      {/* Connect Platform Modal */}
      {showAddPlatform && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{connectingPlatform ? 'Connect' : 'Connect a Platform'}</h2>
              <button className="btn-icon" onClick={() => { setShowAddPlatform(false); setConnectingPlatform(null); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

              {!connectingPlatform && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { key: 'facebook', label: 'Meta Ads', connected: metaStatus?.connected },
                    { key: 'google',   label: 'Google Ads', connected: ggStatus?.connected },
                    { key: 'tiktok',   label: 'TikTok Ads', connected: ttStatus?.connected },
                    { key: 'snapchat', label: 'Snapchat Ads', connected: scStatus?.connected },
                    { key: 'pinterest',label: 'Pinterest Ads', connected: ptStatus?.connected },
                  ].map(p => (
                    <div key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, border: `1px solid ${p.connected ? '#00d48f33' : '#2d3248'}`, background: '#1d1d27' }}>
                      <PlatformIcon name={p.key} size={28} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{p.label}</span>
                      {p.connected
                        ? <span style={{ fontSize: 12, color: '#00d48f' }}>● Connected</span>
                        : <button className="btn btn-primary btn-sm" onClick={() => { setConnectingPlatform(p.key); setError(''); }}>Connect</button>
                      }
                    </div>
                  ))}
                </div>
              )}

              {connectingPlatform === 'facebook' && (
                <div>
                  <div style={{ fontSize: 13, color: '#8892b0', marginBottom: 14 }}>
                    You need a <strong style={{ color: '#fff' }}>Meta Access Token</strong> and your <strong style={{ color: '#fff' }}>Ad Account ID</strong>.{' '}
                    <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer" style={{ color: '#0866FF', display: 'inline-flex', alignItems: 'center', gap: 3 }}>Get token <ExternalLink size={11} /></a>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label className="form-label">Access Token *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" type="password" placeholder="EAAxxxxxx..." value={metaForm.access_token} onChange={e => { setMetaForm({ ...metaForm, access_token: e.target.value }); setMetaAdAccounts([]); }} style={{ flex: 1 }} />
                      <button className="btn btn-secondary" onClick={handleFetchAccounts} disabled={fetchingAccounts} style={{ whiteSpace: 'nowrap' }}>{fetchingAccounts ? '...' : 'Fetch Accounts'}</button>
                    </div>
                  </div>
                  {metaAdAccounts.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <label className="form-label">Ad Account *</label>
                      <select className="form-input" value={metaForm.ad_account_id} onChange={e => setMetaForm({ ...metaForm, ad_account_id: e.target.value })}>
                        <option value="">Select an account</option>
                        {metaAdAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id}) — {a.currency}</option>)}
                      </select>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleMetaConnect} disabled={metaConnecting}>{metaConnecting ? 'Connecting…' : 'Connect'}</button>
                    <button className="btn btn-secondary" onClick={() => setConnectingPlatform(null)}>Back</button>
                  </div>
                </div>
              )}

              {connectingPlatform === 'google' && (
                <div>
                  <div style={{ fontSize: 13, color: '#8892b0', marginBottom: 14 }}>
                    You need a <strong style={{ color: '#fff' }}>Google OAuth Access Token</strong>, your <strong style={{ color: '#fff' }}>Customer ID</strong> (e.g. 123-456-7890), and a <strong style={{ color: '#fff' }}>Developer Token</strong>.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">Access Token *</label><input className="form-input" type="password" placeholder="ya29.xxx..." value={ggForm.access_token} onChange={e => setGgForm({ ...ggForm, access_token: e.target.value })} /></div>
                    <div><label className="form-label">Customer ID *</label><input className="form-input" placeholder="123-456-7890" value={ggForm.customer_id} onChange={e => setGgForm({ ...ggForm, customer_id: e.target.value })} /></div>
                    <div><label className="form-label">Developer Token *</label><input className="form-input" type="password" placeholder="Developer token..." value={ggForm.developer_token} onChange={e => setGgForm({ ...ggForm, developer_token: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleGgConnect} disabled={ggConnecting}>{ggConnecting ? 'Connecting…' : 'Connect'}</button>
                    <button className="btn btn-secondary" onClick={() => setConnectingPlatform(null)}>Back</button>
                  </div>
                </div>
              )}

              {connectingPlatform === 'tiktok' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">Access Token *</label><input className="form-input" type="password" placeholder="TikTok access token..." value={ttForm.access_token} onChange={e => setTtForm({ ...ttForm, access_token: e.target.value })} /></div>
                    <div><label className="form-label">Advertiser ID *</label><input className="form-input" placeholder="e.g. 7012345678901234567" value={ttForm.advertiser_id} onChange={e => setTtForm({ ...ttForm, advertiser_id: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleTtConnect} disabled={ttConnecting}>{ttConnecting ? 'Connecting…' : 'Connect'}</button>
                    <button className="btn btn-secondary" onClick={() => setConnectingPlatform(null)}>Back</button>
                  </div>
                </div>
              )}

              {connectingPlatform === 'snapchat' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">Access Token *</label><input className="form-input" type="password" placeholder="Snapchat access token..." value={scForm.access_token} onChange={e => setScForm({ ...scForm, access_token: e.target.value })} /></div>
                    <div><label className="form-label">Ad Account ID *</label><input className="form-input" placeholder="e.g. 12345678-..." value={scForm.ad_account_id} onChange={e => setScForm({ ...scForm, ad_account_id: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleScConnect} disabled={scConnecting}>{scConnecting ? 'Connecting…' : 'Connect'}</button>
                    <button className="btn btn-secondary" onClick={() => setConnectingPlatform(null)}>Back</button>
                  </div>
                </div>
              )}

              {connectingPlatform === 'pinterest' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <div><label className="form-label">Access Token *</label><input className="form-input" type="password" placeholder="Pinterest access token..." value={ptForm.access_token} onChange={e => setPtForm({ ...ptForm, access_token: e.target.value })} /></div>
                    <div><label className="form-label">Ad Account ID *</label><input className="form-input" placeholder="e.g. 549755885175" value={ptForm.ad_account_id} onChange={e => setPtForm({ ...ptForm, ad_account_id: e.target.value })} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handlePtConnect} disabled={ptConnecting}>{ptConnecting ? 'Connecting…' : 'Connect'}</button>
                    <button className="btn btn-secondary" onClick={() => setConnectingPlatform(null)}>Back</button>
                  </div>
                </div>
              )}
            </div>
            {!connectingPlatform && (
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAddPlatform(false)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Campaign Connect Modal ── */}
      {connectSidebar && (
        <CampaignConnectModal
          campaign={connectSidebar.campaign}
          existingConn={connectSidebar.existingConn}
          products={products}
          packs={packs}
          offers={offers}
          usdRate={usdRate}
          dateFrom={calcStart}
          dateTo={calcEnd}
          periodSpendUsd={spendById[connectSidebar.campaign?.id] ?? null}
          platform={connectSidebar.platform || 'meta'}
          onSave={handleSaveConnection}
          onClose={() => setConnectSidebar(null)}
        />
      )}

      {/* Full Campaign Wizard */}
      {showWizard && (
        <MetaCampaignWizard
          usdRate={usdRate}
          onClose={() => setShowWizard(false)}
          onSuccess={(msg) => { setSuccess(msg); loadMetaCampaigns(); }}
        />
      )}

      {/* Create Meta Campaign Modal (simple) */}
      {showMetaCreate && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>New Meta Campaign</h2>
              <button className="btn-icon" onClick={() => { setShowMetaCreate(false); setError(''); }}>✕</button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-error">{error}</div>}
              <div style={{ marginBottom: 14, padding: '10px 12px', background: '#1d1d27', borderRadius: 8, fontSize: 12, color: '#8892b0' }}>
                This creates a campaign shell in Meta. You'll need to add Ad Sets and Ads inside Meta Business Manager before it can run.
              </div>
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Campaign Name *</label>
                <input className="form-input" type="text" placeholder="e.g. Summer Sale 2025"
                  value={metaCreateForm.name}
                  onChange={e => setMetaCreateForm({ ...metaCreateForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Objective</label>
                  <select className="form-input" value={metaCreateForm.objective}
                    onChange={e => setMetaCreateForm({ ...metaCreateForm, objective: e.target.value })}>
                    {META_OBJECTIVES.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Start Status</label>
                  <select className="form-input" value={metaCreateForm.status}
                    onChange={e => setMetaCreateForm({ ...metaCreateForm, status: e.target.value })}>
                    <option value="PAUSED">Paused (recommended)</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Daily Budget (USD) *</label>
                <input className="form-input" type="number" min="1" step="0.5" placeholder="e.g. 10"
                  value={metaCreateForm.daily_budget}
                  onChange={e => setMetaCreateForm({ ...metaCreateForm, daily_budget: e.target.value })} />
                {metaCreateForm.daily_budget && parseFloat(metaCreateForm.daily_budget) > 0 && (
                  <div style={{ marginTop: 4, fontSize: 12, color: '#8892b0' }}>
                    ≈ {fmt(parseFloat(metaCreateForm.daily_budget) * usdRate)} MAD/day
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setShowMetaCreate(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMetaCreate}>Create in Meta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

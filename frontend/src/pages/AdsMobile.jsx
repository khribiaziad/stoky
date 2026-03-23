import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, TrendingUp } from 'lucide-react';
import CampaignConnectModal from './CampaignConnectModal';
import {
  getSetting,
  getMetaStatus, getMetaCampaigns, getMetaSpend,
  getTikTokStatus, getTikTokCampaigns, getTikTokSpend,
  getSnapchatStatus, getSnapchatCampaigns, getSnapchatSpend,
  getPinterestStatus, getPinterestCampaigns, getPinterestSpend,
  getGoogleStatus, getGoogleCampaigns, getGoogleSpend,
  getProducts, getPacks, getOffers,
  getCampaignConnections, saveCampaignConnection, deleteCampaignConnection, getCampaignBulkStats,
} from '../api';

const fmt = n => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUsd = n => Number(n || 0).toFixed(2);

const STATUS_COLORS = {
  ACTIVE: { bg: '#0d2a1e', color: '#00d48f', label: 'Active' },
  ENABLE: { bg: '#0d2a1e', color: '#00d48f', label: 'Active' },
  ENABLED: { bg: '#0d2a1e', color: '#00d48f', label: 'Active' },
  PAUSED: { bg: '#2d3248', color: '#8892b0', label: 'Paused' },
  DEFAULT: { bg: '#2d3248', color: '#8892b0', label: 'Paused' },
};

function statusStyle(status) {
  return STATUS_COLORS[status] || STATUS_COLORS.DEFAULT;
}

// ── Platform Card ──────────────────────────────────────────────────────────
function PlatformCard({ color, name, accountName, campaigns, connections, connStats, spendById, usdRate, open, onToggle, onCampaignTap, loading }) {
  const activeCnt = campaigns.filter(c => ['ACTIVE', 'ENABLE', 'ENABLED'].includes(c.status)).length;

  return (
    <div style={{ background: 'var(--card)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Collapsed header */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            <span style={{ color: '#00d48f' }}>● Connected</span>
            {accountName ? ` · ${accountName}` : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{campaigns.length} campaigns</div>
          {activeCnt > 0 && <div style={{ fontSize: 11, color: '#00d48f' }}>{activeCnt} active</div>}
        </div>
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </div>

      {/* Expanded — campaign list */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>Loading campaigns…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 13 }}>No campaigns found.</div>
          ) : campaigns.map(c => {
            const s         = statusStyle(c.status);
            const conn      = connections.find(cn => cn.meta_campaign_id === c.id);
            const stats     = conn ? (connStats[conn.id] || {}) : null;
            const periodUsd = spendById[c.id] ?? null;
            const spend     = periodUsd != null ? periodUsd * usdRate : null;
            const delivered = stats?.delivered_orders || 0;
            const cpo       = spend != null && delivered > 0 ? spend / delivered : null;
            return (
              <div key={c.id} onClick={() => onCampaignTap(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: 'transparent' }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0, marginTop: 1 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                    <span style={{ background: s.bg, color: s.color, padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>{s.label}</span>
                    {c.daily_budget_usd != null && <span style={{ color: '#60a5fa' }}>${fmtUsd(c.daily_budget_usd)}/day</span>}
                  </div>
                  {conn && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: '#a78bfa', background: '#1e1a2e', padding: '2px 6px', borderRadius: 6 }}>
                        💸 {spend != null ? `${fmt(spend)} MAD` : '—'}
                      </span>
                      <span style={{ fontSize: 10, color: '#60a5fa', background: '#131c2e', padding: '2px 6px', borderRadius: 6 }}>
                        📦 {delivered} delivered
                      </span>
                      <span style={{ fontSize: 10, color: cpo != null ? '#f59e0b' : '#8892b0', background: '#1e1a14', padding: '2px 6px', borderRadius: 6 }}>
                        🎯 {cpo != null ? `${fmt(cpo)} MAD/order` : 'No orders yet'}
                      </span>
                    </div>
                  )}
                </div>

                {conn && (
                  <span style={{ background: '#0d2a1e', color: '#00d48f', padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    ● {conn.item_name}
                  </span>
                )}
                <ChevronDown size={14} color="var(--text-muted)" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Mobile Component ───────────────────────────────────────────────────
export default function AdsMobile() {
  const [usdRate,      setUsdRate]      = useState(10);
  const [openPlatform, setOpenPlatform] = useState(null);
  const [selectedCamp, setSelectedCamp] = useState(null); // opens modal

  // Platform statuses
  const [metaStatus, setMetaStatus] = useState(null);
  const [ttStatus,   setTtStatus]   = useState(null);
  const [scStatus,   setScStatus]   = useState(null);
  const [ptStatus,   setPtStatus]   = useState(null);
  const [ggStatus,   setGgStatus]   = useState(null);

  // Campaigns
  const [metaCampaigns, setMetaCampaigns] = useState([]);
  const [ttCampaigns,   setTtCampaigns]   = useState([]);
  const [scCampaigns,   setScCampaigns]   = useState([]);
  const [ptCampaigns,   setPtCampaigns]   = useState([]);
  const [ggCampaigns,   setGgCampaigns]   = useState([]);
  const [metaLoading,   setMetaLoading]   = useState(false);

  // Catalog + connections
  const [connections,   setConnections]   = useState([]);
  const [connStats,     setConnStats]     = useState({});
  const [products,      setProducts]      = useState([]);
  const [packs,         setPacks]         = useState([]);
  const [offers,        setOffers]        = useState([]);
  const [spendById, setSpendById] = useState({}); // campaignId → spend_usd for period (all platforms)

  // Date range (for stats)
  const [dateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); });
  const [dateTo]   = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    getSetting('usd_rate').catch(() => ({ data: { value: '10' } }))
      .then(r => setUsdRate(parseFloat(r.data?.value || '10') || 10));

    // Platform statuses
    getMetaStatus().catch(() => ({ data: { connected: false } })).then(r => {
      setMetaStatus(r.data);
      if (r.data?.connected) {
        setMetaLoading(true);
        getMetaCampaigns().then(res => setMetaCampaigns(res.data)).catch(() => {}).finally(() => setMetaLoading(false));
      }
    });
    getTikTokStatus().catch(() => ({ data: { connected: false } })).then(r => {
      setTtStatus(r.data);
      if (r.data?.connected) getTikTokCampaigns().then(res => setTtCampaigns(res.data)).catch(() => {});
    });
    getSnapchatStatus().catch(() => ({ data: { connected: false } })).then(r => {
      setScStatus(r.data);
      if (r.data?.connected) getSnapchatCampaigns().then(res => setScCampaigns(res.data)).catch(() => {});
    });
    getPinterestStatus().catch(() => ({ data: { connected: false } })).then(r => {
      setPtStatus(r.data);
      if (r.data?.connected) getPinterestCampaigns().then(res => setPtCampaigns(res.data)).catch(() => {});
    });
    getGoogleStatus().catch(() => ({ data: { connected: false } })).then(r => {
      setGgStatus(r.data);
      if (r.data?.connected) getGoogleCampaigns().then(res => setGgCampaigns(res.data)).catch(() => {});
    });

    getCampaignConnections().then(r => setConnections(r.data)).catch(() => {});
    getProducts().then(r => setProducts(r.data)).catch(() => {});
    getPacks().then(r => setPacks(r.data)).catch(() => {});
    getOffers().then(r => setOffers(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (connections.length === 0) { setConnStats({}); return; }
    getCampaignBulkStats(dateFrom, dateTo).then(r => setConnStats(r.data)).catch(() => {});
  }, [connections.length, dateFrom, dateTo]);

  // Fetch period spend from all connected platforms
  useEffect(() => {
    const fetchers = [
      metaStatus?.connected     && getMetaSpend(dateFrom, dateTo),
      ttStatus?.connected       && getTikTokSpend(dateFrom, dateTo),
      scStatus?.connected       && getSnapchatSpend(dateFrom, dateTo),
      ptStatus?.connected       && getPinterestSpend(dateFrom, dateTo),
      ggStatus?.connected       && getGoogleSpend(dateFrom, dateTo),
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
  }, [metaStatus?.connected, ttStatus?.connected, scStatus?.connected, ptStatus?.connected, ggStatus?.connected]);

  const handleSaveConnection = async (data) => {
    const r = await saveCampaignConnection(data);
    setConnections(prev => {
      const without = prev.filter(c => c.meta_campaign_id !== data.meta_campaign_id);
      return [...without, r.data];
    });
  };

  const getItemPrices = (itemType, itemId) => {
    if (itemType === 'product') {
      const p = products.find(x => x.id === itemId); const v = p?.variants?.[0];
      return v ? { selling_price: v.selling_price || 0, buy_price: v.buying_price || 0, packaging_cost: 0 } : null;
    }
    if (itemType === 'pack') {
      const pk = packs.find(x => x.id === itemId); if (!pk) return null;
      const presetBuy = pk.presets?.[0]?.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0);
      let buy_price = presetBuy || 0;
      if (!buy_price && pk.product_id) { const prod = products.find(x => x.id === pk.product_id); buy_price = (prod?.variants?.[0]?.buying_price || 0) * (pk.item_count || 1); }
      return { selling_price: pk.selling_price, buy_price, packaging_cost: pk.packaging_cost || 0 };
    }
    if (itemType === 'offer') {
      const of = offers.find(x => x.id === itemId); if (!of) return null;
      return { selling_price: of.selling_price, buy_price: of.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0) || 0, packaging_cost: of.packaging_cost || 0 };
    }
    return null;
  };

  const connectedPlatforms = [
    metaStatus?.connected,
    ttStatus?.connected,
    scStatus?.connected,
    ptStatus?.connected,
    ggStatus?.connected,
  ].filter(Boolean).length;

  const allCampaigns = [
    ...metaCampaigns, ...ttCampaigns, ...scCampaigns, ...ptCampaigns, ...ggCampaigns,
  ];
  const activeCnt        = allCampaigns.filter(c => ['ACTIVE','ENABLE','ENABLED'].includes(c.status)).length;
  const totalPeriodSpend = Object.values(spendById).reduce((s, v) => s + v, 0) * usdRate;
  const totalDelivered   = profRows.reduce((s, r) => s + r.delivered, 0);
  const totalRealProfit  = profRows.reduce((s, r) => s + (r.totalProfit || 0), 0);

  // Profitability rows (only Meta for now since connections use meta_campaign_id)
  const profRows = connections.map(conn => {
    const campaign = metaCampaigns.find(c => c.id === conn.meta_campaign_id);
    if (!campaign) return null;
    const periodUsd   = spendById[conn.meta_campaign_id] ?? null;
    const spend       = periodUsd != null ? periodUsd * usdRate : (campaign.spend_all_time_usd || 0) * usdRate;
    const stats       = connStats[conn.id] || {};
    const delivered   = stats.delivered_orders || 0;
    const adCost      = delivered > 0 ? spend / delivered : 0;
    const prices      = getItemPrices(conn.item_type, conn.item_id);
    const profit      = prices ? prices.selling_price - prices.buy_price - prices.packaging_cost - conn.delivery_cost - adCost : null;
    const totalProfit = profit !== null ? profit * delivered : null;
    return { conn, campaign, spend, delivered, stats, profit, totalProfit };
  }).filter(Boolean);

  return (
    <div style={{ padding: '0 0 80px' }}>

      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Ads</h1>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {connectedPlatforms} platform{connectedPlatforms !== 1 ? 's' : ''} connected
        </div>
      </div>

      {/* KPI Summary bar */}
      {connectedPlatforms > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Active Campaigns', value: activeCnt,                                               color: '#00d48f' },
            { label: 'Platforms',        value: connectedPlatforms,                                      color: '#60a5fa' },
            { label: 'Period Spend',     value: `${fmt(totalPeriodSpend)} MAD`,                          color: '#a78bfa' },
            { label: 'Delivered',        value: totalDelivered,                                          color: '#60a5fa' },
            { label: 'Real Profit',      value: `${fmt(totalRealProfit)} MAD`,                           color: totalRealProfit >= 0 ? '#00d48f' : '#f87171' },
            { label: 'Connected',        value: profRows.length,                                         color: '#fbbf24' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* No platforms */}
      {connectedPlatforms === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>No platforms connected</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connect your ad accounts on desktop first</div>
        </div>
      )}

      {/* Platform cards */}
      {metaStatus?.connected && (
        <PlatformCard
          color="#0866FF" name="Meta Ads" accountName={metaStatus.account_name}
          campaigns={metaCampaigns} connections={connections} connStats={connStats} spendById={spendById} usdRate={usdRate}
          loading={metaLoading}
          open={openPlatform === 'meta'}
          onToggle={() => setOpenPlatform(openPlatform === 'meta' ? null : 'meta')}
          onCampaignTap={c => setSelectedCamp(c)}
        />
      )}
      {ttStatus?.connected && (
        <PlatformCard
          color="#010101" name="TikTok Ads" accountName={ttStatus.account_name}
          campaigns={ttCampaigns} connections={connections} connStats={connStats} spendById={spendById} usdRate={usdRate}
          loading={false}
          open={openPlatform === 'tiktok'}
          onToggle={() => setOpenPlatform(openPlatform === 'tiktok' ? null : 'tiktok')}
          onCampaignTap={c => setSelectedCamp(c)}
        />
      )}
      {scStatus?.connected && (
        <PlatformCard
          color="#FFFC00" name="Snapchat Ads" accountName={scStatus.account_name}
          campaigns={scCampaigns} connections={connections} connStats={connStats} spendById={spendById} usdRate={usdRate}
          loading={false}
          open={openPlatform === 'snapchat'}
          onToggle={() => setOpenPlatform(openPlatform === 'snapchat' ? null : 'snapchat')}
          onCampaignTap={c => setSelectedCamp(c)}
        />
      )}
      {ptStatus?.connected && (
        <PlatformCard
          color="#E60023" name="Pinterest Ads" accountName={ptStatus.account_name}
          campaigns={ptCampaigns} connections={connections} connStats={connStats} spendById={spendById} usdRate={usdRate}
          loading={false}
          open={openPlatform === 'pinterest'}
          onToggle={() => setOpenPlatform(openPlatform === 'pinterest' ? null : 'pinterest')}
          onCampaignTap={c => setSelectedCamp(c)}
        />
      )}
      {ggStatus?.connected && (
        <PlatformCard
          color="#ea4335" name="Google Ads" accountName={ggStatus.account_name}
          campaigns={ggCampaigns} connections={connections} connStats={connStats} spendById={spendById} usdRate={usdRate}
          loading={false}
          open={openPlatform === 'google'}
          onToggle={() => setOpenPlatform(openPlatform === 'google' ? null : 'google')}
          onCampaignTap={c => setSelectedCamp(c)}
        />
      )}

      {/* Real Profitability section */}
      {profRows.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', borderTop: '3px solid #a78bfa', marginTop: 16 }}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={15} style={{ color: '#a78bfa' }} />
            <span style={{ fontWeight: 700 }}>Real Profitability</span>
            <span style={{ fontSize: 11, background: '#2d3248', borderRadius: 10, padding: '1px 6px' }}>{profRows.length}</span>
          </div>

          {profRows.map(({ conn, campaign, spend, delivered, stats, profit, totalProfit }) => (
            <div key={conn.id} style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{campaign.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span style={{ textTransform: 'uppercase' }}>{conn.item_type}</span> · {conn.item_name}
                  </div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 15, color: (profit || 0) >= 0 ? '#00d48f' : '#f87171' }}>
                  {profit !== null ? `${fmt(profit)} MAD` : '—'}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400, textAlign: 'right' }}>per order</div>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[
                  { label: 'Spend', value: `${fmt(spend)} MAD`, color: '#a78bfa' },
                  { label: 'Delivered', value: delivered, color: '#60a5fa' },
                  { label: 'Return', value: `${stats.return_rate || 0}%`, color: (stats.return_rate || 0) > 30 ? '#f87171' : '#fbbf24' },
                  { label: 'Total profit', value: totalProfit !== null ? `${fmt(totalProfit)} MAD` : '—', color: (totalProfit || 0) >= 0 ? '#00d48f' : '#f87171' },
                ].map((s, i) => (
                  <div key={i} style={{ background: '#13151e', borderRadius: 8, padding: '5px 10px', flex: '1 0 70px' }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 12, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign connect modal */}
      {selectedCamp && (
        <CampaignConnectModal
          campaign={selectedCamp}
          existingConn={connections.find(cn => cn.meta_campaign_id === selectedCamp.id) || null}
          products={products}
          packs={packs}
          offers={offers}
          usdRate={usdRate}
          dateFrom={dateFrom}
          dateTo={dateTo}
          periodSpendUsd={spendById[selectedCamp.id] ?? null}
          platform={connections.find(cn => cn.meta_campaign_id === selectedCamp.id)?.platform || 'meta'}
          onSave={handleSaveConnection}
          onClose={() => setSelectedCamp(null)}
        />
      )}
    </div>
  );
}

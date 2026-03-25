import { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { getCampaignItemStats } from '../api';

const fmt = n => Number(n || 0).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABELS = { product: 'Product', pack: 'Pack', offer: 'Offer' };

export default function CampaignConnectSidebar({
  campaign,       // { id: string, name: string, spend_all_time_usd: number }
  existingConn,   // null | { id, meta_campaign_id, item_type, item_id, delivery_cost }
  products,
  packs,
  offers,
  usdRate,
  dateFrom,       // YYYY-MM-DD for stats range
  dateTo,
  onSave,         // async (payload) => void
  onClose,
}) {
  const [itemType,     setItemType]     = useState(existingConn?.item_type || 'product');
  const [itemId,       setItemId]       = useState(existingConn?.item_id?.toString() || '');
  const [deliveryCost, setDeliveryCost] = useState(String(existingConn?.delivery_cost ?? 25));
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [copied,       setCopied]       = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Campaign all-time spend in MAD
  const campaignSpend = (campaign?.spend_all_time_usd || 0) * usdRate;

  // Item price breakdown
  const prices = (() => {
    if (!itemId) return null;
    const id = parseInt(itemId);
    if (itemType === 'product') {
      const p = products.find(x => x.id === id);
      if (!p) return null;
      const v = p.variants?.[0];
      return { selling_price: v?.selling_price || 0, buy_price: v?.buying_price || 0, packaging_cost: 0 };
    }
    if (itemType === 'pack') {
      const pk = packs.find(x => x.id === id);
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
      const of = offers.find(x => x.id === id);
      if (!of) return null;
      const buy_price = of.items?.reduce((s, i) => s + (i.buying_price || 0) * i.quantity, 0) || 0;
      return { selling_price: of.selling_price, buy_price, packaging_cost: of.packaging_cost || 0 };
    }
    return null;
  })();

  // Load order stats when item changes
  useEffect(() => {
    if (!itemId) { setStats(null); return; }
    setStatsLoading(true);
    getCampaignItemStats(itemType, parseInt(itemId), dateFrom, dateTo)
      .then(r => setStats(r.data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [itemType, itemId, dateFrom, dateTo]);

  const delivery       = parseFloat(deliveryCost) || 0;
  const delivered      = stats?.delivered_orders || 0;
  const adCostPerOrder = delivered > 0 ? campaignSpend / delivered : 0;
  const realProfit     = prices
    ? prices.selling_price - prices.buy_price - prices.packaging_cost - delivery - adCostPerOrder
    : null;

  const utmRef      = campaign && itemId ? `?ref=${campaign.id}-${itemId}` : '';
  const profitColor = realProfit === null ? '#8892b0' : realProfit >= 0 ? '#00d48f' : '#f87171';

  const handleCopy = () => {
    navigator.clipboard.writeText(utmRef);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!itemId) return;
    setSaving(true);
    try {
      await onSave({
        platform: 'meta',
        meta_campaign_id: campaign.id,
        campaign_name: campaign.name || '',
        item_type: itemType,
        item_id: parseInt(itemId),
        delivery_cost: delivery,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const itemOptions = itemType === 'product'
    ? products
    : itemType === 'pack'
      ? packs.filter(p => p.is_active)
      : offers.filter(o => o.is_active);

  const rowStyle  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 13 };
  const labelStyle = { color: '#8892b0' };
  const valueStyle = { fontWeight: 600 };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: 'min(360px, 100vw)',
      background: '#1a1d27', borderLeft: '1px solid #222733',
      zIndex: 1000, display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 32px rgba(0,0,0,0.6)', overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #222733', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Connect Campaign</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500, marginBottom: 2 }}>{campaign?.name}</div>
            <div style={{ fontSize: 12, color: '#a78bfa' }}>
              All-time spend: {fmt(campaignSpend)} MAD (${fmt(campaign?.spend_all_time_usd || 0, 2)} USD)
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8892b0', cursor: 'pointer', padding: 4, marginTop: -2 }}>
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Step 1 */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8892b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            Step 1 — What does this campaign promote?
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {['product', 'pack', 'offer'].map(t => (
              <button key={t} onClick={() => { setItemType(t); setItemId(''); setStats(null); }}
                style={{
                  flex: 1, padding: '8px 0', border: `1.5px solid ${itemType === t ? '#00d48f' : '#2d3248'}`,
                  borderRadius: 8, background: itemType === t ? '#00d48f18' : '#1d1d27',
                  color: itemType === t ? '#00d48f' : '#8892b0', cursor: 'pointer',
                  fontSize: 13, fontWeight: itemType === t ? 700 : 400,
                }}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <select className="form-input" value={itemId} onChange={e => setItemId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select {TYPE_LABELS[itemType]}...</option>
            {itemOptions.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        {/* Step 2 — Cost Breakdown */}
        {prices && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8892b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Step 2 — Cost Breakdown
            </div>
            <div style={{ background: '#13151e', borderRadius: 10, padding: '12px 14px' }}>
              <div style={rowStyle}>
                <span style={labelStyle}>Selling price</span>
                <span style={valueStyle}>{fmt(prices.selling_price)} MAD</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Buy price</span>
                <span style={{ ...valueStyle, color: '#f87171' }}>− {fmt(prices.buy_price)} MAD</span>
              </div>
              <div style={rowStyle}>
                <span style={labelStyle}>Packaging cost</span>
                <span style={{ ...valueStyle, color: '#f87171' }}>− {fmt(prices.packaging_cost)} MAD</span>
              </div>

              <div style={{ borderTop: '1px solid #222733', margin: '6px 0' }} />

              <div style={{ ...rowStyle, alignItems: 'center' }}>
                <span style={labelStyle}>Delivery cost</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>−</span>
                  <input
                    type="number" min="0" step="0.5" value={deliveryCost}
                    onChange={e => setDeliveryCost(e.target.value)}
                    placeholder="e.g. 25 MAD"
                    style={{ width: 80, padding: '4px 8px', borderRadius: 6, border: '1px solid #2d3248', background: '#1d1d27', color: '#fff', fontSize: 13, textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 11, color: '#8892b0' }}>MAD</span>
                </div>
              </div>

              <div style={rowStyle}>
                <span style={labelStyle}>
                  Ad cost / delivered order
                  {statsLoading && <span style={{ marginLeft: 5, color: '#8892b0' }}>…</span>}
                </span>
                <span style={{ ...valueStyle, color: '#f87171' }}>
                  {statsLoading ? '…' : `− ${fmt(adCostPerOrder)} MAD`}
                  {!statsLoading && delivered > 0 && (
                    <span style={{ fontSize: 10, color: '#8892b0', marginLeft: 4 }}>
                      ({fmt(campaignSpend)} ÷ {delivered})
                    </span>
                  )}
                </span>
              </div>

              <div style={{ borderTop: '1px solid #222733', margin: '6px 0' }} />

              <div style={{ ...rowStyle, paddingTop: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Real profit / order</span>
                <span style={{ fontWeight: 700, fontSize: 15, color: profitColor }}>{fmt(realProfit)} MAD</span>
              </div>

              {stats && (
                <div style={rowStyle}>
                  <span style={labelStyle}>Return rate</span>
                  <span style={{ ...valueStyle, color: stats.return_rate > 30 ? '#f87171' : '#fbbf24' }}>
                    {stats.return_rate}%
                    <span style={{ fontSize: 10, color: '#8892b0', marginLeft: 4 }}>
                      ({stats.returned_orders} returned / {stats.total_orders} total)
                    </span>
                  </span>
                </div>
              )}

              {!statsLoading && stats?.delivered_orders === 0 && (
                <div style={{ fontSize: 11, color: '#8892b0', marginTop: 4 }}>
                  No delivered orders found in selected date range
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 — UTM Link */}
        {utmRef && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8892b0', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Step 3 — UTM Tracking Link
            </div>
            <div style={{ background: '#13151e', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#00d48f', background: '#0d2a1e', padding: '8px 12px', borderRadius: 6, marginBottom: 10, wordBreak: 'break-all' }}>
                {utmRef}
              </div>
              <button onClick={handleCopy} style={{
                width: '100%', padding: '9px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
                background: copied ? '#0d2a1e' : '#00d48f', color: copied ? '#00d48f' : '#0d2a1e',
                fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
              </button>
              <div style={{ fontSize: 11, color: '#8892b0', marginTop: 8, textAlign: 'center' }}>
                Add this link to your ad to track client source automatically
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid #222733', flexShrink: 0 }}>
        <button onClick={handleSave} disabled={!itemId || saving}
          style={{
            width: '100%', padding: '11px 0', border: 'none', borderRadius: 8,
            cursor: itemId ? 'pointer' : 'not-allowed',
            background: itemId ? '#00d48f' : '#2d3248',
            color: itemId ? '#0d2a1e' : '#8892b0',
            fontWeight: 700, fontSize: 14,
          }}>
          {saving ? 'Saving…' : existingConn ? 'Update Connection' : 'Save Connection'}
        </button>
      </div>
    </div>
  );
}

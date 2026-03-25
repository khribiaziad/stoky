import { useState, useEffect } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Package, X } from 'lucide-react';
import { getTeam, createTeamMember, deleteTeamMember, createConfirmerAccount, getMemberStats, toggleMemberAccount } from '../api';

const PERIODS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'this_week',   label: 'This Week' },
  { value: 'today',       label: 'Today' },
  { value: '',            label: 'All Time' },
];

// ── Shared inline style helpers ─────────────────────────────────────────────
const S = {
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  chevron: {
    fontSize: 11,
    color: 'var(--text-muted)',
    flexShrink: 0,
    transition: 'transform 0.2s',
  },
  avatar: (letter) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--accent)22',
    color: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  }),
  meta: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontWeight: 700,
    fontSize: 15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  badges: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  pill: (color) => ({
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 20,
    background: color + '22',
    color: color,
    border: `1px solid ${color}44`,
  }),
  expandedBody: {
    borderTop: '1px solid var(--border)',
    padding: '0 12px 12px',
  },
  actionRow: {
    display: 'flex',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 12,
  },
  actionBtn: (color) => ({
    flex: 1,
    minHeight: 40,
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: `1px solid ${color || 'var(--border)'}`,
    background: 'transparent',
    color: color || 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  }),
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    fontSize: 13,
    borderBottom: '1px solid var(--border)',
  },
  detailLabel: {
    color: 'var(--t2, #8892b0)',
    fontSize: 12,
  },
  detailValue: {
    fontWeight: 600,
    fontSize: 13,
  },
};

export default function TeamMobile() {
  const [team, setTeam] = useState([]);
  const [error, setError] = useState('');

  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateAccount, setShowCreateAccount] = useState(null);
  const [accountForm, setAccountForm] = useState({ username: '', password: '', role: 'confirmer' });

  const [showMemberStats, setShowMemberStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState('this_month');
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [memberForm, setMemberForm] = useState({
    name: '', role: '', payment_type: 'per_order',
    fixed_monthly: 0, per_order_rate: 0, is_confirmer: false,
    start_date: new Date().toISOString().split('T')[0],
  });

  const [expandedMember, setExpandedMember] = useState(null);

  const load = () => getTeam().then(r => setTeam(r.data));

  useEffect(() => { load(); }, []);

  const handleAddMember = async () => {
    try {
      await createTeamMember(memberForm);
      setShowAddMember(false);
      setMemberForm({ name: '', role: '', payment_type: 'per_order', fixed_monthly: 0, per_order_rate: 0, is_confirmer: false, start_date: new Date().toISOString().split('T')[0] });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const openMemberStats = (member) => {
    setShowMemberStats(member);
    setStatsPeriod('this_month');
    setStatsData(null);
    loadMemberStats(member.id, 'this_month');
  };

  const loadMemberStats = (memberId, period) => {
    setStatsLoading(true);
    getMemberStats(memberId, period ? { period } : {})
      .then(r => setStatsData(r.data))
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  };

  const handleStatsPeriodChange = (p) => {
    setStatsPeriod(p);
    loadMemberStats(showMemberStats.id, p);
  };

  const handleCreateAccount = async () => {
    try {
      await createConfirmerAccount(showCreateAccount.id, accountForm);
      setShowCreateAccount(null);
      setAccountForm({ username: '', password: '', role: 'confirmer' });
      load();
    } catch (e) { setError(e.response?.data?.detail || 'Error'); }
  };

  const toggleExpand = (memberId) => {
    setExpandedMember(expandedMember === memberId ? null : memberId);
  };

  const paymentColor = (type) => {
    if (type === 'monthly') return '#818cf8';
    if (type === 'per_order') return '#a78bfa';
    return '#c084fc';
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Team</h1>
        <button className="btn btn-primary" onClick={() => setShowAddMember(true)}>+ Add Member</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Member cards */}
      {team.length === 0 ? (
        <div className="empty-state"><h3>No team members yet</h3></div>
      ) : (
        team.map(m => {
          const isOpen = expandedMember === m.id;
          const initial = (m.name || '?')[0].toUpperCase();

          return (
            <div key={m.id} style={S.card}>
              {/* Collapsed header */}
              <div style={S.cardHeader} onClick={() => toggleExpand(m.id)}>
                <span style={{ ...S.chevron, transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>

                <div style={S.avatar(initial)}>
                  {initial}
                </div>

                <div style={S.meta}>
                  <div style={S.memberName}>{m.name}</div>
                  <div style={S.badges}>
                    {m.role && (
                      <span style={S.pill('#8892b0')}>{m.role}</span>
                    )}
                    <span style={S.pill(paymentColor(m.payment_type))}>{m.payment_type}</span>
                    {m.confirmer_username && (
                      <span style={S.pill(m.account_is_active ? 'var(--accent)' : '#8892b0')}>
                        @{m.confirmer_username}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div style={S.expandedBody} onClick={e => e.stopPropagation()}>
                  {/* Action button row */}
                  <div style={S.actionRow}>
                    <button
                      style={S.actionBtn('var(--accent)')}
                      onClick={() => openMemberStats(m)}
                    >
                      <BarChart2 size={14} strokeWidth={1.75} /> Stats
                    </button>

                    {m.confirmer_username ? (
                      <button
                        style={S.actionBtn(m.account_is_active ? '#f87171' : '#4ade80')}
                        onClick={() => toggleMemberAccount(m.id).then(load)}
                      >
                        {m.account_is_active ? 'Suspend' : 'Reactivate'}
                      </button>
                    ) : (
                      <button
                        style={S.actionBtn()}
                        onClick={() => {
                          setShowCreateAccount(m);
                          setAccountForm({
                            username: m.name.toLowerCase().replace(/\s+/g, ''),
                            password: '',
                            role: m.is_confirmer ? 'confirmer' : 'admin',
                          });
                        }}
                      >
                        + Login
                      </button>
                    )}

                    <button
                      style={S.actionBtn('#f87171')}
                      onClick={() => {
                        if (confirm('Remove team member?')) deleteTeamMember(m.id).then(load);
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {/* Detail rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {(m.payment_type === 'monthly' || m.payment_type === 'both') && m.fixed_monthly ? (
                      <div style={S.detailRow}>
                        <span style={S.detailLabel}>Monthly</span>
                        <span style={S.detailValue}>{m.fixed_monthly} MAD</span>
                      </div>
                    ) : null}

                    {(m.payment_type === 'per_order' || m.payment_type === 'both') && m.per_order_rate ? (
                      <div style={S.detailRow}>
                        <span style={S.detailLabel}>Per order</span>
                        <span style={S.detailValue}>{m.per_order_rate} MAD</span>
                      </div>
                    ) : null}

                    {m.confirmer_username && (
                      <div style={{ ...S.detailRow, borderBottom: 'none' }}>
                        <span style={S.detailLabel}>Account</span>
                        <span style={S.detailValue}>
                          @{m.confirmer_username} · {m.account_role} ·{' '}
                          <span style={{ color: m.account_is_active ? '#4ade80' : '#f87171' }}>
                            {m.account_is_active ? 'Active' : 'Suspended'}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member</h2>
              <button className="btn-icon" onClick={() => setShowAddMember(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={memberForm.name} onChange={e => setMemberForm({ ...memberForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role / Job Title</label>
                  <input className="form-input" placeholder="e.g. Packer" value={memberForm.role} onChange={e => setMemberForm({ ...memberForm, role: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Profile</label>
                <select className="form-input" value={memberForm.is_confirmer ? 'confirmer' : 'admin'} onChange={e => setMemberForm({ ...memberForm, is_confirmer: e.target.value === 'confirmer' })}>
                  <option value="confirmer">Confirmer — uploads orders, view-only on stock/products</option>
                  <option value="admin">Admin — full access to everything</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Payment Type</label>
                <select className="form-input" value={memberForm.payment_type} onChange={e => setMemberForm({ ...memberForm, payment_type: e.target.value })}>
                  <option value="monthly">Monthly Fixed</option>
                  <option value="per_order">Per Order</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="form-grid-2">
                {(memberForm.payment_type === 'monthly' || memberForm.payment_type === 'both') && (
                  <div className="form-group">
                    <label className="form-label">Monthly Salary (MAD)</label>
                    <input className="form-input" type="number" value={memberForm.fixed_monthly} onChange={e => setMemberForm({ ...memberForm, fixed_monthly: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
                {(memberForm.payment_type === 'per_order' || memberForm.payment_type === 'both') && (
                  <div className="form-group">
                    <label className="form-label">Rate Per Order (MAD)</label>
                    <input className="form-input" type="number" value={memberForm.per_order_rate} onChange={e => setMemberForm({ ...memberForm, per_order_rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={memberForm.start_date} onChange={e => setMemberForm({ ...memberForm, start_date: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddMember}>Add Member</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal */}
      {showCreateAccount && (
        <div className="modal-overlay" onClick={() => setShowCreateAccount(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Login for {showCreateAccount.name}</h2>
              <button className="btn-icon" onClick={() => setShowCreateAccount(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Account Role</label>
                <select className="form-input" value={accountForm.role} onChange={e => setAccountForm({ ...accountForm, role: e.target.value })}>
                  <option value="confirmer">Confirmer — can upload orders, view stock (read-only)</option>
                  <option value="admin">Admin — full access to everything</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Username *</label>
                <input className="form-input" value={accountForm.username} onChange={e => setAccountForm({ ...accountForm, username: e.target.value })} placeholder="e.g. ahmed" />
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input className="form-input" type="password" value={accountForm.password} onChange={e => setAccountForm({ ...accountForm, password: e.target.value })} placeholder="Min 6 characters" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateAccount(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateAccount}>Create Account</button>
            </div>
          </div>
        </div>
      )}

      {/* Member Stats Modal */}
      {showMemberStats && (
        <div className="modal-overlay" onClick={() => setShowMemberStats(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{showMemberStats.name}</h2>
                <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 3 }}>
                  {showMemberStats.role || 'Team Member'}
                  {showMemberStats.confirmer_username && <span style={{ marginLeft: 8 }}>· @{showMemberStats.confirmer_username}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select className="form-input" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} value={statsPeriod} onChange={e => handleStatsPeriodChange(e.target.value)}>
                  {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <button className="btn-icon" onClick={() => setShowMemberStats(null)}><X size={16} strokeWidth={1.75} /></button>
              </div>
            </div>
            <div className="modal-body">
              {statsLoading || !statsData ? (
                <div className="loading">Loading stats...</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                    {statsData.member.payment_type === 'monthly' || statsData.member.payment_type === 'both' ? (
                      <span className="badge badge-blue">Monthly: {statsData.member.fixed_monthly} MAD</span>
                    ) : null}
                    {statsData.member.payment_type === 'per_order' || statsData.member.payment_type === 'both' ? (
                      <span className="badge badge-purple">{statsData.member.per_order_rate} MAD / order</span>
                    ) : null}
                    <span className={`badge ${statsData.member.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {statsData.member.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {!statsData.has_account && <span className="badge badge-yellow">No login account</span>}
                  </div>

                  {!statsData.has_account ? (
                    <div className="empty-state">
                      <Package size={32} strokeWidth={1.25} style={{ margin: '0 auto 12px', color: 'var(--t3)' }} />
                      <h3>No account linked</h3>
                      <p>Create a login for this member to track their orders.</p>
                    </div>
                  ) : (
                    <>
                      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: 20 }}>
                        <div className="stat-card"><div className="stat-label">Total Orders</div><div className="stat-value">{statsData.orders.total}</div></div>
                        <div className="stat-card"><div className="stat-label">Delivered</div><div className="stat-value green">{statsData.orders.delivered}</div></div>
                        <div className="stat-card"><div className="stat-label">Returned</div><div className="stat-value red">{statsData.orders.cancelled}</div></div>
                        <div className="stat-card"><div className="stat-label">Pending</div><div className="stat-value yellow">{statsData.orders.pending}</div></div>
                        <div className="stat-card"><div className="stat-label">Earnings</div><div className="stat-value purple">{statsData.earnings.toLocaleString()} MAD</div></div>
                        <div className="stat-card"><div className="stat-label">Revenue Generated</div><div className="stat-value blue">{statsData.revenue.toLocaleString()} MAD</div></div>
                      </div>
                      <div className="card" style={{ margin: 0 }}>
                        <div className="card-title">Performance</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t2)' }}><TrendingUp size={14} strokeWidth={1.75} /> Delivery Rate</span>
                            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{statsData.orders.delivery_rate}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--card-3)', borderRadius: 3, overflow: 'hidden', marginTop: -8 }}>
                            <div style={{ height: '100%', width: `${statsData.orders.delivery_rate}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t2)' }}><TrendingDown size={14} strokeWidth={1.75} /> Return Rate</span>
                            <span style={{ fontWeight: 700, color: 'var(--red)' }}>{statsData.orders.return_rate}%</span>
                          </div>
                          <div style={{ height: 6, background: 'var(--card-3)', borderRadius: 3, overflow: 'hidden', marginTop: -8 }}>
                            <div style={{ height: '100%', width: `${statsData.orders.return_rate}%`, background: 'var(--red)', borderRadius: 3, transition: 'width 0.5s ease' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--t2)' }}><Clock size={14} strokeWidth={1.75} /> Avg Order Value</span>
                            <span style={{ fontWeight: 600 }}>{statsData.orders.avg_order_value} MAD</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

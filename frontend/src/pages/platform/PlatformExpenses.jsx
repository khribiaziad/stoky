import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, ChevronDown } from 'lucide-react';
import { getPlatformExpenses, createPlatformExpense, updatePlatformExpense, deletePlatformExpense } from '../../api';

const CATEGORIES = ['hosting', 'domain', 'software', 'marketing', 'other'];
const TYPES      = ['monthly', 'annual', 'one_time'];

const CAT_COLOR = {
  hosting:   '#60a5fa',
  domain:    '#a78bfa',
  software:  '#34d399',
  marketing: '#f59e0b',
  other:     '#94a3b8',
};

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function currentMonth() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

// ── Summary Cards ─────────────────────────────────────────────────────────────

function SummaryCards({ expenses }) {
  const now    = new Date();
  const month  = now.getMonth() + 1;
  const year   = now.getFullYear();

  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const thisYear = expenses.filter(e => new Date(e.date).getFullYear() === year);

  const byCategory = CATEGORIES.reduce((acc, c) => {
    acc[c] = expenses.filter(e => e.category === c).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});

  const totalMonth = thisMonth.reduce((s, e) => s + e.amount, 0);
  const totalYear  = thisYear.reduce((s, e) => s + e.amount, 0);

  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
      <div className="card" style={{ flex: 1, minWidth: 140, padding: '16px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>This Month</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{totalMonth.toFixed(0)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>MAD</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{thisMonth.length} expense{thisMonth.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="card" style={{ flex: 1, minWidth: 140, padding: '16px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>This Year</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{totalYear.toFixed(0)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>MAD</span></div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{thisYear.length} expense{thisYear.length !== 1 ? 's' : ''}</div>
      </div>
      <div className="card" style={{ flex: 2, minWidth: 220, padding: '16px 20px' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>By Category (all time)</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.filter(c => byCategory[c] > 0).map(c => (
            <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6, background: CAT_COLOR[c] + '18', borderRadius: 8, padding: '4px 10px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLOR[c] }} />
              <span style={{ fontSize: 12, color: CAT_COLOR[c], fontWeight: 600, textTransform: 'capitalize' }}>{c}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{byCategory[c].toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Expense Form ──────────────────────────────────────────────────────────────

function ExpenseForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', category: 'other', amount: '', currency: 'MAD',
    type: 'monthly', date: new Date().toISOString().slice(0, 10), note: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.amount) return;
    setSaving(true);
    try {
      await onSave({ ...form, amount: parseFloat(form.amount), date: new Date(form.date).toISOString() });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <label className="form-label">Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Render hosting" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Category</label>
          <div style={{ position: 'relative' }}>
            <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: 'capitalize' }}>{c}</option>)}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Type</label>
          <div style={{ position: 'relative' }}>
            <select className="form-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
              <option value="one_time">One-time</option>
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Amount</label>
          <input className="form-input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Currency</label>
          <input className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="MAD" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Date</label>
          <input className="form-input" type="date" value={form.date?.slice(0, 10) || ''} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="form-group" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <label className="form-label">Note (optional)</label>
          <input className="form-input" value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Additional details" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleSave}
          disabled={saving || !form.name || !form.amount}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PlatformExpenses() {
  const [expenses, setExpenses]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [monthFilter, setMonthFilter] = useState('');
  const [showAdd, setShowAdd]     = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = (month = monthFilter) => {
    setLoading(true);
    getPlatformExpenses(month || undefined)
      .then(r => setExpenses(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (data) => {
    const res = await createPlatformExpense(data);
    setExpenses(prev => [res.data, ...prev]);
    setShowAdd(false);
  };

  const handleEdit = async (id, data) => {
    const res = await updatePlatformExpense(id, data);
    setExpenses(prev => prev.map(e => e.id === id ? res.data : e));
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await deletePlatformExpense(id);
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleMonthChange = (m) => {
    setMonthFilter(m);
    load(m);
  };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Platform Expenses</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>Track platform-level costs (hosting, tools, etc.)</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowAdd(v => !v)}>
          <Plus size={14} strokeWidth={1.75} /> Add Expense
        </button>
      </div>

      <SummaryCards expenses={expenses} />

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>New Expense</div>
          <ExpenseForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
        </div>
      )}

      {/* List */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>Expenses</div>
          <input
            type="month"
            className="form-input"
            style={{ height: 34, fontSize: 13, width: 160 }}
            value={monthFilter}
            onChange={e => handleMonthChange(e.target.value)}
          />
          {monthFilter && (
            <button className="btn-icon" onClick={() => handleMonthChange('')} style={{ color: 'var(--text-muted)' }}>
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No expenses yet</div>
        ) : (
          <div>
            {expenses.map(exp => (
              <div key={exp.id}>
                {editingId === exp.id ? (
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--card-2)' }}>
                    <ExpenseForm
                      initial={{ ...exp, date: exp.date?.slice(0, 10) }}
                      onSave={(data) => handleEdit(exp.id, data)}
                      onCancel={() => setEditingId(null)}
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--card-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    {/* Category dot */}
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLOR[exp.category] || CAT_COLOR.other, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{exp.name}</span>
                        <span style={{ fontSize: 11, background: CAT_COLOR[exp.category] + '18', color: CAT_COLOR[exp.category] || CAT_COLOR.other,
                          padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{exp.category}</span>
                        <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--text-muted)',
                          padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{exp.type?.replace('_', ' ')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                        {fmt(exp.date)}{exp.note ? ` · ${exp.note}` : ''}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap' }}>
                      {exp.amount.toFixed(2)} <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{exp.currency}</span>
                    </div>
                    <button className="btn-icon" onClick={() => setEditingId(exp.id)}>
                      <Edit2 size={14} strokeWidth={1.75} />
                    </button>
                    <button className="btn-icon" onClick={() => handleDelete(exp.id)} style={{ color: '#f87171' }}>
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import { useBusinessData } from '../hooks/useBusinessData';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type ChartType = 'bar' | 'line' | 'area';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const BusinessOverview: React.FC = () => {
  const {
    businesses, targets, selectedBusiness, setSelectedBusiness,
    selectedTarget, setSelectedTarget, metrics, loading,
    uploadBusiness, addTarget, deleteTarget, deleteBusiness, toggleBusinessStatus
  } = useBusinessData();

  const handleToggleBusinessStatus = async () => {
    if (!selectedBusiness) return;
    await toggleBusinessStatus(selectedBusiness.id, selectedBusiness.status);
  };

  const [chartType, setChartType] = useState<ChartType>('area');
  const [showUpload, setShowUpload] = useState(false);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [targetDesc, setTargetDesc] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith('.md')) return;
    const text = await file.text();
    const name = file.name.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    await uploadBusiness(name, text);
    setShowUpload(false);
  };

  const handleAddTarget = async () => {
    if (!selectedBusiness || !targetName.trim()) return;
    await addTarget(selectedBusiness.id, targetName.trim(), targetDesc.trim());
    setTargetName(''); setTargetDesc(''); setShowAddTarget(false);
  };

  const handleDeleteTarget = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this target?')) return;
    await deleteTarget(id);
  };

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  if (loading) return <div style={S.loading}>LOADING BUSINESS DATA...</div>;

  const dailyData = (metrics?.dailyLeads || []).map((v, i) => ({
    day: DAY_LABELS[i] || `D${i}`, leads: v, emails: metrics?.dailyEmails?.[i] || 0
  }));

  const targetPieData = targets.filter(t => t.status === 'active').map((t, i) => ({ name: t.name, value: 1, color: COLORS[i % COLORS.length] }));

  const cards = metrics ? [
    { label: 'TOTAL LEADS', value: metrics.totalLeads, icon: '👥', color: '#3b82f6' },
    { label: 'ACTIVE CAMPAIGNS', value: metrics.activeCampaigns, icon: '🚀', color: '#8b5cf6' },
    { label: 'AVG OPEN RATE', value: `${metrics.avgOpenRate.toFixed(1)}%`, icon: '📬', color: '#10b981' },
    { label: 'REPLY RATE', value: `${metrics.avgReplyRate.toFixed(1)}%`, icon: '💬', color: '#f59e0b' },
    { label: 'TOTAL EMAILS SENT', value: metrics.totalSent, icon: '📤', color: '#ec4899' },
    { label: 'CONVERSION', value: `${metrics.conversionRate.toFixed(1)}%`, icon: '🎯', color: '#06b6d4' },
    { label: 'ACTIVE TARGETS', value: metrics.activeTargets, icon: '🎪', color: '#84cc16' },
    { label: 'TOTAL PROSPECTS', value: metrics.totalProspects, icon: '📊', color: '#ef4444' },
  ] : [];

  const renderChart = (dataKey: string, color: string) => {
    if (chartType === 'bar') return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={dailyData}><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ background: '#1c1917', border: 'none', fontFamily: 'VT323', color: '#fff' }} /><Bar dataKey={dataKey} fill={color} radius={[4,4,0,0]} /></BarChart>
      </ResponsiveContainer>
    );
    if (chartType === 'line') return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={dailyData}><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ background: '#1c1917', border: 'none', fontFamily: 'VT323', color: '#fff' }} /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ fill: color, r: 4 }} /></LineChart>
      </ResponsiveContainer>
    );
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={dailyData}><XAxis dataKey="day" stroke="#64748b" fontSize={12} /><YAxis stroke="#64748b" fontSize={12} /><Tooltip contentStyle={{ background: '#1c1917', border: 'none', fontFamily: 'VT323', color: '#fff' }} /><Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} /></AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div style={S.root}>
      {/* HEADER */}
      <div style={S.header}>
        <div>
          <h2 style={S.title}>BUSINESS_OVERVIEW</h2>
          <div style={S.subtitle}>
            <div style={{ width: 40, height: 1, backgroundColor: 'var(--secondary-color)' }} />
            MULTI-TARGET_INTELLIGENCE_DASHBOARD
            <div style={{ width: 40, height: 1, backgroundColor: 'var(--secondary-color)' }} />
          </div>
        </div>
        <div style={S.controls}>
          {/* Business Switcher */}
          <select value={selectedBusiness?.id || ''} onChange={e => { const b = businesses.find(x => x.id === e.target.value); if (b) setSelectedBusiness(b); }} style={S.select}>
            {businesses.map(b => (
              <option key={b.id} value={b.id} style={S.option}>
                {b.name} {b.status === 'inactive' ? '[DISABLED]' : ''}
              </option>
            ))}
          </select>
          {selectedBusiness && selectedBusiness.id !== 'all' && (
            <button
              onClick={handleToggleBusinessStatus}
              style={{
                ...S.actionBtn,
                backgroundColor: selectedBusiness.status === 'active' ? '#ef4444' : '#10b981',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {selectedBusiness.status === 'active' ? 'DISABLE' : 'ENABLE'}
            </button>
          )}
          {selectedBusiness && selectedBusiness.id !== 'all' && (
            <button
              onClick={async () => {
                if (window.confirm(`Are you sure you want to delete ${selectedBusiness.name}? This will attempt a hard delete, and fallback to a soft delete if there are dependencies.`)) {
                  await deleteBusiness(selectedBusiness.id);
                }
              }}
              style={{
                ...S.actionBtn,
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer'
              }}
              title="Delete Business"
            >
              DELETE
            </button>
          )}
          {/* Target Filter */}
          <select value={selectedTarget} onChange={e => setSelectedTarget(e.target.value)} style={S.select}>
            <option value="all" style={S.option}>ALL TARGETS</option>
            {targets.map(t => <option key={t.id} value={t.id} style={S.option}>{t.name}</option>)}
          </select>
          {/* Chart Toggle */}
          <div style={S.chartToggle}>
            {(['bar', 'line', 'area'] as ChartType[]).map(t => (
              <button key={t} onClick={() => setChartType(t)} style={{ ...S.toggleBtn, ...(chartType === t ? S.toggleActive : {}) }}>{t.toUpperCase()}</button>
            ))}
          </div>
          <button onClick={() => setShowUpload(!showUpload)} style={S.actionBtn}>+ BUSINESS</button>
          {selectedBusiness && selectedBusiness.id !== 'all' && (
            <button onClick={() => setShowAddTarget(!showAddTarget)} style={{ ...S.actionBtn, backgroundColor: '#8b5cf6' }}>+ TARGET</button>
          )}
        </div>
      </div>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div style={S.modal}>
          <div style={S.modalTitle}>UPLOAD BUSINESS (.md)</div>
          <input ref={fileRef} type="file" accept=".md" onChange={handleFileUpload} style={S.fileInput} />
          <button onClick={() => fileRef.current?.click()} style={S.actionBtn}>SELECT FILE</button>
        </div>
      )}

      {/* ADD TARGET MODAL */}
      {showAddTarget && (
        <div style={S.modal}>
          <div style={S.modalTitle}>NEW BUSINESS TARGET</div>
          <input value={targetName} onChange={e => setTargetName(e.target.value)} placeholder="Target name e.g. Web Development" style={S.input} />
          <input value={targetDesc} onChange={e => setTargetDesc(e.target.value)} placeholder="Description" style={S.input} />
          <button onClick={handleAddTarget} style={S.actionBtn}>CREATE TARGET</button>
        </div>
      )}

      {/* 8 METRIC CARDS */}
      <div style={S.cardGrid}>
        {cards.map((card, i) => (
          <div key={i} style={S.card}>
            <div style={{ ...S.cardAccent, backgroundColor: card.color }} />
            <div style={S.cardIcon}>{card.icon}</div>
            <div style={S.cardValue}>{card.value}</div>
            <div style={S.cardLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* CHARTS ROW */}
      <div style={S.chartsRow}>
        <div style={S.chartPanel}>
          <div style={S.chartTitle}>LEAD DISCOVERY (7D)</div>
          {renderChart('leads', '#3b82f6')}
        </div>
        <div style={S.chartPanel}>
          <div style={S.chartTitle}>EMAILS SENT (7D)</div>
          {renderChart('emails', '#10b981')}
        </div>
        <div style={S.chartPanel}>
          <div style={S.chartTitle}>TARGET DISTRIBUTION</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={targetPieData.length > 0 ? targetPieData : [{ name: 'No Targets', value: 1, color: '#334155' }]} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40} paddingAngle={2} label={({ name }) => name}>
                {(targetPieData.length > 0 ? targetPieData : [{ name: 'No Targets', value: 1, color: '#334155' }]).map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1c1917', border: 'none', fontFamily: 'VT323', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* URGENT EMAILS */}
      {metrics && metrics.urgentEmails.length > 0 && (
        <div style={S.urgentSection}>
          <div style={S.urgentHeader}>
            <span style={S.urgentDot} />
            URGENT ATTENTION ({metrics.urgentEmails.length})
          </div>
          <div style={S.urgentList}>
            {metrics.urgentEmails.map(email => (
              <div key={email.id} style={S.urgentCard}>
                <div style={S.urgentFrom}>{email.from}</div>
                <div style={S.urgentSubject}>{email.subject}</div>
                {email.review_reason && <div style={S.urgentReason}>⚠ {email.review_reason}</div>}
                <div style={S.urgentSnippet}>{email.snippet?.substring(0, 120)}</div>
                <div style={S.urgentMeta}>
                  <span>{timeAgo(email.received_at)}</span>
                  {email.campaign_name && <span style={S.urgentCampaign}>{email.campaign_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BUSINESS TARGETS LIST */}
      <div style={S.targetsSection}>
        <div style={S.sectionTitle}>BUSINESS TARGETS</div>
        <div style={S.targetsList}>
          {targets.map(t => (
            <div key={t.id} style={S.targetCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={S.targetName}>{t.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <span style={{ ...S.targetStatus, color: t.status === 'active' ? '#10b981' : '#f59e0b' }}>{t.status.toUpperCase()}</span>
                  <button onClick={() => handleDeleteTarget(t.id)} style={S.deleteTargetBtn} title="Delete Target">×</button>
                </div>
              </div>
              {t.description && <div style={S.targetDesc}>{t.description}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Styles object
const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '2rem', padding: '8rem 2rem 2rem', height: '100%', overflowY: 'auto', backgroundColor: 'var(--primary-color)', color: 'var(--text-color)' },
  loading: { color: 'var(--text-color)', fontSize: '2rem', padding: '2rem', fontFamily: 'VT323, monospace' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' },
  title: { fontSize: '4rem', fontFamily: 'VT323, monospace', margin: 0, textShadow: 'none', color: 'var(--text-color)' },
  subtitle: { display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', fontSize: '1.2rem', letterSpacing: '4px' },
  controls: { display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' },
  select: { 
    backgroundColor: 'rgba(30, 41, 59, 0.7)', 
    color: '#ffffff', 
    border: '1px solid rgba(255, 255, 255, 0.08)', 
    borderRadius: '8px',
    padding: '0.6rem 1.2rem', 
    fontFamily: 'Inter, sans-serif', 
    fontSize: '0.9rem', 
    fontWeight: 600,
    cursor: 'pointer', 
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  option: { 
    backgroundColor: '#0f172a', 
    color: '#ffffff',
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.9rem'
  },
  chartToggle: { display: 'flex', gap: '2px', backgroundColor: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' },
  toggleBtn: { 
    backgroundColor: 'transparent', 
    color: '#64748b', 
    border: 'none', 
    borderRadius: '6px',
    padding: '0.5rem 0.9rem', 
    fontFamily: 'Inter, sans-serif', 
    fontSize: '0.8rem', 
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  toggleActive: { backgroundColor: '#3b82f6', color: '#ffffff', boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)' },
  actionBtn: { 
    backgroundColor: '#3b82f6', 
    color: '#ffffff', 
    border: 'none', 
    borderRadius: '8px',
    padding: '0.6rem 1.4rem', 
    fontFamily: 'Inter, sans-serif', 
    fontSize: '0.9rem', 
    fontWeight: 600,
    cursor: 'pointer', 
    letterSpacing: '0.5px',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
  },
  modal: { 
    backgroundColor: 'rgba(15, 23, 42, 0.85)', 
    padding: '1.5rem', 
    borderRadius: '12px',
    display: 'flex', 
    flexDirection: 'column', 
    gap: '1rem', 
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)'
  },
  modalTitle: { fontFamily: 'VT323, monospace', fontSize: '1.4rem', color: '#3b82f6', letterSpacing: '2px' },
  fileInput: { display: 'none' },
  input: { 
    backgroundColor: 'rgba(0, 0, 0, 0.2)', 
    color: '#ffffff', 
    border: '1px solid rgba(255, 255, 255, 0.08)', 
    borderRadius: '8px',
    padding: '0.8rem', 
    fontFamily: 'Inter, sans-serif', 
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'all 0.2s ease'
  },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' },
  card: { 
    backgroundColor: 'rgba(30, 41, 59, 0.4)', 
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    padding: '1.5rem', 
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    position: 'relative', 
    overflow: 'hidden', 
    boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.3)', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '0.4rem', 
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)', 
    cursor: 'default' 
  },
  cardAccent: { position: 'absolute', top: 0, left: 0, width: '100%', height: '3px' },
  cardIcon: { fontSize: '1.8rem' },
  cardValue: { fontSize: '2.8rem', fontFamily: 'VT323, monospace', fontWeight: 'bold', lineHeight: 1 },
  cardLabel: { fontSize: '1rem', fontFamily: 'VT323, monospace', color: 'var(--text-muted)', letterSpacing: '1px' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' },
  chartPanel: { backgroundColor: 'var(--secondary-color)', padding: '1.5rem', boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.05), inset -2px -2px 0 rgba(0,0,0,0.2)' },
  chartTitle: { fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: 'var(--accent-color)', marginBottom: '1rem', letterSpacing: '2px' },
  urgentSection: { backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '1.5rem', boxShadow: 'inset 4px 0 0 #ef4444' },
  urgentHeader: { display: 'flex', alignItems: 'center', gap: '0.8rem', fontFamily: 'VT323, monospace', fontSize: '1.4rem', color: '#ef4444', marginBottom: '1rem', letterSpacing: '2px' },
  urgentDot: { width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1.5s infinite' },
  urgentList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.8rem' },
  urgentCard: { backgroundColor: 'var(--secondary-color)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)' },
  urgentFrom: { fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: '#ef4444' },
  urgentSubject: { fontFamily: 'VT323, monospace', fontSize: '1.1rem', color: 'var(--text-color)' },
  urgentReason: { fontSize: '0.85rem', color: '#f59e0b', fontFamily: 'VT323, monospace', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', letterSpacing: '1px' },
  urgentSnippet: { fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.3 },
  urgentMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', marginTop: '0.3rem' },
  urgentCampaign: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.1rem 0.5rem', fontSize: '0.8rem' },
  targetsSection: { marginTop: '0.5rem' },
  sectionTitle: { fontFamily: 'VT323, monospace', fontSize: '1.6rem', color: 'var(--accent-color)', letterSpacing: '2px', marginBottom: '1rem' },
  targetsList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' },
  targetCard: { backgroundColor: 'var(--secondary-color)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.05), inset -2px -2px 0 rgba(0,0,0,0.2)' },
  targetName: { fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: 'var(--text-color)' },
  targetStatus: { fontFamily: 'VT323, monospace', fontSize: '0.9rem' },
  targetDesc: { fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 },
  deleteTargetBtn: { backgroundColor: 'transparent', color: '#ef4444', border: 'none', fontSize: '1.6rem', cursor: 'pointer', padding: '0 0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'color 0.1s' }
};

export default BusinessOverview;

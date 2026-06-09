import React, { useState, useMemo } from 'react';
import { useBusinessData } from '../hooks/useBusinessData';

const Inbox: React.FC = () => {
  const { metrics, loading, archiveEmails } = useBusinessData();
  const [activeTab, setActiveTab] = useState<'urgent' | 'replies'>('urgent');
  const [selectedUrgent, setSelectedUrgent] = useState<Set<string>>(new Set());

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  const handleSelectToggle = (id: string) => {
    const newSet = new Set(selectedUrgent);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUrgent(newSet);
  };

  const handleSelectAll = () => {
    if (!metrics) return;
    if (selectedUrgent.size === metrics.urgentEmails.length) {
      setSelectedUrgent(new Set());
    } else {
      setSelectedUrgent(new Set(metrics.urgentEmails.map(e => e.id)));
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedUrgent.size === 0 || !archiveEmails) return;
    await archiveEmails(Array.from(selectedUrgent));
    setSelectedUrgent(new Set());
  };

  const handleArchiveAll = async () => {
    if (!metrics || metrics.urgentEmails.length === 0 || !archiveEmails) return;
    await archiveEmails(metrics.urgentEmails.map(e => e.id));
    setSelectedUrgent(new Set());
  };

  const repliesByCampaign = useMemo(() => {
    if (!metrics?.allReplies) return {};
    const grouped: Record<string, typeof metrics.allReplies> = {};
    metrics.allReplies.forEach(reply => {
      const campName = reply.campaign_name || 'Unassigned Campaign';
      if (!grouped[campName]) grouped[campName] = [];
      grouped[campName].push(reply);
    });
    return grouped;
  }, [metrics?.allReplies]);

  if (loading) return <div style={S.loading}>LOADING INBOX...</div>;

  const hasUrgent = metrics && metrics.urgentEmails.length > 0;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <h2 style={S.title}>EMAIL_INBOX</h2>
        <div style={S.subtitle}>
          <div style={{ width: 40, height: 1, backgroundColor: 'var(--secondary-color)' }} />
          PRIORITY_MESSAGES_AND_REVIEWS
          <div style={{ width: 40, height: 1, backgroundColor: 'var(--secondary-color)' }} />
        </div>
      </div>

      <div style={S.tabs}>
        <button 
          style={{ ...S.tab, ...(activeTab === 'urgent' ? S.activeTab : {}) }}
          onClick={() => setActiveTab('urgent')}
        >
          URGENT ACTION {metrics?.urgentEmails.length ? `(${metrics.urgentEmails.length})` : ''}
        </button>
        <button 
          style={{ ...S.tab, ...(activeTab === 'replies' ? S.activeTab : {}) }}
          onClick={() => setActiveTab('replies')}
        >
          ALL REPLIES {metrics?.allReplies ? `(${metrics.allReplies.length})` : ''}
        </button>
      </div>

      {activeTab === 'urgent' && (
        <>
          {hasUrgent ? (
            <div style={S.urgentSection}>
              <div style={S.urgentHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <span style={S.urgentDot} />
                  URGENT ATTENTION ({metrics.urgentEmails.length})
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button style={{...S.actionBtn, opacity: 1}} onClick={handleSelectAll}>
                    {selectedUrgent.size === metrics.urgentEmails.length ? 'DESELECT ALL' : 'SELECT ALL'}
                  </button>
                  <button style={{...S.actionBtn, opacity: selectedUrgent.size === 0 ? 0.5 : 1, cursor: selectedUrgent.size === 0 ? 'not-allowed' : 'pointer'}} onClick={handleArchiveSelected} disabled={selectedUrgent.size === 0}>
                    ARCHIVE SELECTED
                  </button>
                  <button style={{...S.actionBtn, opacity: 1}} onClick={handleArchiveAll}>
                    ARCHIVE ALL
                  </button>
                </div>
              </div>
              <div style={S.urgentList}>
                {metrics.urgentEmails.map(email => (
                  <div key={email.id} style={{ ...S.urgentCard, borderLeft: selectedUrgent.has(email.id) ? '4px solid #ef4444' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={S.urgentFrom}>{email.from}</div>
                      <input 
                        type="checkbox" 
                        checked={selectedUrgent.has(email.id)}
                        onChange={() => handleSelectToggle(email.id)}
                        style={S.checkbox}
                      />
                    </div>
                    <div style={S.urgentSubject}>{email.subject}</div>
                    {email.review_reason && <div style={S.urgentReason}>⚠ {email.review_reason}</div>}
                    <div style={S.urgentSnippet}>{email.snippet}</div>
                    <div style={S.urgentMeta}>
                      <span>{timeAgo(email.received_at)}</span>
                      {email.campaign_name && <span style={S.urgentCampaign}>{email.campaign_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={S.emptyState}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <div style={{ fontFamily: 'VT323, monospace', fontSize: '1.5rem', color: 'var(--text-muted)' }}>NO URGENT EMAILS</div>
            </div>
          )}
        </>
      )}

      {activeTab === 'replies' && (
        <div style={S.repliesSection}>
          {Object.entries(repliesByCampaign).length > 0 ? Object.entries(repliesByCampaign).map(([campName, emails]) => (
            <div key={campName} style={S.campaignGroup}>
              <div style={S.campaignHeader}>{campName} <span style={{color: 'var(--text-muted)', fontSize: '1.2rem'}}>({emails.length})</span></div>
              <div style={S.urgentList}>
                {emails.map(email => (
                  <div key={email.id} style={S.urgentCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{...S.urgentFrom, color: 'var(--text-color)'}}>{email.from}</div>
                      {email.needs_human_review && <div style={S.urgentReason}>⚠ URGENT</div>}
                    </div>
                    <div style={S.urgentSubject}>{email.subject}</div>
                    <div style={S.urgentSnippet}>{email.snippet}</div>
                    <div style={S.urgentMeta}>
                      <span>{timeAgo(email.received_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )) : (
            <div style={S.emptyState}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <div style={{ fontFamily: 'VT323, monospace', fontSize: '1.5rem', color: 'var(--text-muted)' }}>NO REPLIES YET</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', height: '100%', overflowY: 'auto', backgroundColor: 'var(--primary-color)', color: 'var(--text-color)' },
  loading: { color: 'var(--text-color)', fontSize: '2rem', padding: '2rem', fontFamily: 'VT323, monospace' },
  header: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  title: { fontSize: '3.5rem', fontFamily: 'VT323, monospace', margin: 0, textShadow: 'none', color: 'var(--text-color)' },
  subtitle: { display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', fontSize: '1rem', letterSpacing: '4px' },
  tabs: { display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' },
  tab: { background: 'none', border: 'none', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem 1rem', transition: 'all 0.2s' },
  activeTab: { color: 'var(--text-color)', borderBottom: '2px solid #ef4444' },
  urgentSection: { backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '1.5rem', boxShadow: 'inset 4px 0 0 #ef4444', borderRadius: '8px' },
  urgentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'VT323, monospace', fontSize: '1.4rem', color: '#ef4444', marginBottom: '1rem', letterSpacing: '2px', flexWrap: 'wrap', gap: '1rem' },
  urgentDot: { width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1.5s infinite' },
  urgentList: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' },
  urgentCard: { backgroundColor: 'var(--secondary-color)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)', borderRadius: '6px', transition: 'border 0.2s' },
  urgentFrom: { fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#ef4444' },
  urgentSubject: { fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: 'var(--text-color)' },
  urgentReason: { fontSize: '0.9rem', color: '#f59e0b', fontFamily: 'VT323, monospace', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.3rem 0.6rem', letterSpacing: '1px', borderRadius: '4px' },
  urgentSnippet: { fontSize: '0.95rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 },
  urgentMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', marginTop: '0.5rem' },
  urgentCampaign: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.2rem 0.6rem', fontSize: '0.85rem', borderRadius: '4px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' },
  actionBtn: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', fontFamily: 'VT323, monospace', fontSize: '1.2rem', transition: 'opacity 0.2s' },
  checkbox: { width: '1.5rem', height: '1.5rem', cursor: 'pointer', accentColor: '#ef4444' },
  repliesSection: { display: 'flex', flexDirection: 'column', gap: '2rem' },
  campaignGroup: { display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' },
  campaignHeader: { fontFamily: 'VT323, monospace', fontSize: '1.8rem', color: 'var(--text-color)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }
};

export default Inbox;

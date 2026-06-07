import React from 'react';
import { useBusinessData } from '../hooks/useBusinessData';

const Inbox: React.FC = () => {
  const { metrics, loading } = useBusinessData();

  const timeAgo = (dateStr: string) => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return `${Math.floor(mins / 1440)}d ago`;
  };

  if (loading) return <div style={S.loading}>LOADING INBOX...</div>;

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

      {metrics && metrics.urgentEmails.length > 0 ? (
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
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem', height: '100%', overflowY: 'auto', backgroundColor: 'var(--primary-color)', color: 'var(--text-color)' },
  loading: { color: 'var(--text-color)', fontSize: '2rem', padding: '2rem', fontFamily: 'VT323, monospace' },
  header: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  title: { fontSize: '3.5rem', fontFamily: 'VT323, monospace', margin: 0, textShadow: 'none', color: 'var(--text-color)' },
  subtitle: { display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', fontSize: '1rem', letterSpacing: '4px' },
  urgentSection: { backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '1.5rem', boxShadow: 'inset 4px 0 0 #ef4444', borderRadius: '8px' },
  urgentHeader: { display: 'flex', alignItems: 'center', gap: '0.8rem', fontFamily: 'VT323, monospace', fontSize: '1.4rem', color: '#ef4444', marginBottom: '1rem', letterSpacing: '2px' },
  urgentDot: { width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 1.5s infinite' },
  urgentList: { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' },
  urgentCard: { backgroundColor: 'var(--secondary-color)', padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)', borderRadius: '6px' },
  urgentFrom: { fontFamily: 'VT323, monospace', fontSize: '1.3rem', color: '#ef4444' },
  urgentSubject: { fontFamily: 'VT323, monospace', fontSize: '1.2rem', color: 'var(--text-color)' },
  urgentReason: { fontSize: '0.9rem', color: '#f59e0b', fontFamily: 'VT323, monospace', backgroundColor: 'rgba(245, 158, 11, 0.1)', padding: '0.3rem 0.6rem', letterSpacing: '1px', borderRadius: '4px' },
  urgentSnippet: { fontSize: '0.95rem', color: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', lineHeight: 1.4 },
  urgentMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', marginTop: '0.5rem' },
  urgentCampaign: { backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.2rem 0.6rem', fontSize: '0.85rem', borderRadius: '4px' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }
};

export default Inbox;

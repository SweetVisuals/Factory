import { useState } from 'react';
import { useBusinessData } from '../hooks/useBusinessData';
import CampaignCard from './CampaignCard';
import Skeleton from './Skeleton';

const Dashboard = ({ toggleOverlay }: { toggleOverlay?: (view: 'discover' | 'dashboard' | 'profile' | 'employees' | 'queue' | 'business' | 'logs' | 'inbox') => void }) => {
  const { businesses, setSelectedBusiness, metrics } = useBusinessData();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('all');


  const handleBusinessChange = (bizId: string) => {
    setSelectedBusinessId(bizId);
    const b = businesses.find(x => x.id === bizId) || businesses[0];
    if (b) setSelectedBusiness(b);
  };

  const getBusinessColor = (name: string) => {
    if (name.toLowerCase().includes('relay')) return '#10b981';
    if (name.toLowerCase().includes('mrmedic')) return '#3b82f6';
    return '#8b5cf6'; // Default purple
  };

  const isLoading = !metrics || businesses.length === 0;

  const filteredCampaigns = metrics?.campaignsList?.filter(c => {
    return selectedBusinessId === 'all' || c.business_id === selectedBusinessId;
  }) || [];

  return (
    <div style={{ padding: '2rem 3rem', color: 'var(--text-color)', height: '100%', overflowY: 'auto' }}>
      
      {/* Top 3 Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* Card 1: System Activity Log */}
        <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', height: '350px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', boxShadow: '0 0 10px var(--accent-color)' }} />
            <h3 style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>System Activity Log</h3>
          </div>
          <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <Skeleton width="100%" height="20px" />
            ) : metrics?.recentLogs && metrics.recentLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {metrics.recentLogs.slice(0, 15).map((log) => (
                  <div 
                    key={log.id}
                    onClick={() => {
                      if (toggleOverlay) {
                        if (log.type === 'email_received') toggleOverlay('inbox');
                        else if (log.type === 'lead_added') toggleOverlay('discover');
                        else toggleOverlay('business');
                      }
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      borderLeft: `3px solid ${log.type === 'sent' ? '#10b981' : log.type === 'bounced' ? '#ef4444' : log.type === 'email_received' ? '#3b82f6' : '#8b5cf6'}`,
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)'}
                  >
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.2rem' }}>{log.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{log.description}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>No recent activity.</div>
            )}
          </div>
        </div>

        {/* Card 2: Unread Replies */}
        <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', height: '350px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 10px #f59e0b' }} />
              <h3 style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>Unread Replies</h3>
            </div>
            {!isLoading && metrics?.urgentEmails && metrics.urgentEmails.length > 0 && (
              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                {metrics.urgentEmails.length} New
              </span>
            )}
          </div>
          <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <Skeleton width="100%" height="20px" />
            ) : metrics?.urgentEmails && metrics.urgentEmails.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {metrics.urgentEmails.map((email) => (
                  <div 
                    key={email.id}
                    onClick={() => { if (toggleOverlay) toggleOverlay('inbox'); }}
                    style={{ 
                      padding: '0.75rem 1rem',
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      borderLeft: '3px solid #f59e0b',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.2)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', gap: '0.5rem' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.from}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(email.received_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email.subject}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✨</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Inbox zero!</div>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: System Health */}
        <div style={{ backgroundColor: 'var(--panel-bg)', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', height: '350px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
            <h3 style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '1.1rem', fontWeight: 600 }}>System Health</h3>
          </div>
          <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
            {isLoading ? (
              <Skeleton width="100%" height="20px" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Paused Campaigns Alert */}
                {(() => {
                  const pausedCampaigns = (metrics?.campaignsList || []).filter(c => c.status === 'Paused' || c.status === 'Stopped');
                  if (pausedCampaigns.length > 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ color: '#ef4444', marginTop: '2px' }}>⏸️</div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fca5a5' }}>{pausedCampaigns.length} Paused Campaign{pausedCampaigns.length !== 1 ? 's' : ''}</div>
                          <div style={{ fontSize: '0.8rem', color: '#fecaca', marginTop: '0.25rem' }}>
                            {pausedCampaigns.slice(0, 2).map(c => c.name).join(', ')} {pausedCampaigns.length > 2 ? `+${pausedCampaigns.length - 2} more` : ''}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Bounced Emails Alert */}
                {(() => {
                  const bounced = (metrics?.recentLogs || []).filter(l => l.type === 'bounced');
                  if (bounced.length > 0) {
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ color: '#ef4444', marginTop: '2px' }}>⚠️</div>
                        <div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fca5a5' }}>{bounced.length} Recent Bounce{bounced.length !== 1 ? 's' : ''}</div>
                          <div style={{ fontSize: '0.8rem', color: '#fecaca', marginTop: '0.25rem' }}>
                            Review email deliverability and sender reputation.
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* System Status Overview */}
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Services Overview</div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Outbound Sending</span>
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 500 }}>Operational</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Lead Generation</span>
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 500 }}>Operational</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>API Credits</span>
                    <span style={{ fontSize: '0.75rem', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.1rem 0.5rem', borderRadius: '10px', fontWeight: 500 }}>Healthy</span>
                  </div>
                </div>

                {(!metrics?.campaignsList?.some(c => c.status === 'Paused' || c.status === 'Stopped') && !metrics?.recentLogs?.some(l => l.type === 'bounced')) && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem 0', color: '#10b981', marginTop: 'auto' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>All systems nominal</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Header matching old CampaignHub layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '6px', height: '32px', backgroundColor: 'var(--accent-color)', boxShadow: '0 0 15px rgba(59,130,246,0.6)' }} />
              <h1 style={{ margin: 0, fontFamily: 'Inter, sans-serif', fontSize: '2.5rem', fontWeight: 600, color: 'var(--text-color)', lineHeight: 1 }}>Campaigns</h1>
            </div>
            <p style={{ margin: '0 0 0 1.5rem', fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: 'var(--text-muted)' }}>
              Overview of all outbound sequences
            </p>
          </div>
          
          <button style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            backgroundColor: 'var(--accent-color)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.2rem',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-2px, -2px)'; e.currentTarget.style.boxShadow = '6px 6px 0px rgba(255,255,255,0.5)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '4px 4px 0px rgba(255,255,255,0.3)'; }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 0.8 }}>+</span>
            NEW CAMPAIGN
          </button>
        </div>

        {/* Filters Bar matching CampaignHub */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.6rem',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          backdropFilter: 'blur(20px)',
          overflowX: 'auto',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 20px rgba(0, 0, 0, 0.2)',
          scrollbarWidth: 'none'
        }}>
          <button
            onClick={() => handleBusinessChange('all')}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.4rem',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: 'pointer',
              border: selectedBusinessId === 'all' ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              backgroundColor: selectedBusinessId === 'all' ? '#ffffff' : 'rgba(255, 255, 255, 0.02)',
              color: selectedBusinessId === 'all' ? '#0f172a' : '#94a3b8',
              boxShadow: selectedBusinessId === 'all' ? '0 4px 12px rgba(255, 255, 255, 0.15)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              if (selectedBusinessId !== 'all') {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedBusinessId !== 'all') {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
              }
            }}
          >
            ALL WORKSPACES
          </button>
          
          {businesses.filter(b => b.id !== 'all').map(b => {
            const color = getBusinessColor(b.name);
            const isSelected = selectedBusinessId === b.id;
            return (
              <button
                key={b.id}
                onClick={() => handleBusinessChange(b.id)}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem 1.4rem',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  border: isSelected ? `1px solid ${color}80` : '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  backgroundColor: isSelected ? `${color}15` : 'rgba(255, 255, 255, 0.02)',
                  color: isSelected ? color : '#94a3b8',
                  boxShadow: isSelected ? `0 0 15px -3px ${color}30` : 'none',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = color;
                    e.currentTarget.style.backgroundColor = `${color}08`;
                    e.currentTarget.style.borderColor = `${color}30`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = '#94a3b8';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                  }
                }}
              >
                <div style={{ 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  backgroundColor: color,
                  boxShadow: isSelected ? `0 0 8px ${color}` : 'none'
                }} />
                {b.name}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        {isLoading ? (
          <Skeleton width="200px" height="20px" />
        ) : (
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Showing <span style={{ color: 'var(--text-color)', fontWeight: 700 }}>{filteredCampaigns.length}</span> active campaigns
          </span>
        )}
      </div>

      {/* Campaign Cards Grid */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', background: 'var(--panel-bg)', borderRadius: '12px', padding: '1.5rem', border: '1px solid rgba(255, 255, 255, 0.05)', minHeight: '340px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <Skeleton width="80px" height="12px" />
                  <Skeleton width="180px" height="24px" />
                </div>
                <Skeleton width="60px" height="24px" borderRadius="12px" />
              </div>
              <Skeleton width="100%" height="80px" borderRadius="8px" />
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Skeleton width="100%" height="12px" />
                <Skeleton width="100%" height="4px" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem', backgroundColor: 'var(--secondary-color)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            No campaigns found for this filter.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '2rem' }}>
          {filteredCampaigns.map(campaign => {
            const biz = businesses.find(b => b.id === campaign.business_id);
            const bizName = biz ? biz.name : 'Other';
            let activeColor = getBusinessColor(bizName);
            
            return (
              <CampaignCard 
                key={campaign.id} 
                campaign={campaign} 
                businessName={bizName} 
                activeColor={activeColor} 
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;


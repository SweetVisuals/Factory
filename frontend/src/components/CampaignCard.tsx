import React from 'react';

interface Campaign {
  id: string;
  name: string;
  business_id: string;
  status?: string;
  prospects?: number;
  sent?: number;
  replies?: number;
  click_rate?: number;
  current_step?: number;
}

interface CampaignCardProps {
  campaign: Campaign;
  businessName: string;
  activeColor: string;
}

const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, businessName, activeColor }) => {
  const isCompleted = campaign.status?.toLowerCase() === 'completed';
  const isDraft = campaign.status?.toLowerCase() === 'draft' || campaign.status?.toLowerCase() === 'pending';
  const statusLabel = isCompleted ? 'Completed' : isDraft ? 'Draft' : 'Active';
  const statusIconColor = isCompleted ? '#10b981' : isDraft ? '#64748b' : '#3b82f6';
  
  const totalExpected = (campaign.prospects || 0) * 4;
  const progressPct = totalExpected > 0 ? Math.min(100, Math.round(((campaign.sent || 0) / totalExpected) * 100)) : 0;
  
  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--panel-bg)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        minHeight: '340px',
        position: 'relative',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)';
        e.currentTarget.style.borderColor = `rgba(255, 255, 255, 0.15)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
      }}
    >
      {/* Top Accent Line */}
      <div style={{ height: '3px', width: '100%', background: `linear-gradient(90deg, ${activeColor}, ${activeColor}20)` }} />

      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        backgroundColor: 'rgba(255, 255, 255, 0.01)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.4rem', 
            fontFamily: 'Inter, sans-serif', 
            fontSize: '0.75rem', 
            color: activeColor, 
            fontWeight: 700,
            letterSpacing: '1px',
            textTransform: 'uppercase'
          }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: activeColor, boxShadow: `0 0 8px ${activeColor}` }} />
            {businessName}
          </div>
          <h3 style={{ 
            margin: 0, 
            fontFamily: 'Inter, sans-serif', 
            fontWeight: 700, 
            fontSize: '1.25rem', 
            color: '#ffffff', 
            whiteSpace: 'nowrap', 
            overflow: 'hidden', 
            textOverflow: 'ellipsis',
            lineHeight: 1.2
          }}>
            {campaign.name}
          </h3>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.7rem',
          borderRadius: '20px',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          background: 'rgba(255, 255, 255, 0.03)',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: statusIconColor, boxShadow: `0 0 6px ${statusIconColor}` }} />
          {statusLabel}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '1.5rem' }}>
        
        {/* Stats Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)', 
          gap: '1rem', 
          marginBottom: '1.5rem',
          background: 'var(--secondary-color)',
          borderRadius: '8px',
          padding: '1rem',
          border: '1px solid rgba(255, 255, 255, 0.03)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Leads</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{campaign.prospects || 0}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Sent</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{campaign.sent || 0}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>Replies</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '1.4rem', fontWeight: 700, color: '#10b981', lineHeight: 1 }}>{campaign.replies || 0}</span>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 500, color: '#475569' }}>
                {campaign.click_rate ? campaign.click_rate.toFixed(1) : '0.0'}%
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', marginBottom: '1.5rem' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.5px' }}>Recent Activity</span>
          {campaign.sent && campaign.sent > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: activeColor, opacity: 0.8 }}>→</span> Contacted Prospect
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>Just now</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ color: activeColor, opacity: 0.8 }}>→</span> Contacted Prospect
                </span>
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>2m ago</span>
              </div>
            </div>
          ) : (
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>No activity yet.</span>
          )}
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Step {campaign.current_step || 1} of 4
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: activeColor }}>
              {progressPct}%
            </span>
          </div>
          <div style={{ 
            height: '4px', 
            width: '100%', 
            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '10px',
            overflow: 'hidden' 
          }}>
            <div style={{ 
              height: '100%', 
              width: `${progressPct}%`, 
              background: `linear-gradient(90deg, ${activeColor}b0, ${activeColor})`,
              borderRadius: '10px',
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 8px ${activeColor}80`
            }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;

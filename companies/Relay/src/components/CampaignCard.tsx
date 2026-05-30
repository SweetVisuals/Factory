import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { CheckCircle2, FileEdit, Activity, Users, Mail, MessageSquare, ArrowUpRight } from 'lucide-react';

interface CampaignCardProps {
  id: string;
  name: string;
  status: string;
  prospects: string | number;
  replies: string | number;
  sent: string | number;
  replyRate?: string;
  objective?: string;
  created_at?: string;
  current_step?: number;
  themeColor?: string;
  businessName?: string;
  onClick: () => void;
}

const parseLocationFromName = (fullName: string) => {
  const match = fullName.trim().match(/\s+([Uu][Ss]|[Uu][Kk])$/) || fullName.trim().match(/\s+\(([Uu][Ss]|[Uu][Kk])\)$/);
  if (match) return { loc: match[1].toUpperCase(), cleanName: fullName.trim().replace(match[0], '') };
  return { loc: null, cleanName: fullName };
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
};

const CampaignCard = ({ 
  id,
  name, 
  status, 
  prospects, 
  replies, 
  sent,
  replyRate = '0.0%',
  objective,
  current_step = 1,
  themeColor = '#ffffff', 
  businessName,
  onClick
}: CampaignCardProps) => {
  let activeColor = themeColor;
  let bizLabel = businessName || 'Other';
  
  if (bizLabel.toLowerCase().includes('relay') || name.toLowerCase().includes('relay')) { activeColor = '#10b981'; bizLabel = 'Relay Solutions'; }
  else if (bizLabel.toLowerCase().includes('mrmedic') || name.toLowerCase().includes('mrmedic')) { activeColor = '#3b82f6'; bizLabel = 'MrMedic Events'; }
  else if (bizLabel !== 'Other') { activeColor = '#8b5cf6'; } // Default purple for other businesses

  const [recentSent, setRecentSent] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const fetchRecentSent = async () => {
      const { data } = await supabase.from('campaign_progress').select('id, sent_at, lead:leads(name, email)').eq('campaign_id', id).eq('status', 'sent').order('created_at', { ascending: false }).limit(2);
      if (data) setRecentSent(data);
    };
    fetchRecentSent();
    const channel = supabase.channel(`campaign-card-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_progress', filter: `campaign_id=eq.${id}` }, () => fetchRecentSent())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const rgbColor = hexToRgb(activeColor);
  const prospectsVal = parseInt(String(prospects)) || 0;
  const sentVal = parseInt(String(sent)) || 0;
  const repliesVal = parseInt(String(replies)) || 0;
  
  const totalExpectedEmails = prospectsVal * 4; 
  const progressPct = totalExpectedEmails > 0 ? Math.min(100, Math.round((sentVal / totalExpectedEmails) * 100)) : 0;
  
  const isCompleted = status?.toLowerCase() === 'completed' || (progressPct >= 100 && prospectsVal > 0);
  const isDraft = (status?.toLowerCase() === 'draft' || status?.toLowerCase() === 'pending') && !isCompleted;
  const { loc, cleanName } = parseLocationFromName(name);

  return (
    <div 
      onClick={onClick} 
      className="relative flex flex-col cursor-pointer transition-all duration-500 hover:-translate-y-1 bg-card border border-border shadow-sm hover:shadow-xl group"
      style={{ 
        borderRadius: '24px',
        minHeight: '360px',
        overflow: 'hidden'
      }}
    >
      {/* Dynamic Top Glow */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-500 group-hover:h-1.5"
        style={{ 
          background: `linear-gradient(90deg, rgba(${rgbColor},0.8) 0%, rgba(${rgbColor},0.2) 100%)`,
          boxShadow: `0 2px 15px rgba(${rgbColor}, 0.4)`
        }}
      />
      
      {/* Header */}
      <div className="p-6 pb-4 flex justify-between items-start">
        <div className="flex flex-col gap-1 min-w-0 pr-4">
          <div className="flex gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: activeColor }}>
            <span>{bizLabel}</span>
            {loc && <span>• {loc}</span>}
          </div>
          <h3 className="font-bold text-xl tracking-tight text-foreground truncate">{cleanName}</h3>
        </div>
        
        {/* Agent Status Badge */}
        <span 
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded-full border shadow-sm transition-colors"
          style={{ 
            backgroundColor: `rgba(${rgbColor}, 0.1)`, 
            borderColor: `rgba(${rgbColor}, 0.2)`,
            color: activeColor 
          }}
        >
          {isCompleted ? <CheckCircle2 size={12} /> : isDraft ? <FileEdit size={12} /> : <Activity size={12} className="animate-pulse" />}
          {isCompleted ? 'Agent Completed' : isDraft ? 'Agent Idle' : 'Agent Active'}
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6 pt-2">
        {/* Simplified Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border transition-colors group-hover:bg-muted/50">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground mb-1">Leads</span>
            <span className="font-bold text-2xl text-foreground">{prospectsVal}</span>
          </div>
          <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border transition-colors group-hover:bg-muted/50">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground mb-1">Sent</span>
            <span className="font-bold text-2xl text-foreground">{sentVal}</span>
          </div>
          <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border transition-colors group-hover:bg-muted/50">
            <span className="text-xs font-semibold tracking-wider text-muted-foreground mb-1">Replies</span>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-2xl text-foreground">{repliesVal}</span>
              <span className="text-[10px] font-semibold" style={{ color: activeColor }}>{replyRate || '0.0%'}</span>
            </div>
          </div>
        </div>

        {/* Agent Activity Log */}
        <div className="flex flex-col gap-3 mt-auto mb-6 bg-muted/10 p-4 rounded-xl border border-border/50">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeColor }} />
            Live Agent Log
          </span>
          {recentSent.length === 0 ? (
            <span className="text-xs font-medium text-muted-foreground italic">Awaiting routing instructions...</span>
          ) : (
            recentSent.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowUpRight size={12} className="text-muted-foreground/60 shrink-0" />
                  <span className="text-xs font-medium text-foreground/80 truncate">
                    {item.lead?.name || item.lead?.email || 'Unknown Contact'}
                  </span>
                </div>
                <span className="text-[10px] font-medium text-muted-foreground shrink-0">
                  {format(new Date(item.sent_at || new Date()), 'h:mm a')}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Autonomous Progress Bar */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Routing Progress</span>
            <span style={{ color: activeColor }}>{progressPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700 ease-out" 
              style={{ width: `${progressPct}%`, backgroundColor: activeColor }} 
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;

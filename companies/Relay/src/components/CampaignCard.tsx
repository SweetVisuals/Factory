import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { CheckCircle2, FileEdit, Activity, Users, Mail, MessageSquare, ArrowUpRight, PauseCircle, AlertCircle } from 'lucide-react';
import { AnimatedNumber } from './AnimatedNumber';

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
  const [realSentCount, setRealSentCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    const fetchRecentSent = async () => {
      const { data } = await supabase.from('campaign_progress').select('id, sent_at, lead:leads(name, email)').eq('campaign_id', id).eq('status', 'sent').order('sent_at', { ascending: false }).limit(2);
      if (data) setRecentSent(data);
    };
    const fetchRealSentCount = async () => {
      const { count } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'sent');
      setRealSentCount(count || 0);
    };
    fetchRecentSent();
    fetchRealSentCount();
    const channel = supabase.channel(`campaign-card-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_progress', filter: `campaign_id=eq.${id}` }, () => {
        fetchRecentSent();
        fetchRealSentCount();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const rgbColor = hexToRgb(activeColor);
  const prospectsVal = parseInt(String(prospects)) || 0;
  const sentVal = realSentCount;
  const repliesVal = parseInt(String(replies)) || 0;
  
  const totalExpectedEmails = prospectsVal * 4; 
  const progressPct = totalExpectedEmails > 0 ? Math.min(100, Math.round((sentVal / totalExpectedEmails) * 100)) : 0;
  
  const isCompleted = status?.toLowerCase() === 'completed' || (progressPct >= 100 && prospectsVal > 0);
  const isDraft = (status?.toLowerCase() === 'draft' || status?.toLowerCase() === 'pending') && !isCompleted;
  const isPaused = status?.toLowerCase() === 'paused';
  const isReview = status?.toLowerCase() === 'review';
  const { loc, cleanName } = parseLocationFromName(name);

  let badgeColor = activeColor;
  let badgeRgb = rgbColor;
  if (isPaused) {
    badgeColor = '#f59e0b';
    badgeRgb = '245, 158, 11';
  } else if (isDraft) {
    badgeColor = '#a3a3a3';
    badgeRgb = '163, 163, 163';
  } else if (isReview) {
    badgeColor = '#a78bfa';
    badgeRgb = '167, 139, 250';
  }

  return (
    <div 
      onClick={onClick} 
      className={`relative flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 bg-card border border-border hover:border-border/80 shadow-sm group rounded-none overflow-hidden ${isReview ? 'campaign-card-review-pulse' : ''}`}
      style={{ 
        minHeight: '380px'
      }}
    >
      {isReview && (
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes purple-pulse-shadow {
            0% {
              box-shadow: 0 0 15px rgba(139, 92, 246, 0.4), 0 0 5px rgba(139, 92, 246, 0.2);
              border-color: rgba(167, 139, 250, 0.4);
            }
            50% {
              box-shadow: 0 0 30px rgba(139, 92, 246, 0.85), 0 0 10px rgba(139, 92, 246, 0.5);
              border-color: rgba(167, 139, 250, 0.95);
            }
            100% {
              box-shadow: 0 0 15px rgba(139, 92, 246, 0.4), 0 0 5px rgba(139, 92, 246, 0.2);
              border-color: rgba(167, 139, 250, 0.4);
            }
          }
          .campaign-card-review-pulse {
            animation: purple-pulse-shadow 2s infinite ease-in-out;
          }
        `}} />
      )}
      {/* Dynamic Top Glow */}
      <div 
        className="absolute top-0 left-0 right-0 h-1 transition-all duration-500 opacity-100"
        style={{ backgroundColor: isReview ? '#8b5cf6' : isPaused ? '#f59e0b' : activeColor }}
      />
      
      {/* Header */}
      <div className="p-6 pb-4 flex justify-between items-start relative z-10">
        <div className="flex flex-col gap-1.5 min-w-0 pr-4">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: isPaused ? '#f59e0b' : activeColor }}>
            <span className="px-2 py-0.5 rounded-none bg-primary/10 border border-primary/20">{bizLabel}</span>
            {loc && <span className="text-muted-foreground">{loc}</span>}
          </div>
          <h3 className="font-black text-2xl tracking-tight text-foreground truncate uppercase">{cleanName}</h3>
        </div>
        
        {/* Agent Status Badge */}
        <span 
          className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-none border transition-all duration-300"
          style={{ 
            backgroundColor: `rgba(${badgeRgb}, 0.1)`, 
            borderColor: `rgba(${badgeRgb}, 0.3)`,
            color: badgeColor 
          }}
        >
          {isCompleted ? (
            <CheckCircle2 size={12} />
          ) : isReview ? (
            <AlertCircle size={12} className="animate-pulse" />
          ) : isPaused ? (
            <PauseCircle size={12} />
          ) : isDraft ? (
            <FileEdit size={12} />
          ) : (
            <Activity size={12} className="animate-pulse" />
          )}
          {isCompleted ? 'Completed' : isReview ? 'Needs Review' : isPaused ? 'Paused' : isDraft ? 'Idle' : 'Active'}
        </span>
      </div>

      <div className="flex flex-col flex-1 p-6 pt-2 relative z-10">
        {/* Premium Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="flex flex-col bg-background rounded-none p-4 border border-border transition-all duration-300 group/metric">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Leads</span>
            <span className="font-black text-2xl text-foreground">
              <AnimatedNumber value={prospectsVal} />
            </span>
          </div>
          <div className="flex flex-col bg-background rounded-none p-4 border border-border transition-all duration-300 group/metric">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Sent</span>
            <span className="font-black text-2xl text-foreground">
              <AnimatedNumber value={sentVal} />
            </span>
          </div>
          <div className="flex flex-col bg-background rounded-none p-4 border border-border transition-all duration-300 group/metric">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Replies</span>
            <div className="flex items-baseline gap-2">
              <span className="font-black text-2xl text-foreground">
                <AnimatedNumber value={repliesVal} />
              </span>
              <span className="text-[10px] font-black" style={{ color: activeColor }}>{replyRate || '0.0%'}</span>
            </div>
          </div>
        </div>

        {/* Agent Activity Log */}
        <div className="flex flex-col gap-3 mt-auto mb-6 bg-background p-4 rounded-none border border-border transition-all">
          <span className="text-[9px] font-black tracking-[0.2em] text-muted-foreground uppercase flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-none animate-pulse shadow-[0_0_8px_currentColor]" style={{ backgroundColor: activeColor, color: activeColor }} />
            Live Agent Log
          </span>
          {recentSent.length === 0 ? (
            <span className="text-xs font-medium text-muted-foreground italic">Awaiting routing instructions...</span>
          ) : (
            recentSent.map((item, idx) => (
              <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0 hover:bg-muted/50 -mx-2 px-2 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <ArrowUpRight size={12} className="text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground truncate">
                    {item.lead?.name || item.lead?.email || 'Unknown Contact'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                  {format(new Date(item.sent_at || new Date()), 'h:mm a')}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Autonomous Progress Bar */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            <span>Routing Progress</span>
            <span style={{ color: activeColor }}>{progressPct}%</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-none overflow-hidden border border-border">
            <div 
              className="h-full rounded-none transition-all duration-1000 ease-out relative overflow-hidden" 
              style={{ width: `${progressPct}%`, backgroundColor: activeColor }} 
            >
              <div className="absolute top-0 bottom-0 left-0 right-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-full animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignCard;

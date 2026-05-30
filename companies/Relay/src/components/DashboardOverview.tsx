import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Send, TrendingUp, DollarSign, ArrowUpRight, MessageSquare, User, Clock, Zap, Activity, BarChart2, X, ShieldCheck, Wifi, Users, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import LoadingSpinner from './auth/LoadingSpinner';

interface ActivityItem {
  id: string;
  type: 'sent' | 'received' | 'neural';
  timestamp: string;
  subject: string;
  from: string;
  to: string;
  campaignName: string;
  txId: string;
  signalStrength: number;
  snippet?: string;
}

interface DashboardOverviewProps {
  selectedBusinessId?: string;
  themeHue?: number;
}

const DashboardOverview = ({ selectedBusinessId = 'all', themeHue = 260 }: DashboardOverviewProps) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    leadsToday: 0,
    neuralSignals: 0,
    totalLeads: 0,
    potentialValue: 0,
    incomeValue: 0
  });

  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [isAdvancedMetricsOpen, setIsAdvancedMetricsOpen] = useState(false);
  const [activityPage, setActivityPage] = useState(0);
  const ACTIVITIES_PER_PAGE = 5;

  const accentColor = `hsl(${themeHue}, 80%, 60%)`;

  const fetchOverviewData = async () => {
    try {
      if (activities.length === 0) setLoading(true);

      let campaignIds: string[] = [];
      if (selectedBusinessId && selectedBusinessId !== 'all') {
        const { data: bCampaigns } = await supabase
          .from('campaigns')
          .select('id')
          .eq('business_id', selectedBusinessId);
        campaignIds = (bCampaigns || []).map(c => c.id);
      }

      // Fetch Recent Sent
      let sentQuery = supabase.from('campaign_progress').select('id, created_at, status, campaign_id, campaign:campaigns(name), email_account:email_accounts(health_score)').eq('status', 'sent').order('created_at', { ascending: false }).limit(20);
      let receivedQuery = supabase.from('inbox_emails').select('id, received_at, subject, from, to, body_text, campaign:campaigns(name), email_account:email_accounts(health_score)').eq('folder', 'inbox').order('received_at', { ascending: false }).limit(10);
      let scraperQuery = supabase.from('scraper_logs').select('*').order('timestamp', { ascending: false }).limit(20);

      if (selectedBusinessId && selectedBusinessId !== 'all') {
        const campIds = campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000'];
        sentQuery = sentQuery.in('campaign_id', campIds);
        receivedQuery = receivedQuery.in('campaign_id', campIds);
      }

      const [{ data: sentData }, { data: receivedData }, { data: scraperData }] = await Promise.all([
        sentQuery, receivedQuery, scraperQuery
      ]);

      const sentItems: ActivityItem[] = (sentData || []).map(item => ({
        id: `sent-${item.id}`,
        type: 'sent',
        timestamp: item.created_at,
        subject: `Outgoing Email Sent`,
        from: 'System',
        to: 'Lead',
        campaignName: (item.campaign as any)?.name || 'Direct',
        txId: `TX-${item.id.substring(0,4).toUpperCase()}`,
        signalStrength: (item.email_account as any)?.health_score || 100
      }));

      const receivedItems: ActivityItem[] = (receivedData || []).map(item => ({
        id: `recv-${item.id}`,
        type: 'received',
        timestamp: item.received_at,
        subject: item.subject,
        from: item.from,
        to: item.to,
        campaignName: (item.campaign as any)?.name || 'Direct',
        snippet: item.body_text?.substring(0, 100),
        txId: `RX-${item.id.substring(0,4).toUpperCase()}`,
        signalStrength: (item.email_account as any)?.health_score || 100
      }));

      const neuralItems: ActivityItem[] = (scraperData || []).map(item => ({
        id: `scrp-${item.id}`,
        type: 'neural',
        timestamp: item.timestamp,
        subject: 'Scraper Activity',
        from: 'Scraper Agent',
        to: 'System',
        campaignName: 'Lead Finder',
        snippet: item.message,
        txId: `SIG-${item.id.substring(0,4).toUpperCase()}`,
        signalStrength: 95
      }));

      const combined = [...sentItems, ...receivedItems, ...neuralItems]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(combined);

      // Advanced Stats
      let leadsTodayQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).gt('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString());
      let oppsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Opportunity', 'Active', 'Interested', 'Meeting Booked']);
      let convsQuery = supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Converted', 'Closed', 'Client', 'Deal Won']);
      let totalLeadsQuery = supabase.from('leads').select('id', { count: 'exact', head: true });

      if (selectedBusinessId && selectedBusinessId !== 'all') {
        let leadIds: string[] = [];
        if (campaignIds.length > 0) {
          const { data: clData } = await supabase.from('campaign_leads').select('lead_id').in('campaign_id', campaignIds);
          leadIds = Array.from(new Set((clData || []).map(cl => cl.lead_id)));
        }
        const lIds = leadIds.length > 0 ? leadIds : ['00000000-0000-0000-0000-000000000000'];
        leadsTodayQuery = leadsTodayQuery.in('id', lIds);
        oppsQuery = oppsQuery.in('id', lIds);
        convsQuery = convsQuery.in('id', lIds);
        totalLeadsQuery = totalLeadsQuery.in('id', lIds);
      }

      const [{ count: leadsToday }, { count: opps }, { count: convs }, { count: totalLeads }, { count: neuralSignals }] = await Promise.all([
        leadsTodayQuery, oppsQuery, convsQuery, totalLeadsQuery,
        supabase.from('scraper_logs').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        leadsToday: leadsToday || 0,
        neuralSignals: neuralSignals || 0,
        totalLeads: totalLeads || 0,
        potentialValue: (opps || 0) * 1500,
        incomeValue: (convs || 0) * 5000
      });

    } catch (err) {
      console.error('Error fetching overview data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
    const channel = supabase.channel('dashboard-overview').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchOverviewData()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedBusinessId]);

  if (loading && activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <LoadingSpinner />
        <p className="text-sm font-medium text-white/50">Loading feed...</p>
      </div>
    );
  }

  const totalActivityPages = Math.ceil(activities.length / ACTIVITIES_PER_PAGE);
  const displayedActivities = activities.slice(activityPage * ACTIVITIES_PER_PAGE, (activityPage + 1) * ACTIVITIES_PER_PAGE);

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Recent Activity Section */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden backdrop-blur-xl">
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/[0.05]">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-white/5">
              <Activity size={20} style={{ color: accentColor }} />
            </div>
            <h2 className="text-lg font-bold">Recent Activity Feed</h2>
          </div>
        </div>

        <div className="divide-y divide-white/[0.02]">
          {displayedActivities.length > 0 ? (
            displayedActivities.map((activity, i) => (
              <div 
                key={activity.id} 
                onClick={() => setSelectedActivity(activity)}
                className="flex items-center justify-between p-6 hover:bg-white/[0.04] transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 group-hover:scale-110 transition-transform">
                    {activity.type === 'sent' && <ArrowUpRight size={18} style={{ color: accentColor }} />}
                    {activity.type === 'received' && <Wifi size={18} className="text-emerald-500" />}
                    {activity.type === 'neural' && <Zap size={18} className="text-blue-400" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">{activity.subject}</h3>
                    <p className="text-xs text-white/50 mt-1">
                      {activity.type === 'sent' ? `To: ${activity.to}` : `From: ${activity.from}`} • {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="hidden md:block text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-white/60 group-hover:bg-white/10">
                    {activity.campaignName}
                  </span>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: activity.type === 'received' ? '#10b981' : accentColor }} />
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-white/40">No recent activity found.</div>
          )}
        </div>

        {/* Pagination Footer */}
        {totalActivityPages > 1 && (
          <div className="p-4 border-t border-white/[0.05] flex items-center justify-center gap-4 bg-white/[0.01]">
            <button 
              onClick={() => setActivityPage(p => Math.max(0, p - 1))}
              disabled={activityPage === 0}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium text-white/50">Page {activityPage + 1} of {totalActivityPages}</span>
            <button 
              onClick={() => setActivityPage(p => Math.min(totalActivityPages - 1, p + 1))}
              disabled={activityPage === totalActivityPages - 1}
              className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Collapsible Advanced Metrics */}
      <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden backdrop-blur-xl transition-all duration-500">
        <div 
          className="p-6 md:p-8 flex items-center justify-between cursor-pointer hover:bg-white/[0.04] transition-colors"
          onClick={() => setIsAdvancedMetricsOpen(!isAdvancedMetricsOpen)}
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-white/5">
              <TrendingUp size={20} className="text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Advanced Pipeline Metrics</h2>
              <p className="text-sm text-white/40">Revenue & detailed conversion tracking</p>
            </div>
          </div>
          {isAdvancedMetricsOpen ? <ChevronUp className="text-white/40" /> : <ChevronDown className="text-white/40" />}
        </div>

        <div className={cn("transition-all duration-500", isAdvancedMetricsOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden")}>
          <div className="p-6 md:p-8 pt-0 border-t border-white/[0.05]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
                <p className="text-sm font-medium text-emerald-500/80 mb-2">Opportunities Value</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">${stats.potentialValue.toLocaleString()}</span>
                  <span className="text-sm text-emerald-500/50">USD</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors" style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}10` }}>
                <p className="text-sm font-medium mb-2" style={{ color: accentColor }}>Revenue Generated</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white">${stats.incomeValue.toLocaleString()}</span>
                  <span className="text-sm" style={{ color: accentColor }}>USD</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Overlay */}
      {selectedActivity && (
        <div className="fixed inset-y-0 right-0 w-full md:w-[500px] bg-[#0a0a0a] border-l border-white/10 shadow-2xl z-[2000] flex flex-col p-8 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <h3 className="text-xl font-bold text-white">Activity Detail</h3>
            <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} className="text-white/60" />
            </button>
          </div>
          
          <div className="space-y-6 text-sm">
            <div>
              <p className="text-white/40 mb-1">Subject</p>
              <p className="text-lg font-semibold">{selectedActivity.subject}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/40 mb-1">From</p>
                <p className="font-medium truncate">{selectedActivity.from}</p>
              </div>
              <div>
                <p className="text-white/40 mb-1">To</p>
                <p className="font-medium truncate">{selectedActivity.to}</p>
              </div>
            </div>
            <div>
              <p className="text-white/40 mb-1">Date & Time</p>
              <p className="font-medium">{format(new Date(selectedActivity.timestamp), 'MMMM do, yyyy - h:mm:ss a')}</p>
            </div>
            {selectedActivity.snippet && (
              <div>
                <p className="text-white/40 mb-2">Content Snippet</p>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-white/80 whitespace-pre-wrap font-mono text-xs">
                  {selectedActivity.snippet}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;

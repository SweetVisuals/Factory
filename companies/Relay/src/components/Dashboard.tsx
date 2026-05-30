import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, AlertCircle, Zap, Shield, Users, Mail, Target, ArrowUpRight, Wifi, ChevronLeft, ChevronRight, Activity, TrendingUp, BarChart2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from './layout/Layout';
import CampaignCard from './CampaignCard';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { campaigns, retry } = useApp();
  const [businesses, setBusinesses] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  
  const [globalStats, setGlobalStats] = useState({ totalSent: 0, bounceRate: 0, opportunities: 0, conversions: 0, health: 98.4 });
  const [activities, setActivities] = useState<any[]>([]);
  const [engineStatus, setEngineStatus] = useState<{ status: string; reason?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'activity'>('campaigns');
  const [campaignsPage, setCampaignsPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  
  const ITEMS_PER_PAGE = 8;
  const CAMPAIGNS_PER_PAGE = 8;

  const handleResumeEngine = async () => {
    const { error } = await supabase.from('agent_memory').upsert({ key_name: 'factory_status', value: { status: 'active' } }, { onConflict: 'key_name' });
    if (!error) setEngineStatus({ status: 'active' });
  };

  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data } = await supabase.from('businesses').select('id, name, status').order('created_at');
      if (data && data.length > 0) {
        setBusinesses(data);
        if (!selectedBusinessId) setSelectedBusinessId(data[0].id);
      }
    };
    fetchBusinesses();
  }, []);

  useEffect(() => {
    if (!selectedBusinessId) return;

    const fetchEngineStatus = async () => {
      const { data } = await supabase.from('agent_memory').select('value').eq('key_name', 'factory_status').maybeSingle();
      if (data && data.value) setEngineStatus(data.value);
    };
    fetchEngineStatus();

    const fetchAllData = async () => {
      const { data: bCampaigns } = await supabase.from('campaigns').select('id').eq('business_id', selectedBusinessId);
      const campaignIds = (bCampaigns || []).map(c => c.id);
      const campIds = campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000'];

      const [{ count: totalSent }, { count: totalFailed }, { count: opps }, { count: convs }] = await Promise.all([
        supabase.from('campaign_progress').select('id', { count: 'exact', head: true }).eq('status', 'sent').in('campaign_id', campIds),
        supabase.from('campaign_progress').select('id', { count: 'exact', head: true }).eq('status', 'failed').in('campaign_id', campIds),
        supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Opportunity', 'Active', 'Interested', 'Meeting Booked']),
        supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Converted', 'Closed', 'Client', 'Deal Won'])
      ]);
      const bounceRate = totalSent && totalSent > 0 ? Math.round(((totalFailed || 0) / ((totalSent || 0) + (totalFailed || 0))) * 100) : 0;
      setGlobalStats(prev => ({ 
        ...prev, 
        totalSent: totalSent || 0, 
        bounceRate,
        opportunities: opps || 0,
        conversions: convs || 0 
      }));

      const [{ data: sentData }, { data: repliesData }, { data: scraperData }] = await Promise.all([
        supabase.from('campaign_progress').select('id, created_at, status, campaign:campaigns(name), lead:leads(name, email, company)').eq('status', 'sent').in('campaign_id', campIds).order('created_at', { ascending: false }).limit(30),
        supabase.from('inbox_emails').select('id, received_at, subject, from, to, body_text, campaign:campaigns(name)').eq('folder', 'inbox').in('campaign_id', campIds).order('received_at', { ascending: false }).limit(20),
        supabase.from('scraper_logs').select('*').order('timestamp', { ascending: false }).limit(20)
      ]);

      const sentItems = (sentData || []).map(item => ({
        id: `sent-${item.id}`,
        type: 'sent',
        timestamp: item.created_at,
        subject: `Outgoing Email Sent`,
        from: 'System',
        to: (item.lead?.name && item.lead.name.trim() !== '') ? item.lead.name : (item.lead?.email || 'Unknown Lead'),
        campaignName: (item.campaign as any)?.name || 'Direct',
        details: `Sent successfully. Company: ${item.lead?.company || 'N/A'}`
      }));

      const receivedItems = (repliesData || []).map(item => ({
        id: `recv-${item.id}`,
        type: 'received',
        timestamp: item.received_at,
        subject: item.subject,
        from: item.from,
        to: item.to,
        campaignName: (item.campaign as any)?.name || 'Direct',
        details: item.body_text?.substring(0, 150) || 'No content available.'
      }));

      const neuralItems = (scraperData || []).map(item => ({
        id: `scrp-${item.id}`,
        type: 'neural',
        timestamp: item.timestamp,
        subject: 'Lead Finder Activity',
        from: 'Scraper Engine',
        to: 'System',
        campaignName: 'Prospecting',
        details: item.message
      }));

      const combined = [...sentItems, ...receivedItems, ...neuralItems].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(combined);
    };

    fetchAllData();

    const channel = supabase.channel('dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_progress' }, () => { fetchAllData(); retry(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_emails' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scraper_logs' }, () => fetchAllData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedBusinessId]);

  const activeCampaigns = campaigns.filter(c => c.business_id === selectedBusinessId);
  const paginatedCampaigns = activeCampaigns.slice(campaignsPage * CAMPAIGNS_PER_PAGE, (campaignsPage + 1) * CAMPAIGNS_PER_PAGE);
  const paginatedActivities = activities.slice(activityPage * ITEMS_PER_PAGE, (activityPage + 1) * ITEMS_PER_PAGE);

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground">
        
        {/* Header Section */}
        <div className="px-10 py-10 bg-background border-b border-border/50">
          <div className="flex flex-col gap-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex flex-col gap-3">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">Dashboard</h1>
                <p className="text-muted-foreground text-base">Overview of your automated outreach and active pipeline.</p>
              </div>

              <button
                onClick={() => navigate('/create-campaign')}
                className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm transition-colors hover:bg-primary/90 shadow-sm"
              >
                <PlusCircle size={18} />
                New Campaign
              </button>
            </div>
            
            {/* Business Selection Tabs */}
            <div className="flex items-center gap-3">
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBusinessId(b.id); setCampaignsPage(0); setActivityPage(0); }}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm font-semibold transition-all border",
                    selectedBusinessId === b.id 
                      ? "bg-foreground text-background border-foreground shadow-md" 
                      : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {engineStatus?.status === 'paused' && (
          <div className="mx-10 mt-6 max-w-[1400px] xl:mx-auto p-5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <AlertCircle size={24} className="text-destructive" />
              <div className="flex flex-col">
                <span className="font-bold text-destructive">Engine Paused</span>
                <span className="text-destructive/80 text-sm">Please check your connected email accounts or billing settings to resume outreach.</span>
              </div>
            </div>
            <button onClick={handleResumeEngine} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-bold hover:bg-destructive/90 transition-colors text-sm shadow-sm">Resume System</button>
          </div>
        )}

        <div className="p-10 max-w-[1400px] mx-auto w-full flex-1 flex flex-col gap-10">
          
          {/* Always Visible Performance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: 'Total Leads Found', val: activeCampaigns.reduce((sum, c) => sum + parseInt(String(c.prospects || 0), 10), 0).toLocaleString(), icon: Users },
              { label: 'Total Emails Sent', val: globalStats.totalSent.toLocaleString(), icon: Mail },
              { label: 'Estimated Pipeline', val: `$${(globalStats.opportunities * 1500 + globalStats.conversions * 5000).toLocaleString()}`, icon: TrendingUp },
              { label: 'System Bounce Rate', val: `${globalStats.bounceRate}%`, icon: AlertCircle, color: globalStats.bounceRate > 5 ? 'text-destructive' : 'text-muted-foreground' }
            ].map((stat, i) => (
              <div key={i} className="p-8 rounded-xl bg-card/40 border border-white/5 flex flex-col justify-between h-40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <stat.icon size={20} className={stat.color || "text-muted-foreground"} />
                </div>
                <p className="text-4xl font-bold text-foreground tracking-tight">{stat.val}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-6">
            {/* Main Navigation Pill Tabs */}
            <div className="flex gap-4">
              {[
                { id: 'campaigns', label: 'Active Campaigns' },
                { id: 'activity', label: 'Activity Log' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-sm font-bold transition-all",
                    activeTab === tab.id ? "bg-card text-foreground ring-1 ring-border shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="animate-in fade-in duration-300">
              {activeTab === 'campaigns' && (
                <div className="space-y-8">
                  {activeCampaigns.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-center bg-card/40 border border-white/5 rounded-xl">
                      <Target size={48} className="text-muted-foreground/30 mb-6" />
                      <h3 className="text-xl font-bold text-foreground mb-2">No Active Campaigns</h3>
                      <p className="text-base text-muted-foreground">Select a business or create a new campaign to begin outreach.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {paginatedCampaigns.map(c => (
                          <CampaignCard
                            key={c.id}
                            id={c.id} name={c.name} status={c.status} prospects={c.prospects || 0} replies={c.replies || 0} sent={c.sent || 0} replyRate={c.reply_rate || c.replyRate || '0%'} objective={c.objective} created_at={c.created_at} current_step={c.current_step}
                            onClick={() => navigate(`/campaign/${c.id}`)}
                          />
                        ))}
                      </div>
                      <PaginationControls page={campaignsPage} setPage={setCampaignsPage} totalItems={activeCampaigns.length} perPage={CAMPAIGNS_PER_PAGE} />
                    </>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="bg-card/40 border border-white/5 rounded-xl flex flex-col">
                  {activities.length === 0 ? (
                    <div className="p-32 text-center flex flex-col items-center gap-4">
                      <Activity size={40} className="text-muted-foreground/30" />
                      <p className="text-base text-muted-foreground">No recent activity to display.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {paginatedActivities.map(item => (
                        <div key={item.id} className="p-8 hover:bg-muted/30 transition-colors flex flex-col gap-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-5">
                              <div className="p-3 rounded-xl bg-muted text-foreground border border-border/50">
                                {item.type === 'sent' && <ArrowUpRight size={18} />}
                                {item.type === 'received' && <Wifi size={18} />}
                                {item.type === 'neural' && <Zap size={18} />}
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-base text-foreground">{item.subject}</span>
                                <span className="text-sm font-medium text-muted-foreground">
                                  {item.type === 'sent' ? `To: ${item.to}` : `From: ${item.from}`}
                                </span>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-muted-foreground whitespace-nowrap bg-muted px-3 py-1 rounded-full">{format(new Date(item.timestamp), 'MMM d, h:mm a')}</span>
                          </div>
                          
                          <div className="bg-muted/40 rounded-xl p-5 ml-16 border border-border/50">
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              {item.details}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {activities.length > ITEMS_PER_PAGE && (
                    <div className="p-6 flex justify-center bg-muted/20 rounded-b-2xl">
                      <PaginationControls page={activityPage} setPage={setActivityPage} totalItems={activities.length} perPage={ITEMS_PER_PAGE} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const PaginationControls = ({ page, setPage, totalItems, perPage }: { page: number, setPage: (p: number | ((prev: number) => number)) => void, totalItems: number, perPage: number }) => {
  const totalPages = Math.ceil(totalItems / perPage);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-3 mt-4">
      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="p-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors shadow-sm">
        <ChevronLeft size={18} />
      </button>
      <span className="text-sm font-bold text-muted-foreground px-4">Page {page + 1} of {totalPages}</span>
      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} className="p-2.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50 transition-colors shadow-sm">
        <ChevronRight size={18} />
      </button>
    </div>
  );
};

export default Dashboard;

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, AlertCircle, Zap, Mail, TrendingUp, Users, ChevronRight, Activity, Send, Inbox as InboxIcon, Bot, ArrowRight, CornerDownRight, X, User, Briefcase, Archive, CheckCircle2, Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from './layout/Layout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format, subDays } from 'date-fns';
import { AnimatedNumber } from './AnimatedNumber';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface InboxEmail {
  id: string;
  received_at: string;
  subject: string;
  from: string;
  to: string;
  body_text: string;
  body_html: string;
  campaign_id: string;
  email_account_id: string;
  campaign: { name: string };
  is_read: boolean;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const { campaigns } = useApp();
  const { toast } = useToast();
  
  const [globalStats, setGlobalStats] = useState({ totalSent: 0, bounceRate: 0, opportunities: 0, conversions: 0, totalScraped: 0 });
  const [inboxEmails, setInboxEmails] = useState<InboxEmail[]>([]);
  
  const [showBounces, setShowBounces] = useState(false);
  const [showOptOuts, setShowOptOuts] = useState(false);
  const [showAutoReplies, setShowAutoReplies] = useState(false);
  
  const [selectedInboxEmail, setSelectedInboxEmail] = useState<InboxEmail | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Time Range Selection
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsTimeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      const { data: bCampaigns } = await supabase.from('campaigns').select('id');
      const campaignIds = (bCampaigns || []).map(c => c.id);
      const campIds = campaignIds.length > 0 ? campaignIds : ['00000000-0000-0000-0000-000000000000'];

      const [{ count: totalSent }, { count: totalBounced }, { count: opps }, { count: convs }, { count: totalScraped }] = await Promise.all([
        supabase.from('campaign_progress').select('id', { count: 'exact', head: true }).eq('status', 'sent').in('campaign_id', campIds),
        supabase.from('campaign_progress').select('id', { count: 'exact', head: true }).eq('status', 'bounced').in('campaign_id', campIds),
        supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Opportunity', 'Active', 'Interested', 'Meeting Booked']),
        supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['Converted', 'Closed', 'Client', 'Deal Won']),
        supabase.from('campaign_leads').select('lead_id', { count: 'exact', head: true }).in('campaign_id', campIds)
      ]);
      const bounceRate = totalSent && totalSent > 0 ? Math.round(((totalBounced || 0) / ((totalSent || 0) + (totalBounced || 0))) * 100) : 0;
      setGlobalStats(prev => ({ 
        ...prev, 
        totalSent: totalSent || 0, 
        bounceRate,
        opportunities: opps || 0,
        conversions: convs || 0,
        totalScraped: totalScraped || 0,
        freePlanLimit: 10000
      }));

      // Get email accounts for this business's campaigns
      const { data: campaignEmailLinks } = await supabase.from('campaign_email_accounts').select('email_account_id').in('campaign_id', campIds);
      const accountIds = Array.from(new Set((campaignEmailLinks || []).map(link => link.email_account_id)));
      const safeAccountIds = accountIds.length > 0 ? accountIds : ['00000000-0000-0000-0000-000000000000'];

      // Fetch Inbox (include emails matched by campaign OR sent to the business's accounts)
      const { data: iEmails } = await supabase
        .from('inbox_emails')
        .select('id, received_at, subject, from, to, body_text, body_html, campaign_id, email_account_id, is_read, is_archived, campaign:campaigns(name)')
        .eq('folder', 'inbox')
        .eq('is_archived', false)
        .or(`campaign_id.in.(${campIds.join(',')}),email_account_id.in.(${safeAccountIds.join(',')})`)
        .order('received_at', { ascending: false })
        .limit(50);

      if (iEmails) {
        // Dedup if an email matched both
        const uniqueEmails = Array.from(new Map(iEmails.map(item => [item.id, item])).values());
        setInboxEmails(uniqueEmails as any);
      }
    };

    fetchAllData();

    // Use polling instead of heavy postgres_changes subscriptions
    const pollInterval = setInterval(() => {
      fetchAllData();
    }, 15000); // 15 seconds polling

    return () => { 
      clearInterval(pollInterval);
    };
  }, []);

  const handleAIDraft = async () => {
    if (!selectedInboxEmail) return;
    try {
      setIsDrafting(true);
      const res = await api.post('/draft-closing-reply', {
        lead: { email: selectedInboxEmail.from },
        thread: selectedInboxEmail.body_text,
        companyName: 'Relay Solutions', // Adjust dynamically based on business if needed
        senderName: 'System Agent',
        senderEmail: selectedInboxEmail.to,
        campaignId: selectedInboxEmail.campaign_id
      });
      
      if (res.data.success && res.data.draft) {
        setReplyContent(res.data.draft);
        toast({ title: 'Draft Generated', description: 'AI has drafted a response.' });
      } else if (res.data.isAutoReply) {
        toast({ title: 'Auto-Reply Detected', description: 'No draft needed.' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to draft response', variant: 'destructive' });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleArchiveEmail = async (id: string = selectedInboxEmail?.id || '') => {
    if (!id) return;
    try {
      await supabase.from('inbox_emails').update({ is_archived: true }).eq('id', id);
      setInboxEmails(prev => prev.filter(e => e.id !== id));
      if (selectedInboxEmail?.id === id) setSelectedInboxEmail(null);
      toast({ title: 'Archived', description: 'Email removed from Needs Attention.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to archive email', variant: 'destructive' });
    }
  };

  const handleBulkArchive = async () => {
    if (selectedEmails.size === 0) return;
    try {
      const ids = Array.from(selectedEmails);
      await supabase.from('inbox_emails').update({ is_archived: true }).in('id', ids);
      setInboxEmails(prev => prev.filter(e => !selectedEmails.has(e.id)));
      if (selectedInboxEmail && selectedEmails.has(selectedInboxEmail.id)) {
        setSelectedInboxEmail(null);
      }
      setSelectedEmails(new Set());
      toast({ title: 'Archived', description: `${ids.length} emails removed.` });
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to archive emails', variant: 'destructive' });
    }
  };

  const toggleEmailSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedEmails);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEmails(next);
  };

  const handleSendReply = async () => {
    if (!selectedInboxEmail || !replyContent) return;
    try {
      setIsSending(true);
      await api.post('/send-closing-reply', {
        leadId: 'unknown', // Typically parsed or fetched
        campaignId: selectedInboxEmail.campaign_id,
        accountId: selectedInboxEmail.email_account_id,
        toEmail: selectedInboxEmail.from,
        subject: `Re: ${selectedInboxEmail.subject}`,
        content: replyContent
      });
      toast({ title: 'Sent', description: 'Reply sent successfully.' });
      setReplyContent('');
      setSelectedInboxEmail(null);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const activeCampaignsCount = campaigns.length;

  // Chart Data Generation (Mocked for visual, based on global stats for scale)
  const generateChartData = () => {
    const data = [];
    const points = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 15;
    const now = new Date();
    
    const scale = {
      campaigns: activeCampaignsCount > 0 ? activeCampaignsCount : 5,
      scraped: globalStats.totalScraped > 0 ? globalStats.totalScraped / points : 100,
      sent: globalStats.totalSent > 0 ? globalStats.totalSent / points : 50,
      pipeline: (globalStats.opportunities * 1500 + globalStats.conversions * 5000) > 0 ? ((globalStats.opportunities * 1500 + globalStats.conversions * 5000) / points) : 1000,
      bounce: globalStats.bounceRate > 0 ? globalStats.bounceRate : 2
    };

    for (let i = points; i >= 0; i--) {
      const d = timeRange === 'day' 
        ? new Date(now.getTime() - i * 60 * 60 * 1000) 
        : subDays(now, i);

      const progress = (points - i) / points; // 0 to 1
      const variation = () => 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      
      data.push({
        name: timeRange === 'day' ? format(d, 'HH:00') : format(d, 'MMM d'),
        'Active Campaigns': Math.max(1, Math.floor(scale.campaigns * (0.5 + progress * 0.5) * (0.9 + Math.random() * 0.2))),
        'Prospects Scraped': Math.floor(scale.scraped * progress * variation() * 10),
        'Emails Sent': Math.floor(scale.sent * progress * variation() * 5),
        'Estimated Pipeline': Math.floor(scale.pipeline * progress * variation() * 2),
        'Bounce Rate': Math.min(100, Math.max(0, scale.bounce * variation() + (Math.random() > 0.8 ? 5 : 0)))
      });
    }
    return data;
  };
  const chartData = generateChartData();

  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-white/10 p-3 rounded-lg shadow-xl flex flex-col gap-2 min-w-[200px] z-50">
          <p className="text-white font-bold text-sm mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.name}
              </span>
              <span className="text-white font-bold">
                {entry.name === 'Estimated Pipeline' ? `$${entry.value.toLocaleString()}` : 
                 entry.name === 'Bounce Rate' ? `${entry.value.toFixed(1)}%` :
                 entry.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout fullHeight>
      <div className="w-full h-full bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Dynamic Header Section */}
        <div className="p-8 pb-4 shrink-0 border-b border-white/5 relative z-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Dashboard</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Overview of automated outreach pipeline
              </p>
            </div>
            
            {/* Time Range Selector */}
            <div className="flex items-center gap-3 relative" ref={dropdownRef}>
              {timeRange === 'custom' && (
                <div className="flex items-center gap-2 bg-[#1a1a1a] border border-white/10 rounded-xl p-1 animate-in fade-in zoom-in duration-200">
                  <input 
                    type="date" 
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-xs text-white px-2 py-1.5 focus:outline-none rounded-lg"
                  />
                  <span className="text-muted-foreground text-xs font-bold">-</span>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-xs text-white px-2 py-1.5 focus:outline-none rounded-lg"
                  />
                </div>
              )}
              
              <div className="relative">
                <button
                  onClick={() => setIsTimeDropdownOpen(!isTimeDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] hover:bg-white/5 border border-white/10 rounded-xl transition-all text-xs font-bold text-white"
                >
                  <Calendar size={14} className="text-muted-foreground" />
                  {timeRange === 'day' ? 'Past Day' : 
                   timeRange === 'week' ? 'Past Week' : 
                   timeRange === 'month' ? 'Past Month' : 'Custom Range'}
                  <ChevronDown size={14} className="text-muted-foreground ml-2" />
                </button>
                
                {isTimeDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="flex flex-col py-1">
                      {[
                        { id: 'day', label: 'Past Day' },
                        { id: 'week', label: 'Past Week' },
                        { id: 'month', label: 'Past Month' },
                        { id: 'custom', label: 'Custom Range' }
                      ].map((option) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            setTimeRange(option.id as any);
                            setIsTimeDropdownOpen(false);
                          }}
                          className={cn(
                            "px-4 py-2.5 text-xs font-bold text-left hover:bg-white/5 transition-colors flex items-center justify-between",
                            timeRange === option.id ? "text-primary" : "text-white"
                          )}
                        >
                          {option.label}
                          {timeRange === option.id && <CheckCircle2 size={14} className="text-primary" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full relative z-10">
          
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
            {[
              { label: 'Active Campaigns', val: activeCampaignsCount.toString(), icon: Activity, color: 'text-blue-400' },
              { label: 'Prospects Scraped', val: globalStats.totalScraped.toLocaleString(), icon: Users, color: 'text-amber-400' },
              { label: 'Total Emails Sent', val: globalStats.totalSent.toLocaleString(), icon: Mail, color: 'text-emerald-400' },
              { label: 'Estimated Pipeline', val: `$${(globalStats.opportunities * 1500 + globalStats.conversions * 5000).toLocaleString()}`, icon: TrendingUp, color: 'text-purple-400' },
              { label: 'Bounce Rate', val: `${globalStats.bounceRate}%`, icon: AlertCircle, color: globalStats.bounceRate > 5 ? 'text-destructive' : 'text-muted-foreground' }
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-2xl bg-[#1a1a1a] border border-white/5 flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full opacity-50 group-hover:scale-110 transition-transform" />
                <div className="flex items-center justify-between relative z-10">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                  <stat.icon size={16} className={stat.color} />
                </div>
                <p className="text-3xl font-black text-white tracking-tight relative z-10">
                  <AnimatedNumber value={stat.val} />
                </p>
              </div>
            ))}
          </div>

          {/* Main Content Area: Chart (Left) + Needs Attention (Right) */}
          <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0 lg:h-[600px] h-auto pb-6">
            
            {/* Left Column (Chart) */}
            <div className="flex-[2] bg-[#1a1a1a] border border-white/5 rounded-2xl flex flex-col overflow-hidden min-w-0">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-white tracking-tight text-lg">Performance Over Time</h3>
                  <p className="text-xs text-muted-foreground">Aggregated metrics for all active campaigns</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Legend */}
                  <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#60A5FA]" /> Campaigns</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#FBBF24]" /> Scraped</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#34D399]" /> Emails</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#A78BFA]" /> Pipeline</span>
                    <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#F87171]" /> Bounces</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-6 relative min-h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        stroke="#ffffff40" 
                        fontSize={10} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(value) => value > 999 ? `${(value/1000).toFixed(1)}k` : value}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      
                      {/* Active Campaigns */}
                      <Line type="monotone" dataKey="Active Campaigns" stroke="#60A5FA" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#60A5FA', stroke: '#000', strokeWidth: 2 }} />
                      
                      {/* Prospects Scraped */}
                      <Line type="monotone" dataKey="Prospects Scraped" stroke="#FBBF24" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#FBBF24', stroke: '#000', strokeWidth: 2 }} />
                      
                      {/* Emails Sent */}
                      <Line type="monotone" dataKey="Emails Sent" stroke="#34D399" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#34D399', stroke: '#000', strokeWidth: 2 }} />
                      
                      {/* Estimated Pipeline */}
                      <Line type="monotone" dataKey="Estimated Pipeline" stroke="#A78BFA" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#A78BFA', stroke: '#000', strokeWidth: 2 }} />
                      
                      {/* Bounce Rate */}
                      <Line type="monotone" dataKey="Bounce Rate" stroke="#F87171" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#F87171', stroke: '#000', strokeWidth: 2 }} />
                      
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground italic">No data available for the selected period.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (Needs Attention) */}
            <div className="flex-1 flex flex-col gap-4 min-w-[350px] max-w-[500px]">
              <div className="flex flex-col gap-2 bg-[#1a1a1a] p-3 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between mb-1 px-1">
                  <div className="flex items-center gap-2">
                    <InboxIcon size={18} className="text-primary" />
                    <h3 className="font-black text-white text-base">Needs Attention</h3>
                  </div>
                  {inboxEmails.filter(e => !e.is_read).length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {inboxEmails.filter(e => !e.is_read).length} Unread
                    </span>
                  )}
                </div>
                
                {inboxEmails.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 px-1">
                    <button
                      onClick={() => setShowBounces(!showBounces)}
                      className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors", showBounces ? "bg-red-500/20 text-red-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      Bounces {showBounces ? '(On)' : ''}
                    </button>
                    <button
                      onClick={() => setShowOptOuts(!showOptOuts)}
                      className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors", showOptOuts ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      Opt Outs {showOptOuts ? '(On)' : ''}
                    </button>
                    <button
                      onClick={() => setShowAutoReplies(!showAutoReplies)}
                      className={cn("px-2.5 py-1 text-[10px] font-bold rounded-md transition-colors", showAutoReplies ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      Auto Reply {showAutoReplies ? '(On)' : ''}
                    </button>
                    <div className="flex-1" />
                    {selectedEmails.size > 0 && (
                      <button
                        onClick={handleBulkArchive}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1"
                      >
                        <Archive size={12} /> Archive
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-2xl flex flex-col overflow-hidden relative">
                
                {selectedInboxEmail ? (
                  // Thread & Reply View (Nested in the Right Column now)
                  <div className="flex-1 flex flex-col h-full bg-black/20 animate-in slide-in-from-right-4 duration-300">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]/90 backdrop-blur z-10">
                      <div className="flex items-center gap-3 min-w-0 pr-4">
                        <button onClick={() => setSelectedInboxEmail(null)} className="p-1.5 hover:bg-white/10 rounded-lg shrink-0 text-muted-foreground hover:text-white transition-colors">
                          <X size={16} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                          {(selectedInboxEmail.from.charAt(0) || '?').toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-sm text-white truncate">{selectedInboxEmail.subject}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{selectedInboxEmail.from.split('<')[0]}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                      <div className="bg-[#111111] border border-white/5 rounded-xl p-4 shadow-sm">
                        <div className="prose prose-invert prose-sm max-w-none font-medium leading-relaxed text-white/80 whitespace-pre-wrap text-[11px]">
                          {selectedInboxEmail.body_text}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 border-t border-white/5 bg-[#1a1a1a]">
                      <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-shadow flex flex-col">
                        <textarea
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          placeholder="Type reply or AI draft..."
                          className="w-full bg-transparent p-3 text-xs resize-none focus:outline-none min-h-[80px] text-white custom-scrollbar"
                        />
                        <div className="flex items-center justify-between p-2 border-t border-white/5 bg-white/[0.02]">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleArchiveEmail()}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-white/10 hover:text-white transition-colors"
                              title="Archive"
                            >
                              <Archive size={14} />
                            </button>
                            <button
                              onClick={handleAIDraft}
                              disabled={isDrafting}
                              className="p-1.5 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                              title="AI Draft"
                            >
                              <Bot size={14} />
                            </button>
                          </div>
                          <button
                            onClick={handleSendReply}
                            disabled={!replyContent.trim() || isSending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-bold transition-colors disabled:opacity-50"
                          >
                            {isSending ? 'Sending' : 'Send'} <Send size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Needs Attention List
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {inboxEmails.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground italic flex flex-col items-center gap-2 m-auto mt-12">
                        <CheckCircle2 size={32} className="opacity-20 text-emerald-500" />
                        Inbox zero. You're all caught up.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {inboxEmails.filter(email => {
                          const isBounce = email.from.toLowerCase().includes('mailer-daemon') || email.from.toLowerCase().includes('postmaster');
                          const subjectLower = (email.subject || '').toLowerCase();
                          const bodyLower = (email.body_text || '').toLowerCase();
                          const isOptOut = bodyLower.includes('no thank you') || bodyLower.includes('no thanks') || bodyLower.includes('not interested') || bodyLower.includes('unsubscribe') || bodyLower.includes('opt out') || bodyLower.includes('opt-out') || bodyLower.includes('remove me') || subjectLower.includes('unsubscribe') || subjectLower.includes('opt out');
                          const isAutoReply = /^(auto:|automatic reply:|autoreply:|out of office|ooo:|vacation|undeliverable)/i.test(email.subject || '') || bodyLower.includes('this is an automated response') || bodyLower.includes('this mailbox is not monitored') || bodyLower.includes('away from my desk') || bodyLower.includes('out of the office') || bodyLower.includes('your email has been received') || subjectLower.includes('thank you for emailing') || subjectLower.includes('we have received your email') || subjectLower.includes('safely received your email') || bodyLower.includes('automatic response') || bodyLower.includes('safely received your email');
                          
                          if (isBounce && !showBounces) return false;
                          if (isOptOut && !showOptOuts) return false;
                          if (isAutoReply && !showAutoReplies) return false;
                          return true;
                        }).map((email) => {
                          const isBounce = email.from.toLowerCase().includes('mailer-daemon') || email.from.toLowerCase().includes('postmaster');
                          const subjectLower = (email.subject || '').toLowerCase();
                          const bodyLower = (email.body_text || '').toLowerCase();
                          const isOptOut = bodyLower.includes('no thank you') || bodyLower.includes('no thanks') || bodyLower.includes('not interested') || bodyLower.includes('unsubscribe') || bodyLower.includes('opt out') || bodyLower.includes('opt-out') || bodyLower.includes('remove me') || subjectLower.includes('unsubscribe') || subjectLower.includes('opt out');
                          const isAutoReply = /^(auto:|automatic reply:|autoreply:|out of office|ooo:|vacation|undeliverable)/i.test(email.subject || '') || bodyLower.includes('this is an automated response') || bodyLower.includes('this mailbox is not monitored') || bodyLower.includes('away from my desk') || bodyLower.includes('out of the office') || bodyLower.includes('your email has been received') || subjectLower.includes('thank you for emailing') || subjectLower.includes('we have received your email') || subjectLower.includes('safely received your email') || bodyLower.includes('automatic response') || bodyLower.includes('safely received your email');
                          
                          let displayBody = email.body_text?.substring(0, 100);
                          let originalEmail = '';
                          if (isBounce) {
                            const match = email.body_text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                            if (match) originalEmail = match[0];
                            displayBody = `Email: ${originalEmail || 'Unknown'} was blacklisted and invalid.`;
                          } else if (isAutoReply) {
                            displayBody = `[Automated Response] ${displayBody}`;
                          } else if (isOptOut) {
                            displayBody = `[Opt Out] ${displayBody}`;
                          }

                          return (
                            <div 
                              key={email.id}
                              onClick={() => setSelectedInboxEmail(email)}
                              className={cn(
                                "p-3 rounded-xl border border-white/5 cursor-pointer transition-all hover:bg-white/[0.04] flex gap-3 group relative overflow-hidden",
                                isBounce ? "bg-red-500/5 hover:bg-red-500/10 border-red-500/20" :
                                isAutoReply ? "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/20" :
                                isOptOut ? "bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20" : "bg-black/20"
                              )}
                            >
                              <div 
                                onClick={(e) => toggleEmailSelection(email.id, e)}
                                className={cn(
                                  "w-4 h-4 rounded border flex flex-shrink-0 items-center justify-center transition-colors mt-0.5 z-10", 
                                  selectedEmails.has(email.id) ? "bg-primary border-primary text-white" : "border-white/20 group-hover:border-white/40"
                                )}
                              >
                                {selectedEmails.has(email.id) && <CheckCircle2 size={12} />}
                              </div>
                              <div className="flex-1 min-w-0 z-10">
                                <div className="flex justify-between items-start gap-2 mb-0.5">
                                  <span className={cn("text-xs truncate", !email.is_read ? "font-bold text-white" : "font-medium text-white/70")}>
                                    {isBounce ? 'System Bounce' : email.from.split('<')[0]}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground whitespace-nowrap pt-0.5">{format(new Date(email.received_at), 'MMM d, h:mm a')}</span>
                                </div>
                                <div className={cn("text-[11px] truncate mb-1", !email.is_read ? "font-semibold text-white/90" : "text-white/60")}>
                                  {isBounce ? 'Undeliverable Mail' : email.subject}
                                </div>
                                <div className={cn("text-[10px] line-clamp-2 leading-relaxed opacity-70", isBounce ? "text-red-400 font-medium" : "text-muted-foreground")}>
                                  {displayBody}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;

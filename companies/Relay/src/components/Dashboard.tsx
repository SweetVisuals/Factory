import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, AlertCircle, Zap, Mail, TrendingUp, Users, ChevronRight, Activity, Send, Inbox as InboxIcon, Bot, ArrowRight, CornerDownRight, X, User, Briefcase, Archive, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Layout from './layout/Layout';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { AnimatedNumber } from './AnimatedNumber';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';

interface ScraperLog {
  id: string;
  timestamp: string;
  message: string;
}

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

interface SentEmail {
  id: string;
  created_at: string;
  sent_at: string;
  status: string;
  campaign_id: string;
  lead: { id: string; name: string; email: string; company: string };
  campaign: { name: string };
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const { campaigns } = useApp();
  const { toast } = useToast();
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const scraperContainerRef = useRef<HTMLDivElement>(null);
  
  const [businesses, setBusinesses] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  
  const [globalStats, setGlobalStats] = useState({ totalSent: 0, bounceRate: 0, opportunities: 0, conversions: 0, totalScraped: 0, health: 98.4 });
  const [engineStatus, setEngineStatus] = useState<{ status: string; reason?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'inbox' | 'outgoing'>('inbox');
  
  // Real-time feeds
  const [scraperLogs, setScraperLogs] = useState<ScraperLog[]>([]);
  const [isScraperOpen, setIsScraperOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [showBounces, setShowBounces] = useState(false);
  const [showOptOuts, setShowOptOuts] = useState(false);
  const [showAutoReplies, setShowAutoReplies] = useState(false);
  
  const [inboxEmails, setInboxEmails] = useState<InboxEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  
  // Reply State
  const [selectedInboxEmail, setSelectedInboxEmail] = useState<InboxEmail | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const scrollToBottom = () => {
    if (scraperContainerRef.current) {
      scraperContainerRef.current.scrollTo({
        top: scraperContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    if (isScraperOpen) scrollToBottom();
  }, [scraperLogs, isScraperOpen]);

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
        totalScraped: totalScraped || 0
      }));

      // Fetch Scraper Logs
      try {
        const logRes = await api.get('/scraper-logs');
        if (Array.isArray(logRes.data) && logRes.data.length > 0) {
            setScraperLogs(logRes.data);
        }
      } catch(e) {}

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

      // Fetch Sent
      const { data: sEmails } = await supabase.from('campaign_progress').select('id, created_at, sent_at, status, campaign_id, campaign:campaigns(name), lead:leads(id, name, email, company)').eq('status', 'sent').in('campaign_id', campIds).order('sent_at', { ascending: false }).limit(50);
      if (sEmails) setSentEmails(sEmails as any);
    };

    fetchAllData();

    const channel = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_progress' }, () => fetchAllData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_emails' }, () => fetchAllData())
      .subscribe();

    let logsInterval: any;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.channel(`scraped-leads-${session.user.id}`)
        .on('broadcast', { event: 'scrape-log' }, (payload) => {
           if (payload.payload && payload.payload.message) {
             setScraperLogs(prev => [...prev.slice(-49), payload.payload as ScraperLog]);
           }
        }).subscribe();
        
      logsInterval = setInterval(async () => {
        try {
          const logRes = await api.get('/scraper-logs');
          if (Array.isArray(logRes.data) && logRes.data.length > 0) {
            setScraperLogs(logRes.data);
          }
        } catch(e) {}
      }, 2000);
    });

    return () => { 
      supabase.removeChannel(channel); 
      if (logsInterval) clearInterval(logsInterval);
    };
  }, [selectedBusinessId]);

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
      toast({ title: 'Archived', description: 'Email removed from Needs Reply.' });
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

  const activeCampaignsCount = campaigns.filter(c => c.business_id === selectedBusinessId).length;

  return (
    <Layout fullHeight>
      <div className="w-full h-full bg-background text-foreground flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Dynamic Header Section */}
        <div className="p-8 pb-4 shrink-0">
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
            
            {/* Business Selection Tabs */}
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
              {businesses.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBusinessId(b.id)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                    selectedBusinessId === b.id 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {engineStatus?.status === 'paused' && (
          <div className="mx-6 mt-4 max-w-[1600px] xl:mx-auto p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <AlertCircle size={20} className="text-destructive" />
              <div className="flex flex-col">
                <span className="font-bold text-destructive text-sm">Engine Paused</span>
                <span className="text-destructive/80 text-xs">System outreach halted. Resume when ready.</span>
              </div>
            </div>
            <button onClick={handleResumeEngine} className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg font-bold hover:bg-destructive/90 transition-colors text-sm shadow-sm">Resume System</button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full">
          
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

          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row flex-1 gap-6 min-h-0 lg:h-[600px] h-auto pb-6">
            
            {/* Left/Middle Column (Inbox & Sent) */}
            <div className="flex-[2] flex flex-col gap-4 min-w-0">
              <div className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded-xl border border-white/5">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setActiveTab('inbox'); setSelectedInboxEmail(null); }}
                    className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeTab === 'inbox' ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white")}
                  >
                    <InboxIcon size={16} /> Needs Reply
                    {inboxEmails.filter(e => !e.is_read).length > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full">{inboxEmails.filter(e => !e.is_read).length}</span>
                    )}
                  </button>
                  <button 
                    onClick={() => { setActiveTab('outgoing'); setSelectedInboxEmail(null); }}
                    className={cn("px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all", activeTab === 'outgoing' ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white")}
                  >
                    <Send size={16} /> Outgoing Stream
                  </button>
                </div>
                {activeTab === 'inbox' && inboxEmails.length > 0 && (
                  <div className="flex items-center gap-3 pr-2">
                    <button
                      onClick={() => setShowBounces(!showBounces)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors", showBounces ? "bg-red-500/20 text-red-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      <AlertCircle size={14} /> {showBounces ? 'Hide Bounces' : 'Show Bounces'}
                    </button>
                    <button
                      onClick={() => setShowOptOuts(!showOptOuts)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors", showOptOuts ? "bg-yellow-500/20 text-yellow-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      <AlertCircle size={14} /> {showOptOuts ? 'Hide Opt Outs' : 'Show Opt Outs'}
                    </button>
                    <button
                      onClick={() => setShowAutoReplies(!showAutoReplies)}
                      className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors", showAutoReplies ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white")}
                    >
                      <AlertCircle size={14} /> {showAutoReplies ? 'Hide Auto Replies' : 'Show Auto Replies'}
                    </button>
                    <button
                      onClick={() => {
                        if (selectedEmails.size === inboxEmails.length) setSelectedEmails(new Set());
                        else setSelectedEmails(new Set(inboxEmails.map(e => e.id)));
                      }}
                      className="text-xs font-bold text-muted-foreground hover:text-white flex items-center gap-1.5 transition-colors"
                    >
                      <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors", selectedEmails.size === inboxEmails.length ? "bg-primary border-primary text-white" : "border-white/20")}>
                        {selectedEmails.size === inboxEmails.length && <CheckCircle2 size={12} />}
                      </div>
                      Select All
                    </button>
                    {selectedEmails.size > 0 && (
                      <button
                        onClick={handleBulkArchive}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        <Archive size={14} /> Archive Selected
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-2xl flex overflow-hidden">
                {activeTab === 'inbox' ? (
                  <>
                    {/* Inbox List */}
                    <div className={cn("flex flex-col border-r border-white/5 overflow-y-auto custom-scrollbar", selectedInboxEmail ? "w-1/3 hidden md:flex" : "w-full")}>
                      {inboxEmails.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground italic flex flex-col items-center gap-2 m-auto">
                          <InboxIcon size={32} className="opacity-20" />
                          Inbox zero. You're all caught up.
                        </div>
                      ) : (
                        inboxEmails.filter(email => {
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
                              "p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/[0.02] flex gap-3 group",
                              selectedInboxEmail?.id === email.id ? "bg-white/[0.04] border-l-2 border-l-primary" : "border-l-2 border-l-transparent",
                              isBounce ? "bg-red-500/5 hover:bg-red-500/10" :
                              isAutoReply ? "bg-orange-500/10 hover:bg-orange-500/20" :
                              isOptOut ? "bg-yellow-500/10 hover:bg-yellow-500/20" : ""
                            )}
                          >
                            <div 
                              onClick={(e) => toggleEmailSelection(email.id, e)}
                              className={cn(
                                "w-4 h-4 rounded border flex flex-shrink-0 items-center justify-center transition-colors mt-0.5", 
                                selectedEmails.has(email.id) ? "bg-primary border-primary text-white" : "border-white/20 group-hover:border-white/40"
                              )}
                            >
                              {selectedEmails.has(email.id) && <CheckCircle2 size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <span className={cn("text-sm truncate", !email.is_read ? "font-bold text-white" : "font-medium text-white/70")}>
                                  {isBounce ? 'System Bounce' : email.from.split('<')[0]}
                                </span>
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(email.received_at), 'MMM d, h:mm a')}</span>
                              </div>
                              <div className={cn("text-xs truncate mb-1", !email.is_read ? "font-semibold text-white/90" : "text-white/60")}>
                                {isBounce ? 'Undeliverable Mail' : email.subject}
                              </div>
                              <div className={cn("text-[10px] line-clamp-2 leading-relaxed", isBounce ? "text-red-400 font-medium" : "text-muted-foreground")}>
                                {displayBody}
                              </div>
                            </div>
                          </div>
                        )})
                      )}
                    </div>
                    
                    {/* Thread & Reply View */}
                    {selectedInboxEmail && (
                      <div className="flex-1 flex flex-col min-w-0 bg-black/20 relative">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#1a1a1a]/90 backdrop-blur z-10">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                              {(selectedInboxEmail.from.charAt(0) || '?').toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-sm text-white truncate">
                                {(() => {
                                  const subjectLower = (selectedInboxEmail.subject || '').toLowerCase();
                                  const bodyLower = (selectedInboxEmail.body_text || '').toLowerCase();
                                  const isOptOut = bodyLower.includes('no thank you') || bodyLower.includes('no thanks') || bodyLower.includes('not interested') || bodyLower.includes('unsubscribe') || bodyLower.includes('opt out') || bodyLower.includes('opt-out') || bodyLower.includes('remove me') || subjectLower.includes('unsubscribe') || subjectLower.includes('opt out');
                                  const isAutoReply = /^(auto:|automatic reply:|autoreply:|out of office|ooo:|vacation|undeliverable)/i.test(selectedInboxEmail.subject || '') || bodyLower.includes('this is an automated response') || bodyLower.includes('this mailbox is not monitored') || bodyLower.includes('away from my desk') || bodyLower.includes('out of the office') || bodyLower.includes('your email has been received') || subjectLower.includes('thank you for emailing') || subjectLower.includes('we have received your email') || subjectLower.includes('safely received your email') || bodyLower.includes('automatic response') || bodyLower.includes('safely received your email');
                                  
                                  if (isAutoReply) return <span className="text-orange-400 mr-2">[Automated Response]</span>;
                                  if (isOptOut) return <span className="text-yellow-400 mr-2">[Opt Out]</span>;
                                  return null;
                                })()}
                                {selectedInboxEmail.subject}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">{selectedInboxEmail.from} • {selectedInboxEmail.campaign?.name || 'Direct'}</span>
                            </div>
                          </div>
                          <button onClick={() => setSelectedInboxEmail(null)} className="p-2 hover:bg-white/10 rounded-lg shrink-0 md:hidden">
                            <X size={16} />
                          </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                          <div className="bg-[#111111] border border-white/5 rounded-xl p-5 shadow-sm">
                            <div className="prose prose-invert prose-sm max-w-none font-medium leading-relaxed text-white/80 whitespace-pre-wrap">
                              {(() => {
                                 const isBounce = selectedInboxEmail.from.toLowerCase().includes('mailer-daemon') || selectedInboxEmail.from.toLowerCase().includes('postmaster');
                                 if (isBounce) {
                                   const match = selectedInboxEmail.body_text?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                                   return <span className="text-red-400 font-bold">Email: {match ? match[0] : 'Unknown'} was blacklisted and invalid.</span>;
                                 }
                                 return selectedInboxEmail.body_text;
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="p-4 border-t border-white/5 bg-[#1a1a1a]">
                          <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Type your reply or use AI to draft..."
                              className="w-full bg-transparent p-4 text-sm resize-none focus:outline-none min-h-[100px] text-white"
                            />
                            <div className="flex items-center justify-between p-3 border-t border-white/5 bg-white/[0.02]">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleArchiveEmail()}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-white/70 hover:bg-white/10 hover:text-white text-xs font-bold transition-colors"
                                >
                                  <Archive size={14} /> Archive
                                </button>
                                <button
                                  onClick={handleAIDraft}
                                  disabled={isDrafting}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition-colors disabled:opacity-50"
                                >
                                  <Bot size={14} /> {isDrafting ? 'Drafting...' : 'AI Draft'}
                                </button>
                              </div>
                              <button
                                onClick={handleSendReply}
                                disabled={!replyContent.trim() || isSending}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-colors disabled:opacity-50"
                              >
                                {isSending ? 'Sending...' : 'Send Reply'} <Send size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                    {sentEmails.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground italic m-auto">No outgoing emails found.</div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {sentEmails.map(sent => (
                          <div 
                            key={sent.id} 
                            onClick={() => navigate('/inbox', { state: { focusEmailFrom: sent.lead?.email } })}
                            className="p-4 flex flex-col gap-2 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400">
                                  <ArrowRight size={14} />
                                </div>
                                <span className="font-bold text-sm text-white group-hover:text-primary transition-colors">To: {sent.lead?.name || sent.lead?.email}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{format(new Date(sent.sent_at || sent.created_at), 'MMM d, h:mm a')}</span>
                            </div>
                            <div className="ml-9 flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Briefcase size={12}/> {sent.lead?.company || 'Unknown Company'}</span>
                              <span className="text-[11px] text-primary/80 font-medium">Campaign: {sent.campaign?.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Scraper Feed */}
            <div className={cn("flex flex-col transition-all duration-300", isScraperOpen ? "flex-1 lg:max-w-[400px] h-[400px] lg:h-auto" : "w-full lg:w-12 h-[52px] lg:h-auto shrink-0")}>
              <div className="flex items-center justify-between bg-[#1a1a1a] p-2 rounded-xl border border-white/5 mb-4">
                {isScraperOpen ? (
                  <>
                    <div className="flex items-center gap-2 px-2 font-bold text-sm text-white">
                      <Zap size={16} className="text-yellow-400" /> Live Scraper Feed
                    </div>
                    <button onClick={() => setIsScraperOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground"><X size={16}/></button>
                  </>
                ) : (
                  <button onClick={() => setIsScraperOpen(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-yellow-400 m-auto flex flex-col gap-2" title="Open Scraper Feed">
                    <Zap size={16} />
                  </button>
                )}
              </div>

               {/* Collapsed Feed Box Container (Only show if open) */}
              {isScraperOpen && (
                <div className="flex-1 bg-[#1a1a1a] border border-white/5 rounded-2xl flex flex-col overflow-hidden relative">
                  <div className="absolute top-0 w-full h-4 bg-gradient-to-b from-[#1a1a1a] to-transparent z-10 pointer-events-none" />
                  <div ref={scraperContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {scraperLogs.length === 0 ? (
                      <div className="text-center text-xs text-muted-foreground italic py-8">Waiting for scraper activity...</div>
                    ) : (
                      scraperLogs.map((log, i) => (
                        <div key={log.id || i} className="font-mono text-[10px] leading-relaxed p-3 rounded-lg bg-black/40 border border-white/5 animate-in slide-in-from-bottom-2 duration-300">
                          <div className="flex items-center justify-between mb-1.5 opacity-60">
                            <span className="text-blue-400 flex items-center gap-1"><TerminalIcon size={10} /> SYSTEM</span>
                            <span>{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                          </div>
                          <div className="text-emerald-400 whitespace-pre-wrap break-words max-h-32 overflow-y-auto custom-scrollbar pr-2 bg-black/20 p-2 rounded border border-white/5">
                            {log.message}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                  </div>
                  <div className="absolute bottom-0 w-full h-8 bg-gradient-to-t from-[#1a1a1a] to-transparent z-10 pointer-events-none" />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
};

const TerminalIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
);

export default Dashboard;

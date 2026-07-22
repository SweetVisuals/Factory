import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Inbox as InboxIcon, Archive, Star, Search, RefreshCw, Briefcase, Folder, Filter, Mail, Send, CheckCircle2, Bot, ChevronDown, ArrowLeft, Trash2, X, Edit3, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmailMessage, EmailAccount, Campaign } from '../types';
import { fetchEmailAccounts } from '../lib/api/email-accounts';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';
import Layout from '../components/layout/Layout';
import { ComposeDock } from '../components/ComposeDock';
type FilterState = 
  | { type: 'all' }
  | { type: 'archive' }
  | { type: 'business'; businessName: string }
  | { type: 'campaign'; businessName: string; campaignId: string };

interface Thread {
  id: string;
  contactEmail: string;
  contactName: string;
  messages: EmailMessage[];
  lastMessageAt: Date;
  isRead: boolean;
  campaignId?: string;
  accountId: string;
  folder: string; // Derived from latest message
}

const Inbox = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  
  // Reply State
  const [replyContent, setReplyContent] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyFromAccountId, setReplyFromAccountId] = useState('');
  const [showReplySignatureDropdown, setShowReplySignatureDropdown] = useState(false);
  const [showReplyFromDropdown, setShowReplyFromDropdown] = useState(false);
  const replyEditorRef = useRef<HTMLDivElement>(null);
  
  // Compose State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const location = useLocation();

  const getBusinessName = (accountId: string): string => {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return 'Other';
    const emailLower = account.email.toLowerCase();
    if (emailLower.includes('mrmedicevents') || emailLower.includes('mrmedic')) return 'MrMedic Events';
    if (emailLower.includes('relaysolutions') || emailLower.includes('relay')) return 'Relay Solutions';
    const domain = emailLower.split('@')[1];
    if (domain) return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    return 'Other';
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const accountsData = await fetchEmailAccounts();
        setAccounts(accountsData);
        const { data: camps } = await supabase.from('campaigns').select('id, name');
        if (camps) setCampaigns(camps as Campaign[]);
        await fetchEmails(false, false);
      } catch (err) {
        console.error('Failed to load inbox data:', err);
        setError('Failed to load inbox. Please refresh.');
      } finally {
        setLoading(false);
      }
    };
    loadData();

    const inboxChannel = supabase
      .channel('global-inbox-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inbox_emails' }, () => fetchEmails(false, false))
      .subscribe();

    return () => { supabase.removeChannel(inboxChannel); };
  }, []);

  const fetchEmails = async (refresh = false, syncNew = false) => {
    try {
      setError(null);
      if (!refresh && !syncNew) setLoading(true);
      
      const { data, error: fetchErr } = await supabase.from('inbox_emails').select('*').order('received_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      if (data) {
        const parsedEmails: EmailMessage[] = data.map(email => ({
          id: email.id, uid: email.uid, accountId: email.email_account_id,
          from: email.from, to: email.to, subject: email.subject, date: email.received_at,
          snippet: email.snippet || '', text: email.body_text, html: email.body_html,
          folder: email.folder as any, isRead: email.is_read, sequenceStep: email.sequence_step, campaignId: email.campaign_id
        }));
        
        setEmails(parsedEmails);
        
        // Group into threads
        const threadsMap = new Map<string, Thread>();
        parsedEmails.forEach(email => {
          const isSent = email.folder === 'sent';
          const rawEmailString = isSent ? email.to : email.from;
          const match = rawEmailString.match(/<([^>]+)>/);
          const contactEmail = match ? match[1].toLowerCase().trim() : rawEmailString.toLowerCase().trim();
          
          let contactName = '';
          if (match) {
            contactName = rawEmailString.split('<')[0].replace(/"/g, '').trim();
          } else {
            contactName = contactEmail;
          }

          if (!threadsMap.has(contactEmail)) {
            threadsMap.set(contactEmail, {
              id: contactEmail,
              contactEmail,
              contactName,
              messages: [],
              lastMessageAt: new Date(email.date),
              isRead: email.folder === 'sent' ? true : email.isRead,
              campaignId: email.campaignId,
              accountId: email.accountId,
              folder: email.folder
            });
          }
          
          const thread = threadsMap.get(contactEmail)!;
          thread.messages.push(email);
          
          const emailDate = new Date(email.date);
          if (emailDate > thread.lastMessageAt) {
            thread.lastMessageAt = emailDate;
            thread.isRead = email.folder === 'sent' ? true : email.isRead;
            thread.folder = email.folder;
          }
        });

        // Sort messages chronologically inside threads
        threadsMap.forEach(thread => {
          thread.messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        });

        const threadList = Array.from(threadsMap.values()).sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
        setThreads(threadList);
      }

      if (refresh || syncNew) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          api.get('/emails', { params: { refresh, syncNew }, headers: { 'Authorization': `Bearer ${session.access_token}` } })
            .catch(e => console.warn('Background IMAP sync failed:', e));
        }
      }
    } catch (err) {
      console.error('Error fetching emails:', err);
      if (!syncNew) setError('Failed to load emails. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEmails(true);
  };

  // Deep linking for Dashboard "Outgoing Stream" click
  useEffect(() => {
    if (threads.length > 0 && location.state) {
      const state = location.state as any;
      if (state.focusEmailFrom) {
        const searchEmail = state.focusEmailFrom.toLowerCase().trim();
        const matched = threads.find(t => t.contactEmail.includes(searchEmail));
        if (matched) {
          setSelectedThread(matched);
          // clear state
          window.history.replaceState({}, document.title);
        }
      }
    }
  }, [threads, location.state]);

  // Scroll to bottom of thread when opened and mark as read
  useEffect(() => {
    if (selectedThread) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      setReplyFromAccountId(selectedThread.accountId);
      
      // Mark as read if not read
      if (!selectedThread.isRead) {
        const unreadMsgs = selectedThread.messages.filter(m => !m.isRead);
        if (unreadMsgs.length > 0) {
          supabase.from('inbox_emails').update({ is_read: true }).in('id', unreadMsgs.map(m => m.id)).then(() => {
            fetchEmails();
          });
        }
      }
    }
  }, [selectedThread?.id]);

  useEffect(() => {
    if (replyEditorRef.current && replyContent !== replyEditorRef.current.innerHTML) {
      replyEditorRef.current.innerHTML = replyContent;
    }
  }, [replyContent]);

  const getSignatureHtml = (sig: any) => {
    if (!sig) return '';
    const textHtml = sig.content.replace(/\n/g, '<br/>');
    const imgHtml = sig.imageUrl ? `<img src="${sig.imageUrl}" alt="Signature Logo" style="max-width: 100%; display: block; margin-top: 6px;" />` : '';
    return `<div class="composer-signature-block" style="margin-top: 16px; line-height: 1.5;">${textHtml}${imgHtml}</div>`;
  };

  const injectReplySignature = (sig: any) => {
    if (!replyEditorRef.current) return;
    
    let currentHtml = replyEditorRef.current.innerHTML;
    
    // Remove existing signature block
    const doc = new DOMParser().parseFromString(currentHtml, 'text/html');
    const existingSig = doc.querySelector('.composer-signature-block');
    if (existingSig) {
      existingSig.remove();
    }
    
    // Clean up trailing line breaks to avoid signature stacking gaps
    let cleanedBody = doc.body.innerHTML;
    cleanedBody = cleanedBody.replace(/(?:<br\s*\/?>|\s)+$/, '');
    
    const sigHtml = getSignatureHtml(sig);
    const newHtml = cleanedBody + sigHtml;
    
    replyEditorRef.current.innerHTML = newHtml;
    setReplyContent(newHtml);
  };

  useEffect(() => {
    const selectedAccount = accounts.find(a => a.id === replyFromAccountId);
    if (selectedAccount?.signatures) {
      try {
        const sigs = typeof selectedAccount.signatures === 'string' 
          ? JSON.parse(selectedAccount.signatures) 
          : selectedAccount.signatures;
        if (Array.isArray(sigs)) {
          const defSig = sigs.find((s: any) => s.isDefault);
          if (defSig) {
            injectReplySignature(defSig);
          } else {
            injectReplySignature(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [replyFromAccountId, accounts, selectedThread?.id]);

  const filteredThreads = useMemo(() => {
    return threads.filter(thread => {
      // Archive filter check based on the latest message's folder
      if (filter.type === 'archive') {
        if (thread.folder !== 'archive') return false;
      } else {
        if (thread.folder === 'archive') return false;
      }

      const emailBusiness = getBusinessName(thread.accountId);
      if (filter.type === 'business' && emailBusiness !== filter.businessName) return false;
      if (filter.type === 'campaign' && (emailBusiness !== filter.businessName || thread.campaignId !== filter.campaignId)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return thread.contactName.toLowerCase().includes(term) || 
               thread.contactEmail.toLowerCase().includes(term) || 
               thread.messages.some(m => m.subject.toLowerCase().includes(term) || m.text.toLowerCase().includes(term));
      }
      return true;
    });
  }, [threads, accounts, filter, searchTerm]);

  const hierarchy = useMemo(() => {
    const tree: Record<string, Record<string, number>> = {};
    threads.forEach(thread => {
      if (thread.folder === 'archive') return;
      const emailBusiness = getBusinessName(thread.accountId);
      if (!tree[emailBusiness]) tree[emailBusiness] = {};
      const campId = thread.campaignId || 'unassigned';
      if (!tree[emailBusiness][campId]) tree[emailBusiness][campId] = 0;
      tree[emailBusiness][campId]++;
    });
    return tree;
  }, [threads, accounts]);

  const handleAction = async (action: 'archive', thread: Thread) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      toast({ title: 'Archiving thread...', description: "Please wait..." });
      
      // We only archive the received emails in this thread to clean up the inbox view
      const incomingMsgs = thread.messages.filter(m => m.folder === 'inbox');
      if (incomingMsgs.length === 0) {
        // If thread only contains sent, we just mark the sent as archive
         await Promise.all(thread.messages.map(m => api.post('/emails/action', { 
          emailAccountId: thread.accountId, 
          uids: [m.uid], 
          action, 
          folder: m.folder 
        }, { headers: { 'Authorization': `Bearer ${session.access_token}` } })));
      } else {
        await Promise.all(incomingMsgs.map(m => api.post('/emails/action', { 
          emailAccountId: thread.accountId, 
          uids: [m.uid], 
          action, 
          folder: m.folder 
        }, { headers: { 'Authorization': `Bearer ${session.access_token}` } })));
      }
      
      setSelectedThread(null);
      fetchEmails();
      toast({ title: "Success", description: `Thread archived.` });
    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      toast({ title: "Error", description: `Failed to ${action} thread.`, variant: "destructive" });
    }
  };

  const handleAIDraft = async () => {
    if (!selectedThread) return;
    try {
      setIsDrafting(true);
      // Collect thread history for context
      const threadHistory = selectedThread.messages.map(m => `${m.folder === 'sent' ? 'Relay:' : 'Lead:'} ${m.text}`).join('\n\n');
      
      const res = await api.post('/draft-closing-reply', {
        lead: { email: selectedThread.contactEmail },
        thread: threadHistory,
        companyName: getBusinessName(selectedThread.accountId),
        senderName: 'Account Executive',
        senderEmail: accounts.find(a => a.id === selectedThread.accountId)?.email || '',
        campaignId: selectedThread.campaignId
      });
      if (res.data.success && res.data.draft) {
        setReplyContent(res.data.draft);
        toast({ title: 'Draft Generated', description: 'AI has drafted a response based on the thread.' });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to draft response', variant: 'destructive' });
    } finally {
      setIsDrafting(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedThread || !replyContent) return;
    try {
      setIsSending(true);
      const lastIncoming = selectedThread.messages.slice().reverse().find(m => m.folder === 'inbox');
      const subject = lastIncoming ? `Re: ${lastIncoming.subject.replace(/^(Re:\s*)+/i, '')}` : `Follow up`;
      
      await api.post('/send-closing-reply', {
        leadId: 'unknown',
        campaignId: selectedThread.campaignId,
        accountId: replyFromAccountId || selectedThread.accountId,
        toEmail: selectedThread.contactEmail,
        subject,
        content: replyContent
      });
      toast({ title: 'Sent', description: 'Reply sent successfully.' });
      setReplyContent('');
      fetchEmails(true); // refresh to pull the sent email
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-background animate-in fade-in duration-200">
        
        {/* Canonical Header */}
        <div className="px-8 py-5 pb-3 shrink-0">
          <div className="flex items-end justify-between w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Inbox</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Unified conversation threads
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-[10px] font-bold text-white/30 uppercase tracking-widest">{threads.filter(t => t.folder !== 'archive').length} active threads</span>
              <button 
                onClick={() => setIsComposeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
              >
                <Plus size={14} /> Compose
              </button>
              <button onClick={handleRefresh} className={cn("p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all", refreshing && "animate-spin text-primary")}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Main Inbox Application Shell */}
        <div className="flex flex-1 overflow-hidden border-t border-white/5">

          {/* Sidebar */}
          <div className="hidden lg:flex w-60 border-r border-white/5 flex-col bg-[#1a1a1a]/50 shrink-0">
            <div className="p-4 border-b border-white/5">
              <button 
                onClick={() => setIsComposeOpen(true)}
                className="w-full py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                Compose <Send size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
              <div className="space-y-0.5">
                <span className="px-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Mailboxes</span>
                <button
                  onClick={() => { setFilter({ type: 'all' }); setSelectedThread(null); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'all' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <InboxIcon size={14} /> Active
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'all' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder !== 'archive').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'archive' }); setSelectedThread(null); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'archive' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <Archive size={14} /> Archived
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'archive' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder === 'archive').length}</span>
                </button>
              </div>

              <div className="space-y-0.5">
                <span className="px-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Organizations</span>
                {Object.entries(hierarchy).map(([businessName, bizCampaigns]) => {
                  const isBizSelected = filter.type === 'business' && filter.businessName === businessName;
                  let bizTotal = 0; Object.values(bizCampaigns).forEach(c => bizTotal += c);

                  return (
                    <div key={businessName} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => { setFilter({ type: 'business', businessName }); setSelectedThread(null); }}
                        className={cn("flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all min-w-0 w-full", isBizSelected ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                      >
                        <Briefcase size={12} className="shrink-0" /> <span className="truncate flex-1 text-left">{businessName}</span> <span className="ml-auto text-[10px] font-black shrink-0">{bizTotal}</span>
                      </button>

                      <div className="pl-7 space-y-0.5">
                        {Object.entries(bizCampaigns).map(([campaignId, count]) => {
                          const campaign = campaigns.find(c => c.id === campaignId);
                          const isCampSelected = filter.type === 'campaign' && filter.campaignId === campaignId && filter.businessName === businessName;
                          return (
                            <button
                              key={campaignId}
                              onClick={() => { setFilter({ type: 'campaign', businessName, campaignId }); setSelectedThread(null); }}
                              className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all min-w-0", isCampSelected ? "bg-primary/10 text-primary" : "text-white/30 hover:text-white hover:bg-white/5")}
                            >
                              <Folder size={10} className="shrink-0" /> <span className="truncate flex-1 text-left">{campaign ? campaign.name : 'Unknown'}</span> <span className="ml-auto text-[9px] font-black shrink-0">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Threads List Column */}
          <div className={cn("border-r border-white/5 flex flex-col bg-white/[0.01] relative z-10 shrink-0", selectedThread ? "hidden md:flex w-80" : "flex-1 w-full lg:w-80")}>
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={13} />
                <input
                  type="text"
                  placeholder="Search threads..."
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-white/[0.03] border border-white/5 rounded-lg focus:outline-none focus:border-primary/40 text-white placeholder:text-white/25 transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <RefreshCw className="animate-spin text-primary" size={18} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Loading threads...</span>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[10px] font-bold uppercase tracking-widest text-white/20">
                  No threads found
                </div>
              ) : (
                <div>
                  {filteredThreads.map(thread => {
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    const isActive = selectedThread?.id === thread.id;
                    return (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={cn(
                          "px-4 py-3 cursor-pointer transition-all flex flex-col gap-0.5 border-b border-white/[0.03]",
                          isActive ? "bg-primary/[0.06] border-l-2 border-l-primary" : "border-l-2 border-l-transparent hover:bg-white/[0.02]",
                          !thread.isRead && !isActive ? "bg-white/[0.02]" : ""
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className={cn("font-bold text-xs truncate pr-2", !thread.isRead ? "text-white" : "text-white/50")}>
                            {thread.contactName}
                          </span>
                          <span className="text-[9px] font-bold text-white/20 uppercase tracking-wider shrink-0">
                            {format(thread.lastMessageAt, 'MMM d')}
                          </span>
                        </div>
                        <div className="text-[11px] truncate font-medium text-white/40 flex items-center gap-1.5">
                          {latestMsg.folder === 'sent' ? <Send size={9} className="text-white/20 shrink-0" /> : <Mail size={9} className="text-primary/60 shrink-0" />}
                          {latestMsg.subject}
                        </div>
                        <div className="text-[10px] line-clamp-1 text-white/20">
                          {latestMsg.snippet || latestMsg.text?.substring(0, 60)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Thread Reading & Reply Pane */}
          <div className={cn("bg-background flex flex-col min-w-0 relative", selectedThread ? "flex-1 w-full" : "hidden md:flex flex-1")}>
            {selectedThread ? (
              <>
                <div className="h-14 flex items-center px-4 md:px-6 justify-between border-b border-white/5 bg-background sticky top-0 z-10 shrink-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button 
                      onClick={() => setSelectedThread(null)} 
                      className="md:hidden p-1.5 -ml-1 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20 shrink-0">
                      {selectedThread.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">{selectedThread.contactName}</span>
                      <span className="text-[11px] text-white/30 font-medium">{selectedThread.contactEmail} · {selectedThread.messages.length} messages</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAction('archive', selectedThread)}
                      className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all"
                      title="Archive Thread"
                    >
                      <Archive size={14} />
                    </button>
                    <button onClick={() => setSelectedThread(null)} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-all">
                      <X size={14} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-3xl mx-auto flex flex-col gap-5">
                    {selectedThread.messages.map((msg, idx) => {
                      const isSent = msg.folder === 'sent';
                      const senderAccount = accounts.find(a => a.id === msg.accountId);
                      const fromLabel = isSent ? (senderAccount?.email || msg.from) : msg.from;
                      const toLabel = isSent ? msg.to : (senderAccount?.email || msg.to);
                      return (
                        <div key={msg.id} className={cn("flex flex-col max-w-[85%] animate-in fade-in duration-150", isSent ? "self-end items-end" : "self-start items-start")}>
                          {/* From / To + Timestamp */}
                          <div className="flex flex-col gap-0.5 mb-1.5 px-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">
                                {isSent ? 'You' : selectedThread.contactName.split(' ')[0]}
                              </span>
                              <span className="text-[9px] text-white/20">{format(new Date(msg.date), 'MMM d, h:mm a')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-white/20 font-medium">
                              <span>From: <span className="text-white/35">{fromLabel.replace(/<|>/g, '').substring(0, 40)}</span></span>
                              <span>To: <span className="text-white/35">{toLabel.replace(/<|>/g, '').substring(0, 40)}</span></span>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-medium border",
                            isSent 
                              ? "bg-primary/[0.06] border-primary/10 text-white/80 rounded-tr-sm" 
                              : "bg-white/[0.03] border-white/5 text-white/80 rounded-tl-sm"
                          )}>
                            {msg.text ? msg.text : (
                              <iframe
                                title={`msg-${msg.id}`}
                                srcDoc={`<html><body style="font-family: sans-serif; color: #e4e4e7; margin: 0; padding: 0;">${msg.html}</body></html>`}
                                className="w-full min-h-[100px] border-none"
                                sandbox="allow-same-origin"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Reply Box */}
                <div className="p-4 border-t border-white/5 shrink-0">
                  <div className="max-w-3xl mx-auto">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden focus-within:border-primary/30 transition-colors">
                      {/* From Selector */}
                      <div className="flex items-center px-4 py-2.5 border-b border-white/5 bg-white/[0.01]">
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mr-3">From:</span>
                        <div className="relative inline-block z-20">
                          <button
                            type="button"
                            onClick={() => setShowReplyFromDropdown(!showReplyFromDropdown)}
                            className="bg-black/20 border border-white/5 px-2.5 py-1 rounded-lg text-xs text-white/70 hover:text-white transition-colors flex items-center gap-1 min-w-[140px] justify-between"
                          >
                            <span className="truncate max-w-[120px]">{accounts.find(a => a.id === replyFromAccountId)?.email || 'Select Account'}</span>
                            <ChevronDown size={12} className="opacity-50" />
                          </button>
                          {showReplyFromDropdown && (
                            <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                              <div className="px-3 py-2 border-b border-white/5 bg-[#1a1a1a]">
                                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Send Reply From</span>
                              </div>
                              <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                {accounts.map(acc => (
                                  <button
                                    key={acc.id}
                                    type="button"
                                    onClick={() => { setReplyFromAccountId(acc.id); setShowReplyFromDropdown(false); }}
                                    className={cn(
                                      "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 flex items-center justify-between",
                                      replyFromAccountId === acc.id ? "bg-primary/10 text-primary font-bold" : "text-white"
                                    )}
                                  >
                                    <span className="truncate">{acc.email}</span>
                                    {acc.status === 'active' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Rich Text Editor */}
                      <div
                        ref={replyEditorRef}
                        contentEditable
                        onInput={(e) => setReplyContent(e.currentTarget.innerHTML)}
                        className="w-full bg-transparent p-4 text-sm focus:outline-none min-h-[120px] text-white overflow-y-auto max-h-48 prose prose-invert focus:ring-0 empty:before:content-[attr(placeholder)] empty:before:text-white/20 empty:before:pointer-events-none"
                        placeholder={`Reply to ${selectedThread.contactName}...`}
                        style={{ outline: 'none' }}
                      />

                      {/* Toolbar & Send Actions */}
                      <div className="flex items-center justify-between p-3 border-t border-white/5 bg-black/10">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAIDraft}
                            disabled={isDrafting}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                          >
                            <Bot size={12} /> {isDrafting ? 'Drafting...' : 'Draft with AI'}
                          </button>

                          {/* Formatting Actions */}
                          <div className="flex items-center gap-1 border-l border-white/5 pl-2 ml-1">
                            <button
                              type="button"
                              onClick={() => document.execCommand('bold')}
                              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Bold"
                            >
                              <span className="font-bold text-xs">B</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => document.execCommand('italic')}
                              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Italic"
                            >
                              <span className="italic text-xs font-serif">I</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => document.execCommand('underline')}
                              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Underline"
                            >
                              <span className="underline text-xs">U</span>
                            </button>
                          </div>

                          {/* Signature Selector */}
                          <div className="relative inline-block ml-1">
                            <button
                              type="button"
                              onClick={() => setShowReplySignatureDropdown(!showReplySignatureDropdown)}
                              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors flex items-center"
                              title="Insert Signature"
                            >
                              <Edit3 size={14} />
                            </button>
                            {showReplySignatureDropdown && (
                              <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                                <div className="px-3 py-1.5 border-b border-white/5 bg-[#1a1a1a]">
                                  <span className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Select Signature</span>
                                </div>
                                <div className="max-h-36 overflow-y-auto custom-scrollbar">
                                  {(() => {
                                    const acc = accounts.find(a => a.id === replyFromAccountId);
                                    let sigList: any[] = [];
                                    if (acc?.signatures) {
                                      try {
                                        sigList = typeof acc.signatures === 'string' ? JSON.parse(acc.signatures) : acc.signatures;
                                      } catch (e) {
                                        console.error(e);
                                      }
                                    }
                                    if (sigList.length > 0) {
                                      return sigList.map((sig: any, index: number) => (
                                        <button
                                          key={index}
                                          type="button"
                                          onClick={() => { injectReplySignature(sig); setShowReplySignatureDropdown(false); }}
                                          className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 transition-colors flex items-center justify-between"
                                        >
                                          <span className="truncate">{sig.name}</span>
                                          {sig.isDefault && <span className="text-[8px] text-primary uppercase font-bold">Def</span>}
                                        </button>
                                      ));
                                    }
                                    return (
                                      <div className="px-3 py-2 text-[10px] text-white/40 italic">
                                        No custom signatures
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={handleSendReply}
                          disabled={!replyContent.trim() || isSending}
                          className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-xl hover:bg-gray-200 transition-all font-black uppercase tracking-widest text-[10px] disabled:opacity-40 shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                        >
                          {isSending ? 'Sending...' : 'Send'} <Send size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-5">
                  <Mail size={28} className="text-white/15" />
                </div>
                <p className="font-bold text-sm text-white/40">Select a thread to view</p>
                <p className="text-[10px] text-white/15 mt-1 uppercase tracking-widest font-bold">Conversations will appear here</p>
              </div>
            )}
          </div>

        </div>
      </div>
      
      <ComposeDock 
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        accounts={accounts}
      />
    </Layout>
  );
};

export default Inbox;

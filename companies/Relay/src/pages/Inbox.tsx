import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Search, Mail, RefreshCw, Trash2, Archive, Inbox as InboxIcon, ChevronDown, ChevronRight, Briefcase, Folder, Send, Bot, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmailMessage, EmailAccount, Campaign } from '../types';
import { fetchEmailAccounts } from '../lib/api/email-accounts';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';
import Layout from '../components/layout/Layout';

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

  // Scroll to bottom of thread when opened
  useEffect(() => {
    if (selectedThread) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
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
        accountId: selectedThread.accountId,
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
      <div className="flex flex-col h-full bg-background p-0">
        
        {/* Main Inbox Application Shell */}
        <div className="flex flex-1 overflow-hidden bg-card border-none">

          {/* Sidebar */}
          <div className="w-64 border-r border-border flex flex-col bg-card/50">
            <div className="p-6 flex items-center justify-between border-b border-border/50 bg-background/50">
              <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Mail className="text-primary" size={20} /> Inbox
              </h2>
              <button onClick={handleRefresh} className={cn("p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all", refreshing && "animate-spin text-primary")}>
                <RefreshCw size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-8">
              <div className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mailboxes</span>
                <button
                  onClick={() => { setFilter({ type: 'all' }); setSelectedThread(null); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", filter.type === 'all' ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                >
                  <InboxIcon size={16} /> Active Threads
                  <span className={cn("ml-auto text-xs font-black", filter.type === 'all' ? "text-primary-foreground/80" : "text-muted-foreground")}>{threads.filter(t => t.folder !== 'archive').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'archive' }); setSelectedThread(null); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", filter.type === 'archive' ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                >
                  <Archive size={16} /> Archived
                  <span className={cn("ml-auto text-xs font-black", filter.type === 'archive' ? "text-primary-foreground/80" : "text-muted-foreground")}>{threads.filter(t => t.folder === 'archive').length}</span>
                </button>
              </div>

              <div className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Organizations</span>
                {Object.entries(hierarchy).map(([businessName, bizCampaigns]) => {
                  const isBizSelected = filter.type === 'business' && filter.businessName === businessName;
                  let bizTotal = 0; Object.values(bizCampaigns).forEach(c => bizTotal += c);

                  return (
                    <div key={businessName} className="flex flex-col gap-0.5">
                      <div className="flex items-center min-w-0">
                        <button
                          onClick={() => { setFilter({ type: 'business', businessName }); setSelectedThread(null); }}
                          className={cn("flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold transition-all min-w-0", isBizSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                        >
                          <Briefcase size={14} className="shrink-0" /> <span className="truncate flex-1 text-left">{businessName}</span> <span className="ml-auto text-[10px] opacity-60 shrink-0">{bizTotal}</span>
                        </button>
                      </div>

                      <div className="pl-6 space-y-0.5 mt-0.5">
                        {Object.entries(bizCampaigns).map(([campaignId, count]) => {
                          const campaign = campaigns.find(c => c.id === campaignId);
                          const isCampSelected = filter.type === 'campaign' && filter.campaignId === campaignId && filter.businessName === businessName;

                          return (
                            <button
                              key={campaignId}
                              onClick={() => { setFilter({ type: 'campaign', businessName, campaignId }); setSelectedThread(null); }}
                              className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-bold transition-all min-w-0", isCampSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                            >
                              <Folder size={12} className="shrink-0" /> <span className="truncate flex-1 text-left">{campaign ? campaign.name : 'Unknown'}</span> <span className="ml-auto text-[9px] opacity-60 shrink-0">{count}</span>
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
          <div className="w-96 border-r border-border flex flex-col bg-card relative z-10 shadow-xl shadow-black/5">
            <div className="p-4 border-b border-border/50 bg-background/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  placeholder="Search threads..."
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-foreground placeholder:text-muted-foreground"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                  <RefreshCw className="animate-spin text-primary" size={24} />
                  <span className="text-xs font-bold uppercase tracking-widest">Loading threads...</span>
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  No threads found
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredThreads.map(thread => {
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    return (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={cn(
                          "p-4 cursor-pointer transition-all relative flex flex-col gap-1 hover:bg-muted",
                          selectedThread?.id === thread.id ? "bg-primary/5 border-l-4 border-primary" : "border-l-4 border-transparent",
                          !thread.isRead ? "bg-primary/5" : ""
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <span className={cn("font-bold text-sm truncate pr-2", !thread.isRead ? "text-foreground" : "text-muted-foreground")}>
                            {thread.contactName}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mt-0.5">
                            {format(thread.lastMessageAt, 'MMM d')}
                          </span>
                        </div>
                        <div className="text-xs truncate font-medium text-foreground/80 flex items-center gap-1.5">
                          {latestMsg.folder === 'sent' ? <Send size={10} className="text-muted-foreground" /> : <Mail size={10} className="text-primary" />}
                          {latestMsg.subject}
                        </div>
                        <div className="text-[11px] line-clamp-1 text-muted-foreground/80">
                          {latestMsg.snippet || latestMsg.text?.substring(0, 50)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Thread Reading & Reply Pane */}
          <div className="flex-1 bg-background flex flex-col min-w-0 relative">
            {selectedThread ? (
              <>
                <div className="h-16 flex items-center px-8 justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border border-primary/30">
                      {selectedThread.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground">{selectedThread.contactName}</span>
                      <span className="text-xs text-muted-foreground">{selectedThread.contactEmail}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction('archive', selectedThread)}
                      className="p-2 bg-card border border-border hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 shadow-sm"
                      title="Archive Thread"
                    >
                      <Archive size={16} />
                    </button>
                    <button onClick={() => setSelectedThread(null)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-muted/10">
                  <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {/* Date separator can be added here in future */}
                    
                    {selectedThread.messages.map((msg, idx) => {
                      const isSent = msg.folder === 'sent';
                      return (
                        <div key={msg.id} className={cn("flex flex-col max-w-[85%]", isSent ? "self-end items-end" : "self-start items-start")}>
                          <div className="flex items-center gap-2 mb-1 px-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              {isSent ? 'You' : selectedThread.contactName.split(' ')[0]}
                            </span>
                            <span className="text-[9px] text-muted-foreground/60">{format(new Date(msg.date), 'MMM d, h:mm a')}</span>
                          </div>
                          
                          <div className={cn(
                            "p-5 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap font-medium border",
                            isSent 
                              ? "bg-primary/10 border-primary/20 text-foreground/90 rounded-tr-sm" 
                              : "bg-card border-border/50 text-foreground/90 rounded-tl-sm"
                          )}>
                            {/* Render text or HTML. Since this is an internal dashboard, raw text is often cleaner, but we'll use HTML inside an iframe for complex ones or just raw text */}
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
                <div className="p-4 bg-card border-t border-border/50">
                  <div className="max-w-4xl mx-auto">
                    <div className="bg-background border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder={`Reply to ${selectedThread.contactName}...`}
                        className="w-full bg-transparent p-4 text-sm resize-none focus:outline-none min-h-[120px] text-foreground"
                      />
                      <div className="flex items-center justify-between p-3 border-t border-border/50 bg-muted/30">
                        <button
                          onClick={handleAIDraft}
                          disabled={isDrafting}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          <Bot size={14} /> {isDrafting ? 'Drafting...' : 'Draft with AI'}
                        </button>
                        <button
                          onClick={handleSendReply}
                          disabled={!replyContent.trim() || isSending}
                          className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-bold transition-colors shadow-sm disabled:opacity-50"
                        >
                          {isSending ? 'Sending...' : 'Send'} <Send size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
                  <Mail size={32} className="opacity-50" />
                </div>
                <p className="font-bold text-sm">Select a thread to view</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Inbox zero is calling.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </Layout>
  );
};

export default Inbox;

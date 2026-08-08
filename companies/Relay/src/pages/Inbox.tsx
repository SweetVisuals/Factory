import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Inbox as InboxIcon, Archive, Star, Search, RefreshCw, Briefcase, Folder, Mail, Send, Bot, ChevronDown, ArrowLeft, Trash2, Edit3, MessageSquare, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmailMessage, EmailAccount, Campaign } from '../types';

// Augment EmailMessage locally for the new field
interface LocalEmailMessage extends EmailMessage {
  isImportant?: boolean;
  campaignId?: string;
}
import { fetchEmailAccounts } from '../lib/api/email-accounts';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';
import Layout from '../components/layout/Layout';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { ComposeDock } from '../components/ComposeDock';
type FilterState = 
  | { type: 'all' }
  | { type: 'replies' }
  | { type: 'archive' }
  | { type: 'important' }
  | { type: 'trash' }
  | { type: 'business'; businessName: string }
  | { type: 'campaign'; businessName: string; campaignId: string };

interface Thread {
  id: string;
  contactEmail: string;
  contactName: string;
  messages: LocalEmailMessage[];
  lastMessageAt: Date;
  isRead: boolean;
  campaignId?: string;
  accountId: string;
  folder: string; // Derived from latest message
  isImportant?: boolean;
}

const Inbox = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'replies' });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
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
  const [searchParams] = useSearchParams();
  const composeEmail = searchParams.get('compose');

  useEffect(() => {
    if (composeEmail) {
      setIsComposeOpen(true);
    }
  }, [composeEmail]);

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
        toast({ title: 'Error', description: 'Failed to load inbox data. Please refresh.', variant: 'destructive' });
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
      if (!refresh && !syncNew) setLoading(true);
      
      const { data, error: fetchErr } = await supabase.from('inbox_emails').select('*').order('received_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      if (data) {
        const parsedEmails: LocalEmailMessage[] = data.map(email => ({
          id: email.id, uid: email.uid, accountId: email.email_account_id,
          from: email.from, to: email.to, subject: email.subject, date: email.received_at,
          snippet: email.snippet || '', text: email.body_text, html: email.body_html,
          folder: email.folder as any, isRead: email.is_read, sequenceStep: email.sequence_step, campaignId: email.campaign_id,
          isImportant: email.is_important
        }));
        
        
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
              folder: email.folder,
              isImportant: email.isImportant
            });
          }
          
          const thread = threadsMap.get(contactEmail)!;
          thread.messages.push(email);
          if (email.isImportant) thread.isImportant = true;
          
          const emailDate = new Date(email.date);
          if (emailDate > thread.lastMessageAt) {
            thread.lastMessageAt = emailDate;
            thread.isRead = email.folder === 'sent' ? true : email.isRead;
            if (email.folder !== 'sent' || thread.folder !== 'archive') {
              thread.folder = email.folder;
            }
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
      if (!syncNew) toast({ title: 'Error', description: 'Failed to load emails. Please try again.', variant: 'destructive' });
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
    if (!sig) {
      const acc = accounts.find(a => a.id === replyFromAccountId);
      if (acc?.signature) {
        const legacySig = acc.signature.replace(/<img([^>]*)style="[^"]*"([^>]*)>/gi, '<img$1style="height: 200px; width: auto; display: block; margin-top: 6px;"$2>');
        return `<div class="composer-signature-block" style="margin-top: 16px; line-height: 1.5;">${legacySig}</div>`;
      }
      return '';
    }
    const textHtml = sig.content.replace(/\n/g, '<br/>');
    const imgHtml = sig.imageUrl ? `<img src="${sig.imageUrl}" alt="Signature Logo" style="height: 200px; width: auto; display: block; margin-top: 6px;" />` : '';
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

      if (filter.type === 'replies') {
        // A thread is a "reply" if it has at least one message in the inbox
        const hasReply = thread.messages.some(m => m.folder === 'inbox');
        if (!hasReply) return false;
      }

      const emailBusiness = getBusinessName(thread.accountId);
      if (filter.type === 'business' && emailBusiness !== filter.businessName) return false;
      if (filter.type === 'campaign' && (emailBusiness !== filter.businessName || thread.campaignId !== filter.campaignId)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return thread.contactName.toLowerCase().includes(term) || 
               thread.contactEmail.toLowerCase().includes(term) || 
               thread.messages.some(m => m.subject.toLowerCase().includes(term) || m.text?.toLowerCase().includes(term));
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
      const threadHistory = selectedThread.messages.map(m => `${m.folder === 'sent' ? 'Relay:' : 'Lead:'} ${m.text || ''}`).join('\n\n');
      
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

  const getAvatarBgColor = (name: string) => {
    const colors = [
      'bg-red-500/20 text-red-300 border-red-500/30',
      'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'bg-green-500/20 text-green-300 border-green-500/30',
      'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'bg-pink-500/20 text-pink-300 border-pink-300/30',
      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
    return colors[sum % colors.length];
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-background animate-in fade-in duration-200 p-0 relative">
        
        {/* Mobile Navigation Drawer (Gmail Style) */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Drawer Backdrop */}
            <div 
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setIsDrawerOpen(false)}
            />
            {/* Drawer Content */}
            <div className="relative flex flex-col w-72 max-w-xs bg-[#1a1a1a] border-r border-white/10 h-full p-4 animate-in slide-in-from-left duration-200">
              <div className="flex items-center gap-2 mb-6 px-2">
                <span className="font-black text-lg tracking-wider text-white">Relay</span>
                <span className="text-[10px] bg-primary/20 text-primary font-black px-1.5 py-0.5 rounded uppercase">Inbox</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                <div className="space-y-0.5">
                  <span className="px-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Mailboxes</span>
                  <button
                    onClick={() => { setFilter({ type: 'replies' }); setSelectedThread(null); setSelectedThreads(new Set()); setIsDrawerOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'replies' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                  >
                    <MessageSquare size={14} className={cn(filter.type === 'replies' ? "text-primary" : "text-white/30")} />
                    Replies
                  </button>
                  <button
                    onClick={() => { setFilter({ type: 'all' }); setSelectedThread(null); setSelectedThreads(new Set()); setIsDrawerOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'all' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                  >
                    <InboxIcon size={14} className={cn(filter.type === 'all' ? "text-primary" : "text-white/30")} />
                    All Conversations
                    <span className={cn("ml-auto text-[10px] font-black", filter.type === 'all' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder !== 'archive' && t.folder !== 'trash').length}</span>
                  </button>
                  <button
                    onClick={() => { setFilter({ type: 'important' }); setSelectedThread(null); setSelectedThreads(new Set()); setIsDrawerOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'important' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                  >
                    <Star size={14} /> Starred
                    <span className={cn("ml-auto text-[10px] font-black", filter.type === 'important' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.isImportant && t.folder !== 'trash').length}</span>
                  </button>
                  <button
                    onClick={() => { setFilter({ type: 'archive' }); setSelectedThread(null); setSelectedThreads(new Set()); setIsDrawerOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'archive' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                  >
                    <Archive size={14} /> Archived
                    <span className={cn("ml-auto text-[10px] font-black", filter.type === 'archive' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder === 'archive').length}</span>
                  </button>
                  <button
                    onClick={() => { setFilter({ type: 'trash' }); setSelectedThread(null); setSelectedThreads(new Set()); setIsDrawerOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'trash' ? "bg-red-500/10 text-red-400" : "text-white/40 hover:text-white hover:bg-white/5")}
                  >
                    <Trash2 size={14} /> Trash
                    <span className={cn("ml-auto text-[10px] font-black", filter.type === 'trash' ? "text-red-400" : "text-white/20")}>{threads.filter(t => t.folder === 'trash').length}</span>
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
                          onClick={() => { setFilter({ type: 'business', businessName }); setSelectedThread(null); setIsDrawerOpen(false); }}
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
                                onClick={() => { setFilter({ type: 'campaign', businessName, campaignId }); setSelectedThread(null); setIsDrawerOpen(false); }}
                                className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all min-w-0", isCampSelected ? "bg-primary/10 text-primary" : "text-white/30 hover:text-white hover:bg-white/5")}
                              >
                                <Folder size={10} className="shrink-0" /> <span className="truncate flex-1 text-left uppercase">{campaign ? campaign.name : 'Unknown'}</span> <span className="ml-auto text-[9px] font-black shrink-0">{count}</span>
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
          </div>
        )}

        {/* Main Inbox Application Shell */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden">
 
          {/* Sidebar (Desktop Only) */}
          <div className="hidden lg:flex w-60 border-r border-border/50 flex-col bg-muted/20 shrink-0">
            <div className="p-4 border-b border-white/5 flex gap-2">
              <button 
                onClick={() => setIsComposeOpen(true)}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              >
                Compose <Send size={14} />
              </button>
              <button onClick={handleRefresh} className={cn("w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all shrink-0", refreshing && "text-primary")}>
                <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
              <div className="space-y-0.5">
                <span className="px-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Mailboxes</span>
                <button
                  onClick={() => { setFilter({ type: 'replies' }); setSelectedThread(null); setSelectedThreads(new Set()); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'replies' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <MessageSquare size={14} className={cn(filter.type === 'replies' ? "text-primary" : "text-white/30")} />
                  Replies
                </button>
                <button
                  onClick={() => { setFilter({ type: 'all' }); setSelectedThread(null); setSelectedThreads(new Set()); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'all' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <InboxIcon size={14} className={cn(filter.type === 'all' ? "text-primary" : "text-white/30")} />
                  All Conversations
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'all' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder !== 'archive' && t.folder !== 'trash').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'important' }); setSelectedThread(null); setSelectedThreads(new Set()); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'important' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <Star size={14} /> Starred
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'important' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.isImportant && t.folder !== 'trash').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'archive' }); setSelectedThread(null); setSelectedThreads(new Set()); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'archive' ? "bg-primary/10 text-primary" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <Archive size={14} /> Archived
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'archive' ? "text-primary" : "text-white/20")}>{threads.filter(t => t.folder === 'archive').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'trash' }); setSelectedThread(null); setSelectedThreads(new Set()); }}
                  className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all", filter.type === 'trash' ? "bg-red-500/10 text-red-400" : "text-white/40 hover:text-white hover:bg-white/5")}
                >
                  <Trash2 size={14} /> Trash
                  <span className={cn("ml-auto text-[10px] font-black", filter.type === 'trash' ? "text-red-400" : "text-white/20")}>{threads.filter(t => t.folder === 'trash').length}</span>
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
                              <Folder size={10} className="shrink-0" /> <span className="truncate flex-1 text-left uppercase">{campaign ? campaign.name : 'Unknown'}</span> <span className="ml-auto text-[9px] font-black shrink-0">{count}</span>
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
            
            {/* Mobile Header (Gmail Style Floating Search Bar) */}
            <div className="md:hidden p-3 bg-background flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-3 bg-white/[0.04] border border-white/10 rounded-full px-3 py-1.5 shadow-lg">
                <button onClick={() => setIsDrawerOpen(true)} className="p-2 text-white/50 hover:text-white transition-colors hover:bg-white/5 rounded-full shrink-0">
                  <Menu size={20} />
                </button>
                <input
                  type="text"
                  placeholder="Search in Relay mail"
                  className="flex-1 bg-transparent text-sm focus:outline-none text-white placeholder:text-white/35 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center text-xs font-black text-primary select-none shrink-0 uppercase">
                  R
                </div>
              </div>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block p-3 border-b border-white/5">
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
            
            <div className="flex-1 overflow-y-auto relative">
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
                <div className="flex flex-col">
                  {/* Bulk Actions Bar */}
                  {selectedThreads.size > 0 && (
                    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-white/5 p-2 flex items-center gap-2 shadow-xl">
                      <span className="text-xs font-bold text-white ml-2">{selectedThreads.size} selected</span>
                      <div className="flex-1" />
                      <button onClick={async () => {
                        const threadsToUpdate = filteredThreads.filter(t => selectedThreads.has(t.id));
                        await Promise.all(threadsToUpdate.map(t => handleAction('archive', t)));
                        setSelectedThreads(new Set());
                      }} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded" title="Archive Selected">
                        <Archive size={14} />
                      </button>
                      <button onClick={async () => {
                        const threadsToUpdate = filteredThreads.filter(t => selectedThreads.has(t.id));
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session) {
                          await Promise.all(threadsToUpdate.map(t => {
                            const uids = t.messages.map(m => m.uid);
                            return api.post('/emails/action', { emailAccountId: t.accountId, uids, action: 'trash', folder: t.folder }, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
                          }));
                          fetchEmails();
                          setSelectedThreads(new Set());
                        }
                      }} className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded" title="Trash Selected">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                  
                  {/* Thread Items */}
                  {filteredThreads.map(thread => {
                    const latestMsg = thread.messages[thread.messages.length - 1];
                    const isActive = selectedThread?.id === thread.id;
                    const isSelected = selectedThreads.has(thread.id);
                    
                    const isBounced = thread.messages.some(m => m.subject.toLowerCase().includes('bounce') || m.subject.toLowerCase().includes('undeliverable') || m.subject.toLowerCase().includes('postmaster'));
                    const isOptOut = !isBounced && thread.messages.some(m => m.subject.toLowerCase().includes('unsubscribe') || m.subject.toLowerCase().includes('opt-out') || m.text?.toLowerCase().includes('unsubscribe') || m.text?.toLowerCase().includes('remove me'));
                    
                    let domain = thread.contactEmail.split('@')[1];
                    if (domain && domain.includes('>')) domain = domain.split('>')[0];
                    const avatarUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : '';

                    return (
                      <div
                        key={thread.id}
                        className={cn(
                          "px-4 py-3.5 cursor-pointer transition-all flex items-start gap-3.5 border-b border-white/[0.02] group",
                          isActive ? "bg-primary/[0.06] border-l-2 border-l-primary" : "border-l-2 border-l-transparent hover:bg-white/[0.02]",
                          !thread.isRead && !isActive ? "bg-white/[0.01]" : "",
                          isBounced ? "border-l-red-500 bg-red-500/[0.02]" : isOptOut ? "border-l-orange-500 bg-orange-500/[0.02]" : ""
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('.thread-checkbox')) return;
                          setSelectedThread(thread);
                        }}
                      >
                        {/* Selector/Checkbox */}
                        <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0 thread-checkbox">
                          <div className="scale-75">
                            <CustomCheckbox
                              checked={isSelected}
                              onChange={(e) => {
                                e?.stopPropagation();
                                const newSet = new Set(selectedThreads);
                                if (!isSelected) newSet.add(thread.id);
                                else newSet.delete(thread.id);
                                setSelectedThreads(newSet);
                              }}
                            />
                          </div>
                          <button 
                            className="md:opacity-0 group-hover:opacity-100 transition-opacity mt-1.5"
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Toggle important status
                              await supabase.from('inbox_emails').update({ is_important: !thread.isImportant }).in('id', thread.messages.map(m => m.id));
                              fetchEmails();
                            }}
                          >
                            <Star size={14} className={cn(thread.isImportant ? "fill-yellow-500 text-yellow-500 opacity-100" : "text-white/20 hover:text-white")} />
                          </button>
                        </div>
                        
                        {/* Avatar (Gmail mobile circle style) */}
                        <div className="shrink-0 mt-0.5">
                          {avatarUrl ? (
                            <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                          ) : null}
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border",
                            avatarUrl ? "hidden" : getAvatarBgColor(thread.contactName)
                          )}>
                            {thread.contactName.charAt(0).toUpperCase()}
                          </div>
                        </div>

                        {/* Thread detail snippet */}
                        <div className="flex flex-col gap-0.5 min-w-0 w-full">
                          <div className="flex justify-between items-center gap-2">
                            <span className={cn("text-sm truncate", !thread.isRead ? "font-black text-white" : "font-semibold text-white/50")}>
                              {thread.contactName}
                            </span>
                            <span className={cn("text-[10px] uppercase tracking-wider shrink-0", !thread.isRead ? "font-bold text-primary" : "font-medium text-white/20")}>
                              {format(thread.lastMessageAt, 'MMM d')}
                            </span>
                          </div>
                          <div className={cn("text-xs truncate flex items-center gap-1.5", !thread.isRead ? "font-bold text-white/80" : "font-medium text-white/40")}>
                            {latestMsg.folder === 'sent' ? <Send size={10} className="text-white/20 shrink-0" /> : <Mail size={10} className="text-primary/60 shrink-0" />}
                            {latestMsg.subject}
                          </div>
                          <div className="text-xs line-clamp-2 text-white/30 mt-0.5 leading-relaxed">
                            {latestMsg.snippet || latestMsg.text?.substring(0, 80)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Compose FAB */}
            <button
              onClick={() => setIsComposeOpen(true)}
              className="md:hidden fixed bottom-6 right-6 z-20 flex items-center gap-2.5 bg-primary hover:bg-primary/95 text-primary-foreground px-5 py-3.5 rounded-full shadow-2xl active:scale-95 transition-all font-black text-xs uppercase tracking-wider"
            >
              <Edit3 size={16} />
              <span>Compose</span>
            </button>

          </div>

          {/* Thread Reading & Reply Pane */}
          <div className={cn("bg-background flex flex-col min-w-0 relative h-full", selectedThread ? "flex-1 w-full fixed inset-0 z-20 md:relative md:inset-auto" : "hidden md:flex flex-1")}>
            {selectedThread ? (
              <>
                {/* Header (Gmail Mobile style Actions) */}
                <div className="h-14 flex items-center px-3 md:px-6 justify-between border-b border-white/5 bg-[#121212] sticky top-0 z-10 shrink-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <button 
                      onClick={() => setSelectedThread(null)} 
                      className="p-2 -ml-1 text-white/70 hover:text-white hover:bg-white/5 rounded-full transition-colors"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm border border-primary/20 shrink-0 overflow-hidden">
                      <img src={`https://www.google.com/s2/favicons?domain=${selectedThread.contactEmail.split('@')[1]}&sz=64`} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                      <span className="hidden">{selectedThread.contactName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex flex-col min-w-0 max-w-[120px] sm:max-w-none">
                      <span className="font-bold text-xs sm:text-sm text-white truncate">{selectedThread.contactName}</span>
                      <span className="text-[10px] text-white/30 font-medium truncate">{selectedThread.contactEmail}</span>
                    </div>
                  </div>
                  
                  {/* Actions list */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAction('archive', selectedThread)}
                      className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-all"
                      title="Archive Thread"
                    >
                      <Archive size={18} />
                    </button>
                    <button
                      onClick={async () => {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (session && selectedThread) {
                          const uids = selectedThread.messages.map(m => m.uid);
                          await api.post('/emails/action', { emailAccountId: selectedThread.accountId, uids, action: 'trash', folder: selectedThread.folder }, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
                          setSelectedThread(null);
                          fetchEmails();
                          toast({ title: 'Success', description: 'Thread moved to trash.' });
                        }
                      }}
                      className="p-2 rounded-full text-white/70 hover:text-red-400 hover:bg-red-400/10 transition-all"
                      title="Move to Trash"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        // Mark as unread
                        supabase.from('inbox_emails').update({ is_read: false }).in('id', selectedThread.messages.map(m => m.id)).then(() => {
                          setSelectedThread(null);
                          fetchEmails();
                          toast({ title: 'Success', description: 'Marked as unread' });
                        });
                      }} 
                      className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/5 transition-all"
                      title="Mark as Unread"
                    >
                      <Mail size={18} />
                    </button>
                  </div>
                </div>

                {/* Message detail body */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
                  <div className="max-w-3xl mx-auto flex flex-col gap-4">
                    {/* Subject line header */}
                    <div className="pb-3 border-b border-white/5 mb-2">
                      <h1 className="text-base sm:text-lg font-bold text-white">{selectedThread.messages[0]?.subject}</h1>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-white/5 border border-white/10 text-white/40 font-bold px-1.5 py-0.5 rounded uppercase">
                          {getBusinessName(selectedThread.accountId)}
                        </span>
                      </div>
                    </div>

                    {selectedThread.messages.map((msg) => {
                      const isSent = msg.folder === 'sent';
                      
                      return (
                        <div key={msg.id} className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                          {/* Sender details header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-2.5 min-w-0">
                              <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border",
                                isSent ? "bg-primary/20 text-primary border-primary/20" : getAvatarBgColor(selectedThread.contactName)
                              )}>
                                {isSent ? 'Y' : selectedThread.contactName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-xs text-white truncate">
                                  {isSent ? 'You' : selectedThread.contactName}
                                </span>
                                <span className="text-[10px] text-white/30 truncate">
                                  to {isSent ? selectedThread.contactName : 'me'}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] text-white/20 shrink-0 font-medium whitespace-nowrap mt-1">
                              {format(new Date(msg.date), 'MMM d, h:mm a')}
                            </span>
                          </div>
                          
                          {/* Message HTML/Text */}
                          <div className="text-xs sm:text-sm leading-relaxed text-white/80 overflow-x-auto pt-2 break-words">
                            {msg.text ? (
                              <div className="whitespace-pre-wrap font-medium">{msg.text}</div>
                            ) : (
                              <iframe
                                title={`msg-${msg.id}`}
                                srcDoc={`<html><body style="font-family: sans-serif; color: #d4d4d8; margin: 0; padding: 0; background-color: transparent; font-size: 13px; line-height: 1.6;">${msg.html}</body></html>`}
                                className="w-full min-h-[150px] border-none"
                                sandbox="allow-same-origin"
                                onLoad={(e) => {
                                  // Adjust height of iframe to content
                                  const iframe = e.currentTarget;
                                  if (iframe.contentWindow?.document.body) {
                                    iframe.style.height = (iframe.contentWindow.document.body.scrollHeight + 30) + 'px';
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Reply Editor Drawer/Pane */}
                <div className="p-3 border-t border-white/5 shrink-0 bg-[#121212]">
                  <div className="max-w-3xl mx-auto">
                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-visible focus-within:border-primary/30 transition-colors">
                      
                      {/* Send reply from account row */}
                      <div className="flex items-center px-4 py-2 border-b border-white/5 bg-white/[0.01]">
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest mr-3">From:</span>
                        <div className="relative inline-block z-20">
                          <button
                            type="button"
                            onClick={() => setShowReplyFromDropdown(!showReplyFromDropdown)}
                            className="bg-black/20 border border-white/5 px-2 py-0.5 rounded-lg text-[10px] text-white/70 hover:text-white transition-colors flex items-center gap-1 min-w-[120px] justify-between"
                          >
                            <span className="truncate max-w-[100px]">{accounts.find(a => a.id === replyFromAccountId)?.email || 'Select Account'}</span>
                            <ChevronDown size={10} className="opacity-50" />
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

                      {/* Content editable reply textarea */}
                      <div
                        ref={replyEditorRef}
                        contentEditable
                        onInput={(e) => setReplyContent(e.currentTarget.innerHTML)}
                        className="w-full bg-transparent p-4 text-sm focus:outline-none min-h-[80px] text-white overflow-y-auto max-h-36 prose prose-invert focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-white/20 empty:before:pointer-events-none"
                        data-placeholder={`Reply to ${selectedThread.contactName}...`}
                        style={{ outline: 'none' }}
                      />

                      {/* Compose actions bar */}
                      <div className="flex items-center justify-between p-2.5 border-t border-white/5 bg-black/10">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleAIDraft}
                            disabled={isDrafting}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[9px] font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                          >
                            <Bot size={10} /> {isDrafting ? 'Drafting...' : 'AI Draft'}
                          </button>

                          {/* Formatting buttons */}
                          <div className="flex items-center gap-0.5 border-l border-white/5 pl-2">
                            <button
                              type="button"
                              onClick={() => document.execCommand('bold')}
                              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Bold"
                            >
                              <span className="font-bold text-xs">B</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => document.execCommand('italic')}
                              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Italic"
                            >
                              <span className="italic text-xs font-serif">I</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => document.execCommand('underline')}
                              className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors"
                              title="Underline"
                            >
                              <span className="underline text-xs">U</span>
                            </button>
                          </div>

                          {/* Signature insertion */}
                          <div className="relative inline-block ml-0.5">
                            <button
                              type="button"
                              onClick={() => setShowReplySignatureDropdown(!showReplySignatureDropdown)}
                              className="p-1.5 text-white/40 hover:text-white hover:bg-white/5 rounded transition-colors flex items-center"
                              title="Insert Signature"
                            >
                              <Edit3 size={12} />
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
                          className="flex items-center gap-1.5 bg-white text-black px-4 py-1.5 rounded-xl hover:bg-gray-200 transition-all font-black uppercase tracking-widest text-[9px] disabled:opacity-40 shadow-md"
                        >
                          {isSending ? 'Sending...' : 'Send'} <Send size={10} />
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
      </div>
      
      <ComposeDock 
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        initialToEmail={composeEmail || undefined}
        accounts={accounts}
      />
    </Layout>
  );
};

export default Inbox;

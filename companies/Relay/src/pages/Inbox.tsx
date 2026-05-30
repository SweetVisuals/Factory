import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Search, Mail, RefreshCw, Trash2, Archive, Inbox as InboxIcon, ChevronDown, ChevronRight, Briefcase, Folder } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmailMessage, EmailAccount, Campaign } from '../types';
import { fetchEmailAccounts } from '../lib/api/email-accounts';
import { api } from '../lib/api/api';
import { useToast } from '../components/ui/use-toast';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import Layout from '../components/layout/Layout';

type FilterState = 
  | { type: 'all' }
  | { type: 'archive' }
  | { type: 'business'; businessName: string }
  | { type: 'campaign'; businessName: string; campaignId: string }
  | { type: 'step'; businessName: string; campaignId: string; step: string };

const Inbox = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<Array<{ email: string; error: string }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set());
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const { toast } = useToast();

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
        setLoading(false);
        fetchEmails(false, true);
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
      setSyncErrors([]);
      if (!refresh && !syncNew) setLoading(true);
      
      const { data, error: fetchErr } = await supabase.from('inbox_emails').select('*').order('received_at', { ascending: false });
      if (fetchErr) throw fetchErr;

      if (data) {
        setEmails(data.map(email => ({
          id: email.id, uid: email.uid, accountId: email.email_account_id,
          from: email.from, to: email.to, subject: email.subject, date: email.received_at,
          snippet: email.snippet || '', text: email.body_text, html: email.body_html,
          folder: email.folder as any, isRead: email.is_read, sequenceStep: email.sequence_step, campaignId: email.campaign_id
        })));
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

  const hierarchy = useMemo(() => {
    const tree: Record<string, Record<string, Record<string, number>>> = {};
    emails.forEach(email => {
      if (email.folder === 'archive') return;
      const emailBusiness = getBusinessName(email.accountId);
      if (!tree[emailBusiness]) tree[emailBusiness] = {};
      const campId = email.campaignId || 'unassigned';
      if (!tree[emailBusiness][campId]) tree[emailBusiness][campId] = {};
      const step = email.sequenceStep || 'Unassigned';
      if (!tree[emailBusiness][campId][step]) tree[emailBusiness][campId][step] = 0;
      tree[emailBusiness][campId][step]++;
    });
    return tree;
  }, [emails, accounts]);

  const filteredEmails = useMemo(() => {
    return emails.filter(email => {
      if (filter.type === 'archive') {
        if (email.folder !== 'archive') return false;
      } else {
        if (email.folder === 'archive') return false;
      }

      const emailBusiness = getBusinessName(email.accountId);
      if (filter.type === 'business') if (emailBusiness !== filter.businessName) return false;
      const campId = email.campaignId || 'unassigned';
      if (filter.type === 'campaign') if (emailBusiness !== filter.businessName || campId !== filter.campaignId) return false;
      const step = email.sequenceStep || 'Unassigned';
      if (filter.type === 'step') if (emailBusiness !== filter.businessName || campId !== filter.campaignId || step !== filter.step) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return email.subject.toLowerCase().includes(term) || email.from.toLowerCase().includes(term) || email.to.toLowerCase().includes(term) || email.snippet.toLowerCase().includes(term);
      }
      return true;
    });
  }, [emails, accounts, filter, searchTerm]);

  const handleAction = async (action: 'delete' | 'archive', targetEmails: EmailMessage | EmailMessage[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const emailList = Array.isArray(targetEmails) ? targetEmails : [targetEmails];
      if (emailList.length === 0) return;

      toast({ title: `${action === 'delete' ? 'Deleting' : 'Archiving'} ${emailList.length} email(s)...`, description: "Please wait..." });
      const emailIdsToRemove = new Set(emailList.map(e => e.id));

      setEmails(prev => prev.map(e => {
        if (emailIdsToRemove.has(e.id)) if (action === 'archive') return { ...e, folder: 'archive' as const };
        return e;
      }).filter(e => !(emailIdsToRemove.has(e.id) && action === 'delete')));

      setSelectedEmailIds(prev => {
        const next = new Set(prev);
        emailIdsToRemove.forEach(id => next.delete(id));
        return next;
      });

      if (selectedEmail && emailIdsToRemove.has(selectedEmail.id)) setSelectedEmail(null);

      const groupedByAccount = emailList.reduce((acc, email) => {
        if (!acc[email.accountId]) acc[email.accountId] = { uids: [], folder: email.folder };
        acc[email.accountId].uids.push(email.uid);
        return acc;
      }, {} as Record<string, { uids: number[], folder: string }>);

      const results = await Promise.all(
        Object.entries(groupedByAccount).map(([accountId, data]) =>
          api.post('/emails/action', { emailAccountId: accountId, uids: data.uids, action, folder: data.folder }, { headers: { 'Authorization': `Bearer ${session.access_token}` } })
        )
      );

      const allOk = results.every(res => res.status >= 200 && res.status < 300);
      if (!allOk) throw new Error('Failed to perform action on some emails');
      toast({ title: "Success", description: `${emailList.length} email(s) ${action === 'delete' ? 'deleted' : 'archived'}.` });

    } catch (err) {
      console.error(`Error performing ${action}:`, err);
      toast({ title: "Error", description: `Failed to ${action} emails.`, variant: "destructive" });
      fetchEmails();
    }
  };

  const handleEmailClick = (email: EmailMessage, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedId) {
      const currentIndex = filteredEmails.findIndex(e => e.id === email.id);
      const lastIndex = filteredEmails.findIndex(e => e.id === lastSelectedId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const rangeIds = filteredEmails.slice(start, end + 1).map(e => e.id);
        if (event.ctrlKey || event.metaKey) {
          setSelectedEmailIds(prev => {
            const next = new Set(prev);
            rangeIds.forEach(id => next.add(id));
            return next;
          });
        } else {
          setSelectedEmailIds(new Set(rangeIds));
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      setSelectedEmailIds(prev => {
        const next = new Set(prev);
        if (next.has(email.id)) next.delete(email.id);
        else next.add(email.id);
        return next;
      });
      setLastSelectedId(email.id);
      setSelectedEmail(email);
    } else {
      setSelectedEmailIds(new Set([email.id]));
      setSelectedEmail(email);
      setLastSelectedId(email.id);
    }
  };

  const handleCheckboxChange = (email: EmailMessage, event?: React.MouseEvent) => {
    if (!event) return;
    event.stopPropagation();
    handleEmailClick(email, { ...event, ctrlKey: true } as React.MouseEvent);
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-background p-6">
        
        {/* Main Inbox Application Shell */}
        <div className="flex flex-1 overflow-hidden bg-card border border-border shadow-md rounded-3xl">

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
                  onClick={() => { setFilter({ type: 'all' }); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", filter.type === 'all' ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                >
                  <InboxIcon size={16} /> All Inboxes
                  <span className={cn("ml-auto text-xs font-black", filter.type === 'all' ? "text-primary-foreground/80" : "text-muted-foreground")}>{emails.filter(e => e.folder !== 'archive').length}</span>
                </button>
                <button
                  onClick={() => { setFilter({ type: 'archive' }); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                  className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all", filter.type === 'archive' ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                >
                  <Archive size={16} /> Archived
                  <span className={cn("ml-auto text-xs font-black", filter.type === 'archive' ? "text-primary-foreground/80" : "text-muted-foreground")}>{emails.filter(e => e.folder === 'archive').length}</span>
                </button>
              </div>

              <div className="space-y-1">
                <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Organizations</span>
                {Object.entries(hierarchy).map(([businessName, bizCampaigns]) => {
                  const isBizExpanded = expandedBusinesses.has(businessName);
                  const isBizSelected = filter.type === 'business' && filter.businessName === businessName;
                  let bizTotal = 0; Object.values(bizCampaigns).forEach(c => Object.values(c).forEach(s => bizTotal += s));

                  return (
                    <div key={businessName} className="flex flex-col gap-0.5">
                      <div className="flex items-center min-w-0">
                        <button onClick={() => setExpandedBusinesses(p => { const n = new Set(p); n.has(businessName) ? n.delete(businessName) : n.add(businessName); return n; })} className="p-1 text-muted-foreground hover:text-foreground shrink-0"><ChevronRight size={14} className={cn("transition-transform", isBizExpanded && "rotate-90")} /></button>
                        <button
                          onClick={() => { setFilter({ type: 'business', businessName }); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                          className={cn("flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-bold transition-all min-w-0", isBizSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                        >
                          <Briefcase size={14} className="shrink-0" /> <span className="truncate flex-1 text-left">{businessName}</span> <span className="ml-auto text-[10px] opacity-60 shrink-0">{bizTotal}</span>
                        </button>
                      </div>

                      {isBizExpanded && (
                        <div className="pl-6 space-y-0.5 mt-0.5">
                          {Object.entries(bizCampaigns).map(([campaignId, steps]) => {
                            const campaign = campaigns.find(c => c.id === campaignId);
                            const isCampExpanded = expandedCampaigns.has(`${businessName}-${campaignId}`);
                            const isCampSelected = filter.type === 'campaign' && filter.campaignId === campaignId && filter.businessName === businessName;
                            let campTotal = 0; Object.values(steps).forEach(s => campTotal += s);

                            return (
                              <div key={campaignId} className="flex flex-col gap-0.5">
                                <div className="flex items-center min-w-0">
                                  <button onClick={() => setExpandedCampaigns(p => { const k = `${businessName}-${campaignId}`; const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; })} className="p-1 text-muted-foreground hover:text-foreground shrink-0"><ChevronRight size={12} className={cn("transition-transform", isCampExpanded && "rotate-90")} /></button>
                                  <button
                                    onClick={() => { setFilter({ type: 'campaign', businessName, campaignId }); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                                    className={cn("flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold transition-all min-w-0", isCampSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                                  >
                                    <Folder size={12} className="shrink-0" /> <span className="truncate flex-1 text-left">{campaign ? campaign.name : 'Unknown'}</span> <span className="ml-auto text-[9px] opacity-60 shrink-0">{campTotal}</span>
                                  </button>
                                </div>
                                
                                {isCampExpanded && (
                                  <div className="pl-6 space-y-0.5 mt-0.5">
                                    {Object.entries(steps).map(([step, count]) => {
                                      const isStepSelected = filter.type === 'step' && filter.step === step && filter.campaignId === campaignId && filter.businessName === businessName;
                                      return (
                                        <button
                                          key={step}
                                          onClick={() => { setFilter({ type: 'step', businessName, campaignId, step }); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                                          className={cn("flex items-center gap-2 w-full px-2 py-1 rounded-lg text-[11px] font-bold transition-all min-w-0", isStepSelected ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground")}
                                        >
                                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isStepSelected ? "bg-primary" : "bg-muted-foreground")} />
                                          <span className="truncate flex-1 text-left">{step}</span> <span className="ml-auto text-[9px] opacity-60 shrink-0">{count}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Email List Column */}
          <div className="w-90 border-r border-border flex flex-col bg-card relative z-10 shadow-xl shadow-black/5">
            <div className="p-4 border-b border-border/50 bg-background/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  placeholder="Search emails..."
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
                  <span className="text-xs font-bold uppercase tracking-widest">Loading inbox...</span>
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-xs font-bold uppercase tracking-widest">
                  No messages found
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredEmails.map(email => (
                    <div
                      key={email.id}
                      onClick={(e) => handleEmailClick(email, e)}
                      className={cn(
                        "p-5 cursor-pointer transition-all relative group flex gap-3",
                        selectedEmailIds.has(email.id) ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-muted border-l-4 border-transparent"
                      )}
                    >
                      <div className="pt-0.5">
                        <CustomCheckbox checked={selectedEmailIds.has(email.id)} onChange={(e) => handleCheckboxChange(email, e)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className={cn("font-bold text-sm truncate pr-2", !email.isRead ? "text-foreground" : (selectedEmailIds.has(email.id) ? "text-primary" : "text-muted-foreground"))}>
                            {email.from.replace(/<.*>/, '').trim() || email.from}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 mt-0.5">
                            {format(new Date(email.date), 'MMM d')}
                          </span>
                        </div>
                        <div className={cn("text-xs mb-1.5 truncate", !email.isRead ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>
                          {email.subject}
                        </div>
                        <div className="text-[11px] line-clamp-2 leading-relaxed font-medium text-muted-foreground/80">
                          {email.snippet}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reading Pane Column */}
          <div className="flex-1 bg-background flex flex-col min-w-0 relative">
            {selectedEmail ? (
              <>
                <div className="h-16 flex items-center px-8 justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction('archive', selectedEmailIds.size > 1 ? emails.filter(e => selectedEmailIds.has(e.id)) : selectedEmail)}
                      className="p-2 bg-card border border-border hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Archive size={16} />
                    </button>
                    <button
                      onClick={() => handleAction('delete', selectedEmailIds.size > 1 ? emails.filter(e => selectedEmailIds.has(e.id)) : selectedEmail)}
                      className="p-2 bg-card border border-border hover:bg-red-500/10 rounded-xl text-muted-foreground hover:text-red-500 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {selectedEmailIds.size > 1 ? `${selectedEmailIds.size} selected` : format(new Date(selectedEmail.date), 'PPpp')}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-background">
                  <div className="max-w-4xl mx-auto bg-card border border-border rounded-3xl p-10 shadow-sm">
                    <h1 className="text-2xl font-bold mb-8 text-foreground leading-tight">{selectedEmail.subject}</h1>
                    <div className="flex items-center gap-5 mb-10 pb-10 border-b border-border/50">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/30">
                        {(selectedEmail.from.replace(/<.*>/, '').trim() || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base text-foreground truncate">{selectedEmail.from}</div>
                        <div className="text-xs font-medium text-muted-foreground mt-0.5">To: {selectedEmail.to}</div>
                      </div>
                    </div>
                    
                    <div className="prose prose-invert max-w-none text-sm text-foreground/90 leading-relaxed">
                      <iframe
                        title="email-content"
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <style>
                                body { font-family: 'Inter', -apple-system, sans-serif; color: #e4e4e7; font-size: 14px; line-height: 1.6; padding: 0; margin: 0; background: transparent; }
                                img { max-width: 100%; height: auto; border-radius: 8px; }
                                a { color: #8b5cf6; text-decoration: none; font-weight: 500; }
                                p { margin-top: 0; margin-bottom: 1rem; }
                                blockquote { border-left: 3px solid #3f3f46; margin: 0 0 1rem; padding: 0.5rem 1rem; color: #a1a1aa; }
                              </style>
                            </head>
                            <body>
                              ${selectedEmail.html || `<div style="white-space: pre-wrap;">${selectedEmail.text || 'No content'}</div>`}
                            </body>
                          </html>
                        `}
                        className="w-full min-h-[500px] border-none"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
                  <Mail size={32} className="opacity-50" />
                </div>
                <p className="font-bold text-sm">Select an email to read</p>
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

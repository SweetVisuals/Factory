import { useState, useEffect, useMemo } from 'react';
import { Search, Mail, RefreshCw, Trash2, Archive, Inbox as InboxIcon, Send as SendIcon, User, Globe, StickyNote, X, Building2, Phone, MapPin, Linkedin, ExternalLink, Activity, Radio, Database, Shield, Zap, Terminal, Command, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EmailMessage } from '../../types';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { useToast } from '../ui/use-toast';
import { fetchEmailAccounts } from '../../lib/api/email-accounts';
import { api } from '../../lib/api/api';

interface CampaignInboxProps {
    campaignId: string;
    initialSearch?: string;
}

const CampaignInbox = ({ campaignId, initialSearch = '' }: CampaignInboxProps) => {
    const [searchTerm, setSearchTerm] = useState(initialSearch);
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncErrors, setSyncErrors] = useState<Array<{ email: string; error: string }>>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
    const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'inbox' | 'sent' | 'archive'>('sent');
    const [selectedStep, setSelectedStep] = useState<string | null>(null);
    const [counts, setCounts] = useState({ inbox: 0, sent: 0, archive: 0 });
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    const [matchedLead, setMatchedLead] = useState<any | null>(null);
    const [leadPanelMode, setLeadPanelMode] = useState<'data' | 'notes' | null>(null);
    const { toast } = useToast();

    // Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const campaignAccounts = await fetchEmailAccounts(campaignId);
                setAccounts(campaignAccounts);
                await fetchEmails(false, false);
                fetchEmails(false, true);
            } catch (err) {
                console.error('Error loading inbox data:', err);
                setError('Failed to establish signal connection.');
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [campaignId]);

    // Refetch when account selection or view mode changes
    useEffect(() => {
        if (!loading) {
            fetchEmails();
        }
    }, [selectedAccountId, viewMode]);

    const fetchEmails = async (refresh = false, syncNew = false) => {
        try {
            if (!campaignId) return;
            setError(null);
            setSyncErrors([]);
            if (!refresh && !syncNew) setLoading(true);

            // Fetch emails directly from Supabase inbox_emails table
            let query = supabase
                .from('inbox_emails')
                .select('*')
                .eq('campaign_id', campaignId)
                .order('received_at', { ascending: false });

            if (selectedAccountId && selectedAccountId !== 'all') {
                query = query.eq('email_account_id', selectedAccountId);
            }
            
            if (viewMode === 'inbox' || viewMode === 'sent' || viewMode === 'archive') {
                query = query.eq('folder', viewMode);
            }

            const { data, error: fetchErr } = await query;

            if (fetchErr) throw fetchErr;

            if (data) {
                // Map DB names to component prop names if they differ
                const mappedData = data.map(email => ({
                    id: email.id,
                    uid: email.uid,
                    accountId: email.email_account_id,
                    from: email.from,
                    to: email.to,
                    subject: email.subject,
                    date: email.received_at,
                    snippet: email.snippet || '',
                    text: email.body_text,
                    html: email.body_html,
                    folder: email.folder as 'inbox' | 'sent' | 'archive',
                    isRead: email.is_read,
                    sequenceStep: email.sequence_step,
                    campaignId: email.campaign_id
                }));

                setEmails(mappedData);

                // Calculate counts for the folders
                const { data: countData } = await supabase
                    .from('inbox_emails')
                    .select('folder')
                    .eq('campaign_id', campaignId);
                
                if (countData) {
                    const newCounts = countData.reduce((acc: any, curr: any) => {
                        acc[curr.folder] = (acc[curr.folder] || 0) + 1;
                        return acc;
                    }, { inbox: 0, sent: 0, archive: 0 });
                    setCounts(newCounts);
                }
            }

            // If refresh or syncNew is requested, we still hit the local API to TRIGGER the IMAP sync
            // but we don't depend on its return value for the initial display.
            if (refresh || syncNew) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    api.get('/emails', {
                        params: { campaignId, refresh, syncNew },
                        headers: { 'Authorization': `Bearer ${session.access_token}` }
                    }).catch(e => console.warn("Background sync trigger failed:", e));
                }
            }

        } catch (err) {
            console.error('Error fetching emails:', err);
            if (!syncNew) setError('Failed to synchronize propagation data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchEmails(true);
    };

    const filteredEmails = useMemo(() => {
        return emails.filter(email => {
            if (selectedAccountId !== 'all' && email.accountId !== selectedAccountId) return false;
            if (viewMode === 'inbox' && email.folder !== 'inbox') return false;
            if (viewMode === 'sent' && email.folder !== 'sent') return false;
            if (viewMode === 'archive' && email.folder !== 'archive') return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    email.subject.toLowerCase().includes(term) ||
                    email.from.toLowerCase().includes(term) ||
                    email.to.toLowerCase().includes(term) ||
                    email.snippet.toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [emails, searchTerm, viewMode, selectedAccountId]);

    const stepFolders = useMemo(() => {
        if (viewMode !== 'sent') return [];
        const map = new Map<string, number>();
        filteredEmails.forEach(e => {
            const step = e.sequenceStep || 'Uncategorized';
            map.set(step, (map.get(step) || 0) + 1);
        });
        return Array.from(map.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [filteredEmails, viewMode]);

    const renderedEmails = useMemo(() => {
        if (viewMode === 'sent' && selectedStep) {
            return filteredEmails.filter(e => (e.sequenceStep || 'Uncategorized') === selectedStep);
        }
        return filteredEmails;
    }, [filteredEmails, viewMode, selectedStep]);

    const handleAction = async (action: 'delete' | 'archive', targetEmails: EmailMessage | EmailMessage[]) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const emailList = Array.isArray(targetEmails) ? targetEmails : [targetEmails];
            if (emailList.length === 0) return;

            const emailIdsToRemove = new Set(emailList.map(e => e.id));

            setEmails(prev => prev.map(e => {
                if (emailIdsToRemove.has(e.id) && action === 'archive') return { ...e, folder: 'archive' as const };
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

            await Promise.all(
                Object.entries(groupedByAccount).map(([accountId, data]) =>
                    api.post('/emails/action', {
                        emailAccountId: accountId,
                        uids: data.uids,
                        action,
                        folder: data.folder
                    }, { headers: { 'Authorization': `Bearer ${session.access_token}` } })
                )
            );

            toast({ title: "System Update", description: `${emailList.length} transmissions ${action === 'delete' ? 'purged' : 'archived'}.` });
        } catch (err) {
            toast({ title: "Action Failed", description: `Failed to ${action} transmissions.`, variant: "destructive" });
            fetchEmails();
        }
    };

    const handleEmailClick = (email: EmailMessage, event: React.MouseEvent) => {
        if (event.shiftKey && lastSelectedId) {
            const currentIndex = renderedEmails.findIndex(e => e.id === email.id);
            const lastIndex = renderedEmails.findIndex(e => e.id === lastSelectedId);
            if (currentIndex !== -1 && lastIndex !== -1) {
                const start = Math.min(currentIndex, lastIndex);
                const end = Math.max(currentIndex, lastIndex);
                const rangeIds = renderedEmails.slice(start, end + 1).map(e => e.id);
                setSelectedEmailIds(prev => {
                    const next = new Set(prev);
                    rangeIds.forEach(id => next.add(id));
                    return next;
                });
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
            setLastSelectedId(email.id);
            setSelectedEmail(email);
        }
    };

    useEffect(() => {
        if (!selectedEmail || !campaignId) {
            setMatchedLead(null);
            setLeadPanelMode(null);
            return;
        }
        const lookupLead = async () => {
            try {
                const emailAddr = viewMode === 'sent'
                    ? (selectedEmail.to.match(/<([^>]+)>/)?.[1] || selectedEmail.to).trim().toLowerCase()
                    : (selectedEmail.from.match(/<([^>]+)>/)?.[1] || selectedEmail.from).trim().toLowerCase();

                const { data } = await supabase
                    .from('leads')
                    .select('id, name, email, company, title, role, phone, linkedin, website, summary, company_news, campaign_leads!inner(campaign_id)')
                    .eq('campaign_leads.campaign_id', campaignId)
                    .ilike('email', emailAddr)
                    .limit(1)
                    .maybeSingle();

                setMatchedLead(data || null);
            } catch (err) {
                setMatchedLead(null);
            }
        };
        lookupLead();
    }, [selectedEmail?.id, campaignId, viewMode]);

    return (
        <div className="h-full flex overflow-hidden relative bg-transparent">
            {/* Folders & Accounts Sidebar */}
            <div className="w-72 bg-card/40 border-r border-white/5 flex flex-col shrink-0 backdrop-blur-md">
                <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Folders */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Folders</h3>
                        <div className="space-y-1.5">
                            {[
                                { id: 'sent', label: 'Sent', icon: SendIcon, count: counts.sent },
                                { id: 'inbox', label: 'Inbox', icon: InboxIcon, count: counts.inbox },
                                { id: 'archive', label: 'Archive', icon: Archive, count: counts.archive }
                            ].map((mode) => (
                                <button
                                    key={mode.id}
                                    onClick={() => { setViewMode(mode.id as any); setSelectedStep(null); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                                    className={cn(
                                        "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                                        viewMode === mode.id
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
                                    )}
                                >
                                    <mode.icon size={18} className={cn("shrink-0", viewMode === mode.id ? "text-primary-foreground" : "text-muted-foreground")} />
                                    <span className="flex-1 text-left truncate">{mode.label}</span>
                                    {mode.count > 0 && (
                                        <span className={cn(
                                            "text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0", 
                                            viewMode === mode.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            {mode.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Accounts */}
                    <div className="space-y-4 pt-6 border-t border-border">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sending Accounts</h3>
                            <Activity size={14} className="text-primary/70 animate-pulse" />
                        </div>
                        <div className="space-y-1.5">
                            <button
                                onClick={() => { setSelectedAccountId('all'); setSelectedStep(null); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                                className={cn(
                                    "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
                                    selectedAccountId === 'all'
                                        ? "bg-muted/80 text-foreground"
                                        : "text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                                )}
                            >
                                <Radio size={18} className={selectedAccountId === 'all' ? "text-primary" : "text-muted-foreground"} />
                                <span className="truncate">All Accounts</span>
                            </button>
                            {accounts.map(account => (
                                <button
                                    key={account.id}
                                    onClick={() => { setSelectedAccountId(account.id); setSelectedStep(null); setSelectedEmailIds(new Set()); setSelectedEmail(null); }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left",
                                        selectedAccountId === account.id
                                            ? "bg-muted/80 text-foreground"
                                            : "text-foreground/70 hover:bg-muted/40 hover:text-foreground"
                                    )}
                                >
                                    <div className={cn(
                                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold transition-all",
                                        selectedAccountId === account.id ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                                    )}>
                                        {account.email.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="truncate flex-1">{account.email}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Column: Email List */}
            <div className="w-[450px] flex flex-col shrink-0 border-r border-white/5 bg-background/20 backdrop-blur-sm">
                <div className="p-6 border-b border-white/5 bg-card/20 flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 group min-w-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                            <input
                                type="text"
                                placeholder="Search messages..."
                                className="w-full pl-11 pr-4 h-11 bg-muted/40 border border-transparent rounded-xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:bg-background/50 focus:border-primary/30 focus:ring-1 focus:ring-primary/30 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button
                            onClick={handleRefresh}
                            className={cn("w-11 h-11 flex items-center justify-center rounded-xl bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all shrink-0", refreshing && "animate-spin text-primary")}
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>

                    {selectedStep && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-xl w-fit animate-in fade-in slide-in-from-left-2 border border-primary/20">
                            <span className="text-xs font-semibold text-primary">Step:</span>
                            <span className="text-xs font-bold text-primary truncate max-w-[200px]">{selectedStep}</span>
                            <button onClick={() => setSelectedStep(null)} className="ml-2 p-1 hover:bg-primary/20 rounded-md transition-colors">
                                <X size={14} className="text-primary" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <RefreshCw className="animate-spin text-primary/50" size={28} />
                            <span className="text-sm font-semibold text-muted-foreground">Loading messages...</span>
                        </div>
                    ) : viewMode === 'sent' && !selectedStep ? (
                        <div className="p-4 space-y-3">
                            {stepFolders.map(folder => (
                                <button
                                    key={folder.name}
                                    onClick={() => setSelectedStep(folder.name)}
                                    className="w-full flex items-center justify-between p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-lg transition-all group min-w-0 gap-4"
                                >
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                        <div className="p-3 bg-primary/10 rounded-xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                                            <Layers size={20} />
                                        </div>
                                        <div className="text-left min-w-0 flex-1">
                                            <div className="text-base font-bold text-foreground truncate">{folder.name}</div>
                                            <div className="text-xs font-semibold text-muted-foreground mt-1 truncate">Sequence Step</div>
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold px-4 py-1.5 bg-muted/80 rounded-full group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                                        {folder.count}
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : renderedEmails.length === 0 ? (
                        <div className="py-24 flex flex-col items-center text-center px-6">
                            <div className="w-20 h-20 rounded-3xl bg-muted/40 flex items-center justify-center mb-6">
                                <Mail size={32} className="text-muted-foreground/40" />
                            </div>
                            <p className="text-base font-semibold text-muted-foreground">No messages found.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {renderedEmails.map(email => (
                                <div
                                    key={email.id}
                                    onClick={(e) => handleEmailClick(email, e)}
                                    className={cn(
                                        "p-6 cursor-pointer transition-all relative group flex flex-col gap-2 min-w-0",
                                        selectedEmailIds.has(email.id)
                                            ? "bg-primary/5"
                                            : "bg-transparent hover:bg-white/[0.03]"
                                    )}
                                >
                                    {selectedEmailIds.has(email.id) && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                                    )}
                                    {!email.isRead && !selectedEmailIds.has(email.id) && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-primary rounded-r-full" />
                                    )}
                                    
                                    <div className="flex justify-between items-start gap-3 min-w-0">
                                        <span className={cn(
                                            "text-base font-bold truncate flex-1",
                                            !email.isRead ? "text-foreground" : "text-foreground/80"
                                        )}>
                                            {viewMode === 'sent' ? `To: ${email.to}` : (email.from.replace(/<.*>/, '').trim() || email.from)}
                                        </span>
                                        <span className="text-xs font-semibold text-muted-foreground shrink-0 mt-1">
                                            {format(new Date(email.date), 'MMM d')}
                                        </span>
                                    </div>
                                    <div className={cn(
                                        "text-sm font-semibold truncate w-full min-w-0",
                                        !email.isRead ? "text-foreground" : "text-muted-foreground"
                                    )}>
                                        {email.subject}
                                    </div>
                                    <div className="text-sm font-medium text-muted-foreground line-clamp-2 leading-relaxed break-words">
                                        {email.snippet}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Reading Pane */}
            <div className="flex-1 flex flex-col min-w-0 bg-card/40 relative backdrop-blur-sm">
                {selectedEmail ? (
                    <>
                        {/* Toolbar */}
                        <div className="h-20 px-8 border-b border-white/5 flex items-center justify-between shrink-0 bg-background/20">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleAction('archive', selectedEmailIds.size > 1 ? renderedEmails.filter(e => selectedEmailIds.has(e.id)) : selectedEmail)}
                                    className="p-2.5 rounded-xl text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-all"
                                    title="Archive"
                                >
                                    <Archive size={20} />
                                </button>
                                <button
                                    onClick={() => handleAction('delete', selectedEmailIds.size > 1 ? renderedEmails.filter(e => selectedEmailIds.has(e.id)) : selectedEmail)}
                                    className="p-2.5 rounded-xl text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all"
                                    title="Delete"
                                >
                                    <Trash2 size={20} />
                                </button>

                                {matchedLead && (
                                    <>
                                        <div className="h-8 w-px bg-border mx-3"></div>
                                        <button
                                            onClick={() => setLeadPanelMode(leadPanelMode === 'data' ? null : 'data')}
                                            className={cn(
                                                "flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                                                leadPanelMode === 'data' ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <User size={16} />
                                            Lead Details
                                        </button>
                                        <button
                                            onClick={() => setLeadPanelMode(leadPanelMode === 'notes' ? null : 'notes')}
                                            className={cn(
                                                "flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all",
                                                leadPanelMode === 'notes' ? "bg-amber-500 text-white shadow-md" : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <StickyNote size={16} />
                                            Lead Notes
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar relative flex flex-col">
                            {/* Lead Panel overlay/inline */}
                            {matchedLead && leadPanelMode && (
                                <div className="m-8 mb-0 p-8 bg-card/80 border border-white/5 rounded-3xl shadow-lg animate-in slide-in-from-top-4 duration-300 relative overflow-hidden backdrop-blur-xl">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="p-3 bg-primary/10 rounded-2xl text-primary shrink-0">
                                                {leadPanelMode === 'data' ? <User size={24} /> : <Command size={24} />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xl font-bold text-foreground truncate">
                                                    {leadPanelMode === 'data' ? 'Lead Info' : 'AI Research'}
                                                </h4>
                                            </div>
                                        </div>
                                        <button onClick={() => setLeadPanelMode(null)} className="p-2.5 rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all shrink-0">
                                            <X size={20} />
                                        </button>
                                    </div>

                                    {leadPanelMode === 'data' ? (
                                        <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                                            {[
                                                { icon: <User size={16} />, label: 'Name', value: matchedLead.name },
                                                { icon: <Mail size={16} />, label: 'Email', value: matchedLead.email },
                                                { icon: <Building2 size={16} />, label: 'Company', value: matchedLead.company },
                                                { icon: <Shield size={16} />, label: 'Job Title', value: matchedLead.title || matchedLead.role },
                                                { icon: <Phone size={16} />, label: 'Phone', value: matchedLead.phone },
                                                { icon: <MapPin size={16} />, label: 'Location', value: matchedLead.location },
                                                { icon: <Globe size={16} />, label: 'Website', value: matchedLead.website, isLink: true },
                                                { icon: <Linkedin size={16} />, label: 'LinkedIn', value: matchedLead.linkedin, isLink: true },
                                            ].filter(item => item.value).map((item, i) => (
                                                <div key={i} className="flex flex-col gap-1.5 min-w-0">
                                                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                                        {item.icon} {item.label}
                                                    </div>
                                                    {item.isLink ? (
                                                        <a href={item.value!.startsWith('http') ? item.value! : `https://${item.value}`} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-primary hover:underline truncate w-full">
                                                            {item.value}
                                                        </a>
                                                    ) : (
                                                        <div className="text-base font-semibold text-foreground truncate w-full">{item.value}</div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-base text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                            {matchedLead.summary || matchedLead.company_news || "No AI research notes available for this lead."}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Email Content Header */}
                            <div className="p-10 pb-6">
                                <h2 className="text-3xl font-bold text-foreground mb-8 leading-tight break-words">{selectedEmail.subject}</h2>
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold shrink-0">
                                        {(selectedEmail.from.replace(/<.*>/, '').trim() || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                                        <div className="text-lg font-bold text-foreground truncate">{selectedEmail.from}</div>
                                        <div className="text-base font-medium text-muted-foreground truncate">to {selectedEmail.to}</div>
                                    </div>
                                    <div className="text-sm font-semibold text-muted-foreground shrink-0">
                                        {format(new Date(selectedEmail.date), 'MMM d, yyyy, h:mm a')}
                                    </div>
                                </div>
                            </div>

                            {/* Email Body Frame */}
                            <div className="flex-1 p-10 pt-4 flex flex-col relative min-h-[500px]">
                                <iframe
                                    title="message-content"
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html>
                                            <head>
                                                <style>
                                                    :root {
                                                        --text-color: #e4e4e7;
                                                    }
                                                    body { 
                                                        font-family: -apple-system, BlinkMacSystemFont, "Plus Jakarta Sans", "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                                                        color: var(--text-color);
                                                        background-color: transparent;
                                                        font-size: 16px;
                                                        line-height: 1.7;
                                                        margin: 0;
                                                        padding: 0;
                                                        word-wrap: break-word;
                                                    }
                                                    p, span, div, td, th, li, h1, h2, h3, h4, h5, h6 { color: var(--text-color) !important; }
                                                    a { color: #3b82f6 !important; text-decoration: none; }
                                                    a:hover { text-decoration: underline; }
                                                    p { margin-bottom: 1.5em; }
                                                    ::-webkit-scrollbar { width: 8px; }
                                                    ::-webkit-scrollbar-track { background: transparent; }
                                                    ::-webkit-scrollbar-thumb { background: rgba(161, 161, 170, 0.3); border-radius: 9999px; }
                                                    ::-webkit-scrollbar-thumb:hover { background: rgba(161, 161, 170, 0.5); }
                                                </style>
                                                <script>
                                                    function updateTheme() {
                                                        try {
                                                            const isLight = window.parent.document.documentElement.classList.contains('light');
                                                            document.documentElement.style.setProperty('--text-color', isLight ? '#09090b' : '#fafafa');
                                                        } catch(e) {}
                                                    }
                                                    window.onload = function() {
                                                        updateTheme();
                                                        setInterval(updateTheme, 500);
                                                    };
                                                </script>
                                            </head>
                                            <body>
                                                ${selectedEmail.html || `<div style="white-space: pre-wrap;">${selectedEmail.text || 'No message content available.'}</div>`}
                                            </body>
                                        </html>
                                    `}
                                    className="w-full flex-1 border-none bg-transparent"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-muted-foreground animate-in fade-in duration-500">
                        <div className="w-24 h-24 bg-muted/30 rounded-3xl flex items-center justify-center">
                            <Mail size={40} className="text-muted-foreground/40" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-xl font-bold text-foreground">No message selected</p>
                            <p className="text-base font-medium">Select an email from the list to view its contents.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignInbox;

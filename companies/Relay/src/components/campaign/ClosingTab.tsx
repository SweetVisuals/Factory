import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api/api';
import { Send, RefreshCw, User, Bot, Loader2, Trash2, ArchiveRestore, Inbox, Globe, StickyNote, X, Building2, Phone, MapPin, Linkedin, ExternalLink, Mail, MessageSquare, Activity, Search, Target, Filter, MoreVertical, Clock, Check, ArrowLeft } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { Button } from '../ui/button';

interface ClosingTabProps {
    campaignId: string;
}

export default function ClosingTab({ campaignId }: ClosingTabProps) {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'interested' | 'ignored' | 'sent'>('interested');
    const [selectedLead, setSelectedLead] = useState<any | null>(null);
    const [thread, setThread] = useState<any[]>([]);
    const [threadLoading, setThreadLoading] = useState(false);
    const [draft, setDraft] = useState('');
    const [drafting, setDrafting] = useState(false);
    const [sending, setSending] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [leadPanelMode, setLeadPanelMode] = useState<'data' | 'notes' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showThreadDialog, setShowThreadDialog] = useState(false);
    const { toast } = useToast();

    const fetchInterestedLeads = async () => {
        setLoading(true);
        try {
            if (viewMode === 'sent') {
                const { data: progressData, error: progressError } = await supabase
                    .from('campaign_progress')
                    .select('lead_id')
                    .eq('campaign_id', campaignId)
                    .in('status', ['sent', 'replied']);
                
                if (progressError) throw progressError;
                
                const leadIds = progressData?.map(p => p.lead_id).filter(Boolean) || [];
                const uniqueLeadIds = [...new Set(leadIds)];
                
                if (uniqueLeadIds.length === 0) {
                    setLeads([]);
                } else {
                    const { data, error } = await supabase
                        .from('leads')
                        .select('*, campaign_leads!inner(campaign_id)')
                        .eq('campaign_leads.campaign_id', campaignId)
                        .in('id', uniqueLeadIds)
                        .order('updated_at', { ascending: false });

                    if (error) throw error;
                    setLeads(data || []);
                }
            } else {
                const { data, error } = await supabase
                    .from('leads')
                    .select('*, campaign_leads!inner(campaign_id)')
                    .eq('campaign_leads.campaign_id', campaignId)
                    .eq('status', viewMode)
                    .order('updated_at', { ascending: false });

                if (error) throw error;
                setLeads(data || []);
            }
        } catch (err: any) {
            console.error('Error fetching leads:', err);
            toast({ title: 'Query Failed', description: 'Failed to access conversion registry.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterestedLeads();
        setSelectedLead(null);
        setLeadPanelMode(null);
        setShowThreadDialog(false);
    }, [campaignId, viewMode]);

    const fetchThread = async (lead: any) => {
        setSelectedLead(lead);
        setThreadLoading(true);
        setDraft('');
        setShowThreadDialog(true);
        try {
            const { data: withCampaign, error: e1 } = await supabase
                .from('inbox_emails')
                .select('*')
                .eq('campaign_id', campaignId)
                .or(`from.ilike.%${lead.email}%,to.ilike.%${lead.email}%`);

            const { data: noCampaign, error: e2 } = await supabase
                .from('inbox_emails')
                .select('*')
                .is('campaign_id', null)
                .or(`from.ilike.%${lead.email}%,to.ilike.%${lead.email}%`);

            if (e1) throw e1;

            const all = [...(withCampaign || []), ...(noCampaign || [])];
            const seen = new Set<string>();
            const unique = all.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
            unique.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

            setThread(unique);
        } catch (err: any) {
            console.error('Error fetching thread:', err);
            toast({ title: 'Stream Interrupted', description: 'Failed to synchronize communication packet.', variant: 'destructive' });
        } finally {
            setThreadLoading(false);
        }
    };

    const handleDraftReply = async () => {
        if (!selectedLead) return;
        setDrafting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const threadText = thread.map(e => `From: ${e.from}\nTo: ${e.to}\nDate: ${e.received_at}\n\n${e.body_text || e.snippet}`).join('\n\n---\n\n');

            const lastSent = thread.slice().reverse().find(e => e.folder === 'sent');
            let senderName = 'Me';
            let senderEmail = 'hello@example.com';

            if (lastSent) {
                const matchNameAndEmail = lastSent.from.match(/^(.*?)\s*<([^>]+)>$/);
                if (matchNameAndEmail) {
                    senderName = matchNameAndEmail[1].replace(/"/g, '').trim();
                    senderEmail = matchNameAndEmail[2].trim();
                } else {
                    const matchEmailOnly = lastSent.from.match(/^([^<]+)$/);
                    if (matchEmailOnly && matchEmailOnly[1].includes('@')) {
                        senderEmail = matchEmailOnly[1].trim();
                        senderName = senderEmail.split('@')[0];
                        senderName = senderName.charAt(0).toUpperCase() + senderName.slice(1);
                    }
                }
            } else if (thread.length > 0) {
                const lastReceived = thread.slice().reverse().find(e => e.folder === 'inbox');
                if (lastReceived) {
                    const match = lastReceived.to.match(/<([^>]+)>/) || lastReceived.to.match(/^([^<]+)$/);
                    if (match) senderEmail = (match[1] || match[0]).trim();
                }
            }

            const response = await api.post('/draft-closing-reply', {
                lead: selectedLead,
                thread: threadText,
                companyName: 'ColdSpark',
                senderName: senderName,
                senderEmail: senderEmail,
                prompt: aiPrompt
            }, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (response.data.success) {
                setDraft(response.data.draft);
                toast({ title: 'Inference Complete', description: 'AI has synthesized a contextual response.' });
            } else {
                throw new Error(response.data.error || 'Failed to draft reply');
            }
        } catch (err: any) {
            console.error('Error drafting reply:', err);
            toast({ title: 'Synthesis Failed', description: err.message || 'AI failed to contextualize the thread.', variant: 'destructive' });
        } finally {
            setDrafting(false);
        }
    };

    const handleSendReply = async () => {
        if (!selectedLead || !draft) return;
        setSending(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const lastSent = thread.slice().reverse().find(e => e.folder === 'sent');
            const lastReceived = thread.slice().reverse().find(e => e.folder === 'inbox');
            let accountId = lastSent?.email_account_id || lastReceived?.email_account_id;

            if (!accountId && lastReceived) {
                const toEmailMatch = lastReceived.to.match(/<([^>]+)>/)?.[1] || lastReceived.to;
                const { data: accounts } = await supabase.from('email_accounts').select('id, email');
                const matchedAccount = accounts?.find(a => a.email.toLowerCase() === toEmailMatch.toLowerCase());
                if (matchedAccount) accountId = matchedAccount.id;
            }

            if (!accountId) {
                const { data: campaignAccounts } = await supabase.from('campaign_email_accounts').select('email_account_id').eq('campaign_id', campaignId).limit(1);
                accountId = campaignAccounts?.[0]?.email_account_id;
            }

            if (!accountId) throw new Error('No active cluster nodes available for this propagation.');

            let subject = `Re: ${thread.length > 0 ? thread[thread.length - 1].subject.replace(/^(Re|Fwd|Fw|Aw|Reply):\s*/i, '').trim() : 'Follow up'}`;
            if (!subject.startsWith('Re:')) subject = `Re: ${subject}`;

            const response = await api.post('/send-closing-reply', {
                leadId: selectedLead.id,
                campaignId: campaignId,
                accountId: accountId,
                toEmail: selectedLead.email,
                subject: subject,
                content: draft
            }, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (response.data.success) {
                toast({ title: 'Signal Dispatched', description: 'Communication packet successfully transmitted.' });
                setDraft('');
                fetchThread(selectedLead);
            } else {
                throw new Error(response.data.error || 'Failed to send reply');
            }
        } catch (err: any) {
            console.error('Error sending reply:', err);
            toast({ title: 'Dispatch Error', description: err.message || 'Signal transmission failed.', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedLead) return;
        const newStatus = viewMode === 'interested' ? 'ignored' : 'interested';
        try {
            const { error } = await supabase
                .from('leads')
                .update({ status: newStatus })
                .eq('id', selectedLead.id);

            if (error) throw error;
            toast({ title: 'Registry Updated', description: newStatus === 'ignored' ? 'Entity moved to cold storage.' : 'Entity restored to active registry.' });
            setSelectedLead(null);
            setShowThreadDialog(false);
            fetchInterestedLeads();
        } catch (err: any) {
            console.error('Error updating lead status:', err);
            toast({ title: 'Update Failed', description: 'Failed to modify registry state.', variant: 'destructive' });
        }
    };

    const filteredLeads = leads.filter(lead => 
        `${lead.name} ${lead.company} ${lead.email}`.toLowerCase()
        .includes(searchQuery.toLowerCase())
    );

    const closeDialog = () => {
        setShowThreadDialog(false);
        setSelectedLead(null);
        setLeadPanelMode(null);
        setDraft('');
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-14rem)] min-h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Left Panel: Conversion Registry List */}
            <div className={cn(
                "lg:col-span-4 flex flex-col h-full bg-card rounded-3xl border border-border overflow-hidden min-w-0 shadow-sm transition-all",
                selectedLead && "hidden lg:flex"
            )}>
                {/* Header Row */}
                <div className="flex items-center justify-between p-6 pb-4 shrink-0 bg-muted/20 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <Target size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Conversion Registry</h3>
                            <p className="text-xs font-medium text-muted-foreground mt-0.5">Interested B2B leads</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-muted text-xs font-bold text-muted-foreground rounded-full">
                        {leads.length} Leads
                    </span>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-4 border-b border-border bg-background/50 shrink-0">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by name, company, or email..."
                            className="w-full bg-card border border-border pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground"
                        />
                    </div>
                </div>

                {/* View Toggles */}
                <div className="flex gap-2 p-4 shrink-0 bg-background/20">
                    <button
                        onClick={() => { setViewMode('interested'); setSelectedLead(null); }}
                        className={cn("flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-lg", 
                            viewMode === 'interested' ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}
                    >
                        <Inbox size={14} /> Active
                    </button>
                    <button
                        onClick={() => { setViewMode('sent'); setSelectedLead(null); }}
                        className={cn("flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-lg", 
                            viewMode === 'sent' ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}
                    >
                        <Send size={14} /> Sent
                    </button>
                    <button
                        onClick={() => { setViewMode('ignored'); setSelectedLead(null); }}
                        className={cn("flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold transition-all rounded-lg", 
                            viewMode === 'ignored' ? "bg-destructive text-destructive-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}
                    >
                        <Trash2 size={14} /> Dismissed
                    </button>
                </div>

                {/* Lead List Scroll Area */}
                <div className="flex-1 overflow-y-auto space-y-1 p-3 custom-scrollbar min-h-0 bg-muted/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                            <Loader2 className="animate-spin text-primary" size={28} />
                            <p className="text-sm font-semibold">Syncing Registry...</p>
                        </div>
                    ) : filteredLeads.length === 0 ? (
                        <div className="py-20 text-center space-y-4 border border-dashed border-border rounded-2xl mx-3">
                            <Inbox className="mx-auto text-muted-foreground/40" size={32} />
                            <p className="text-sm font-semibold text-muted-foreground">No leads in this view</p>
                        </div>
                    ) : (
                        filteredLeads.map(lead => (
                            <button
                                key={lead.id}
                                onClick={() => fetchThread(lead)}
                                className={cn(
                                    "w-full text-left p-4 hover:bg-muted/50 transition-all group/lead relative overflow-hidden flex items-center gap-4 rounded-xl border border-transparent",
                                    selectedLead?.id === lead.id && "bg-background border-border shadow-sm"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 flex items-center justify-center font-bold text-sm shrink-0 transition-all rounded-full",
                                    selectedLead?.id === lead.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground group-hover/lead:bg-primary/10 group-hover/lead:text-primary"
                                )}>
                                    {(lead.name || lead.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm text-foreground truncate group-hover/lead:text-primary transition-colors">
                                        {lead.name || lead.email.split('@')[0]}
                                    </div>
                                    <div className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                                        {lead.company || lead.email.split('@')[1]}
                                    </div>
                                </div>
                                <MessageSquare size={16} className={cn(
                                    "transition-colors shrink-0",
                                    selectedLead?.id === lead.id ? "text-primary" : "text-muted-foreground/40 group-hover/lead:text-muted-foreground"
                                )} />
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Detail & Interactive Conversation thread */}
            <div className={cn(
                "lg:col-span-8 flex flex-col h-full bg-card rounded-3xl border border-border overflow-hidden min-w-0 shadow-sm transition-all",
                !selectedLead && "hidden lg:flex"
            )}>
                {selectedLead ? (
                    <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300 bg-muted/10">
                        {/* Header Details bar */}
                        <div className="p-6 flex items-center justify-between shrink-0 bg-card border-b border-border shadow-sm z-10">
                            <div className="flex items-center gap-4 min-w-0">
                                <button
                                    onClick={() => setSelectedLead(null)}
                                    className="lg:hidden p-2 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-all mr-2"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <div className="w-12 h-12 bg-primary/10 flex items-center justify-center font-bold text-xl text-primary shrink-0 rounded-full">
                                    {(selectedLead.name || selectedLead.email).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-bold text-foreground truncate">{selectedLead.name}</h2>
                                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                        <span className="text-sm font-medium text-muted-foreground truncate block">{selectedLead.email}</span>
                                        {selectedLead.company && (
                                            <>
                                                <div className="w-1 h-1 rounded-full bg-border shrink-0" />
                                                <span className="text-sm font-medium text-muted-foreground truncate block">{selectedLead.company}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => setLeadPanelMode(leadPanelMode === 'data' ? null : 'data')}
                                    className={cn("p-2.5 transition-all rounded-xl", leadPanelMode === 'data' ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted")}
                                    title="Lead Details"
                                >
                                    <User size={16} />
                                </button>
                                <button
                                    onClick={handleToggleStatus}
                                    className={cn("flex items-center gap-2 px-4 py-2.5 text-sm font-bold transition-all rounded-xl", 
                                        viewMode === 'interested' ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20")}
                                >
                                    {viewMode === 'interested' ? <Trash2 size={16} /> : <ArchiveRestore size={16} />}
                                    {viewMode === 'interested' ? 'Dismiss' : 'Restore'}
                                </button>
                            </div>
                        </div>

                        {/* Lead Details Panel (Expandable) */}
                        {leadPanelMode === 'data' && (
                            <div className="p-6 bg-card border-b border-border grid grid-cols-2 md:grid-cols-4 gap-6 shrink-0 animate-in slide-in-from-top-4 duration-300 shadow-sm z-0">
                                {[
                                    { icon: <User size={14} />, label: 'Name', value: selectedLead.name },
                                    { icon: <Building2 size={14} />, label: 'Company', value: selectedLead.company },
                                    { icon: <Mail size={14} />, label: 'Title', value: selectedLead.title || selectedLead.role },
                                    { icon: <Phone size={14} />, label: 'Phone', value: selectedLead.phone },
                                    { icon: <Globe size={14} />, label: 'Website', value: selectedLead.website, isLink: true },
                                    { icon: <Linkedin size={14} />, label: 'LinkedIn', value: selectedLead.linkedin, isLink: true },
                                    { icon: <MapPin size={14} />, label: 'Location', value: selectedLead.location },
                                ].filter(item => item.value).map((item, i) => (
                                    <div key={i} className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            {item.icon} {item.label}
                                        </div>
                                        {item.isLink ? (
                                            <a href={String(item.value).startsWith('http') ? String(item.value) : `https://${item.value}`} target="_blank" rel="noopener" className="text-sm font-bold text-primary hover:underline truncate block">{item.value}</a>
                                        ) : (
                                            <span className="text-sm font-semibold text-foreground truncate block">{item.value}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Thread Messages */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar min-h-0 relative">
                            {threadLoading ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-background/50 backdrop-blur-sm z-10">
                                    <Loader2 className="animate-spin text-primary" size={32} />
                                    <p className="text-sm font-semibold text-muted-foreground">Loading Thread...</p>
                                </div>
                            ) : thread.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 text-muted-foreground border border-dashed border-border rounded-3xl mx-4 my-4">
                                    <MessageSquare size={40} className="text-muted-foreground/30" />
                                    <p className="text-base font-semibold">No messages in thread</p>
                                </div>
                            ) : (
                                <div className="max-w-3xl mx-auto space-y-8">
                                    {thread.map((email, idx) => {
                                        const isFromLead = email.from.toLowerCase().includes(selectedLead.email.toLowerCase());
                                        const emailBody = email.body_text || email.snippet || 'No content';
                                        // Clean subject for display (strip Re:/Fwd: prefixes)
                                        const cleanSubject = email.subject?.replace(/^(Re|Fwd|Fw|Aw|Reply):\s*/gi, '').trim();
                                        return (
                                            <div key={idx} className={cn("flex flex-col", isFromLead ? "items-start" : "items-end")}>
                                                <div className="flex items-center gap-3 mb-2 px-2">
                                                    <span className="text-xs font-bold text-muted-foreground">
                                                        {isFromLead ? selectedLead.name : 'You'}
                                                    </span>
                                                    <span className="text-xs font-medium text-muted-foreground/70">
                                                        {format(new Date(email.received_at), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                                
                                                <div className={cn(
                                                    "max-w-[85%] rounded-2xl overflow-hidden shadow-sm",
                                                    isFromLead 
                                                        ? "bg-card border border-border" 
                                                        : "bg-primary text-primary-foreground"
                                                )}>
                                                    {/* Subject line header */}
                                                    {cleanSubject && (
                                                        <div className={cn(
                                                            "px-5 py-3 text-xs font-bold truncate border-b",
                                                            isFromLead 
                                                                ? "bg-muted/30 border-border text-foreground" 
                                                                : "bg-black/10 border-white/10 text-primary-foreground"
                                                        )}>
                                                            {cleanSubject}
                                                        </div>
                                                    )}
                                                    {/* Email body with preserved formatting */}
                                                    <div className={cn(
                                                        "p-5 text-sm leading-relaxed",
                                                        isFromLead ? "text-foreground" : "text-primary-foreground"
                                                    )} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                        {emailBody}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Draft Area */}
                                    {draft && (
                                        <div className="flex flex-col items-end animate-in fade-in slide-in-from-bottom-4 duration-500 mt-8 pt-8 border-t border-border">
                                            <div className="flex items-center gap-2 mb-2 px-2">
                                                <Bot size={14} className="text-primary animate-pulse" />
                                                <span className="text-xs font-bold text-primary uppercase tracking-wider">AI Draft</span>
                                            </div>
                                            <div className="w-full bg-card rounded-2xl overflow-hidden border border-border shadow-md focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                                <textarea
                                                    value={draft}
                                                    onChange={(e) => setDraft(e.target.value)}
                                                    className="w-full min-h-[200px] p-6 text-sm leading-relaxed bg-transparent text-foreground outline-none resize-none placeholder:text-muted-foreground custom-scrollbar"
                                                    placeholder="Synthesizing response..."
                                                />
                                                <div className="p-4 bg-muted/30 border-t border-border flex justify-end gap-3">
                                                    <Button
                                                        variant="ghost"
                                                        onClick={() => setDraft('')}
                                                        className="px-5 text-sm font-bold text-muted-foreground hover:text-foreground rounded-xl"
                                                    >
                                                        Discard
                                                    </Button>
                                                    <Button
                                                        onClick={handleSendReply}
                                                        disabled={sending}
                                                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-bold text-sm gap-2 rounded-xl shadow-sm"
                                                    >
                                                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                        Send Response
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Bottom AI Input Bar */}
                        <div className="p-6 bg-card border-t border-border shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                            <div className="max-w-3xl mx-auto flex gap-4">
                                <div className="flex-1 relative group">
                                    <Bot className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="text"
                                        value={aiPrompt}
                                        onChange={(e) => setAiPrompt(e.target.value)}
                                        placeholder="Add context for AI reply generation..."
                                        className="w-full bg-muted/40 border border-border pl-12 pr-4 py-3.5 rounded-xl text-sm font-medium text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !drafting) handleDraftReply();
                                        }}
                                    />
                                </div>
                                <Button
                                    onClick={handleDraftReply}
                                    disabled={drafting || threadLoading}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 font-bold text-sm gap-2 rounded-xl shadow-sm h-auto"
                                >
                                    {drafting ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
                                    {draft ? 'Re-Draft' : 'AI Draft'}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Elegant standby telemetry panel */
                    <div className="flex-1 flex flex-col items-center justify-center py-20 text-center p-8 bg-muted/5">
                        <div className="relative mb-8">
                            <div className="w-24 h-24 flex items-center justify-center bg-primary/10 text-primary rounded-full shadow-[0_0_30px_rgba(59,130,246,0.15)]">
                                <MessageSquare size={40} />
                            </div>
                            <div className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 rounded-full border-4 border-card animate-pulse shadow-sm" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Select a Conversation</h3>
                        <p className="text-base font-medium text-muted-foreground mt-3 max-w-sm leading-relaxed">
                            Choose a lead from the registry to view the communication thread and use AI to draft personalized responses.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../types';
import { Phone, Clock, Mail, Search, ChevronRight, Copy, Loader2, CheckCircle2, PhoneOff } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { cn } from '../../lib/utils';
import { LeadIntelligenceDrawer } from '../lead-scraper/LeadIntelligenceDrawer';

type CallStatus = 'pending' | 'completed' | 'follow_up' | 'not_interested';

export default function ColdCallingTab({ campaignId }: { campaignId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CallStatus>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<Lead | null>(null);

  useEffect(() => {
    fetchLeads();
  }, [campaignId]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('campaign_leads')
      .select('lead:leads(*)')
      .eq('campaign_id', campaignId);

    if (data) {
      setLeads(data.map((d: any) => d.lead).filter(Boolean));
    }
    setLoading(false);
  };

  const updateLeadStatus = async (leadId: string, newStatus: CallStatus, dbStatus: string) => {
    if (newStatus === 'not_interested') {
      await supabase.from('campaign_leads').delete().eq('campaign_id', campaignId).eq('lead_id', leadId);
      await supabase.from('leads').update({ status: 'not interested' }).eq('id', leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      toast({ title: "Lead removed", description: "Lead removed from campaign." });
      return;
    }
    
    await supabase.from('leads').update({ status: dbStatus }).eq('id', leadId);
    
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: dbStatus } : l));
    toast({ title: "Status updated", description: `Lead marked as ${newStatus.replace('_', ' ')}.` });
  };

  const handleOpenLeadDrawer = (lead: Lead) => {
    setSelectedLeadForDrawer(lead);
    setDrawerOpen(true);
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${type} copied to clipboard.` });
  };

  const getLeadCallStatus = (lead: Lead): CallStatus => {
    const s = (lead.status || 'new').toLowerCase();
    if (s === 'follow up') return 'follow_up';
    if (s === 'contacted') return 'completed';
    if (s === 'not interested' || s === 'unsubscribed') return 'not_interested';
    return 'pending';
  };

  const filteredLeads = leads.filter(l => {
    const status = getLeadCallStatus(l);
    if (status !== activeTab) return false;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (l.company || '').toLowerCase().includes(term) ||
        (l.name || '').toLowerCase().includes(term) ||
        (l.phone || '').toLowerCase().includes(term) ||
        (l.email || '').toLowerCase().includes(term)
      );
    }
    return true;
  });

  const tabCounts = {
    pending: leads.filter(l => getLeadCallStatus(l) === 'pending').length,
    completed: leads.filter(l => getLeadCallStatus(l) === 'completed').length,
    follow_up: leads.filter(l => getLeadCallStatus(l) === 'follow_up').length,
    not_interested: leads.filter(l => getLeadCallStatus(l) === 'not_interested').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Navigation & Search */}
      <div className="bg-card border border-border shadow-sm rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        <div className="flex gap-2 overflow-x-auto hide-scrollbar w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'pending', label: 'Pending', count: tabCounts.pending },
            { id: 'follow_up', label: 'Follow Up', count: tabCounts.follow_up },
            { id: 'completed', label: 'Completed', count: tabCounts.completed },
            { id: 'not_interested', label: 'Not Interested', count: tabCounts.not_interested },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as CallStatus)} 
              className={cn(
                "px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all shrink-0 flex items-center gap-2 border", 
                activeTab === tab.id 
                  ? "bg-primary text-primary-foreground border-primary shadow-[0_0_15px_-5px_rgba(139,92,246,0.5)]" 
                  : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
              )}
            >
              {tab.label}
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[9px]",
                activeTab === tab.id ? "bg-black/20 text-white" : "bg-muted-foreground/10 text-muted-foreground"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative group w-full md:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-muted/40 border border-border rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground shadow-sm"
          />
        </div>
      </div>

      {/* Leads List (Thin Rows) */}
      <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden divide-y divide-border">
        {filteredLeads.map(lead => (
          <div 
            key={lead.id} 
            onClick={() => handleOpenLeadDrawer(lead)}
            className="flex flex-col md:flex-row md:items-center justify-between p-3 md:px-4 md:py-2.5 hover:bg-muted/50 cursor-pointer transition-colors group"
          >
            {/* Left: Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1 mb-3 md:mb-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-xs border border-primary/20">
                {(lead.company || lead.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-foreground truncate">
                    {lead.company || 'Unknown Company'}
                  </span>
                  {lead.name && (
                    <span className="text-[10px] font-medium text-muted-foreground truncate hidden md:inline-block">
                      — {lead.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground truncate">
                  {lead.phone ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.phone!, 'Phone'); }}
                      className="font-mono text-foreground/80 hover:text-primary transition-colors flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded"
                      title="Copy Phone"
                    >
                      <Phone size={9} /> {lead.phone}
                    </button>
                  ) : (
                    <span className="font-mono text-foreground/40">No Phone</span>
                  )}
                  <span>•</span>
                  {lead.email ? (
                    <button 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(lead.email, 'Email'); }}
                      className="truncate hover:text-primary transition-colors flex items-center gap-1 bg-muted/30 px-1.5 py-0.5 rounded"
                      title="Copy Email"
                    >
                      <Mail size={9} /> {lead.email}
                    </button>
                  ) : (
                    <span className="text-foreground/40">No Email</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0 ml-11 md:ml-0" onClick={e => e.stopPropagation()}>
              
              {/* Status Actions */}
              {activeTab === 'pending' && (
                <>
                  <button 
                    onClick={() => updateLeadStatus(lead.id, 'completed', 'contacted')}
                    className="h-8 px-3 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-all"
                    title="Mark Completed"
                  >
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-bold uppercase hidden md:inline-block">Done</span>
                  </button>
                  <button 
                    onClick={() => updateLeadStatus(lead.id, 'follow_up', 'Follow Up')}
                    className="h-8 px-3 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 flex items-center gap-1.5 transition-all"
                    title="Follow Up Later"
                  >
                    <Clock size={14} />
                    <span className="text-[10px] font-bold uppercase hidden md:inline-block">Later</span>
                  </button>
                  <button 
                    onClick={() => updateLeadStatus(lead.id, 'not_interested', 'not interested')}
                    className="h-8 px-3 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center gap-1.5 transition-all"
                    title="Not Interested"
                  >
                    <PhoneOff size={14} />
                    <span className="text-[10px] font-bold uppercase hidden md:inline-block">Drop</span>
                  </button>
                </>
              )}

              {activeTab !== 'pending' && (
                <button 
                  onClick={() => updateLeadStatus(lead.id, 'pending', 'new')}
                  className="h-8 px-3 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground flex items-center gap-1.5 transition-all"
                >
                  <span className="text-[10px] font-bold uppercase">Reset</span>
                </button>
              )}

              <div className="w-px h-6 bg-border mx-1 hidden md:block"></div>

              {/* Copy Actions */}
              {lead.phone && (
                <button 
                  onClick={() => copyToClipboard(lead.phone!, 'Phone')}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                  title="Copy Phone"
                >
                  <Phone size={12} />
                </button>
              )}
              {lead.email && (
                <button 
                  onClick={() => copyToClipboard(lead.email, 'Email')}
                  className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                  title="Copy Email"
                >
                  <Mail size={12} />
                </button>
              )}
              
              <button 
                onClick={() => handleOpenLeadDrawer(lead)}
                className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-all ml-1"
                title="View Intel"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ))}

        {filteredLeads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Phone className="w-10 h-10 opacity-20 mb-3" />
            <p className="text-xs font-semibold">No {activeTab.replace('_', ' ')} leads found.</p>
          </div>
        )}
      </div>

      <LeadIntelligenceDrawer
        lead={selectedLeadForDrawer}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onReResearch={fetchLeads}
      />
    </div>
  );
}


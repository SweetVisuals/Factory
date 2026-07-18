import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../types';
import { Phone, PhoneOff, Clock, Trash2, Mail, Search, Filter } from 'lucide-react';
import { toast } from '../ui/use-toast';
import { cn } from '../../lib/utils';

import { Check, CheckSquare, Square, MailIcon } from 'lucide-react';

export default function ColdCallingTab({ campaignId }: { campaignId: string }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'gmail' | 'follow_up'>('all');
  const [calledLeads, setCalledLeads] = useState<Set<string>>(new Set());

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

  const removeLead = async (leadId: string) => {
    await supabase.from('campaign_leads').delete().eq('campaign_id', campaignId).eq('lead_id', leadId);
    setLeads(leads.filter(l => l.id !== leadId));
    toast({ title: "Lead removed", description: "Lead marked as not interested." });
  };

  const markFollowUp = async (leadId: string) => {
    await supabase.from('leads').update({ status: 'Follow Up' }).eq('id', leadId);
    fetchLeads();
    toast({ title: "Status updated", description: "Lead marked for follow up." });
  };

  const toggleCalled = (leadId: string) => {
    setCalledLeads(prev => {
      const next = new Set(prev);
      if (next.has(leadId)) {
        next.delete(leadId);
      } else {
        next.add(leadId);
      }
      return next;
    });
  };

  const filteredLeads = leads.filter(l => {
    if (filter === 'gmail') return l.email?.toLowerCase().includes('@gmail.com');
    if (filter === 'follow_up') return l.status === 'Follow Up';
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button 
            onClick={() => setFilter('all')} 
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all", 
              filter === 'all' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            All Leads
          </button>
          <button 
            onClick={() => setFilter('gmail')} 
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all", 
              filter === 'gmail' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Gmail Only
          </button>
          <button 
            onClick={() => setFilter('follow_up')} 
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all", 
              filter === 'follow_up' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            Follow Up
          </button>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          Called: {calledLeads.size} / {leads.length}
        </div>
      </div>

      <div className="space-y-2">
        {filteredLeads.map(lead => {
          const isCalled = calledLeads.has(lead.id);
          return (
            <div key={lead.id} className={cn("flex items-center justify-between p-4 bg-card border rounded-xl transition-all", isCalled ? "border-emerald-500/20 bg-emerald-500/[0.01] opacity-75" : "border-border")}>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleCalled(lead.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title={isCalled ? "Mark as uncalled" : "Mark as called"}
                >
                  {isCalled ? (
                    <CheckSquare size={20} className="text-emerald-500" />
                  ) : (
                    <Square size={20} />
                  )}
                </button>
                <div>
                  <div className="font-bold flex items-center gap-2">
                    <span className={cn(isCalled && "line-through text-muted-foreground")}>
                      {lead.first_name} {lead.last_name || lead.company_name}
                    </span>
                    {lead.status === 'Follow Up' && (
                      <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-widest rounded">
                        Follow Up
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{lead.email} • {lead.phone || 'No phone'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                {lead.status === 'Follow Up' && (
                  <button 
                    onClick={() => {
                      toast({ title: "Drafting response", description: `Drafting custom response email to ${lead.email}` });
                    }}
                    className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors" 
                    title="Draft Custom Response"
                  >
                    <MailIcon size={16} />
                  </button>
                )}
                <button 
                  onClick={() => markFollowUp(lead.id)} 
                  className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3" 
                  title="Follow Up Later"
                >
                  <Clock size={14} />
                  Follow Up
                </button>
                <button 
                  onClick={() => removeLead(lead.id)} 
                  className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20 transition-all flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3" 
                  title="Not Interested"
                >
                  <PhoneOff size={14} />
                  Not Interested
                </button>
              </div>
            </div>
          );
        })}
        {filteredLeads.length === 0 && !loading && (
          <div className="text-center p-8 text-muted-foreground">No leads found for this filter.</div>
        )}
      </div>
    </div>
  );
}

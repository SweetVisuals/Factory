import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../types';
import {
  X, Mail, User, Building2, Globe, Linkedin, Twitter, Facebook, Instagram,
  ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Loader2, BrainCircuit,
  List, Target, Activity, Phone, MapPin, Sparkles
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import axios from 'axios';

interface LeadDetailModalProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({ leadId, open, onClose }) => {
  const [lead, setLead] = useState<Lead | null>(null);
  const [lists, setLists] = useState<{ id: string; name: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string }[]>([]);
  const [outreachLogs, setOutreachLogs] = useState<{ id: string; status: string; created_at: string; campaign_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isResearching, setIsResearching] = useState(false);
  const [deepResearch, setDeepResearch] = useState<string | null>(null);

  useEffect(() => {
    if (!leadId || !open) return;

    const fetchLeadDetails = async () => {
      setLoading(true);
      setDeepResearch(null);
      try {
        // 1. Fetch Lead
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .maybeSingle();

        if (leadError) throw leadError;
        setLead(leadData);
        if (leadData?.summary) {
          setDeepResearch(leadData.summary);
        }

        // 2. Fetch associated saved lists
        const { data: listLeads, error: listError } = await supabase
          .from('list_leads')
          .select('saved_lists(id, name)')
          .eq('lead_id', leadId);

        if (!listError && listLeads) {
          const fetchedLists = listLeads
            .map((item: any) => item.saved_lists)
            .filter(Boolean);
          setLists(fetchedLists);
        }

        // 3. Fetch associated campaigns
        const { data: campLeads, error: campError } = await supabase
          .from('campaign_leads')
          .select('campaigns(id, name, status)')
          .eq('lead_id', leadId);

        if (!campError && campLeads) {
          const fetchedCampaigns = campLeads
            .map((item: any) => item.campaigns)
            .filter(Boolean);
          setCampaigns(fetchedCampaigns);
        }

        // 4. Fetch campaign progress/outreach logs
        const { data: progressData, error: progressError } = await supabase
          .from('campaign_progress')
          .select('id, status, created_at, campaigns(name)')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false });

        if (!progressError && progressData) {
          const logs = progressData.map((item: any) => ({
            id: item.id,
            status: item.status,
            created_at: item.created_at,
            campaign_name: item.campaigns?.name || 'Unknown Campaign'
          }));
          setOutreachLogs(logs);
        }
      } catch (err) {
        console.error('Error fetching lead details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeadDetails();
  }, [leadId, open]);

  const handleDeepResearch = async () => {
    if (!lead || isResearching) return;
    setIsResearching(true);
    try {
      const res = await axios.post('/api/deep-research', {
        company: lead.company,
        website: lead.website,
        notesContext: ''
      });
      if (res.data.success) {
        setDeepResearch(res.data.data);
        // Also update local lead state summary
        setLead(prev => prev ? { ...prev, summary: res.data.data } : null);
      }
    } catch (e) {
      console.error('Deep scan failed:', e);
    } finally {
      setIsResearching(false);
    }
  };

  const hasDeepResearchContent = deepResearch || (lead?.summary && (lead.summary.includes('##') || lead.summary.length > 200));
  const hasError = (deepResearch && deepResearch.startsWith('AI_ERROR')) || (lead?.summary && lead.summary.startsWith('AI_ERROR'));
  const contentToShow = deepResearch || lead?.summary;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-background/95 backdrop-blur-3xl border border-white/10 max-w-4xl max-h-[85vh] rounded-none p-0 overflow-hidden shadow-2xl flex flex-col">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
        
        <div className="flex items-center justify-between p-6 border-b border-foreground/[0.03]">
          <div>
            <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
              <User className="text-primary" size={20} />
              Lead Profile Detail
            </DialogTitle>
            <DialogDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">
              Active identity mapping and outreach history
            </DialogDescription>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-24 space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em]">Decoding digital fingerprint...</p>
          </div>
        ) : !lead ? (
          <div className="flex-1 flex flex-col items-center justify-center p-24 space-y-4">
            <AlertTriangle className="w-10 h-10 text-destructive" />
            <p className="text-[10px] font-black text-destructive/80 uppercase tracking-[0.2em]">Lead record offline or unresolved.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 space-y-8 min-h-0 scrollbar-thin">
            {/* Header info card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Core Identity */}
              <div className="md:col-span-2 space-y-6 bg-foreground/[0.01] p-6 border border-foreground/[0.02] relative">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-foreground tracking-tight">{lead.name || 'Unknown Contact'}</h3>
                    <p className="text-xs font-bold text-muted-foreground/60 flex items-center gap-2">
                      <Building2 size={12} />
                      {lead.company} {lead.title ? `— ${lead.title}` : ''}
                    </p>
                  </div>
                  
                  {/* Validation Badge */}
                  <div className="flex items-center gap-2">
                    {lead.validation_status === 'valid' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black bg-emerald-500/10 text-emerald-500 uppercase tracking-widest">
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                    {lead.validation_status === 'warning' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black bg-amber-500/10 text-amber-500 uppercase tracking-widest">
                        <AlertTriangle size={10} /> Unstable
                      </span>
                    )}
                    {lead.validation_status === 'invalid' && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black bg-red-500/10 text-red-500 uppercase tracking-widest">
                        <XCircle size={10} /> Blocked
                      </span>
                    )}
                    {!lead.validation_status && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-black bg-foreground/[0.04] text-muted-foreground/60 uppercase tracking-widest">
                        Unscanned
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-foreground/[0.03]">
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block">Email Address</span>
                    <span className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                      <Mail size={12} className="text-primary" />
                      {lead.email}
                    </span>
                  </div>
                  {lead.phone && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block">Direct Line</span>
                      <span className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                        <Phone size={12} className="text-muted-foreground/60" />
                        {lead.phone}
                      </span>
                    </div>
                  )}
                  {lead.location && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block">Geographic Vector</span>
                      <span className="text-xs font-bold text-foreground/80 flex items-center gap-2">
                        <MapPin size={12} className="text-muted-foreground/60" />
                        {lead.location}
                      </span>
                    </div>
                  )}
                  {lead.website && (
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block">Digital Realm</span>
                      <a 
                        href={lead.website} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-2"
                      >
                        <Globe size={12} />
                        {lead.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    </div>
                  )}
                </div>

                {/* Social Nodes */}
                <div className="flex gap-2 pt-2">
                  {lead.linkedin && (
                    <a href={lead.linkedin} target="_blank" rel="noreferrer" className="w-8 h-8 bg-foreground/[0.03] hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center text-muted-foreground">
                      <Linkedin size={14} />
                    </a>
                  )}
                  {lead.twitter && (
                    <a href={lead.twitter} target="_blank" rel="noreferrer" className="w-8 h-8 bg-foreground/[0.03] hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center text-muted-foreground">
                      <Twitter size={14} />
                    </a>
                  )}
                  {lead.facebook && (
                    <a href={lead.facebook} target="_blank" rel="noreferrer" className="w-8 h-8 bg-foreground/[0.03] hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center text-muted-foreground">
                      <Facebook size={14} />
                    </a>
                  )}
                  {lead.instagram && (
                    <a href={lead.instagram} target="_blank" rel="noreferrer" className="w-8 h-8 bg-foreground/[0.03] hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-center text-muted-foreground">
                      <Instagram size={14} />
                    </a>
                  )}
                </div>
              </div>

              {/* Right Column: Routing / System Status */}
              <div className="space-y-6 bg-foreground/[0.01] p-6 border border-foreground/[0.02]">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-foreground mb-3">Registries & Campaigns</h4>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-1">Target Registries</span>
                      {lists.length === 0 ? (
                        <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">Unassigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {lists.map(list => (
                            <span key={list.id} className="inline-flex items-center gap-1 text-[8px] font-black text-primary bg-primary/5 px-2 py-0.5 uppercase tracking-widest border border-primary/10">
                              <List size={8} /> {list.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] block mb-1">Active Sequences</span>
                      {campaigns.length === 0 ? (
                        <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-widest">No Active Campaigns</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {campaigns.map(camp => (
                            <span key={camp.id} className="inline-flex items-center gap-1 text-[8px] font-black text-amber-500 bg-amber-500/5 px-2 py-0.5 uppercase tracking-widest border border-amber-500/10">
                              <Target size={8} /> {camp.name} ({camp.status})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI intelligence / summary section */}
            <div className="bg-foreground/[0.01] border border-foreground/[0.02] p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-foreground/[0.03]">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="text-primary" size={18} />
                  <div>
                    <h4 className="text-xs font-black text-foreground uppercase tracking-wider">AI Intelligence Context</h4>
                    <p className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">Intent mapping and corporate profile intelligence</p>
                  </div>
                </div>
                
                <button
                  onClick={handleDeepResearch}
                  disabled={isResearching}
                  className={`px-5 py-2 rounded-none font-black uppercase tracking-widest text-[9px] transition-all flex items-center gap-2 ${hasDeepResearchContent ? 'bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.05]' : 'bg-primary text-primary-foreground hover:scale-[1.02]'}`}
                >
                  {isResearching ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {isResearching ? "Processing..." : (hasError ? "Retry Scan" : (hasDeepResearchContent ? "Force Rescan" : "Initialize Scan"))}
                </button>
              </div>

              <div className="space-y-4 text-foreground/80 min-h-[100px]">
                {isResearching ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 opacity-50">
                    <Loader2 size={24} className="animate-spin text-primary" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Compiling Corporate Intelligence...</p>
                  </div>
                ) : hasError ? (
                  <div className="p-4 bg-red-500/5 text-red-400 space-y-2">
                    <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[9px]">
                      <AlertTriangle size={12} />
                      Intelligence Scan Interrupted
                    </div>
                    <p className="text-xs font-bold opacity-80">{contentToShow?.replace('AI_ERROR:', '')}</p>
                  </div>
                ) : contentToShow ? (
                  <div className="prose prose-invert prose-xs max-w-none max-h-[200px] overflow-y-auto pr-2 scrollbar-none">
                    {contentToShow.split('\n').map((line, i) => {
                      if (!line.trim()) return <br key={i} />;
                      const isHeader = line.startsWith('##');
                      const isBold = line.startsWith('**');
                      return (
                        <p key={i} className={`${isHeader ? 'text-sm font-black text-foreground uppercase tracking-tight mt-4 mb-2 border-b border-foreground/[0.02] pb-1' : ''} ${isBold ? 'font-black text-foreground' : 'text-xs font-medium text-foreground/60 leading-relaxed'}`}>
                          {line.replace(/##/g, '').replace(/\*\*/g, '')}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3 opacity-20">
                    <BrainCircuit size={32} />
                    <p className="text-[9px] font-black uppercase tracking-widest">Intelligence offline</p>
                  </div>
                )}
              </div>
            </div>

            {/* Outreach logs / timeline */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-2 border-b border-foreground/[0.03]">
                <Activity className="text-primary" size={16} />
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">Outreach Activity Log</h4>
              </div>

              {outreachLogs.length === 0 ? (
                <div className="p-8 text-center bg-foreground/[0.01] border border-dashed border-foreground/[0.04]">
                  <p className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-[0.25em]">No signal history detected for this node.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-none pr-2">
                  {outreachLogs.map(log => (
                    <div 
                      key={log.id}
                      className="flex items-center justify-between p-3 bg-foreground/[0.01] border border-foreground/[0.02] hover:bg-foreground/[0.02] transition-colors"
                      style={{ borderLeft: `2.5px solid ${log.status === 'sent' ? '#10b981' : (log.status === 'failed' || log.status === 'bounced') ? '#ef4444' : log.status === 'replied' ? '#3b82f6' : '#8b5cf6'}` }}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-foreground uppercase tracking-tight">Outreach Status: {log.status}</span>
                        <span className="text-[10px] text-muted-foreground/60">Campaign: {log.campaign_name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/40 font-bold">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

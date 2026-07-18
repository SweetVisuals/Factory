import React, { useState } from 'react';
import {
  Plus, Sparkles, Trash, Search, ChevronLeft, ChevronRight, Mail, User,
  Linkedin, Loader2, Eye, Download, XCircle, Ban,
  ExternalLink, Facebook, Instagram, Twitter, FileText,
  CheckCircle2, AlertTriangle, BrainCircuit, ChevronDown, ChevronUp,
  Database, Activity, Target, ShieldAlert, RefreshCw, MoreVertical, Layers,
  Copy, Globe
} from 'lucide-react';
import { Lead } from '@/types';
import { LeadUploader } from './leads/LeadUploader';
import { LeadForm } from './leads/LeadForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLead, createLeads, fetchLeads, deleteLead } from '@/lib/api/leads';
import { toast } from '@/components/ui/use-toast';
import { CustomCheckbox } from '@/components/ui/CustomCheckbox';
import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { cn } from '@/lib/utils';

interface Props {
  campaignId: string;
  refreshTrigger?: boolean;
  onViewLead?: (leadId: string) => void;
}

const ITEMS_PER_PAGE = 100;

const LeadsTable: React.FC<Props> = ({ campaignId, refreshTrigger }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddLead, setShowAddLead] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const [totalToDelete, setTotalToDelete] = useState(0);
  const [viewingDraft, setViewingDraft] = useState<Lead | null>(null);
  const [showTestLead, setShowTestLead] = useState(false);
  const [testLeadName, setTestLeadName] = useState('');
  const [testLeadEmail, setTestLeadEmail] = useState('');
  const [testLeadNiche, setTestLeadNiche] = useState('');
  const [isGeneratingTestLead, setIsGeneratingTestLead] = useState(false);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [deepResearchOpen, setDeepResearchOpen] = useState(false);
  const [activeSummaryLead, setActiveSummaryLead] = useState<Lead | null>(null);
  const [deepResearchResults, setDeepResearchResults] = useState<Record<string, string>>({});
  const [isDeletingBounced, setIsDeletingBounced] = useState(false);

  React.useEffect(() => {
    loadLeads();
  }, [campaignId, refreshTrigger]);

  const deduplicateLeads = (leads: Lead[]): Lead[] => {
    const leadMap = new Map<string, Lead>();
    leads.forEach(lead => {
      const existing = leadMap.get(lead.email);
      if (!existing) {
        leadMap.set(lead.email, lead);
        return;
      }
      const existingScore = Object.values(existing).filter(Boolean).length;
      const newScore = Object.values(lead).filter(Boolean).length;
      if (newScore > existingScore) {
        leadMap.set(lead.email, lead);
      }
    });
    return Array.from(leadMap.values());
  };

  const bouncedLeads = leads.filter(l => l.status === 'bounced');
  const bouncedCount = bouncedLeads.length;

  const handlePurgeBounced = async () => {
    if (bouncedCount === 0) return;
    setIsDeletingBounced(true);
    try {
      for (const lead of bouncedLeads) {
        await deleteLead(campaignId, lead.id);
      }
      setLeads(prev => prev.filter(l => l.status !== 'bounced'));
      toast({ title: 'Bounced Purged', description: `${bouncedCount} bounced leads removed from campaign.` });
    } catch (error) {
      toast({ title: 'Purge Failed', description: 'Failed to remove bounced leads.', variant: 'destructive' });
    } finally {
      setIsDeletingBounced(false);
    }
  };

  const loadLeads = async () => {
    try {
      setIsLoading(true);
      const data = await fetchLeads(campaignId) as Lead[];
      const deduplicated = deduplicateLeads(data);
      setLeads(deduplicated);
    } catch (error) {
      console.error('Error loading leads:', error);
      toast({ title: "Fetch Failed", description: "Failed to load leads list.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLead = async (lead: Lead) => {
    try {
      await createLead(campaignId, lead);
      await loadLeads();
      setShowAddLead(false);
      toast({ title: "Lead Added", description: "Lead has been added to the campaign." });
    } catch (error) {
      console.error('Error adding lead:', error);
      toast({ title: "Addition Failed", description: "Failed to add lead to the database.", variant: "destructive" });
    }
  };

  const handleAddTestLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testLeadName || !testLeadEmail || !testLeadNiche) {
      toast({ title: "Input Required", description: "Please fill in all fields.", variant: "destructive" });
      return;
    }
    setIsGeneratingTestLead(true);
    try {
      const response = await axios.post('http://localhost:3001/api/generate-test-lead', {
        name: testLeadName,
        email: testLeadEmail,
        niche: testLeadNiche
      });
      if (!response.data.success || !response.data.data) throw new Error(response.data.error || 'Generation failed');
      const generatedData = response.data.data;
      const testLead = {
        email: testLeadEmail,
        name: testLeadName,
        company: generatedData.company || 'Unknown Company',
        title: generatedData.title || '',
        industry: generatedData.industry || testLeadNiche,
        summary: generatedData.summary || '',
        personalized_email: generatedData.personalized_email || '',
        phone: generatedData.phone || '',
        location: generatedData.location || ''
      } as Lead;
      await createLead(campaignId, testLead);
      await loadLeads();
      setShowTestLead(false);
      setTestLeadName(''); setTestLeadEmail(''); setTestLeadNiche('');
      toast({ title: "Sample Lead Created", description: "AI has successfully generated a sample lead." });
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingTestLead(false);
    }
  };

  const handleUploadLeads = async (uploadedLeads: Lead[]) => {
    try {
      const deduplicated = deduplicateLeads(uploadedLeads);
      await createLeads(campaignId, deduplicated);
      await loadLeads();
      toast({ title: "Import Complete", description: `${uploadedLeads.length} leads successfully imported.` });
    } catch (error) {
      toast({ title: "Import Error", description: "Failed to import leads batch.", variant: "destructive" });
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      setDeletingId(leadId);
      await deleteLead(campaignId, leadId);
      setLeads(leads.filter(lead => lead.id !== leadId));
      setSelectedLeads(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      toast({ title: "Lead Deleted", description: "Lead record removed." });
    } catch (error) {
      toast({ title: "Delete Failed", description: "Failed to remove lead record.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const leadsToDelete = Array.from(selectedLeads);
      setDeletingId('BULK');
      setDeleteProgress(0);
      setTotalToDelete(leadsToDelete.length);
      await Promise.all(leadsToDelete.map(async (id) => {
        await deleteLead(campaignId, id);
        setDeleteProgress(prev => prev + 1);
      }));
      setLeads(leads.filter(lead => !selectedLeads.has(lead.id)));
      setSelectedLeads(new Set());
      toast({ title: "Batch Delete Complete", description: `${leadsToDelete.length} leads removed.` });
    } catch (error) {
      toast({ title: "Batch Delete Failed", description: "Failed to delete selected leads.", variant: "destructive" });
    } finally {
      setDeletingId(null);
      setDeleteProgress(0);
      setTotalToDelete(0);
    }
  };

  const filteredLeads = leads.filter((lead) =>
    Object.values(lead).some((value) => String(value).toLowerCase().includes(searchTerm.toLowerCase())) ||
    lead.phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.website?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentLeads = filteredLeads.slice(startIndex, endIndex);

  const handleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeepResearch = async (lead: Lead) => {
    if (researchingId) return;
    setResearchingId(lead.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await axios.post('/api/deep-research', {
        company: lead.company,
        website: lead.website,
        notesContext: ''
      }, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.data.success) {
        setDeepResearchResults(prev => ({ ...prev, [lead.id]: res.data.data }));
        setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, summary: res.data.data } : l));
        if (activeSummaryLead?.id === lead.id) setActiveSummaryLead({ ...lead, summary: res.data.data });
      }
    } catch (e) {
      toast({ title: "Research Failed", description: "AI failed to research this lead.", variant: "destructive" });
    } finally {
      setResearchingId(null);
    }
  };

  const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  const exportCSV = () => {
    const dataToExport = selectedLeads.size > 0
      ? leads.filter(l => selectedLeads.has(l.id))
      : leads;

    if (dataToExport.length === 0) {
      toast({ title: 'Nothing to Export', description: 'No leads available to export.', variant: 'destructive' });
      return;
    }

    const headers = ['Name', 'Email', 'Company', 'Title', 'Phone', 'Website', 'Location', 'LinkedIn', 'Facebook', 'Instagram', 'Twitter', 'Source', 'Status', 'Summary'];
    const escapeCSV = (val: string) => {
      if (!val) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    };

    const rows = dataToExport.map(l => [
      escapeCSV(l.name || ''),
      escapeCSV(l.email || ''),
      escapeCSV(l.company || ''),
      escapeCSV(l.title || ''),
      escapeCSV(l.phone || ''),
      escapeCSV(l.website || ''),
      escapeCSV(l.location || ''),
      escapeCSV(l.linkedin || ''),
      escapeCSV(l.facebook || ''),
      escapeCSV(l.instagram || ''),
      escapeCSV(l.twitter || ''),
      escapeCSV(l.source || ''),
      escapeCSV(l.status || ''),
      escapeCSV((l.summary || '').replace(/\n/g, ' '))
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `${dataToExport.length} prospects exported to CSV.` });
  };



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-32 space-y-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          <Database className="h-6 w-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
        </div>
        <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.3em]">Loading leads...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Premium Toolbar */}
      <div className="bg-card border border-border shadow-sm rounded-t-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative group flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search leads..."
              className="w-full bg-muted/40 border border-border rounded-lg pl-11 pr-4 py-2 text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20 focus:border-primary/30 outline-none transition-all placeholder:text-muted-foreground shadow-sm"
            />
          </div>
          
          <div className="flex items-center gap-2 bg-muted/30 border border-border px-3 py-2 rounded-lg shadow-sm">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">
              {leads.length.toLocaleString()} Active Leads
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {bouncedCount > 0 && (
            <Button
              onClick={handlePurgeBounced}
              disabled={isDeletingBounced}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg px-4 h-9 font-bold text-xs transition-all gap-1.5"
            >
              {isDeletingBounced ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <><Ban size={14} /> Purge Bounced ({bouncedCount})</>}
            </Button>
          )}
          {selectedLeads.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={deletingId === 'BULK'}
              className="bg-destructive/10 hover:bg-destructive/20 text-destructive border-none rounded-lg px-4 h-9 font-bold text-xs transition-all"
            >
              {deletingId === 'BULK' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : `Delete Selected (${selectedLeads.size})`}
            </Button>
          )}
          
          <Button
            onClick={exportCSV}
            className="bg-card hover:bg-muted text-emerald-500 rounded-lg border border-border px-4 h-9 font-bold text-xs gap-2 transition-all shadow-sm"
          >
            <Download size={14} /> {selectedLeads.size > 0 ? `Export (${selectedLeads.size})` : 'Export CSV'}
          </Button>

          <Button
            onClick={() => setShowTestLead(true)}
            className="bg-primary/10 hover:bg-primary/20 text-primary rounded-lg px-4 h-9 font-bold text-xs gap-2 transition-all shadow-sm"
          >
            <Sparkles size={14} /> Sample Lead
          </Button>
          
          <Button
            onClick={() => setShowAddLead(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 h-9 font-bold text-xs gap-2 shadow-sm transition-all"
          >
            <Plus size={14} /> Add Lead
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border shadow-sm rounded-b-2xl overflow-hidden -mt-4 pt-4">
        <LeadUploader onUpload={handleUploadLeads} />
        
        <div className="overflow-x-auto custom-scrollbar">
          <table className="min-w-full border-none ">
            <thead>
                <tr className="bg-muted/20 border-b border-border">
                  <th className="pl-6 pr-4 py-3 text-left w-16">
                    <CustomCheckbox
                      checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Location</th>
                  <th className="px-4 py-3 text-right pr-6 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3 text-muted-foreground">
                      <Layers size={36} className="opacity-40" />
                      <p className="text-xs font-semibold">No leads found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentLeads.map((lead) => {
                  const isSelected = selectedLeads.has(lead.id);
                  const hasSummary = lead.summary || deepResearchResults[lead.id];
                  
                  return (
                    <tr 
                      key={lead.id} 
                      className={cn(
                        "group/row transition-all duration-300 hover:bg-muted/50",
                        isSelected && "bg-primary/5",
                        lead.status === 'bounced' && "bg-red-500/5 hover:bg-red-500/10"
                      )}
                    >
                      <td className="pl-6 pr-4 py-2.5">
                        <CustomCheckbox checked={isSelected} onChange={() => handleSelectOne(lead.id)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm transition-all duration-300",
                              lead.status === 'bounced' ? "bg-red-500/20 text-red-500 ring-2 ring-red-500/30" :
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover/row:bg-primary/10 group-hover/row:text-primary"
                            )}>
                              {lead.status === 'bounced' ? <XCircle size={14} /> : (lead.name || lead.email).charAt(0).toUpperCase()}
                            </div>
                            {lead.status === 'bounced' && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-card animate-pulse" />
                            )}
                          </div>
                          <div className="space-y-0.5 min-w-[120px]">
                            <div className={cn(
                              "text-xs font-bold transition-colors truncate",
                              lead.status === 'bounced' ? "text-red-500" : "text-foreground group-hover/row:text-primary"
                            )}>
                              {lead.name || 'Unknown Lead'}
                            </div>
                            <div className={cn(
                              "text-[10px] font-medium truncate",
                              lead.status === 'bounced' ? "text-red-400/70 line-through" : "text-muted-foreground"
                            )}>{lead.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold text-foreground truncate max-w-[160px]">{lead.company || 'Direct'}</div>
                          <div className="text-[10px] font-medium text-muted-foreground truncate max-w-[160px]">{lead.title || 'No Title'}</div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 group/email">
                          <span className="font-mono text-[11px] text-foreground truncate max-w-[160px]">{lead.email}</span>
                          <button onClick={() => { navigator.clipboard.writeText(lead.email); toast({ title: 'Copied', description: lead.email }); }} className="opacity-0 group-hover/email:opacity-100 text-muted-foreground hover:text-foreground transition-all" title="Copy">
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs font-semibold text-foreground truncate max-w-[120px]">{lead.location || 'Remote'}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Social Media Icons */}
                          <div className="flex items-center gap-1">
                            {lead.linkedin && (
                              <a href={lead.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-all" title="LinkedIn">
                                <Linkedin size={10} />
                              </a>
                            )}
                            {lead.twitter && (
                              <a href={lead.twitter} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all" title="Twitter">
                                <Twitter size={10} />
                              </a>
                            )}
                            {lead.facebook && (
                              <a href={lead.facebook} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-blue-600 hover:bg-blue-600/10 transition-all" title="Facebook">
                                <Facebook size={10} />
                              </a>
                            )}
                            {lead.instagram && (
                              <a href={lead.instagram} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-pink-500 hover:bg-pink-500/10 transition-all" title="Instagram">
                                <Instagram size={10} />
                              </a>
                            )}
                          </div>

                          {/* View Button - Always on the right */}
                          <button
                            onClick={() => setActiveSummaryLead(lead)}
                            className={cn(
                              "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 border ml-auto",
                              "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary border-muted"
                            )}
                          >
                            View <ChevronRight className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-6 bg-muted/10 border-t border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">
              Showing {startIndex + 1} - {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-xl bg-card hover:bg-muted border border-border p-0"
              >
                <ChevronLeft size={18} />
              </Button>
              <span className="text-sm font-bold text-foreground px-2">{currentPage} / {totalPages}</span>
              <Button
                variant="ghost"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="w-10 h-10 rounded-xl bg-card hover:bg-muted border border-border p-0"
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-8 max-w-xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Add New Lead</DialogTitle>
          </DialogHeader>
          <LeadForm onSubmit={handleAddLead} onCancel={() => setShowAddLead(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showTestLead} onOpenChange={setShowTestLead}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-8 max-w-xl shadow-lg">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-bold text-foreground">Create Sample Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTestLead} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground ml-1">Name</label>
              <Input value={testLeadName} onChange={(e) => setTestLeadName(e.target.value)} className="bg-muted/40 border-border rounded-xl h-12" placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground ml-1">Email</label>
              <Input type="email" value={testLeadEmail} onChange={(e) => setTestLeadEmail(e.target.value)} className="bg-muted/40 border-border rounded-xl h-12" placeholder="e.g. john@example.com" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground ml-1">Niche/Industry</label>
              <Input value={testLeadNiche} onChange={(e) => setTestLeadNiche(e.target.value)} className="bg-muted/40 border-border rounded-xl h-12" placeholder="e.g. SaaS Founders" />
            </div>
            <div className="flex justify-end gap-4 mt-8">
              <Button type="button" variant="ghost" onClick={() => setShowTestLead(false)} className="rounded-xl px-6 font-bold text-sm">Cancel</Button>
              <Button type="submit" disabled={isGeneratingTestLead} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 h-12 font-bold text-sm shadow-md">
                {isGeneratingTestLead ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : 'Create Lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeSummaryLead} onOpenChange={(open) => !open && setActiveSummaryLead(null)}>
        <DialogContent className="bg-card border border-border text-foreground rounded-3xl p-0 max-w-3xl overflow-hidden shadow-2xl">
          <div className="p-10 h-full flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                  <BrainCircuit size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{activeSummaryLead?.company} Research</h3>
                  <p className="text-sm font-medium text-muted-foreground mt-1">AI Lead Research</p>
                </div>
              </div>
              <Button
                onClick={() => activeSummaryLead && handleDeepResearch(activeSummaryLead)}
                disabled={!!researchingId}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-12 font-bold text-sm gap-3 shadow-md"
              >
                {researchingId === activeSummaryLead?.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity size={18} />}
                Run AI Research
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[60vh] pr-4">
              {researchingId === activeSummaryLead?.id ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 text-muted-foreground">
                  <div className="relative">
                    <Loader2 className="w-16 h-16 animate-spin text-primary/30" />
                    <BrainCircuit className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-base font-bold text-foreground">Researching Lead...</p>
                    <p className="text-sm font-medium">Finding social profiles and company info...</p>
                  </div>
                </div>
              ) : activeSummaryLead?.summary ? (
                <div className="prose prose-sm max-w-none space-y-6">
                  {activeSummaryLead.summary.split('\n').map((line: string, i: number) => {
                    if (line.startsWith('##')) return <h4 key={i} className="text-lg font-bold text-foreground border-b border-border pb-3 mt-8">{line.replace(/#/g, '').trim()}</h4>;
                    if (line.startsWith('**')) return <p key={i} className="font-semibold text-foreground bg-muted/40 p-4 rounded-xl border border-border">{line.replace(/\*\*/g, '').trim()}</p>;
                    return <p key={i} className="text-muted-foreground leading-relaxed">{line}</p>;
                  })}
                </div>
              ) : (
                <div className="py-20 text-center border border-dashed border-border rounded-3xl space-y-6 bg-muted/10">
                  <p className="text-sm font-medium text-muted-foreground">No research data available.</p>
                  <Button onClick={() => activeSummaryLead && handleDeepResearch(activeSummaryLead)} className="bg-primary/10 text-primary hover:bg-primary/20 rounded-xl px-8 h-12 text-sm font-bold shadow-sm">
                    Start AI Research
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsTable;

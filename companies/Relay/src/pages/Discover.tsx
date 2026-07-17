import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/use-toast';
import { Lead } from '../types';
import Layout from '../components/layout/Layout';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { cn } from '../lib/utils';
import { 
  Search, Users, MailCheck, AlertTriangle, 
  ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, HelpCircle, Activity, Loader2, Sparkles, Plus, X, ArrowUpRight,
  Globe, Linkedin, Phone, Building2, MapPin, Briefcase, ArrowUpDown, ArrowUp, ArrowDown,
  Copy, ExternalLink, ChevronDown, Hash, Filter
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface Campaign {
  id: string;
  name: string;
}

type SortField = 'name' | 'company' | 'email' | 'location' | 'created_at';
type SortDir = 'asc' | 'desc';

const Discover: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [requireFullProfile, setRequireFullProfile] = useState(false);
  const [researchFilter, setResearchFilter] = useState('all'); // 'all', 'completed', 'pending', 'failed'

  // Debounced
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedIndustry, setDebouncedIndustry] = useState(industryFilter);
  const [debouncedLocation, setDebouncedLocation] = useState(locationFilter);
  const [debouncedTitle, setDebouncedTitle] = useState(titleFilter);
  const [debouncedCompany, setDebouncedCompany] = useState(companyFilter);

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Selection
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [addingToCampaign, setAddingToCampaign] = useState(false);

  // Expanded row
  const [selectedLeadPanel, setSelectedLeadPanel] = useState<Lead | null>(null);

  // Mobile filters
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    verifiedEmails: 0,
    invalidEmails: 0,
    verificationRate: 0,
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (industryFilter) count++;
    if (locationFilter) count++;
    if (titleFilter) count++;
    if (companyFilter) count++;
    if (statusFilter !== 'all') count++;
    return count;
  }, [search, industryFilter, locationFilter, titleFilter, companyFilter, statusFilter]);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedIndustry(industryFilter);
      setDebouncedLocation(locationFilter);
      setDebouncedTitle(titleFilter);
      setDebouncedCompany(companyFilter);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search, industryFilter, locationFilter, titleFilter, companyFilter]);

  useEffect(() => {
    fetchCampaigns();
    fetchMetrics();
    const sub = supabase
      .channel('public:leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
        fetchMetrics();
      })
      .on('broadcast', { event: 'leads_updated' }, () => {
        fetchLeads();
        fetchMetrics();
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [page, limit, debouncedSearch, debouncedIndustry, debouncedLocation, debouncedTitle, debouncedCompany, statusFilter, sortField, sortDir, requireFullProfile]);

  const fetchCampaigns = async () => {
    const { data } = await supabase.from('campaigns').select('id, name').order('name', { ascending: true });
    if (data) setCampaigns(data);
  };

  const fetchMetrics = async () => {
    const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    const { count: verified } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid');
    const { count: invalid } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'invalid');
    const totalNum = total || 0;
    const verifiedNum = verified || 0;
    setMetrics({
      totalLeads: totalNum,
      verifiedEmails: verifiedNum,
      invalidEmails: invalid || 0,
      verificationRate: totalNum > 0 ? Math.round((verifiedNum / totalNum) * 100) : 0,
    });
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*', { count: 'exact' });
      if (debouncedSearch.trim()) query = query.or(`name.ilike.%${debouncedSearch}%,company.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      if (debouncedIndustry.trim()) query = query.ilike('industry', `%${debouncedIndustry}%`);
      if (debouncedLocation.trim()) query = query.ilike('location', `%${debouncedLocation}%`);
      if (debouncedTitle.trim()) query = query.ilike('title', `%${debouncedTitle}%`);
      if (debouncedCompany.trim()) query = query.ilike('company', `%${debouncedCompany}%`);
      
      if (statusFilter !== 'all') {
        query = query.eq('validation_status', statusFilter);
      } else {
        // Show all leads except invalid ones
        // Use or() to include both valid and null (unverified) leads
        query = query.or('validation_status.is.null,validation_status.neq.invalid');
        query = query.neq('status', 'bounced');
      }

      // Deep Research Filter - only show leads that have passed deep research
      if (researchFilter === 'completed') {
        query = query.eq('research_status', 'completed').not('summary', 'is', null).neq('summary', '');
      } else if (researchFilter === 'pending') {
        query = query.or('research_status.is.null,research_status.neq.completed');
      } else if (researchFilter === 'failed') {
        query = query.in('research_status', ['failed', 'incomplete', 'error']);
      }

      if (requireFullProfile) {
        query = query.not('name', 'is', null).neq('name', '')
                     .not('company', 'is', null).neq('company', '')
                     .not('email', 'is', null).neq('email', '')
                     .not('location', 'is', null).neq('location', '');
      }

      const from = (page - 1) * limit;
      const { data, count, error } = await query
        .order(sortField, { ascending: sortDir === 'asc' })
        .range(from, from + limit - 1);
      if (error) throw error;
      setLeads((data as unknown as Lead[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Selection
  const handleSelectAll = () => {
    setSelectedLeadIds(prev => prev.length === leads.length && leads.length > 0 ? [] : leads.map(l => l.id));
  };

  const handleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleCopyEmail = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    toast({ title: 'Copied', description: email });
  };

  const handleOpenLeadPanel = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setSelectedLeadPanel(prev => prev?.id === lead.id ? null : lead);
  };

  const clearAllFilters = () => {
    setSearch(''); setIndustryFilter(''); setLocationFilter(''); setTitleFilter(''); setCompanyFilter(''); setStatusFilter('all');
  };

  // Bulk Actions
  const handleBulkAddToCampaign = async () => {
    if (!selectedCampaignId) return toast({ title: 'Notice', description: 'Please select a campaign' });
    setAddingToCampaign(true);
    try {
      const insertions = selectedLeadIds.map(leadId => ({ campaign_id: selectedCampaignId, lead_id: leadId, status: 'pending' }));
      const { error } = await supabase.from('campaign_leads').upsert(insertions, { onConflict: 'campaign_id,lead_id' });
      if (error) throw error;
      toast({ title: 'Success', description: `Added ${selectedLeadIds.length} leads to campaign` });
      setSelectedLeadIds([]);
      setSelectedCampaignId('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setAddingToCampaign(false);
    }
  };

  const handleBulkVerifyEmails = async () => {
    setVerifying(true);
    try {
      const selected = leads.filter(l => selectedLeadIds.includes(l.id));
      const updates = selected.map(async (lead) => {
        let status = 'invalid';
        if (lead.email && lead.email.includes('@') && lead.email.includes('.')) {
          status = (lead.email.endsWith('.temp') || lead.email.includes('example')) ? 'catch_all' : 'valid';
        }
        return supabase.from('leads').update({ validation_status: status }).eq('id', lead.id);
      });
      await Promise.all(updates);
      toast({ title: 'Success', description: `Verified ${selectedLeadIds.length} leads` });
      setSelectedLeadIds([]);
      fetchLeads();
      fetchMetrics();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to verify', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const StatusDot = ({ status }: { status?: string }) => {
    const color = status === 'valid' ? 'bg-emerald-500' : status === 'invalid' ? 'bg-rose-500' : status === 'catch_all' ? 'bg-amber-500' : 'bg-white/20';
    return <div className={`w-1.5 h-1.5 rounded-full ${color}`} />;
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-background text-foreground relative animate-in fade-in duration-200">
        
        <div className="p-4 lg:p-8 lg:pb-4 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-6 w-full border-b border-white/5 bg-background z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
              <h1 className="text-4xl font-black text-white tracking-tighter">Lead Searcher</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden p-3 bg-white/[0.03] border border-white/5 rounded-lg text-white/50 hover:text-white transition-colors"
            >
              <Filter size={20} />
            </button>
            <div className="flex items-center gap-4 lg:gap-5 bg-white/[0.03] border border-white/5 rounded-xl px-4 lg:px-5 py-2.5 min-w-max">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Total</span>
                <span className="text-lg font-black text-white tabular-nums">{metrics.totalLeads.toLocaleString()}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest">Valid</span>
                <span className="text-lg font-black text-emerald-400 tabular-nums">{metrics.verifiedEmails.toLocaleString()}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-rose-500/60 uppercase tracking-widest">Invalid</span>
                <span className="text-lg font-black text-rose-400 tabular-nums">{metrics.invalidEmails.toLocaleString()}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">Health</span>
                <span className="text-lg font-black text-blue-400 tabular-nums">{metrics.verificationRate}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex relative">
          
          {/* Mobile Overlay */}
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
          )}

          {/* Sidebar Form */}
          <div className={`
            absolute lg:relative z-50 lg:z-0
            inset-y-0 left-0
            w-[320px] lg:w-[350px] shrink-0
            bg-[#111111] lg:bg-transparent
            border-r border-white/5
            transform transition-transform duration-300 ease-in-out
            ${showMobileFilters ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            flex flex-col
          `}>
            <div className="flex items-center justify-between p-4 border-b border-white/5 lg:hidden">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Filters</h2>
              <button onClick={() => setShowMobileFilters(false)} className="p-2 text-white/50 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 custom-scrollbar">
              
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text"
                    placeholder="Name, email, company..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Role / Title</label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" placeholder="e.g. CEO, Founder" value={titleFilter} onChange={e => setTitleFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Company</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" placeholder="e.g. Apple" value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Industry</label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" placeholder="e.g. Software" value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input type="text" placeholder="e.g. London" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Validation Status</label>
                <select
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                  className="w-full pl-4 pr-4 py-2.5 bg-white/[0.03] border border-white/5 rounded-xl text-sm font-medium text-white focus:outline-none focus:border-primary/40 cursor-pointer transition-colors appearance-none"
                >
                  <option value="all">Any Status</option>
                  <option value="valid">Valid Emails</option>
                  <option value="catch_all">Catch-all Domains</option>
                  <option value="invalid">Invalid Emails</option>
                  <option value="unverified">Unverified</option>
                </select>
              </div>

              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Require Full Profile</span>
                  <button
                    onClick={() => setRequireFullProfile(!requireFullProfile)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none",
                      requireFullProfile ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      requireFullProfile ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
                </div>
                <p className="text-[9px] text-white/30 mt-2 font-medium">Hides leads missing name, email, company, or location, and hides bounces by default.</p>
              </div>

              {activeFilterCount > 0 && (
                <button onClick={clearAllFilters} className="w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-white/70 hover:text-white bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all mt-4">
                  <X size={14} /> Clear {activeFilterCount} Filters
                </button>
              )}
            </div>
            
            <div className="p-4 border-t border-white/5 bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Rows per page</label>
                <select
                  value={limit}
                  onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                  className="py-1 px-2 bg-transparent border-none text-xs font-bold text-white focus:outline-none cursor-pointer text-right appearance-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>

          {/* Data Table Column */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
            <div className="flex-1 overflow-auto relative custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader2 className="w-5 h-5 animate-spin text-primary mb-2" />
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/30">Querying database...</div>
                </div>
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <Search className="w-8 h-8 text-white/10 mb-3" />
                  <div className="text-sm font-bold text-white/40">No records match your filters</div>
                  <button onClick={clearAllFilters} className="mt-4 text-xs font-bold text-primary hover:text-primary/80 uppercase tracking-wider">Clear Filters</button>
                </div>
              ) : (
                <table className="w-full min-w-[1000px] text-left text-[13px] border-collapse">
                  <thead className="bg-[#111] sticky top-0 z-10 border-b border-white/5 shadow-md">
                    <tr>
                      <th className="pl-6 pr-2 py-4 w-10">
                        <div onClick={handleSelectAll} className="cursor-pointer w-max">
                          <CustomCheckbox checked={selectedLeadIds.length === leads.length && leads.length > 0} onChange={() => {}} />
                        </div>
                      </th>
                      <th onClick={() => handleSort('name')} className="px-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none">
                        <div className="flex items-center gap-1.5">Contact <SortIcon field="name" /></div>
                      </th>
                      <th onClick={() => handleSort('company')} className="px-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none">
                        <div className="flex items-center gap-1.5">Company <SortIcon field="company" /></div>
                      </th>
                      <th onClick={() => handleSort('email')} className="px-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none">
                        <div className="flex items-center gap-1.5">Email <SortIcon field="email" /></div>
                      </th>
                      <th onClick={() => handleSort('location')} className="px-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest cursor-pointer hover:text-white/60 transition-colors select-none">
                        <div className="flex items-center gap-1.5">Location <SortIcon field="location" /></div>
                      </th>
                      <th className="pr-6 pl-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const isPanelOpen = selectedLeadPanel?.id === lead.id;
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => handleSelectRow(lead.id)}
                          className={cn(
                            "group cursor-pointer transition-colors border-b border-white/[0.03]",
                            isSelected ? 'bg-primary/[0.06] border-l-2 border-l-primary' : isPanelOpen ? 'bg-white/[0.04] border-l-2 border-l-transparent' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                          )}
                        >
                          <td className="pl-6 pr-2 py-3 w-10">
                            <CustomCheckbox checked={isSelected} onChange={() => {}} />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-[10px] font-black text-white/40 uppercase shrink-0">
                                {(lead.name || '?')[0]}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate max-w-[180px]">{lead.name || 'Unknown'}</div>
                                <div className="text-[11px] text-white/30 truncate max-w-[180px]">{lead.title || '—'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-white/80 truncate max-w-[160px]">{lead.company || '—'}</div>
                            <div className="text-[11px] text-white/25 truncate max-w-[160px]">{lead.industry || '—'}</div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2 group/email">
                              <span className="font-mono text-[12px] text-white/70 truncate max-w-[200px]">{lead.email}</span>
                              <button onClick={(e) => handleCopyEmail(e, lead.email)} className="opacity-0 group-hover/email:opacity-100 text-white/20 hover:text-white transition-all" title="Copy">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-white/40 text-xs">{lead.location || '—'}</span>
                          </td>
                          <td className="pr-6 pl-3 py-3 text-right">
                            <div className="flex justify-end">
                              <button 
                                onClick={(e) => handleOpenLeadPanel(e, lead)}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border",
                                  isPanelOpen ? "bg-white/10 text-white border-white/10" : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border-white/5"
                                )}
                              >
                                View <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            <div className="flex items-center justify-between px-4 lg:px-8 py-2.5 border-t border-white/5 bg-[#111] text-xs shrink-0 relative z-10">
              <div className="flex items-center gap-4">
                <span className="text-white/30 font-bold uppercase tracking-widest text-[10px]">
                  {((page - 1) * limit) + 1}–{Math.min(page * limit, totalCount)} of {totalCount.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={page === 1 || loading} className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-all font-bold text-[10px] uppercase tracking-wider">
                  First
                </button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button key={pageNum} onClick={() => setPage(pageNum)} className={cn(
                      "w-7 h-7 rounded text-xs font-bold transition-all",
                      page === pageNum ? "bg-primary/20 text-primary" : "text-white/30 hover:text-white hover:bg-white/5"
                    )}>
                      {pageNum}
                    </button>
                  );
                })}
                
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || loading} className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(totalPages)} disabled={page >= totalPages || loading} className="px-2 py-1 rounded text-white/40 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent transition-all font-bold text-[10px] uppercase tracking-wider">
                  Last
                </button>
              </div>
            </div>
          </div>

          {/* Right Side Lead Panel */}
          {selectedLeadPanel && (
            <div className="w-0 xl:w-[400px] shrink-0 bg-[#0A0A0A] border-l border-white/10 animate-in slide-in-from-right-8 duration-200 z-40 flex flex-col h-full shadow-2xl relative">
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center text-sm font-black text-white/60 uppercase">
                    {(selectedLeadPanel.name || '?')[0]}
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-black text-white tracking-tight truncate max-w-[200px]" title={selectedLeadPanel.name}>{selectedLeadPanel.name || 'Unknown'}</h3>
                    <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest truncate max-w-[200px]" title={selectedLeadPanel.title}>{selectedLeadPanel.title || 'No Title'}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedLeadPanel(null)} className="p-2 text-white/30 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                
                {/* Contact Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Contact Information</h4>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-3">
                        <MailCheck className="w-4 h-4 text-white/30" />
                        <span className="text-sm font-mono text-white/80">{selectedLeadPanel.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusDot status={selectedLeadPanel.validation_status} />
                        <span className={cn("text-[9px] font-bold uppercase tracking-widest",
                          selectedLeadPanel.validation_status === 'valid' ? 'text-emerald-400' :
                          selectedLeadPanel.validation_status === 'invalid' ? 'text-rose-400' :
                          selectedLeadPanel.validation_status === 'catch_all' ? 'text-amber-400' : 'text-white/25'
                        )}>
                          {selectedLeadPanel.validation_status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    {selectedLeadPanel.phone && (
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <Phone className="w-4 h-4 text-white/30" />
                        <span className="text-sm font-medium text-white/80">{selectedLeadPanel.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company Details */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Company Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Company</span>
                      <span className="text-sm font-semibold text-white/80 truncate" title={selectedLeadPanel.company}>{selectedLeadPanel.company || '—'}</span>
                    </div>
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Location</span>
                      <span className="text-sm font-semibold text-white/80 truncate" title={selectedLeadPanel.location}>{selectedLeadPanel.location || '—'}</span>
                    </div>
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Industry</span>
                      <span className="text-sm font-semibold text-white/80 truncate" title={selectedLeadPanel.industry}>{selectedLeadPanel.industry || '—'}</span>
                    </div>
                    <div className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1">
                      <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider">Employees</span>
                      <span className="text-sm font-semibold text-white/80 truncate">{selectedLeadPanel.employees || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                {(selectedLeadPanel.linkedin || selectedLeadPanel.website) && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Links & Socials</h4>
                    <div className="flex gap-2 flex-wrap">
                      {selectedLeadPanel.linkedin && (
                        <a href={selectedLeadPanel.linkedin} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-3 rounded-xl bg-[#0077b5]/10 border border-[#0077b5]/20 text-[#0077b5] hover:bg-[#0077b5]/20 transition-all font-bold text-xs uppercase tracking-wider">
                          <Linkedin size={14} /> LinkedIn
                        </a>
                      )}
                      {selectedLeadPanel.website && (
                        <a href={`https://${selectedLeadPanel.website.replace(/https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[120px] flex items-center justify-center gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all font-bold text-xs uppercase tracking-wider">
                          <Globe size={14} /> Website
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Deep Research */}
                {selectedLeadPanel.summary && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Deep Research</h4>
                      {selectedLeadPanel.research_status && (
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                          selectedLeadPanel.research_status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                          selectedLeadPanel.research_status === 'error' ? 'bg-rose-500/10 text-rose-400' :
                          'bg-amber-500/10 text-amber-400'
                        )}>
                          {selectedLeadPanel.research_status}
                        </span>
                      )}
                    </div>
                    <div className="text-xs leading-relaxed text-white/60 p-4 rounded-xl bg-white/[0.02] border border-white/5 whitespace-pre-wrap">
                      {selectedLeadPanel.summary}
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        {/* Floating Action Toolbar */}
        {selectedLeadIds.length > 0 && (
          <div className="fixed bottom-20 xl:bottom-10 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-white/10 shadow-2xl shadow-black/60 rounded-2xl px-4 lg:px-6 py-3 flex items-center gap-3 lg:gap-5 animate-in slide-in-from-bottom-8 fade-in duration-200 min-w-max w-[95%] sm:w-auto overflow-x-auto hide-scrollbar">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">{selectedLeadIds.length}</div>
              <span className="text-xs font-bold text-white uppercase tracking-wider">Selected</span>
            </div>
            
            <div className="h-6 w-px bg-white/10" />
            
            <button onClick={handleBulkVerifyEmails} disabled={verifying} className="text-xs font-bold text-white/70 hover:text-emerald-400 transition-colors flex items-center gap-2 disabled:opacity-40 uppercase tracking-wider">
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Verify
            </button>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center gap-2.5">
              <select
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="bg-transparent border border-white/10 rounded-lg outline-none text-xs font-medium text-white focus:ring-0 w-36 cursor-pointer truncate px-2 py-1.5"
              >
                <option value="">Campaign...</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={handleBulkAddToCampaign} disabled={addingToCampaign || !selectedCampaignId} size="sm" className="h-7 rounded-lg px-4 text-[10px] font-black uppercase tracking-wider">
                {addingToCampaign ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Add
              </Button>
            </div>
            
            <button onClick={() => setSelectedLeadIds([])} className="ml-2 w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all">
              <X size={11}/>
            </button>
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
};

export default Discover;

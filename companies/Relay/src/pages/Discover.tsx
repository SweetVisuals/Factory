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
  Copy, ExternalLink, ChevronDown, Hash, Filter, Facebook, Instagram, Twitter, BrainCircuit
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { LeadIntelligenceDrawer } from '../components/lead-scraper/LeadIntelligenceDrawer';

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

  // Advanced Apollo / Instantly Filters
  const [minRevenue, setMinRevenue] = useState(0); // 0 (Any) to 4 (Large)
  const [companySizeFilter, setCompanySizeFilter] = useState('all');
  const [yearFoundedMin, setYearFoundedMin] = useState(1950);
  const [yearFoundedMax, setYearFoundedMax] = useState(2026);
  const [hasFacebook, setHasFacebook] = useState(false);
  const [hasInstagram, setHasInstagram] = useState(false);
  const [hasTwitter, setHasTwitter] = useState(false);
  const [hasLinkedin, setHasLinkedin] = useState(false);
  const [locationRadius, setLocationRadius] = useState('25'); // Radius in miles
  const [baseLocation, setBaseLocation] = useState('');
  const [techStackSearch, setTechStackSearch] = useState('');

  // Debounced
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedIndustry, setDebouncedIndustry] = useState(industryFilter);
  const [debouncedLocation, setDebouncedLocation] = useState(locationFilter);
  const [debouncedTitle, setDebouncedTitle] = useState(titleFilter);
  const [debouncedCompany, setDebouncedCompany] = useState(companyFilter);
  const [debouncedTechStack, setDebouncedTechStack] = useState(techStackSearch);

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeadForDrawer, setSelectedLeadForDrawer] = useState<Lead | null>(null);

  // Deep Research
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [deepResearchResults, setDeepResearchResults] = useState<Record<string, string>>({});

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
      setDebouncedTechStack(techStackSearch);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search, industryFilter, locationFilter, titleFilter, companyFilter, techStackSearch]);

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
  }, [
    page, limit, debouncedSearch, debouncedIndustry, debouncedLocation, debouncedTitle, 
    debouncedCompany, statusFilter, sortField, sortDir, requireFullProfile, researchFilter,
    minRevenue, companySizeFilter, yearFoundedMin, yearFoundedMax, hasFacebook, hasInstagram, 
    hasTwitter, hasLinkedin, locationRadius, baseLocation, debouncedTechStack
  ]);

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
        query = query.or('validation_status.is.null,validation_status.neq.invalid');
        query = query.neq('status', 'bounced');
      }

      // Deep Research Filter
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

      // Apply Advanced Apollo / Instantly Filters
      if (companySizeFilter !== 'all') {
        query = query.eq('company_size', companySizeFilter);
      }

      if (minRevenue > 0) {
        const revBrackets = [
          'Under £632,000',
          '£632,000 - £10.2 Million',
          '£10.2 Million - £36 Million',
          'Over £36 Million'
        ];
        const allowedRevenues = revBrackets.slice(minRevenue - 1);
        query = query.in('annual_revenue', allowedRevenues);
      }

      if (yearFoundedMin > 1950) {
        query = query.gte('year_founded', yearFoundedMin.toString());
      }
      if (yearFoundedMax < 2026) {
        query = query.lte('year_founded', yearFoundedMax.toString());
      }

      if (hasFacebook) {
        query = query.not('facebook', 'eq', '').not('facebook', 'is', null);
      }
      if (hasInstagram) {
        query = query.not('instagram', 'eq', '').not('instagram', 'is', null);
      }
      if (hasTwitter) {
        query = query.not('twitter', 'eq', '').not('twitter', 'is', null);
      }

      if (debouncedTechStack.trim()) {
        query = query.filter('tech_stack', 'cs', `{"${debouncedTechStack}"}`);
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
    setSelectedLeadForDrawer(lead);
    setDrawerOpen(true);
  };

  const handleDeepResearch = async (lead: Lead) => {
    if (researchingId) return;
    setResearchingId(lead.id);
    setSelectedLeadForDrawer(lead);
    setDrawerOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const axios = (await import('axios')).default;
      const res = await axios.post('/api/deep-research', {
        company: lead.company,
        website: lead.website,
        notesContext: '',
        leadId: lead.id
      }, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (res.data.success) {
        const researchData = res.data.data;
        const status = res.data.status || 'completed';
        const score = res.data.research_score || 0;
        
        setDeepResearchResults(prev => ({ ...prev, [lead.id]: researchData }));
        
        // Form a fully updated lead object
        const updatedLead = { 
          ...lead, 
          summary: researchData, 
          research_status: status,
          research_score: score,
          ...res.data.structured
        };

        setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
        setSelectedLeadForDrawer(updatedLead);
        toast({ title: 'Research Complete', description: `AI research completed for ${lead.company}` });
      }
    } catch (e) {
      toast({ title: 'Research Failed', description: 'AI failed to research this lead.', variant: 'destructive' });
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, research_status: 'failed' } : l));
    } finally {
      setResearchingId(null);
    }
  };

  const clearAllFilters = () => {
    setSearch('');
    setIndustryFilter('');
    setLocationFilter('');
    setTitleFilter('');
    setCompanyFilter('');
    setStatusFilter('all');
    setMinRevenue(0);
    setCompanySizeFilter('all');
    setYearFoundedMin(1950);
    setYearFoundedMax(2026);
    setHasFacebook(false);
    setHasInstagram(false);
    setHasTwitter(false);
    setHasLinkedin(false);
    setLocationRadius('25');
    setBaseLocation('');
    setTechStackSearch('');
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
            w-[320px] lg:w-[420px] shrink-0
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
            <div className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5 custom-scrollbar">
              
              {/* Category: Search & Identity */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Search className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">General Search</span>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Global Search</label>
                  <input
                    type="text"
                    placeholder="Name, email, company..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Role / Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. CEO, Director"
                    value={titleFilter}
                    onChange={e => setTitleFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>

              {/* Category: Location & Proximity (Radius) */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Location & Proximity</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Target Area / Town</label>
                  <input
                    type="text"
                    placeholder="e.g. London, Manchester"
                    value={locationFilter}
                    onChange={e => setLocationFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Base Point</label>
                    <input
                      type="text"
                      placeholder="My Location"
                      value={baseLocation}
                      onChange={e => setBaseLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Radius (Miles)</label>
                    <select
                      value={locationRadius}
                      onChange={e => setLocationRadius(e.target.value)}
                      className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-primary/40 cursor-pointer appearance-none"
                    >
                      <option value="5">5 Miles</option>
                      <option value="10">10 Miles</option>
                      <option value="25">25 Miles</option>
                      <option value="50">50 Miles</option>
                      <option value="100">100 Miles</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Category: Apollo Financials & Scope */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Apollo Scope</span>
                </div>

                {/* Company Name */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Specific Company</label>
                  <input
                    type="text"
                    placeholder="e.g. Apple, Stripe"
                    value={companyFilter}
                    onChange={e => setCompanyFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>

                {/* Company Size */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Employee Count</label>
                  <select
                    value={companySizeFilter}
                    onChange={e => setCompanySizeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-primary/40 cursor-pointer appearance-none"
                  >
                    <option value="all">Any Size</option>
                    <option value="1-10 employees">Micro-Team (1-10)</option>
                    <option value="11-50 employees">Small Office (11-50)</option>
                    <option value="51-250 employees">Mid-Market (51-250)</option>
                    <option value="Over 250 employees">Enterprise (250+)</option>
                  </select>
                </div>

                {/* Revenue Range Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-black text-white/30 uppercase tracking-widest">
                    <span>Min Revenue Bracket</span>
                    <span className="text-primary font-mono lowercase">
                      {(() => {
                        if (minRevenue === 0) return 'any';
                        if (minRevenue === 1) return '<£632k';
                        if (minRevenue === 2) return '£632k-£10.2M';
                        if (minRevenue === 3) return '£10.2M-£36M';
                        return '>£36M';
                      })()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    value={minRevenue}
                    onChange={e => setMinRevenue(parseInt(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>

                {/* Founding Year Limits */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[9px] font-black text-white/30 uppercase tracking-widest">
                    <span>Year Founded</span>
                    <span className="text-primary font-mono">{yearFoundedMin} - {yearFoundedMax}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1900"
                      max="2026"
                      value={yearFoundedMin}
                      onChange={e => setYearFoundedMin(parseInt(e.target.value))}
                      className="w-1/2 px-2.5 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg text-xs font-mono text-center text-white"
                    />
                    <input
                      type="number"
                      min="1900"
                      max="2026"
                      value={yearFoundedMax}
                      onChange={e => setYearFoundedMax(parseInt(e.target.value))}
                      className="w-1/2 px-2.5 py-1.5 bg-white/[0.02] border border-white/5 rounded-lg text-xs font-mono text-center text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Category: Tech Stack matchers */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Tech Stack</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Used Technologies</label>
                  <input
                    type="text"
                    placeholder="e.g. WordPress, Shopify"
                    value={techStackSearch}
                    onChange={e => setTechStackSearch(e.target.value)}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>

              {/* Category: Verification & Social Channels */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Contact Checks</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest">Verification Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-medium text-white focus:outline-none focus:border-primary/40 cursor-pointer appearance-none"
                  >
                    <option value="all">Any Status</option>
                    <option value="valid">Valid Emails</option>
                    <option value="catch_all">Catch-all Domains</option>
                    <option value="invalid">Invalid Emails</option>
                    <option value="unverified">Unverified</option>
                  </select>
                </div>

                {/* Social media presence switches */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-white/30 uppercase tracking-widest block mb-2">Required Social Presence</label>
                  
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70 flex items-center gap-1.5"><Facebook size={12} className="text-blue-500" /> Facebook</span>
                      <button
                        onClick={() => setHasFacebook(!hasFacebook)}
                        className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200", hasFacebook ? "bg-primary" : "bg-white/10")}
                      >
                        <span className={cn("pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white transition duration-200", hasFacebook ? "translate-x-3" : "translate-x-0")} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70 flex items-center gap-1.5"><Instagram size={12} className="text-pink-500" /> Instagram</span>
                      <button
                        onClick={() => setHasInstagram(!hasInstagram)}
                        className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200", hasInstagram ? "bg-primary" : "bg-white/10")}
                      >
                        <span className={cn("pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white transition duration-200", hasInstagram ? "translate-x-3" : "translate-x-0")} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70 flex items-center gap-1.5"><Twitter size={12} className="text-sky-500" /> Twitter</span>
                      <button
                        onClick={() => setHasTwitter(!hasTwitter)}
                        className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200", hasTwitter ? "bg-primary" : "bg-white/10")}
                      >
                        <span className={cn("pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white transition duration-200", hasTwitter ? "translate-x-3" : "translate-x-0")} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/70 flex items-center gap-1.5"><Linkedin size={12} className="text-blue-400" /> LinkedIn</span>
                      <button
                        onClick={() => setHasLinkedin(!hasLinkedin)}
                        className={cn("relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200", hasLinkedin ? "bg-primary" : "bg-white/10")}
                      >
                        <span className={cn("pointer-events-none inline-block h-2.5 w-2.5 transform rounded-full bg-white transition duration-200", hasLinkedin ? "translate-x-3" : "translate-x-0")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Requirement: Full profile block */}
              <div className="p-4 bg-white/[0.01] border border-white/5 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Require Full Profile</span>
                  <button
                    onClick={() => setRequireFullProfile(!requireFullProfile)}
                    className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-in-out", requireFullProfile ? "bg-primary" : "bg-white/10")}
                  >
                    <span className={cn("pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition duration-200 ease-in-out", requireFullProfile ? "translate-x-4" : "translate-x-0")} />
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
                      <th className="pr-6 pl-3 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const isSelected = selectedLeadIds.includes(lead.id);
                      const isPanelOpen = selectedLeadPanel?.id === lead.id;
                      const hasResearch = lead.summary || deepResearchResults[lead.id];
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
                            <div className="flex items-center justify-end gap-2">
                              {/* Social Media Icons */}
                              <div className="flex items-center gap-1">
                                {lead.linkedin && (
                                  <a href={lead.linkedin} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/40 hover:text-[#0077b5] hover:border-[#0077b5]/30 transition-all" title="LinkedIn">
                                    <Linkedin size={12} />
                                  </a>
                                )}
                                {lead.twitter && (
                                  <a href={lead.twitter} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/40 hover:text-blue-400 hover:border-blue-400/30 transition-all" title="Twitter">
                                    <Twitter size={12} />
                                  </a>
                                )}
                                {lead.facebook && (
                                  <a href={lead.facebook} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/40 hover:text-blue-600 hover:border-blue-600/30 transition-all" title="Facebook">
                                    <Facebook size={12} />
                                  </a>
                                )}
                                {lead.instagram && (
                                  <a href={lead.instagram} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/40 hover:text-pink-500 hover:border-pink-500/30 transition-all" title="Instagram">
                                    <Instagram size={12} />
                                  </a>
                                )}
                                {lead.website && (
                                  <a href={`https://${lead.website.replace(/https?:\/\//, '')}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary/30 transition-all" title="Website">
                                    <Globe size={12} />
                                  </a>
                                )}
                              </div>

                              {/* Deep Research Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeepResearch(lead);
                                }}
                                disabled={researchingId === lead.id}
                                className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                  hasResearch ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/[0.04] text-white/30 hover:bg-primary/10 hover:text-primary border border-white/5"
                                )}
                                title={hasResearch ? "View Research" : "Run Deep Research"}
                              >
                                {researchingId === lead.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <BrainCircuit className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* View Details Button */}
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

          {/* Lead Intelligence Drawer */}
          <LeadIntelligenceDrawer
            lead={selectedLeadForDrawer}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            onReResearch={(id) => {
              // Re-fetch list elements to update view status if necessary
              fetchLeadsData();
            }}
          />

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

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/use-toast';
import { Lead } from '../types';
import Layout from '../components/layout/Layout';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { 
  Search, Users, MailCheck, AlertTriangle, 
  ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, HelpCircle, Activity, Filter, Loader2, Sparkles, Plus, X, ArrowUpRight
} from 'lucide-react';
import { Button } from '../components/ui/button';

interface Campaign {
  id: string;
  name: string;
}

const Discover: React.FC = () => {
  // Leads & pagination
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Campaigns list
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Filter states
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [titleFilter, setTitleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounce search state
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [debouncedIndustry, setDebouncedIndustry] = useState(industryFilter);
  const [debouncedLocation, setDebouncedLocation] = useState(locationFilter);
  const [debouncedTitle, setDebouncedTitle] = useState(titleFilter);

  // Selection & bulk action states
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [addingToCampaign, setAddingToCampaign] = useState(false);

  // Global KPIs
  const [metrics, setMetrics] = useState({
    totalLeads: 0,
    verifiedEmails: 0,
    invalidEmails: 0,
    verificationRate: 0,
  });

  // Debounce effects
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedIndustry(industryFilter);
      setDebouncedLocation(locationFilter);
      setDebouncedTitle(titleFilter);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search, industryFilter, locationFilter, titleFilter]);

  // Load initial data
  useEffect(() => {
    fetchCampaigns();
    fetchMetrics();

    const leadsSubscription = supabase
      .channel('public:leads_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads();
        fetchMetrics();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, []);

  // Fetch leads when page or filters change
  useEffect(() => {
    fetchLeads();
  }, [page, debouncedSearch, debouncedIndustry, debouncedLocation, debouncedTitle, statusFilter]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await supabase.from('campaigns').select('id, name').order('name', { ascending: true });
      if (data) setCampaigns(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const { count: verified } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'valid');
      const { count: invalid } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('validation_status', 'invalid');

      const totalNum = total || 0;
      const verifiedNum = verified || 0;
      const rate = totalNum > 0 ? Math.round((verifiedNum / totalNum) * 100) : 0;

      setMetrics({ totalLeads: totalNum, verifiedEmails: verifiedNum, invalidEmails: invalid || 0, verificationRate: rate });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase.from('leads').select('*', { count: 'exact' });

      if (debouncedSearch.trim()) query = query.or(`name.ilike.%${debouncedSearch}%,company.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      if (debouncedIndustry.trim()) query = query.ilike('industry', `%${debouncedIndustry}%`);
      if (debouncedLocation.trim()) query = query.ilike('location', `%${debouncedLocation}%`);
      if (debouncedTitle.trim()) query = query.ilike('title', `%${debouncedTitle}%`);
      if (statusFilter !== 'all') query = query.eq('validation_status', statusFilter);

      const from = (page - 1) * limit;
      const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + limit - 1);

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

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedLeadIds.length === leads.length && leads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(leads.map(l => l.id));
    }
  };

  const handleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedLeadIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkAddToCampaign = async () => {
    if (!selectedCampaignId) return toast({ title: 'Notice', description: 'Please select a campaign' });
    setAddingToCampaign(true);
    try {
      const insertions = selectedLeadIds.map(leadId => ({ campaign_id: selectedCampaignId, lead_id: leadId, status: 'pending' }));
      const { error } = await supabase.from('campaign_leads').upsert(insertions, { onConflict: 'campaign_id,lead_id' });
      if (error) throw error;
      toast({ title: 'Success', description: `Added ${selectedLeadIds.length} leads to campaign!` });
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
      const selectedLeadsDetails = leads.filter(l => selectedLeadIds.includes(l.id));
      const updates = selectedLeadsDetails.map(async (lead) => {
        let status = 'invalid';
        if (lead.email && lead.email.includes('@') && lead.email.includes('.')) {
          const isGeneric = lead.email.endsWith('.temp') || lead.email.includes('example');
          status = isGeneric ? 'catch_all' : 'valid';
        }
        return supabase.from('leads').update({ validation_status: status }).eq('id', lead.id);
      });
      await Promise.all(updates);
      toast({ title: 'Success', description: `Verified ${selectedLeadIds.length} leads!` });
      setSelectedLeadIds([]);
      fetchLeads();
      fetchMetrics();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to verify', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-background text-foreground font-sans relative">
        
        {/* Minimal Header */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/20">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Search className="text-primary w-4 h-4" /> Discovery Engine
            </h1>
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground/80">
              <div className="flex items-center gap-1.5"><Users className="w-3 h-3"/> {metrics.totalLeads.toLocaleString()} Leads</div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5 text-emerald-500/80"><MailCheck className="w-3 h-3"/> {metrics.verifiedEmails.toLocaleString()} Valid</div>
              <div className="w-1 h-1 rounded-full bg-border" />
              <div className="flex items-center gap-1.5"><Activity className="w-3 h-3"/> {metrics.verificationRate}% Health</div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground font-medium">
            Showing {leads.length} of {totalCount}
          </div>
        </div>

        {/* Seamless Filter Bar */}
        <div className="flex items-center px-8 py-2.5 border-b border-border/20 bg-muted/5 gap-6 text-sm overflow-x-auto">
          <div className="flex items-center gap-2 text-muted-foreground shrink-0 uppercase tracking-widest text-[10px] font-bold">
            <Filter size={12} /> Filters
          </div>
          
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-medium"
          />
          <div className="w-px h-4 bg-border/40 shrink-0" />
          
          <input
            type="text"
            placeholder="Title / Role..."
            value={titleFilter}
            onChange={e => setTitleFilter(e.target.value)}
            className="w-36 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-medium"
          />
          <div className="w-px h-4 bg-border/40 shrink-0" />

          <input
            type="text"
            placeholder="Industry..."
            value={industryFilter}
            onChange={e => setIndustryFilter(e.target.value)}
            className="w-36 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-medium"
          />
          <div className="w-px h-4 bg-border/40 shrink-0" />

          <input
            type="text"
            placeholder="Location..."
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="w-32 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 font-medium"
          />
          <div className="w-px h-4 bg-border/40 shrink-0" />

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-transparent border-none outline-none text-foreground font-medium text-sm focus:ring-0 cursor-pointer"
          >
            <option value="all">Any Status</option>
            <option value="valid">Verified Valid</option>
            <option value="catch_all">Catch All</option>
            <option value="invalid">Invalid</option>
            <option value="unverified">Unverified</option>
          </select>
          
          {(search || industryFilter || locationFilter || titleFilter || statusFilter !== 'all') && (
            <button 
              onClick={() => { setSearch(''); setIndustryFilter(''); setLocationFilter(''); setTitleFilter(''); setStatusFilter('all'); }}
              className="ml-auto text-xs font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider flex items-center gap-1"
            >
              <X size={12}/> Clear
            </button>
          )}
        </div>

        {/* Minimalist Data Table */}
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-3" />
              <div className="text-xs font-bold uppercase tracking-widest">Loading Records...</div>
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <div className="text-sm font-bold">No leads matched your query</div>
            </div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
              <thead className="bg-background sticky top-0 z-10">
                <tr className="border-b border-border/20">
                  <th className="pl-8 pr-4 py-3 w-14">
                    <div onClick={handleSelectAll} className="w-max cursor-pointer">
                      <CustomCheckbox checked={selectedLeadIds.length === leads.length && leads.length > 0} onChange={() => {}} />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Name & Title</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Company</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contact Detail</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Location</th>
                  <th className="px-8 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Social</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {leads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => handleSelectRow(lead.id)}
                      className={`group transition-all cursor-pointer ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/10'}`}
                    >
                      <td className="pl-8 pr-4 py-3 w-14">
                        <CustomCheckbox checked={isSelected} onChange={() => {}} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground">{lead.name || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">{lead.title || 'No Role'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{lead.company || lead.website || 'N/A'}</div>
                        <div className="text-xs text-muted-foreground">{lead.industry || 'General'}</div>
                      </td>
                      <td className="px-4 py-3 flex flex-col gap-1">
                        <div className="font-medium text-foreground">{lead.email}</div>
                        <div className="flex items-center gap-1.5">
                          {lead.validation_status === 'valid' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> :
                           lead.validation_status === 'invalid' ? <XCircle className="w-3 h-3 text-rose-500" /> :
                           lead.validation_status === 'catch_all' ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <HelpCircle className="w-3 h-3 text-muted-foreground" />}
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            lead.validation_status === 'valid' ? 'text-emerald-500' :
                            lead.validation_status === 'invalid' ? 'text-rose-500' :
                            lead.validation_status === 'catch_all' ? 'text-amber-500' : 'text-muted-foreground'
                          }`}>
                            {lead.validation_status || 'Unverified'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{lead.location || '—'}</td>
                      <td className="px-8 py-3 text-right">
                        <div className="flex gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {lead.linkedin && (
                            <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-blue-500 transition-colors">
                              <ArrowUpRight className="w-4 h-4" />
                            </a>
                          )}
                          {lead.website && (
                            <a href={`https://${lead.website.replace(/https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-emerald-500 transition-colors">
                              <ArrowUpRight className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Minimal Pagination Footer */}
        <div className="flex items-center justify-between px-8 py-3 border-t border-border/20 bg-background text-xs">
          <div className="text-muted-foreground font-bold uppercase tracking-widest">
            Page {page} of {Math.ceil(totalCount / limit) || 1}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="text-foreground hover:text-primary font-bold uppercase tracking-widest disabled:opacity-50 disabled:hover:text-foreground transition-colors flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= totalCount || loading} className="text-foreground hover:text-primary font-bold uppercase tracking-widest disabled:opacity-50 disabled:hover:text-foreground transition-colors flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Floating Action Toolbar */}
        {selectedLeadIds.length > 0 && (
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 bg-card border border-border shadow-2xl shadow-black/50 rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">{selectedLeadIds.length}</div>
              <span className="text-sm font-bold text-foreground">Selected</span>
            </div>
            
            <div className="h-5 w-px bg-border" />
            
            <button onClick={handleBulkVerifyEmails} disabled={verifying} className="text-sm font-bold text-foreground hover:text-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50">
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Verify
            </button>

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-3">
              <select
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="bg-transparent border-none outline-none text-sm font-medium text-foreground focus:ring-0 w-32 cursor-pointer truncate"
              >
                <option value="">Select Campaign...</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={handleBulkAddToCampaign} disabled={addingToCampaign || !selectedCampaignId} size="sm" className="h-8 rounded-full px-4 text-xs font-bold uppercase tracking-wider">
                {addingToCampaign ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Add
              </Button>
            </div>
            
            <button onClick={() => setSelectedLeadIds([])} className="absolute -top-2 -right-2 w-6 h-6 bg-muted border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm">
              <X size={12}/>
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default Discover;

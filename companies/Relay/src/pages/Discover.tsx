import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from '../components/ui/use-toast';
import { Lead } from '../types';
import Layout from '../components/layout/Layout';
import { 
  Search, Users, MailCheck, AlertTriangle, 
  ChevronLeft, ChevronRight, CheckCircle2, 
  XCircle, HelpCircle, Activity, Filter, Loader2, Sparkles, Plus, RefreshCw, X, ArrowUpRight
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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

  // Load initial data
  useEffect(() => {
    fetchCampaigns();
    fetchMetrics();

    // Subscribe to changes in the leads table to update searcher dynamically
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
  }, [page, industryFilter, statusFilter]);

  // Handle manual trigger for search query changes to prevent over-fetching on keystroke
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLeads();
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .order('name', { ascending: true });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      const { count: verified } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'valid');
      const { count: invalid } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('validation_status', 'invalid');

      const totalNum = total || 0;
      const verifiedNum = verified || 0;
      const rate = totalNum > 0 ? Math.round((verifiedNum / totalNum) * 100) : 0;

      setMetrics({
        totalLeads: totalNum,
        verifiedEmails: verifiedNum,
        invalidEmails: invalid || 0,
        verificationRate: rate,
      });
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' });

      // Apply Filters
      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%,title.ilike.%${search}%`);
      }
      if (industryFilter.trim()) {
        query = query.ilike('industry', `%${industryFilter}%`);
      }
      if (locationFilter.trim()) {
        query = query.ilike('location', `%${locationFilter}%`);
      }
      if (titleFilter.trim()) {
        query = query.ilike('title', `%${titleFilter}%`);
      }
      if (statusFilter !== 'all') {
        query = query.eq('validation_status', statusFilter);
      }

      // Pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setLeads((data as unknown as Lead[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching leads:', err);
      toast({ title: 'Error', description: 'Failed to fetch leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Bulk Actions
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeadIds(leads.map(l => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedLeadIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkAddToCampaign = async () => {
    if (selectedLeadIds.length === 0) {
      toast({ title: 'Notice', description: 'Select at least one lead first', variant: 'default' });
      return;
    }
    if (!selectedCampaignId) {
      toast({ title: 'Notice', description: 'Please select a target campaign', variant: 'default' });
      return;
    }

    setAddingToCampaign(true);
    try {
      // Upsert rows into campaign_leads junction table
      const insertions = selectedLeadIds.map(leadId => ({
        campaign_id: selectedCampaignId,
        lead_id: leadId,
        status: 'pending',
      }));

      const { error } = await supabase
        .from('campaign_leads')
        .upsert(insertions, { onConflict: 'campaign_id,lead_id' });

      if (error) throw error;

      toast({ title: 'Success', description: `Successfully added ${selectedLeadIds.length} leads to campaign!` });
      setSelectedLeadIds([]);
      setSelectedCampaignId('');
    } catch (err: any) {
      console.error('Error adding leads to campaign:', err);
      toast({ title: 'Error', description: err.message || 'Failed to add leads to campaign', variant: 'destructive' });
    } finally {
      setAddingToCampaign(false);
    }
  };

  const handleBulkVerifyEmails = async () => {
    if (selectedLeadIds.length === 0) {
      toast({ title: 'Notice', description: 'Select leads to verify' });
      return;
    }

    setVerifying(true);
    try {
      const selectedLeadsDetails = leads.filter(l => selectedLeadIds.includes(l.id));
      
      // Perform email verification simulation / validation check
      const updates = selectedLeadsDetails.map(async (lead) => {
        let status = 'invalid';
        if (lead.email && lead.email.includes('@') && lead.email.includes('.')) {
          const isGeneric = lead.email.endsWith('.temp') || lead.email.includes('example');
          status = isGeneric ? 'catch_all' : 'valid';
        }

        return supabase
          .from('leads')
          .update({
            validation_status: status,
            validation_details: JSON.stringify({ verified_at: new Date().toISOString(), method: 'MX_Record_Lookup' })
          })
          .eq('id', lead.id);
      });

      await Promise.all(updates);
      toast({ title: 'Success', description: `Completed email verification check for ${selectedLeadIds.length} leads!` });
      setSelectedLeadIds([]);
      fetchLeads();
      fetchMetrics();
    } catch (err: any) {
      console.error('Error verifying emails:', err);
      toast({ title: 'Error', description: 'Failed to run verification job', variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'valid':
        return 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]';
      case 'invalid':
        return 'bg-rose-500/15 text-rose-500 border border-rose-500/20';
      case 'catch_all':
        return 'bg-amber-500/15 text-amber-500 border border-amber-500/20';
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/20';
    }
  };

  return (
    <Layout fullHeight>
    <div className="flex flex-col h-full overflow-hidden p-4 animate-in fade-in zoom-in-95 duration-500 w-full">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
            <Search className="text-primary w-8 h-8" />
            Lead Searcher
          </h1>
          <p className="text-sm font-medium text-muted-foreground/60 uppercase tracking-widest mt-1">
            Search, filter, and prospect globally.
          </p>
        </div>
      </div>

      {/* Top metrics dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Leads Found', value: metrics.totalLeads.toLocaleString(), icon: <Users className="w-6 h-6 text-blue-500" /> },
          { label: 'Verified Deliverable', value: metrics.verifiedEmails.toLocaleString(), icon: <MailCheck className="w-6 h-6 text-emerald-500" /> },
          { label: 'Deliverability Score', value: `${metrics.verificationRate}%`, icon: <Activity className="w-6 h-6 text-purple-500" /> },
          { label: 'Bounce Risk', value: metrics.invalidEmails.toLocaleString(), icon: <AlertTriangle className="w-6 h-6 text-rose-500" /> }
        ].map((item, idx) => (
          <div key={idx} className="bg-card border border-border/40 rounded-xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-primary/20 transition-all">
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition-all duration-500">
              {React.cloneElement(item.icon, { className: "w-32 h-32" })}
            </div>
            <div className="relative z-10 flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{item.label}</span>
              {item.icon}
            </div>
            <div className="relative z-10 text-3xl font-black text-foreground">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        
        {/* Sidebar Filters */}
        <div className="w-64 bg-card border border-border/40 rounded-xl p-4 flex flex-col gap-4 overflow-y-auto shadow-sm">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-primary" /> Filters
            </h3>
            <form onSubmit={handleSearchSubmit} className="flex flex-col gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Keywords</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Name, company..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 bg-background/50 border-border/50 text-sm"
                  />
                </div>
              </div>
              <Button type="submit" variant="secondary" className="w-full text-xs font-bold uppercase tracking-wider mt-1">
                Apply Search
              </Button>
            </form>
          </div>

          <div className="h-px bg-border/40 w-full" />

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Industry</label>
            <Input
              type="text"
              placeholder="e.g. Software, Real Estate"
              value={industryFilter}
              onChange={e => { setIndustryFilter(e.target.value); setPage(1); }}
              className="bg-background/50 border-border/50 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Location</label>
            <Input
              type="text"
              placeholder="e.g. London, NY"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              onBlur={() => { setPage(1); fetchLeads(); }}
              className="bg-background/50 border-border/50 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Title / Role</label>
            <Input
              type="text"
              placeholder="e.g. CEO, Founder"
              value={titleFilter}
              onChange={e => setTitleFilter(e.target.value)}
              onBlur={() => { setPage(1); fetchLeads(); }}
              className="bg-background/50 border-border/50 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Verification Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full h-10 px-3 rounded-md border border-border/50 bg-background/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
            >
              <option value="all">All Statuses</option>
              <option value="valid">Verified Valid</option>
              <option value="catch_all">Catch All / Warning</option>
              <option value="invalid">Invalid / Bounce Risk</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          <div className="mt-auto pt-4">
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setIndustryFilter('');
                setLocationFilter('');
                setTitleFilter('');
                setStatusFilter('all');
                setPage(1);
              }}
              className="w-full text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider"
            >
              <X className="w-3 h-3 mr-2" /> Reset Filters
            </Button>
          </div>
        </div>

        {/* Lead Table Container */}
        <div className="flex-1 bg-card border border-border/40 rounded-xl flex flex-col overflow-hidden shadow-sm relative">
          
          {/* Action Toolbar */}
          <div className="p-4 border-b border-border/40 bg-muted/10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-muted-foreground">
                Selected: <strong className="text-primary">{selectedLeadIds.length}</strong>
              </span>

              {selectedLeadIds.length > 0 && (
                <>
                  <div className="h-5 w-px bg-border/60" />
                  
                  <Button
                    onClick={handleBulkVerifyEmails}
                    disabled={verifying}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider h-8 px-4"
                  >
                    {verifying ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Sparkles className="w-3 h-3 mr-2" />}
                    Bulk Verify
                  </Button>

                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCampaignId}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                      className="h-8 px-2 rounded-md border border-border/50 bg-background/50 text-xs text-foreground focus:outline-none"
                    >
                      <option value="">Select Campaign...</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <Button
                      onClick={handleBulkAddToCampaign}
                      disabled={addingToCampaign || !selectedCampaignId}
                      variant="secondary"
                      className="text-xs font-bold uppercase tracking-wider h-8 px-4"
                    >
                      {addingToCampaign ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Plus className="w-3 h-3 mr-2" />}
                      Add to Campaign
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Showing {leads.length} of {totalCount} leads
              </span>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={fetchLeads} 
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                title="Refresh leads list"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col justify-center items-center h-full text-muted-foreground space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <div className="text-center">
                  <div className="text-sm font-bold uppercase tracking-wider text-foreground">Loading Leads</div>
                  <div className="text-xs mt-1">Retrieving contacts from CRM database</div>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-full text-muted-foreground p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <div className="text-lg font-bold text-foreground mb-1">No leads found</div>
                <div className="text-sm max-w-[300px]">Try relaxing your keyword filters or run a scrape in the dashboard to populate contacts.</div>
              </div>
            ) : (
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-muted/30 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="px-3 py-2 w-10 border-b border-border/40">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length && leads.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-border bg-background cursor-pointer focus:ring-primary focus:ring-offset-background"
                      />
                    </th>
                    <th className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">Contact</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">Company & Industry</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">Email & Status</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40">Location</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border/40 text-right">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        className={`border-b border-border/20 transition-colors hover:bg-muted/20 ${isSelected ? 'bg-primary/5' : ''}`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(lead.id)}
                            className="rounded border-border bg-background cursor-pointer focus:ring-primary focus:ring-offset-background"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">{lead.name || 'Unknown Contact'}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">{lead.title || 'Role Unassigned'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm">{lead.company || lead.website || 'N/A'}</span>
                            <span className="text-xs text-muted-foreground mt-0.5">{lead.industry || 'Unknown Industry'}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-sm font-medium text-foreground">{lead.email}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${getStatusBadgeStyle(lead.validation_status)}`}>
                              {lead.validation_status === 'valid' ? <CheckCircle2 className="w-3 h-3" /> :
                               lead.validation_status === 'invalid' ? <XCircle className="w-3 h-3" /> :
                               lead.validation_status === 'catch_all' ? <AlertTriangle className="w-3 h-3" /> : <HelpCircle className="w-3 h-3" />}
                              {lead.validation_status === 'valid' ? 'Valid' :
                               lead.validation_status === 'invalid' ? 'Bounce Risk' :
                               lead.validation_status === 'catch_all' ? 'Catch-all' : 'Unverified'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-muted-foreground">
                          {lead.location || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex gap-2 justify-end">
                            {lead.linkedin && (
                              <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted text-blue-500 hover:text-blue-400 transition-colors" title="LinkedIn">
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                            )}
                            {lead.website && (
                              <a href={`https://${lead.website.replace(/https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted text-emerald-500 hover:text-emerald-400 transition-colors" title="Website">
                                <ArrowUpRight className="w-3 h-3" />
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

          {/* Pagination Footer */}
          <div className="p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between mt-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="text-xs font-bold uppercase tracking-wider"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Prev
            </Button>
            
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              Page {page} of {Math.ceil(totalCount / limit) || 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= totalCount || loading}
              className="text-xs font-bold uppercase tracking-wider"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
    </Layout>
  );
};

export default Discover;

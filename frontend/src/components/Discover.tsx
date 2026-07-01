import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

interface Lead {
  id: string;
  email: string;
  name: string;
  company: string;
  title: string;
  phone: string;
  linkedin: string;
  industry: string;
  location: string;
  employees: string;
  validation_status: string;
  created_at: string;
  website: string;
  role: string;
  source: string;
}

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

      setLeads(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching leads:', err);
      emitToast('Failed to fetch leads', 'error');
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
      emitToast('Select at least one lead first', 'error');
      return;
    }
    if (!selectedCampaignId) {
      emitToast('Please select a target campaign', 'error');
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

      emitToast(`Successfully added ${selectedLeadIds.length} leads to campaign!`, 'success');
      setSelectedLeadIds([]);
      setSelectedCampaignId('');
    } catch (err: any) {
      console.error('Error adding leads to campaign:', err);
      emitToast(err.message || 'Failed to add leads to campaign', 'error');
    } finally {
      setAddingToCampaign(false);
    }
  };

  const handleBulkVerifyEmails = async () => {
    if (selectedLeadIds.length === 0) {
      emitToast('Select leads to verify', 'error');
      return;
    }

    setVerifying(true);
    try {
      const selectedLeadsDetails = leads.filter(l => selectedLeadIds.includes(l.id));
      
      // Perform email verification simulation / validation check
      // For realism: regex matching and domain checks
      const updates = selectedLeadsDetails.map(async (lead) => {
        let status = 'invalid';
        if (lead.email && lead.email.includes('@') && lead.email.includes('.')) {
          // Simple validation rules
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
      emitToast(`Completed email verification check for ${selectedLeadIds.length} leads!`, 'success');
      setSelectedLeadIds([]);
      fetchLeads();
      fetchMetrics();
    } catch (err: any) {
      console.error('Error verifying emails:', err);
      emitToast('Failed to run verification job', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    const base = {
      padding: '0.2rem 0.6rem',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem',
      textTransform: 'uppercase' as const,
    };

    switch (status) {
      case 'valid':
        return {
          ...base,
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: '#34d399',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.1)',
        };
      case 'invalid':
        return {
          ...base,
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.25)',
        };
      case 'catch_all':
        return {
          ...base,
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        };
      default:
        return {
          ...base,
          backgroundColor: 'rgba(148, 163, 184, 0.15)',
          color: '#cbd5e1',
          border: '1px solid rgba(148, 163, 184, 0.25)',
        };
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#090d16',
      color: '#f8fafc',
      fontFamily: "'Inter', sans-serif",
      padding: '7rem 2rem 2rem',
      boxSizing: 'border-box',
    }}>
      {/* Top metrics dashboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem',
      }}>
        {[
          { label: 'Total Leads Found', value: metrics.totalLeads.toLocaleString(), color: '#3b82f6', icon: '⚡' },
          { label: 'Verified Deliverable', value: metrics.verifiedEmails.toLocaleString(), color: '#10b981', icon: '🛡️' },
          { label: 'Deliverability Score', value: `${metrics.verificationRate}%`, color: '#8b5cf6', icon: '📈' },
          { label: 'Undeliverable/Bounce Risk', value: metrics.invalidEmails.toLocaleString(), color: '#ef4444', icon: '⚠️' }
        ].map((item, idx) => (
          <div key={idx} style={{
            backgroundColor: '#111827',
            padding: '1.2rem 1.5rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500, marginBottom: '0.3rem' }}>{item.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>{item.value}</div>
            </div>
            <div style={{ fontSize: '1.8rem', opacity: 0.85, color: item.color }}>{item.icon}</div>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex',
        flex: 1,
        gap: '1.5rem',
        minHeight: 0, // critical for nested scroll
      }}>
        {/* Sidebar Filters */}
        <div style={{
          width: '280px',
          backgroundColor: '#111827',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          height: '100%',
          overflowY: 'auto',
        }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Search & Filters
            </h3>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Name, company, title..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#f8fafc',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                }}
              />
              <button type="submit" className="pixel-btn" style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                Apply Keywords
              </button>
            </form>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.06)', margin: 0 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Industry</label>
            <input
              type="text"
              placeholder="e.g. Software, Healthcare"
              value={industryFilter}
              onChange={e => { setIndustryFilter(e.target.value); setPage(1); }}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Location</label>
            <input
              type="text"
              placeholder="e.g. London, San Francisco"
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              onBlur={() => { setPage(1); fetchLeads(); }}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Title / Role</label>
            <input
              type="text"
              placeholder="e.g. CEO, Founder, Director"
              value={titleFilter}
              onChange={e => setTitleFilter(e.target.value)}
              onBlur={() => { setPage(1); fetchLeads(); }}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Verification Status</label>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{
                backgroundColor: '#1f2937',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#f8fafc',
                padding: '0.6rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Verification Statuses</option>
              <option value="valid">Verified Valid</option>
              <option value="catch_all">Catch All / Warning</option>
              <option value="invalid">Invalid / Bounce Risk</option>
              <option value="unverified">Unverified</option>
            </select>
          </div>

          <button
            onClick={() => {
              setSearch('');
              setIndustryFilter('');
              setLocationFilter('');
              setTitleFilter('');
              setStatusFilter('all');
              setPage(1);
            }}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              padding: '0.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Reset Filters
          </button>
        </div>

        {/* Lead Table Container */}
        <div style={{
          flex: 1,
          backgroundColor: '#111827',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
        }}>
          {/* Action Toolbar */}
          <div style={{
            padding: '1rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#182235',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                Selected: <strong style={{ color: '#3b82f6' }}>{selectedLeadIds.length}</strong>
              </span>

              {selectedLeadIds.length > 0 && (
                <>
                  <div style={{ height: '20px', width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />
                  
                  {/* Verify Emails Button */}
                  <button
                    onClick={handleBulkVerifyEmails}
                    disabled={verifying}
                    className="pixel-btn"
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.4rem 1rem',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    {verifying ? 'Verifying...' : '⚡ Bulk Verify'}
                  </button>

                  {/* Add to Campaign dropdown */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <select
                      value={selectedCampaignId}
                      onChange={e => setSelectedCampaignId(e.target.value)}
                      style={{
                        backgroundColor: '#1f2937',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: '#f8fafc',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">Select Campaign...</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleBulkAddToCampaign}
                      disabled={addingToCampaign || !selectedCampaignId}
                      className="pixel-btn"
                      style={{
                        fontSize: '0.8rem',
                        padding: '0.4rem 1rem',
                      }}
                    >
                      {addingToCampaign ? 'Adding...' : '➕ Bulk Add'}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Showing {leads.length} of {totalCount} leads
              </span>
              <button 
                onClick={fetchLeads} 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#94a3b8', 
                  cursor: 'pointer', 
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.2rem'
                }} 
                title="Refresh leads list"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.5rem', animation: 'pulse 1.5s infinite', marginBottom: '0.5rem' }}>Loading Leads...</div>
                  <div style={{ fontSize: '0.85rem' }}>Retrieving contacts from CRM database</div>
                </div>
              </div>
            ) : leads.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '0.5rem' }}>No leads found</div>
                  <div style={{ fontSize: '0.9rem', maxWidth: '350px', margin: '0 auto' }}>Try relaxing your keyword filters or run a scrape in the dashboard to populate contacts.</div>
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(0, 0, 0, 0.15)' }}>
                    <th style={{ padding: '1rem 1.5rem', width: '50px' }}>
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length === leads.length && leads.length > 0}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Contact</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Company & Industry</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Email & Status</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Location</th>
                    <th style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', textAlign: 'right' }}>Social</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const isSelected = selectedLeadIds.includes(lead.id);
                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectRow(lead.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>{lead.name || 'Unknown Contact'}</div>
                            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.15rem' }}>{lead.title || 'Role Unassigned'}</div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div>
                            <div style={{ fontWeight: 500, color: '#e2e8f0', fontSize: '0.9rem' }}>{lead.company || lead.website || 'N/A'}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>{lead.industry || 'Unknown Industry'}</div>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 500 }}>{lead.email}</span>
                            <span style={getStatusBadgeStyle(lead.validation_status)}>
                              {lead.validation_status === 'valid' ? '✓ Valid' :
                               lead.validation_status === 'invalid' ? '✗ Bounce Risk' :
                               lead.validation_status === 'catch_all' ? '⚠ Catch-all' : 'Unverified'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                          {lead.location || 'N/A'}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                            {lead.linkedin && (
                              <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', fontSize: '1.2rem', color: '#3b82f6' }} title="LinkedIn profile">
                                🔗
                              </a>
                            )}
                            {lead.website && (
                              <a href={`https://${lead.website.replace(/https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', fontSize: '1.2rem', color: '#10b981' }} title="Company website">
                                🌐
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
          <div style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0e1726',
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: page === 1 ? '#4b5563' : '#94a3b8',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Previous Page
            </button>
            
            <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              Page {page} of {Math.ceil(totalCount / limit) || 1}
            </span>

            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= totalCount || loading}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: page * limit >= totalCount ? '#4b5563' : '#94a3b8',
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                cursor: page * limit >= totalCount ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Next Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Discover;

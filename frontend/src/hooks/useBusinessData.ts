import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface Business {
  id: string;
  name: string;
  slug: string;
  overview_md: string | null;
  status: string;
  created_at: string;
}

export interface BusinessTarget {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  status: string;
}

export interface BusinessMetrics {
  totalLeads: number;
  activeCampaigns: number;
  avgOpenRate: number;
  avgReplyRate: number;
  emailsSent24h: number;
  totalSent: number;
  conversionRate: number;
  activeTargets: number;
  totalProspects: number;
  dailyLeads: number[];
  dailyEmails: number[];
  urgentEmails: UrgentEmail[];
  campaignsList: any[];
}

export interface UrgentEmail {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  received_at: string;
  campaign_name?: string;
  review_reason?: string;
}

const ALL_BUSINESS_ITEM: Business = {
  id: 'all',
  name: 'ALL BUSINESSES',
  slug: 'all',
  overview_md: null,
  status: 'active',
  created_at: ''
};

export function useBusinessData() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [targets, setTargets] = useState<BusinessTarget[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>('all');
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const handleSetSelectedBusiness = (b: Business | null) => {
    setSelectedBusiness(b);
    setSelectedTarget('all');
  };

  useEffect(() => { fetchBusinesses(); }, []);
  useEffect(() => { if (selectedBusiness) { fetchTargets(selectedBusiness.id); fetchMetrics(selectedBusiness.id); } }, [selectedBusiness, selectedTarget]);

  const fetchBusinesses = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      await supabase.auth.signInWithPassword({
        email: 'ptnmgmt@gmail.com',
        password: 'Longlonglong1!'
      });
    }

    const { data } = await supabase.from('businesses').select('*').order('created_at');
    const list = data ? [ALL_BUSINESS_ITEM, ...data] : [ALL_BUSINESS_ITEM];
    setBusinesses(list);
    setSelectedBusiness(ALL_BUSINESS_ITEM);
    setLoading(false);
  };

  const fetchTargets = async (businessId: string) => {
    let query = supabase.from('business_targets').select('*').neq('status', 'deleted');
    if (businessId !== 'all') {
      query = query.eq('business_id', businessId);
    }
    const { data } = await query.order('created_at');
    if (data) setTargets(data);
  };

  const fetchMetrics = async (businessId: string) => {
    const targetFilter = selectedTarget !== 'all' ? selectedTarget : null;

    // Fetch campaigns for this business
    let campaignQuery = supabase.from('campaigns').select('*');
    if (businessId !== 'all') {
      campaignQuery = campaignQuery.eq('business_id', businessId);
    }
    if (targetFilter) campaignQuery = campaignQuery.eq('target_id', targetFilter);
    const { data: campaigns } = await campaignQuery;
    const campIds = (campaigns || []).map((c: any) => c.id);
    const campIdsWithDummy = campIds.length > 0 ? campIds : ['00000000-0000-0000-0000-000000000000'];

    // Active campaigns
    const activeCampaigns = (campaigns || []).filter((c: any) => c.status === 'Active' || c.status === 'Sending' || c.status === 'Scheduled' || c.status === 'in_progress').length;

    // Avg open/reply rates
    const rates = (campaigns || []).filter((c: any) => c.open_rate || c.click_rate);
    const avgOpenRate = rates.length > 0 ? rates.reduce((s: number, c: any) => s + (c.open_rate || 0), 0) / rates.length : 0;
    const avgReplyRate = rates.length > 0 ? rates.reduce((s: number, c: any) => s + (c.click_rate || 0), 0) / rates.length : 0;

    // Total prospects
    const totalProspects = (campaigns || []).reduce((s: number, c: any) => s + (c.prospects || 0), 0);

    // Get all lead IDs for this business
    let businessLeadIds: string[] = [];
    if (campIds.length > 0) {
      const { data: clData } = await supabase.from('campaign_leads').select('lead_id').in('campaign_id', campIds);
      businessLeadIds = (clData || []).map((cl: any) => cl.lead_id);
    }
    const uniqueLeadIds = Array.from(new Set(businessLeadIds));
    const uniqueLeadIdsWithDummy = uniqueLeadIds.length > 0 ? uniqueLeadIds : ['00000000-0000-0000-0000-000000000000'];

    // Leads count (filtered by this business's campaigns)
    const totalLeads = uniqueLeadIds.length;

    // Emails sent in last 24h
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: emailsSent24h } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', campIdsWithDummy).eq('status', 'sent').gte('sent_at', dayAgo);

    // Active targets count
    let targetsQuery = supabase.from('business_targets').select('*', { count: 'exact', head: true }).eq('status', 'active');
    if (businessId !== 'all') {
      targetsQuery = targetsQuery.eq('business_id', businessId);
    }
    const { count: activeTargets } = await targetsQuery;

    // Conversion rate (replied / sent)
    const { count: totalSent } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', campIdsWithDummy).eq('status', 'sent');
    const { count: totalReplied } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', campIdsWithDummy).eq('status', 'replied');
    const conversionRate = (totalSent || 0) > 0 ? ((totalReplied || 0) / (totalSent || 1)) * 100 : 0;

    // Daily leads and daily emails for last 7 days
    const dailyLeads: number[] = [];
    const dailyEmails: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - i);
      const end = new Date(start); end.setDate(end.getDate() + 1);
      
      let dc = 0;
      if (uniqueLeadIds.length > 0) {
        const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true }).in('id', uniqueLeadIdsWithDummy).gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
        dc = count || 0;
      }
      dailyLeads.push(dc);

      const { count: ec } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', campIdsWithDummy).eq('status', 'sent').gte('sent_at', start.toISOString()).lt('sent_at', end.toISOString());
      dailyEmails.push(ec || 0);
    }

    // Urgent emails - AI-flagged for human review (unsure how to close, respond, or flagged)
    const { data: urgentRaw } = await supabase.from('inbox_emails').select('id, from, subject, snippet, received_at, campaign_id, review_reason').eq('needs_human_review', true).in('campaign_id', campIdsWithDummy).order('received_at', { ascending: false }).limit(15);

    const urgentEmails: UrgentEmail[] = (urgentRaw || []).map((e: any) => ({
      id: e.id, from: e.from, subject: e.subject || '(No Subject)',
      snippet: e.snippet || '', received_at: e.received_at,
      campaign_name: (campaigns || []).find((c: any) => c.id === e.campaign_id)?.name,
      review_reason: e.review_reason
    }));

    setMetrics({
      totalLeads, activeCampaigns, avgOpenRate, avgReplyRate,
      emailsSent24h: emailsSent24h || 0, totalSent: totalSent || 0, conversionRate,
      activeTargets: activeTargets || 0, totalProspects, dailyLeads, dailyEmails, urgentEmails,
      campaignsList: campaigns || []
    });
  };

  const uploadBusiness = async (name: string, mdContent: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { data, error } = await supabase.from('businesses').insert({ name, slug, overview_md: mdContent, status: 'active' }).select().single();
    if (!error && data) { setBusinesses(prev => [...prev, data]); setSelectedBusiness(data); }
    return { data, error };
  };

  const addTarget = async (businessId: string, name: string, description: string) => {
    const { data, error } = await supabase.from('business_targets').insert({ business_id: businessId, name, description, status: 'active' }).select().single();
    if (!error && data) setTargets(prev => [...prev, data]);
    return { data, error };
  };

  const deleteTarget = async (targetId: string) => {
    const { error } = await supabase.from('business_targets').delete().eq('id', targetId);
    if (error) {
      console.warn('Hard delete failed, trying soft delete:', error.message);
      const { error: softError } = await supabase.from('business_targets').update({ status: 'deleted' }).eq('id', targetId);
      if (softError) {
        console.error('Soft delete failed:', softError.message);
        return { success: false, error: softError };
      }
    }
    setTargets(prev => prev.filter(t => t.id !== targetId));
    if (selectedBusiness) {
      fetchMetrics(selectedBusiness.id);
    }
    return { success: true };
  };

  const toggleBusinessStatus = async (businessId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const { data, error } = await supabase.from('businesses').update({ status: nextStatus }).eq('id', businessId).select().single();
    if (!error && data) {
      setBusinesses(prev => prev.map(b => b.id === businessId ? data : b));
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(data);
      }
    }
    return { data, error };
  };

  const deleteBusiness = async (businessId: string) => {
    // Attempt hard delete first
    const { error } = await supabase.from('businesses').delete().eq('id', businessId);
    if (error) {
      console.warn('Hard delete failed for business, trying soft delete:', error.message);
      const { error: softError } = await supabase.from('businesses').update({ status: 'deleted' }).eq('id', businessId);
      if (softError) {
        console.error('Soft delete failed:', softError.message);
        return { success: false, error: softError };
      }
    }
    setBusinesses(prev => prev.filter(b => b.id !== businessId));
    if (selectedBusiness?.id === businessId) {
      setSelectedBusiness(ALL_BUSINESS_ITEM);
    }
    return { success: true };
  };

  return { businesses: businesses.filter(b => b.status !== 'deleted'), targets, selectedBusiness, setSelectedBusiness: handleSetSelectedBusiness, selectedTarget, setSelectedTarget, metrics, loading, uploadBusiness, addTarget, deleteTarget, deleteBusiness, refetchMetrics: () => selectedBusiness && fetchMetrics(selectedBusiness.id), toggleBusinessStatus };
}

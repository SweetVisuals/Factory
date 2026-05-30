import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Upload, Plus, AlertTriangle, Users, Mail, Target, Zap, BarChart2, ArrowUpRight, Shield, Cpu, Eye, Trash2, LayoutGrid, Clock, List } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import CampaignCard from '../components/CampaignCard';
import { format } from 'date-fns';

type ChartType = 'bar' | 'line' | 'area';
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#ec4899', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Business { id: string; name: string; slug: string; overview_md: string | null; status: string; signature_template?: string | null; }
interface BusinessTarget { id: string; business_id: string; name: string; description: string | null; status: string; }
interface UrgentEmail { id: string; from: string; subject: string; snippet: string; received_at: string; campaign_name?: string; review_reason?: string; }
interface ActivityLog { id: string; sent_at: string; status: string; lead_name: string; lead_email: string; campaign_name: string; campaign_id: string; }

export default function BusinessOverviewPage() {
  const navigate = useNavigate();
  const { campaigns } = useApp();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [targets, setTargets] = useState<BusinessTarget[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [selectedTarget, setSelectedTarget] = useState('all');
  const [chartType, setChartType] = useState<ChartType>('area');
  const [showUpload, setShowUpload] = useState(false);
  const [showAddTarget, setShowAddTarget] = useState(false);
  const [targetName, setTargetName] = useState('');
  const [targetDesc, setTargetDesc] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [isSavingSignature, setIsSavingSignature] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);

  // Metrics & Data
  const [metrics, setMetrics] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [urgentEmails, setUrgentEmails] = useState<UrgentEmail[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('businesses').select('*').order('created_at');
      if (data && data.length > 0) { 
        setBusinesses(data); 
        setSelectedBiz(data[0]); 
      }
      setLoading(false);
    })();
  }, []);

  const getBusinessColor = (name: string) => {
    if (name.toLowerCase().includes('relay')) return '#10b981';
    if (name.toLowerCase().includes('mrmedic')) return '#3b82f6';
    return '#8b5cf6'; // Default purple
  };

  const toggleBizStatus = async () => {
    if (!selectedBiz) return;
    const nextStatus = selectedBiz.status === 'active' ? 'inactive' : 'active';
    const { data, error } = await supabase.from('businesses').update({ status: nextStatus }).eq('id', selectedBiz.id).select().single();
    if (!error && data) {
      setBusinesses(prev => prev.map(b => b.id === selectedBiz.id ? data : b));
      setSelectedBiz(data);
    }
  };

  useEffect(() => {
    if (!selectedBiz) return;
    setSignatureText(selectedBiz.signature_template || '');
    (async () => {
      const { data: t } = await supabase.from('business_targets').select('*').eq('business_id', selectedBiz.id).eq('status', 'active').order('created_at');
      if (t) setTargets(t);
    })();
    fetchMetrics();
    fetchActivityLogs();
  }, [selectedBiz, selectedTarget, campaigns]);

  const fetchActivityLogs = async () => {
    if (!selectedBiz) return;
    const bizCampaigns = campaigns.filter(c => c.business_id === selectedBiz.id);
    if (bizCampaigns.length === 0) {
      setActivityLogs([]);
      return;
    }
    const cIds = bizCampaigns.map(c => c.id);
    
    const { data } = await supabase
      .from('campaign_progress')
      .select('id, sent_at, status, campaign_id, lead:leads(name, email)')
      .in('campaign_id', cIds)
      .in('status', ['sent', 'replied'])
      .order('created_at', { ascending: false })
      .limit(15);
      
    if (data) {
      const logs = data.map((d: any) => ({
        id: d.id,
        sent_at: d.sent_at || new Date().toISOString(),
        status: d.status,
        lead_name: d.lead?.name || 'Unknown',
        lead_email: d.lead?.email || '',
        campaign_name: bizCampaigns.find(c => c.id === d.campaign_id)?.name || 'Unknown Campaign',
        campaign_id: d.campaign_id
      }));
      setActivityLogs(logs);
    }
  };

  const handleSaveSignature = async () => {
    if (!selectedBiz) return;
    setIsSavingSignature(true);
    const { data, error } = await supabase.from('businesses').update({ signature_template: signatureText }).eq('id', selectedBiz.id).select().single();
    if (!error && data) {
      setBusinesses(prev => prev.map(b => b.id === selectedBiz.id ? data : b));
      setSelectedBiz(data);
      alert('Signature saved successfully');
    } else {
      alert('Failed to save signature');
    }
    setIsSavingSignature(false);
  };

  const fetchMetrics = async () => {
    if (!selectedBiz) return;
    let filteredCampaigns = campaigns.filter(c => c.business_id === selectedBiz.id);
    if (selectedTarget !== 'all') {
      filteredCampaigns = filteredCampaigns.filter(c => c.target_id === selectedTarget);
    }
    
    const ids = filteredCampaigns.map((c: any) => c.id);
    const noIds = ['00000000-0000-0000-0000-000000000000'];

    const activeCampaigns = filteredCampaigns.filter((c: any) => ['Active', 'Sending', 'Scheduled'].includes(c.status)).length;
    const rates = filteredCampaigns.filter((c: any) => c.open_rate || c.click_rate);
    const avgOpen = rates.length > 0 ? rates.reduce((s: number, c: any) => s + (c.open_rate || 0), 0) / rates.length : 0;
    const avgReply = rates.length > 0 ? rates.reduce((s: number, c: any) => s + (c.click_rate || 0), 0) / rates.length : 0;
    const totalProspects = filteredCampaigns.reduce((s: number, c: any) => s + (c.prospects || 0), 0);
    const { count: totalLeads } = await supabase.from('leads').select('*', { count: 'exact', head: true });
    
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { count: sent24h } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', ids.length > 0 ? ids : noIds).eq('status', 'sent').gte('sent_at', dayAgo);
    const { count: activeTargets } = await supabase.from('business_targets').select('*', { count: 'exact', head: true }).eq('business_id', selectedBiz.id).eq('status', 'active');
    const { count: totalSent } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', ids.length > 0 ? ids : noIds).eq('status', 'sent');
    const { count: totalReplied } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).in('campaign_id', ids.length > 0 ? ids : noIds).eq('status', 'replied');
    const conv = (totalSent || 0) > 0 ? ((totalReplied || 0) / (totalSent || 1)) * 100 : 0;

    const dLeads: number[] = []; const dEmails: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const s = new Date(); s.setHours(0,0,0,0); s.setDate(s.getDate() - i);
      const e = new Date(s); e.setDate(e.getDate() + 1);
      const { count: dc } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', s.toISOString()).lt('created_at', e.toISOString());
      dLeads.push(dc || 0);
      const { count: ec } = await supabase.from('campaign_progress').select('*', { count: 'exact', head: true }).eq('status', 'sent').gte('sent_at', s.toISOString()).lt('sent_at', e.toISOString());
      dEmails.push(ec || 0);
    }
    setDailyData(dLeads.map((v, i) => ({ day: DAY_LABELS[i], leads: v, emails: dEmails[i] })));

    // Urgent: AI-flagged for human review
    const { data: urgentRaw } = await supabase.from('inbox_emails').select('id, from, subject, snippet, received_at, campaign_id, review_reason').eq('needs_human_review', true).order('received_at', { ascending: false }).limit(15);
    setUrgentEmails((urgentRaw || []).map((em: any) => ({
      id: em.id, from: em.from, subject: em.subject || '(No Subject)',
      snippet: em.snippet || '', received_at: em.received_at,
      review_reason: em.review_reason,
      campaign_name: campaigns.find((c: any) => c.id === em.campaign_id)?.name
    })));

    setMetrics({
      totalLeads: totalLeads || 0, activeCampaigns, avgOpen, avgReply,
      sent24h: sent24h || 0, totalSent: totalSent || 0, conv, activeTargets: activeTargets || 0, totalProspects
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !file.name.endsWith('.md')) return;
    const text = await file.text();
    const name = file.name.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data } = await supabase.from('businesses').insert({ name, slug, overview_md: text, status: 'active' }).select().single();
    if (data) { setBusinesses(p => [...p, data]); setSelectedBiz(data); }
    setShowUpload(false);
  };

  const handleAddTarget = async () => {
    if (!selectedBiz || !targetName.trim()) return;
    const { data } = await supabase.from('business_targets').insert({ business_id: selectedBiz.id, name: targetName.trim(), description: targetDesc.trim(), status: 'active' }).select().single();
    if (data) setTargets(p => [...p, data]);
    setTargetName(''); setTargetDesc(''); setShowAddTarget(false);
  };

  const handleDeleteTarget = async (id: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    const { error } = await supabase.from('business_targets').delete().eq('id', id);
    if (error) {
      await supabase.from('business_targets').update({ status: 'inactive' }).eq('id', id);
    }
    setTargets(prev => prev.filter(t => t.id !== id));
    fetchMetrics();
  };

  const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 60) return `${m}m ago`; if (m < 1440) return `${Math.floor(m / 60)}h ago`; return `${Math.floor(m / 1440)}d ago`; };

  const cards = metrics ? [
    { label: 'Total Leads Managed', value: metrics.totalLeads, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Active Autonomous Campaigns', value: metrics.activeCampaigns, icon: Zap, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Total Emails Sent', value: metrics.totalSent, icon: Mail, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Overall Conversion', value: `${metrics.conv.toFixed(1)}%`, icon: Target, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ] : [];

  const piData = targets.filter(t => t.status === 'active').map((t, i) => ({ name: t.name, value: 1, color: COLORS[i % COLORS.length] }));

  const renderChart = (key: string, color: string) => {
    const C = chartType === 'bar' ? BarChart : chartType === 'line' ? LineChart : AreaChart;
    return (
      <ResponsiveContainer width="100%" height={180}>
        <C data={dailyData}>
          <XAxis dataKey="day" stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} />
          <YAxis stroke="rgba(255,255,255,0.15)" fontSize={10} tickLine={false} />
          <Tooltip contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, fontSize: 12, color: '#fff' }} />
          {chartType === 'bar' && <Bar dataKey={key} fill={color} radius={[4,4,0,0]} />}
          {chartType === 'line' && <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />}
          {chartType === 'area' && <Area type="monotone" dataKey={key} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />}
        </C>
      </ResponsiveContainer>
    );
  };

  if (loading) return <Layout><div className="flex items-center justify-center h-full text-muted-foreground/30 text-xs font-black uppercase tracking-[0.4em]">Loading Business Data...</div></Layout>;

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto">
        {/* Dynamic Header */}
        <div className="p-8 pb-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-foreground tracking-tighter">Command Center</h1>
              </div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest ml-5">
                Business Intelligence & Operations
              </p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setShowUpload(!showUpload)} className="flex items-center gap-2 bg-muted/50 border border-border text-foreground px-6 py-3 hover:bg-muted transition-all rounded-xl">
                <Upload size={14} /> <span className="font-semibold uppercase tracking-widest text-xs">Import Biz</span>
              </button>
            </div>
          </div>
        </div>
        {/* Upload Panel */}
        {showUpload && (
          <div className="mx-8 mt-6 p-6 bg-muted/20 rounded-2xl border border-border space-y-4 shadow-sm">
            <span className="text-xs font-semibold text-primary tracking-widest uppercase">Upload Business (.md)</span>
            <input ref={fileRef} type="file" accept=".md" onChange={handleUpload} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="bg-primary text-primary-foreground px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-all">Select File</button>
          </div>
        )}

        {/* 4 Core Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 bg-muted/20 border-y border-border mt-6">
          {cards.map((card, i) => (
            <div key={i} className={cn("p-8 flex flex-col gap-3 transition-colors hover:bg-muted/30 cursor-default", i < cards.length - 1 && "border-r border-border")}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">{card.label}</span>
                <card.icon size={16} className={cn(card.color, "opacity-70")} />
              </div>
              <span className="text-4xl font-bold text-foreground tracking-tight">{card.value}</span>
            </div>
          ))}
        </div>

        {/* Segmented Campaign Cards Grid */}
        <div className="flex flex-col gap-12 p-10">
          {businesses.map(biz => {
            const bizCampaigns = campaigns.filter(c => c.business_id === biz.id);
            const bizColor = getBusinessColor(biz.name);
            return (
              <div key={biz.id} className="flex flex-col gap-6">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bizColor, boxShadow: `0 0 10px ${bizColor}` }} />
                    <h2 className="text-xl font-bold text-foreground">{biz.name}</h2>
                    <span className="px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground ml-2">
                      {bizCampaigns.length} Autonomous Campaigns
                    </span>
                  </div>
                  <button onClick={() => navigate('/create-campaign')} className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <Plus size={16} /> Deploy Agent
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {bizCampaigns.map(campaign => (
                    <CampaignCard
                      key={campaign.id}
                      {...campaign}
                      businessName={biz.name}
                      themeColor={bizColor}
                      onClick={() => navigate(`/campaign/${campaign.id}`)}
                    />
                  ))}
                </div>
                
                {bizCampaigns.length === 0 && (
                  <div className="p-12 border border-border rounded-3xl bg-muted/10 flex flex-col items-center justify-center text-center gap-3">
                    <LayoutGrid size={32} className="text-muted-foreground/30" />
                    <span className="text-sm font-semibold text-muted-foreground">No agents deployed for {biz.name}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>


      </div>
    </Layout>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Activity, Upload, Plus, AlertTriangle, Users, Mail, Target, Zap, ArrowUpRight, Shield, Cpu, Eye, Trash2, CreditCard, Check, Sparkles, Building2, User, Settings, ArrowLeft, RefreshCw, Camera } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/use-toast';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import UsageDashboard from '../components/UsageDashboard';
import PricingCards from '../components/PricingCards';

import { Business } from '../types';
interface EmailTone { id: string; name: string; slug: string; content_md: string | null; category?: string | null; created_at: string; }

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const { user } = useAuth();
  const { toast } = useToast();
  const { simpleMode, setSimpleMode } = useTheme();

  // Profile States
  const [planType, setPlanType] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    bio: '',
    avatar_url: '',
    phone: user?.user_metadata?.phone || '',
    industry: user?.user_metadata?.industry || '',
  });
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Business States
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [isEditingBiz, setIsEditingBiz] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editAims, setEditAims] = useState('');
  const [editObjectives, setEditObjectives] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editTargetAudience, setEditTargetAudience] = useState('');
  const [isSavingBiz, setIsSavingBiz] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Email Tone States
  const [tones, setTones] = useState<EmailTone[]>([]);
  const [selectedTone, setSelectedTone] = useState<EmailTone | null>(null);
  const [isEditingTone, setIsEditingTone] = useState(false);
  const [editToneContent, setEditToneContent] = useState('');
  const [editToneCategory, setEditToneCategory] = useState('FORMAL');
  const [isSavingTone, setIsSavingTone] = useState(false);
  const [showToneUpload, setShowToneUpload] = useState(false);
  const toneFileRef = useRef<HTMLInputElement>(null);

  // New Business Advanced Expansion States
  const [editPainPoints, setEditPainPoints] = useState('');
  const [editNegativeKeywords, setEditNegativeKeywords] = useState('');

  // AI Sandbox Preview States
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState('');

  const handlePreview = async () => {
    setPreviewLoading(true);
    setPreviewResult('');
    try {
      const response = await fetch('/api/ai/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toneContent: editToneContent || 'Standard professional tone.',
          businessOverview: editContent,
          industry: editIndustry,
          targetAudience: editTargetAudience
        })
      });
      const data = await response.json();
      if (data.success) {
        setPreviewResult(data.email);
      } else {
        setPreviewResult('Failed to generate preview: ' + data.error);
      }
    } catch (error: any) {
      setPreviewResult('Error connecting to preview engine: ' + error.message);
    } finally {
      setPreviewLoading(false);
    }
  };


  // Groq AI Refiner States
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [groqUsageCount, setGroqUsageCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchGroqUsage = async () => {
      if (!user) return;
      const dateStr = new Date().toISOString().split('T')[0];
      const limitKey = `groq_brief_usage_${user.id}_${dateStr}`;
      const { data } = await supabase
        .from('agent_memory')
        .select('value')
        .eq('key_name', limitKey)
        .maybeSingle();
      if (data && data.value) {
        setGroqUsageCount(data.value.count || 0);
      } else {
        setGroqUsageCount(0);
      }
    };
    fetchGroqUsage();
    
    const fetchPlan = async () => {
      if (user) {
        const { data } = await supabase.from('account_settings').select('plan_type').eq('user_id', user.id).maybeSingle();
        if (data) setPlanType(data.plan_type);
      }
    };
    fetchPlan();

    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, avatar_url, bio').eq('id', user.id).maybeSingle();
        if (data) {
          setFormData(prev => ({
            ...prev,
            full_name: data.full_name || prev.full_name,
            avatar_url: data.avatar_url || '',
            bio: data.bio || ''
          }));
        }
      }
    };
    fetchProfile();
  }, [user, isEditingBiz]);

  useEffect(() => {
    const initBusiness = async () => {
      const { data } = await supabase.from('businesses').select('*').eq('status', 'active').order('created_at');
      if (data && data.length > 0) { 
        setBusinesses(data); 
        setSelectedBiz(data[0]); 
      }
    };
    initBusiness();
  }, []);

  useEffect(() => {
    const initTones = async () => {
      const { data } = await supabase.from('email_tones').select('*').order('created_at');
      if (data) {
        setTones(data);
        if (data.length > 0 && !selectedTone) {
          setSelectedTone(data[0]);
        }
      }
    };
    initTones();
  }, [activeTab]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIdentityLoading(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: formData.full_name,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      toast({ title: 'Profile Updated', description: 'Your personal information has been saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIdentityLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}-${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      
      await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl, updated_at: new Date().toISOString() });
      toast({ title: 'Avatar Updated', description: 'Your profile picture has been updated.' });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !file.name.endsWith('.md')) return;
    const text = await file.text();
    const name = file.name.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data } = await supabase.from('businesses').insert({ name, slug, overview_md: text, status: 'active' }).select().single();
    if (data) { setBusinesses(p => [...p, data]); setSelectedBiz(data); }
    setShowUpload(false);
    toast({ title: 'Business Profile Added', description: `${name} has been imported successfully.` });
  };

  const handleSaveBiz = async () => {
    if (!selectedBiz) return;
    setIsSavingBiz(true);
    const { error } = await supabase.from('businesses').update({ 
      overview_md: editContent,
      aims_md: editAims,
      objectives_md: editObjectives,
      industry: editIndustry,
      target_audience: editTargetAudience,
      // pain_points: editPainPoints,
      // negative_keywords: editNegativeKeywords
    }).eq('id', selectedBiz.id);
    setIsSavingBiz(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    } else {
      setBusinesses(prev => prev.map(b => b.id === selectedBiz.id ? { ...b, overview_md: editContent, aims_md: editAims, objectives_md: editObjectives, industry: editIndustry, target_audience: editTargetAudience } : b));
      setSelectedBiz(prev => prev ? { ...prev, overview_md: editContent, aims_md: editAims, objectives_md: editObjectives, industry: editIndustry, target_audience: editTargetAudience } : null);
      toast({ title: 'Saved', description: 'Business profile updated successfully.' });
      setIsEditingBiz(false);
    }
  };

  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a prompt for the AI' });
      return;
    }
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/edit-brief-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          markdown: editContent,
          userId: user?.id
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine brief with AI');
      }
      setEditContent(data.markdown);
      setAiPrompt('');
      if (data.usageCount !== undefined) {
        setGroqUsageCount(data.usageCount);
      }
      toast({
        title: 'Success',
        description: `Brief refined successfully with Groq Llama 3! Daily usage: ${data.usageCount}/5`,
      });
    } catch (error) {
      toast({
        title: 'AI Edit Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleToneUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !file.name.endsWith('.md')) return;
    const text = await file.text();
    const name = file.name.replace('.md', '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data, error } = await supabase.from('email_tones').insert({ name, slug, content_md: text }).select().single();
    if (error) {
      toast({ title: 'Error', description: 'Failed to upload tone guide.', variant: 'destructive' });
    } else if (data) {
      setTones(p => [...p, data]);
      setSelectedTone(data);
      setShowToneUpload(false);
      toast({ title: 'Email Tone Added', description: `${name} has been imported successfully.` });
    }
  };

  const handleSaveTone = async () => {
    if (!selectedTone) return;
    setIsSavingTone(true);
    const { error } = await supabase.from('email_tones').update({ 
      content_md: editToneContent,
      category: editToneCategory
    }).eq('id', selectedTone.id);
    setIsSavingTone(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    } else {
      setTones(prev => prev.map(t => t.id === selectedTone.id ? { ...t, content_md: editToneContent, category: editToneCategory } : t));
      setSelectedTone(prev => prev ? { ...prev, content_md: editToneContent, category: editToneCategory } : null);
      toast({ title: 'Saved', description: 'Email tone guide updated successfully.' });
      setIsEditingTone(false);
    }
  };

  const handleAiToneEdit = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: 'Error', description: 'Please enter a prompt for the AI' });
      return;
    }
    setIsAiLoading(true);
    try {
      const response = await fetch('/api/edit-brief-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          markdown: editToneContent,
          userId: user?.id
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to refine tone guide with AI');
      }
      setEditToneContent(data.markdown);
      setAiPrompt('');
      if (data.usageCount !== undefined) {
        setGroqUsageCount(data.usageCount);
      }
      toast({
        title: 'Success',
        description: `Tone guide refined successfully with Groq Llama 3! Daily usage: ${data.usageCount}/5`,
      });
    } catch (error) {
      toast({
        title: 'AI Edit Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTabChange = (tabName: string) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <Layout>
      <div className="w-full flex h-full bg-background overflow-hidden text-foreground">
        
        {/* Left-hand Sidebar Navigation */}
        <div className="w-64 border-r border-border bg-card flex flex-col shrink-0 h-full">
          <div className="p-6 border-b border-border">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Settings</h2>
          </div>
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {[
              { id: 'profile', label: 'Personal Profile', icon: User },
              { id: 'business', label: 'Business Profiles', icon: Building2 },
              { id: 'tone', label: 'Email Tones', icon: Mail },
              { id: 'usage', label: 'Usage & Limits', icon: Activity },
              { id: 'subscription', label: 'Pricing', icon: CreditCard }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-sm font-bold transition-all border border-transparent",
                    isActive 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-[1200px] mx-auto w-full">
            {/* Dynamic Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-none" />
                <h1 className="text-3xl font-black text-foreground tracking-tighter uppercase">
                  {activeTab === 'profile' && 'Personal Profile'}
                  {activeTab === 'business' && 'Business Profiles'}
                  {activeTab === 'tone' && 'Email Tones'}
                  {activeTab === 'usage' && 'Usage & Limits'}
                  {activeTab === 'subscription' && 'Pricing'}
                </h1>
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-2 ml-5">
                Manage your {activeTab} settings and preferences
              </p>
            </div>
          
          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-12 animate-in fade-in duration-200">
              
              <div className="bg-card border border-border rounded-none p-8 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-6 bg-primary rounded-none" />
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Personal Details</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-12 items-start">
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-full border-4 border-background overflow-hidden bg-muted flex items-center justify-center relative">
                        {formData.avatar_url ? (
                          <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <User size={48} className="text-muted-foreground/50" />
                        )}
                        <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                          <Camera size={24} className="text-white mb-2" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Change</span>
                          <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
                        </label>
                      </div>
                      {avatarUploading && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full"><Activity size={24} className="text-white animate-spin" /></div>}
                    </div>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="flex-1 space-y-6 w-full">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Full Name</label>
                        <input
                          value={formData.full_name}
                          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                          className="w-full bg-background border border-input rounded-none px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="Your Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Address</label>
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full bg-muted/50 border border-border rounded-none px-4 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Phone Number</label>
                        <input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-background border border-input rounded-none px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="Your Phone Number"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Role / Department</label>
                        <input
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full bg-background border border-input rounded-none px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="e.g. Sales Director"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bio / Description</label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          className="w-full h-24 bg-background border border-input rounded-none px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                          placeholder="Tell us a little about yourself..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        disabled={identityLoading}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-none text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                      >
                        {identityLoading && <Activity size={16} className="animate-spin" />}
                        Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="pt-8 border-t border-border/50 space-y-6">
                <h3 className="text-lg font-bold text-foreground mb-6">Interface Preferences</h3>
                <div className="flex items-center justify-between p-4 bg-background border border-border rounded-none">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-muted rounded-none">
                      <Zap size={18} className="text-foreground" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">Theme Appearance</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Toggle between light and dark modes.</span>
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>

              <div className="pt-8 border-t border-border/50 space-y-6">
                <h3 className="text-lg font-bold text-red-500 mb-6">Danger Zone</h3>
                <div className="flex items-center justify-between p-4 bg-background border border-red-500/20 rounded-none">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-red-500/10 rounded-none">
                      <AlertTriangle size={18} className="text-red-500" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">Delete Account</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Permanently delete your account and all data.</span>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-red-500/10 text-red-500 rounded-none text-sm font-bold border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors">
                    Delete Account
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB: USAGE */}
          {activeTab === 'usage' && (
            <div className="animate-in fade-in duration-200 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Limit Card 1 */}
                <div className="p-6 bg-card border border-border rounded-none space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Emails Sent Today</h4>
                    <span className="text-sm font-black text-foreground">45 / 100</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-none overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }} />
                  </div>
                </div>

                {/* Limit Card 2 */}
                <div className="p-6 bg-card border border-border rounded-none space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Campaigns</h4>
                    <span className="text-sm font-black text-foreground">2 / 5</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-none overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '40%' }} />
                  </div>
                </div>

                {/* Limit Card 3 */}
                <div className="p-6 bg-card border border-border rounded-none space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">AI Credits (Monthly)</h4>
                    <span className="text-sm font-black text-foreground">850 / 1000</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-none overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>
              <UsageDashboard />
            </div>
          )}

          {/* TAB: SUBSCRIPTION */}
          {activeTab === 'subscription' && (
            <div className="animate-in fade-in duration-200">
              <PricingCards hideHeader={true} />
            </div>
          )}

          {/* TAB: BUSINESS AI PROFILES */}
          {activeTab === 'business' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground max-w-xl">
                  Business profiles act as the core intelligence source for the AI. Upload markdown documents describing products, tone of voice, and value propositions.
                </p>
                <button 
                  onClick={() => setShowUpload(!showUpload)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-none text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  New Profile
                </button>
              </div>

              {showUpload && (
                <div className="p-8 bg-card border border-border rounded-none animate-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-none p-12 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                      <Upload size={24} className="text-muted-foreground" />
                    </div>
                    <h4 className="text-lg font-bold text-foreground mb-2">Upload Profile Document</h4>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Upload a Markdown (.md) file containing your business context to train the agent.
                    </p>
                    <input ref={fileRef} type="file" accept=".md" onChange={handleUpload} className="hidden" />
                    <button 
                      onClick={() => fileRef.current?.click()}
                      className="px-6 py-3 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                </div>
              )}

              {selectedBiz ? (
                <div className="bg-card border border-border rounded-none p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => { setSelectedBiz(null); setIsEditingBiz(false); }}
                        className="p-2 bg-muted text-muted-foreground hover:text-foreground rounded-none transition-colors"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="text-xl font-bold text-foreground">{selectedBiz.name}</h3>
                    </div>
                    {isEditingBiz ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={handlePreview}
                          disabled={previewLoading}
                          className="px-4 py-2 bg-background text-foreground border border-border rounded-none text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                          Preview AI Email
                        </button>
                        <button 
                          onClick={() => setIsEditingBiz(false)}
                          className="px-4 py-2 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveBiz}
                          disabled={isSavingBiz}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-none text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                          {isSavingBiz ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
                          Save Changes
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { 
                          setEditContent(selectedBiz.overview_md || ''); 
                          setEditAims(selectedBiz.aims_md || '');
                          setEditObjectives(selectedBiz.objectives_md || '');
                          setEditIndustry(selectedBiz.industry || '');
                          setEditTargetAudience(selectedBiz.target_audience || '');
                          setIsEditingBiz(true); 
                        }}
                        className="px-4 py-2 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                      >
                        Edit Profile
                      </button>
                    )}
                  </div>

                  {isEditingBiz ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-foreground mb-2">Industry</label>
                          <input 
                            value={editIndustry}
                            onChange={(e) => setEditIndustry(e.target.value)}
                            placeholder="e.g. B2B SaaS"
                            className="w-full bg-background border border-border rounded-none p-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-foreground mb-2">Target Audience</label>
                          <input 
                            value={editTargetAudience}
                            onChange={(e) => setEditTargetAudience(e.target.value)}
                            placeholder="e.g. CMOs and VPs of Marketing"
                            className="w-full bg-background border border-border rounded-none p-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Campaign Aims</label>
                        <textarea 
                          value={editAims}
                          onChange={(e) => setEditAims(e.target.value)}
                          placeholder="e.g. Book 5 meetings this month for enterprise clients"
                          className="w-full h-24 bg-background border border-border rounded-none p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Pain Points to Avoid</label>
                          <textarea 
                            value={editPainPoints}
                            onChange={(e) => setEditPainPoints(e.target.value)}
                            placeholder="e.g. Budget constraints, Long onboarding"
                            className="w-full h-24 bg-background border border-border rounded-none p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Negative Keywords</label>
                          <textarea 
                            value={editNegativeKeywords}
                            onChange={(e) => setEditNegativeKeywords(e.target.value)}
                            placeholder="e.g. Cheap, Free, Trial"
                            className="w-full h-24 bg-background border border-border rounded-none p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Business Objectives</label>
                        <textarea 
                          value={editObjectives}
                          onChange={(e) => setEditObjectives(e.target.value)}
                          placeholder="e.g. To educate prospects on our new AI features"
                          className="w-full h-24 bg-background border border-border rounded-none p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">General Overview</label>
                        <textarea 
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-96 bg-background border border-border rounded-none p-4 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      
                      {/* AI Assistant Section */}
                      <div className="p-4 bg-muted/40 border border-border rounded-none space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber-400" /> Groq AI Refiner (Free Llama 3)
                          </label>
                          {groqUsageCount !== null && (
                            <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded-full uppercase tracking-wider">
                              Daily Used: {groqUsageCount}/5 edits
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            disabled={isAiLoading}
                            placeholder="e.g. 'Make the copy more casual' or 'Add Plastering segment...'"
                            className="flex-1 rounded-none border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleAiEdit}
                            disabled={isAiLoading || (groqUsageCount !== null && groqUsageCount >= 5)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-none text-sm font-bold shadow-md hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Refine
                          </button>
                        </div>
                      </div>

                      {/* AI Preview Box */}
                      {(previewLoading || previewResult) && (
                        <div className="mt-8 border border-border bg-card rounded-none overflow-hidden">
                          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                              <Sparkles size={12} className="text-primary" /> AI Sandbox Preview
                            </span>
                            {previewLoading && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
                          </div>
                          <div className="p-6">
                            {previewLoading ? (
                              <div className="space-y-4">
                                <div className="h-4 bg-muted/50 w-3/4 rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-full rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-5/6 rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-1/2 rounded-none animate-pulse"></div>
                              </div>
                            ) : (
                              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                                {previewResult}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {selectedBiz.aims_md && (
                        <div className="p-6 bg-background border border-border rounded-none">
                          <h4 className="text-sm font-bold text-foreground mb-2">Campaign Aims</h4>
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {selectedBiz.aims_md}
                          </pre>
                        </div>
                      )}
                      {selectedBiz.objectives_md && (
                        <div className="p-6 bg-background border border-border rounded-none">
                          <h4 className="text-sm font-bold text-foreground mb-2">Business Objectives</h4>
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {selectedBiz.objectives_md}
                          </pre>
                        </div>
                      )}
                      <div className="p-6 bg-background border border-border rounded-none">
                        <h4 className="text-sm font-bold text-foreground mb-2">General Overview</h4>
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                          {selectedBiz.overview_md || 'No content available.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {businesses.map(b => (
                    <div 
                      key={b.id} 
                      onClick={() => setSelectedBiz(b)}
                      className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 bg-card border border-border rounded-none shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <div className="p-2.5 bg-primary/10 rounded-none shrink-0">
                        <Building2 size={20} className="text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-foreground">{b.name}</h3>
                        {b.target_audience && (
                          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5"><Target size={14}/> {b.target_audience}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {b.overview_md ? b.overview_md : 'No context provided.'}
                        </p>
                      </div>
                      <div className="flex flex-col md:items-end gap-2 shrink-0">
                        <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-semibold uppercase tracking-wider rounded-none">
                          {b.status}
                        </span>
                        {b.industry && (
                          <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs font-semibold uppercase tracking-wider rounded-none">
                            {b.industry}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: EMAIL TONE GUIDES */}
          {activeTab === 'tone' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground max-w-xl">
                  Configure tone profiles to teach the AI how to write natural, conversational cold outreach emails. Highlight example templates, DO's, and NOT-to-DO's to hide the "AI look".
                </p>
                <button 
                  onClick={() => setShowToneUpload(!showToneUpload)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-none text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  New Tone Guide
                </button>
              </div>

              {showToneUpload && (
                <div className="p-8 bg-card border border-border rounded-none animate-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-none p-12 text-center">
                    <div className="p-4 bg-muted rounded-full mb-4">
                      <Upload size={24} className="text-muted-foreground" />
                    </div>
                    <h4 className="text-lg font-bold text-foreground mb-2">Upload Tone Document</h4>
                    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                      Upload a Markdown (.md) file containing email rules, guidelines, or templates.
                    </p>
                    <input ref={toneFileRef} type="file" accept=".md" onChange={handleToneUpload} className="hidden" />
                    <button 
                      onClick={() => toneFileRef.current?.click()}
                      className="px-6 py-3 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                </div>
              )}

              {selectedTone ? (
                <div className="bg-card border border-border rounded-none p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => { setSelectedTone(null); setIsEditingTone(false); }}
                        className="p-2 bg-muted text-muted-foreground hover:text-foreground rounded-none transition-colors"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <h3 className="text-xl font-bold text-foreground">{selectedTone.name}</h3>
                    </div>
                    {isEditingTone ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={handlePreview}
                          disabled={previewLoading}
                          className="px-4 py-2 bg-background text-foreground border border-border rounded-none text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                          Preview AI Email
                        </button>
                        <button 
                          onClick={() => setIsEditingTone(false)}
                          className="px-4 py-2 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveTone}
                          disabled={isSavingTone}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-none text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                        >
                          {isSavingTone ? <RefreshCw size={14} className="animate-spin" /> : <Settings size={14} />}
                          Save Changes
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { 
                          setEditToneContent(selectedTone.content_md || ''); 
                          setEditToneCategory(selectedTone.category || 'FORMAL');
                          setIsEditingTone(true); 
                        }}
                        className="px-4 py-2 bg-secondary text-foreground rounded-none text-sm font-bold hover:bg-secondary/80 transition-colors"
                      >
                        Edit Tone
                      </button>
                    )}
                  </div>

                  {isEditingTone ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Category</label>
                        <select 
                          value={editToneCategory}
                          onChange={(e) => setEditToneCategory(e.target.value)}
                          className="w-full bg-background border border-border rounded-none p-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                        >
                          <option value="FORMAL">Formal</option>
                          <option value="CASUAL">Casual</option>
                          <option value="GREETING">Greeting</option>
                          <option value="FOLLOW_UP">Follow-up</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Instructions</label>
                        <textarea 
                          value={editToneContent}
                          onChange={(e) => setEditToneContent(e.target.value)}
                          className="w-full h-96 bg-background border border-border rounded-none p-4 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      
                      {/* AI Assistant Section */}
                      <div className="p-4 bg-muted/40 border border-border rounded-none space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber-400" /> Groq AI Refiner (Free Llama 3)
                          </label>
                          {groqUsageCount !== null && (
                            <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 bg-muted rounded-full uppercase tracking-wider">
                              Daily Used: {groqUsageCount}/5 edits
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            disabled={isAiLoading}
                            placeholder="e.g. 'Add follow-up subject lines' or 'Change tone to casual'..."
                            className="flex-1 rounded-none border border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleAiToneEdit}
                            disabled={isAiLoading || (groqUsageCount !== null && groqUsageCount >= 5)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-none text-sm font-bold shadow-md hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Refine
                          </button>
                        </div>
                      </div>

                      {/* AI Preview Box */}
                      {(previewLoading || previewResult) && (
                        <div className="mt-8 border border-border bg-card rounded-none overflow-hidden">
                          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                              <Sparkles size={12} className="text-primary" /> AI Sandbox Preview
                            </span>
                            {previewLoading && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
                          </div>
                          <div className="p-6">
                            {previewLoading ? (
                              <div className="space-y-4">
                                <div className="h-4 bg-muted/50 w-3/4 rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-full rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-5/6 rounded-none animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-1/2 rounded-none animate-pulse"></div>
                              </div>
                            ) : (
                              <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
                                {previewResult}
                              </pre>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {selectedTone.category && (
                        <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-none mb-4">
                          {selectedTone.category}
                        </div>
                      )}
                      <div className="p-6 bg-background border border-border rounded-none">
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                          {selectedTone.content_md || 'No content available.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-10">
                  {['FORMAL', 'CASUAL', 'GREETING', 'FOLLOW_UP', 'CUSTOM'].map(category => {
                    const categoryTones = tones.filter(t => (t.category || 'FORMAL') === category);
                    if (categoryTones.length === 0) return null;
                    return (
                      <div key={category} className="space-y-4">
                        <div className="flex items-center gap-2 border-b border-border pb-2">
                          <h3 className="text-base font-semibold text-foreground uppercase tracking-wider">{category.replace('_', '-')}</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {categoryTones.map(t => (
                            <div 
                              key={t.id} 
                              onClick={() => setSelectedTone(t)}
                              className="flex flex-col p-5 bg-card border border-border rounded-none shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
                            >
                              <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-primary/10 rounded-none">
                                  <Mail size={18} className="text-primary" />
                                </div>
                                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-semibold uppercase tracking-wider rounded-none">
                                  Active
                                </span>
                              </div>
                              <h3 className="text-base font-semibold text-foreground mb-1">{t.name}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-3">
                                {t.content_md ? t.content_md : 'No guidelines provided.'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}

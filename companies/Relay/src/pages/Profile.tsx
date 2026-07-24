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
import ThreadsSidebar from '../components/layout/ThreadsSidebar';

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
    let error, data;
    
    const payload = {
      overview_md: editContent,
      aims_md: editAims,
      objectives_md: editObjectives,
      industry: editIndustry,
      target_audience: editTargetAudience
    };

    if (selectedBiz.id === 'new') {
      const name = editIndustry ? `${editIndustry} Profile` : 'New Business Profile';
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const res = await supabase.from('businesses').insert({ 
        name,
        slug,
        ...payload,
        status: 'active'
      }).select().single();
      error = res.error;
      data = res.data;
    } else {
      const res = await supabase.from('businesses').update(payload).eq('id', selectedBiz.id).select().single();
      error = res.error;
      data = res.data;
    }

    setIsSavingBiz(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    } else if (data) {
      if (selectedBiz.id === 'new') {
        setBusinesses(prev => [...prev, data]);
      } else {
        setBusinesses(prev => prev.map(b => b.id === selectedBiz.id ? data : b));
      }
      setSelectedBiz(data);
      toast({ title: 'Saved', description: 'Business profile saved successfully.' });
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
    let error, data;
    
    if (selectedTone.id === 'new') {
      const name = editToneCategory ? `${editToneCategory.toLowerCase()} Tone` : 'New Tone Guide';
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const res = await supabase.from('email_tones').insert({
        name,
        slug,
        content_md: editToneContent,
        category: editToneCategory
      }).select().single();
      error = res.error;
      data = res.data;
    } else {
      const res = await supabase.from('email_tones').update({ 
        content_md: editToneContent,
        category: editToneCategory
      }).eq('id', selectedTone.id).select().single();
      error = res.error;
      data = res.data;
    }

    setIsSavingTone(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    } else if (data) {
      if (selectedTone.id === 'new') {
        setTones(prev => [...prev, data]);
      } else {
        setTones(prev => prev.map(t => t.id === selectedTone.id ? data : t));
      }
      setSelectedTone(data);
      toast({ title: 'Saved', description: 'Email tone guide saved successfully.' });
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
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12">
          <div className="max-w-[1200px] mx-auto w-full">
          
            {/* Top Navigation Tabs */}
            <div className="flex items-center gap-1 mb-8 bg-black/40 p-1 rounded-lg backdrop-blur-sm border border-white/5 overflow-x-auto">
              {[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'business', label: 'Business', icon: Building2 },
                { id: 'tone', label: 'Emails', icon: Mail },
                { id: 'usage', label: 'Usage', icon: Activity },
                { id: 'subscription', label: 'Plans', icon: CreditCard },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                      isActive 
                        ? "bg-primary/20 text-primary border border-primary/20" 
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <Icon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

          
          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-12 animate-in fade-in duration-200">
              
              <div className="space-y-8 mt-6">
                <div className="flex items-center gap-4">
                  <div className="w-1.5 h-6 bg-primary rounded-xl" />
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
                          className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="Your Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Email Address</label>
                        <input
                          type="email"
                          value={formData.email}
                          disabled
                          className="w-full bg-muted/50 border border-white/5 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Phone Number</label>
                        <input
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="Your Phone Number"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Role / Department</label>
                        <input
                          value={formData.industry}
                          onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                          className="w-full bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                          placeholder="e.g. Sales Director"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Bio / Description</label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                          className="w-full h-24 bg-background border border-input rounded-xl px-3 py-2 text-sm text-foreground transition-all outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder:text-muted-foreground resize-none"
                          placeholder="Tell us a little about yourself..."
                        />
                      </div>
                    </div>
                    <div className="flex justify-end pt-2">
                      <button 
                        type="submit" 
                        disabled={identityLoading}
                        className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
                      >
                        {identityLoading && <Activity size={16} className="animate-spin" />}
                        Save Profile
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5 space-y-6">
                <h3 className="text-lg font-bold text-foreground mb-6">Interface Preferences</h3>
                <div className="flex items-center justify-between p-4 bg-background border border-white/5 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-muted rounded-xl">
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

            </div>
          )}

          {/* TAB: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-12 animate-in fade-in duration-200">
              <div className="pt-8 space-y-6">
                <div className="flex items-center justify-between p-6 bg-[#111111] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/5 rounded-xl">
                      <AlertTriangle size={24} className="text-muted-foreground" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-lg font-black text-foreground uppercase tracking-tight">Danger Zone: Delete Account</span>
                      <span className="text-xs font-medium text-muted-foreground">Permanently delete your account and all data. This action cannot be undone.</span>
                    </div>
                  </div>
                  <button className="px-6 py-3 bg-black/40 text-foreground rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 hover:bg-white/5 transition-all shadow-sm">
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
                <div className="p-6 bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Emails Sent Today</h4>
                    <span className="text-sm font-black text-foreground">45 / 100</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-xl overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '45%' }} />
                  </div>
                </div>

                {/* Limit Card 2 */}
                <div className="p-6 bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Campaigns</h4>
                    <span className="text-sm font-black text-foreground">2 / 5</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-xl overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '40%' }} />
                  </div>
                </div>

                {/* Limit Card 3 */}
                <div className="p-6 bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Active Contacts</h4>
                    <span className="text-sm font-black text-foreground">850 / 1000</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-xl overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>

              {/* AI Credits Section */}
              <div className="p-8 bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-2.5 bg-primary/10 rounded-xl">
                    <Zap size={20} className="text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground uppercase tracking-tight">AI Credits</h3>
                    <p className="text-xs text-muted-foreground">
                      Paid plans receive a free quota that refreshes automatically. Free tier accounts must top-up manually.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-foreground">Available Credits</span>
                    <span className="text-sm font-black text-primary">850 / 1000</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-xl overflow-hidden border border-white/5">
                    <div className="h-full bg-primary" style={{ width: '85%' }} />
                  </div>
                </div>
                
                <div className="pt-4 border-t border-white/5 flex justify-end">
                  <button className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2">
                    <Plus size={16} />
                    Top-up Credits
                  </button>
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
                  onClick={() => {
                    setSelectedBiz({ id: 'new', name: 'New Business Profile' } as any);
                    setEditContent('');
                    setEditAims('');
                    setEditObjectives('');
                    setEditIndustry('');
                    setEditTargetAudience('');
                    setIsEditingBiz(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  New Profile
                </button>
              </div>

              {selectedBiz ? (
                <div className="bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => { setSelectedBiz(null); setIsEditingBiz(false); }}
                        className="p-2 bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
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
                          className="px-4 py-2 bg-background text-foreground border border-white/5 rounded-xl text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                          Preview AI Email
                        </button>
                        <button 
                          onClick={() => setIsEditingBiz(false)}
                          className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveBiz}
                          disabled={isSavingBiz}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
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
                        className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
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
                          <select 
                            value={editIndustry}
                            onChange={(e) => setEditIndustry(e.target.value)}
                            className="w-full bg-[#111111] border border-white/5 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
                          >
                            <option value="">Select Industry...</option>
                            <option value="B2B SaaS">B2B SaaS</option>
                            <option value="Real Estate">Real Estate</option>
                            <option value="E-commerce">E-commerce</option>
                            <option value="Trades & Construction">Trades & Construction</option>
                            <option value="Marketing Agency">Marketing Agency</option>
                            <option value="Custom">Custom</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-foreground mb-2">Target Audience</label>
                          <input 
                            value={editTargetAudience}
                            onChange={(e) => setEditTargetAudience(e.target.value)}
                            placeholder="e.g. CMOs and VPs of Marketing"
                            className="w-full bg-background border border-white/5 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Campaign Aims</label>
                        <textarea 
                          value={editAims}
                          onChange={(e) => setEditAims(e.target.value)}
                          placeholder="e.g. Book 5 meetings this month for enterprise clients"
                          className="w-full h-24 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Pain Points to Avoid</label>
                          <textarea 
                            value={editPainPoints}
                            onChange={(e) => setEditPainPoints(e.target.value)}
                            placeholder="e.g. Budget constraints, Long onboarding"
                            className="w-full h-24 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Negative Keywords</label>
                          <textarea 
                            value={editNegativeKeywords}
                            onChange={(e) => setEditNegativeKeywords(e.target.value)}
                            placeholder="e.g. Cheap, Free, Trial"
                            className="w-full h-24 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">Business Objectives</label>
                        <textarea 
                          value={editObjectives}
                          onChange={(e) => setEditObjectives(e.target.value)}
                          placeholder="e.g. To educate prospects on our new AI features"
                          className="w-full h-24 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-foreground mb-2">General Overview</label>
                        <textarea 
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full h-96 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      
                      {/* AI Assistant Section */}
                      <div className="space-y-3 pt-4 border-t border-white/5 mt-6">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles size={12} className="text-primary" /> Groq AI Refiner (Free Llama 3)
                          </label>
                          {groqUsageCount !== null && (
                            <span className="text-[10px] font-black text-muted-foreground px-2 py-0.5 bg-white/5 rounded-xl uppercase tracking-widest border border-white/5">
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
                            className="flex-1 rounded-xl border border-white/5 bg-[#111111] px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleAiEdit}
                            disabled={isAiLoading || (groqUsageCount !== null && groqUsageCount >= 5)}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 shadow-md hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Refine
                          </button>
                        </div>
                      </div>

                      {/* AI Preview Box */}
                      {(previewLoading || previewResult) && (
                        <div className="mt-8 border border-white/5 bg-[#111111]/50 backdrop-blur-md rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/5 bg-muted/30 flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                              <Sparkles size={12} className="text-primary" /> AI Sandbox Preview
                            </span>
                            {previewLoading && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
                          </div>
                          <div className="p-6">
                            {previewLoading ? (
                              <div className="space-y-4">
                                <div className="h-4 bg-muted/50 w-3/4 rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-full rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-5/6 rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-1/2 rounded-xl animate-pulse"></div>
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
                        <div className="p-6 bg-background border border-white/5 rounded-xl">
                          <h4 className="text-sm font-bold text-foreground mb-2">Campaign Aims</h4>
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {selectedBiz.aims_md}
                          </pre>
                        </div>
                      )}
                      {selectedBiz.objectives_md && (
                        <div className="p-6 bg-background border border-white/5 rounded-xl">
                          <h4 className="text-sm font-bold text-foreground mb-2">Business Objectives</h4>
                          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                            {selectedBiz.objectives_md}
                          </pre>
                        </div>
                      )}
                      <div className="p-6 bg-background border border-white/5 rounded-xl">
                        <h4 className="text-sm font-bold text-foreground mb-2">General Overview</h4>
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                          {selectedBiz.overview_md || 'No content available.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {Object.entries(businesses.reduce((acc, biz) => {
                    const ind = biz.industry || 'Uncategorized';
                    if (!acc[ind]) acc[ind] = [];
                    acc[ind].push(biz);
                    return acc;
                  }, {} as Record<string, typeof businesses>)).map(([industry, group]) => (
                    <div key={industry} className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <h3 className="text-base font-black text-foreground uppercase tracking-tight">{industry}</h3>
                      </div>
                      <div className="flex flex-col gap-4">
                        {group.map(b => (
                          <div 
                            key={b.id} 
                            onClick={() => setSelectedBiz(b)}
                            className="flex flex-col md:flex-row items-start md:items-center gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-xl shadow-sm hover:bg-white/[0.06] transition-colors cursor-pointer group"
                          >
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <Building2 size={16} className="text-primary" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-[13px] font-bold text-white/90">{b.name}</h3>
                              {b.target_audience && (
                                <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5 flex items-center gap-1.5"><Target size={12}/> {b.target_audience}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {b.overview_md ? b.overview_md : 'No context provided.'}
                              </p>
                            </div>
                            <div className="flex flex-col md:items-end gap-2 shrink-0">
                              <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-widest rounded-xl">
                                {b.status}
                              </span>
                            </div>
                          </div>
                        ))}
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
                  onClick={() => {
                    setSelectedTone({ id: 'new', name: 'New Tone Guide' } as any);
                    setEditToneContent('');
                    setEditToneCategory('CUSTOM');
                    setIsEditingTone(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  New Tone Guide
                </button>
              </div>

              {selectedTone ? (
                <div className="bg-[#111111]/50 backdrop-blur-md border border-white/5 rounded-xl p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => { setSelectedTone(null); setIsEditingTone(false); }}
                        className="p-2 bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
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
                          className="px-4 py-2 bg-background text-foreground border border-white/5 rounded-xl text-sm font-bold hover:bg-muted transition-colors flex items-center gap-2"
                        >
                          {previewLoading ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}
                          Preview AI Email
                        </button>
                        <button 
                          onClick={() => setIsEditingTone(false)}
                          className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleSaveTone}
                          disabled={isSavingTone}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
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
                        className="px-4 py-2 bg-secondary text-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
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
                          className="w-full bg-[#111111] border border-white/5 rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
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
                          className="w-full h-96 bg-background border border-white/5 rounded-xl p-4 text-sm text-foreground font-mono focus:outline-none focus:border-primary/50 resize-y"
                        />
                      </div>
                      
                      {/* AI Assistant Section */}
                      <div className="p-4 bg-black/40 border border-white/5 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles size={12} className="text-primary" /> Groq AI Refiner (Free Llama 3)
                          </label>
                          {groqUsageCount !== null && (
                            <span className="text-[10px] font-black text-muted-foreground px-2 py-0.5 bg-white/5 rounded-xl uppercase tracking-widest border border-white/5">
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
                            className="flex-1 rounded-xl border border-white/5 bg-[#111111] px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={handleAiToneEdit}
                            disabled={isAiLoading || (groqUsageCount !== null && groqUsageCount >= 5)}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 shadow-md hover:scale-102 active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Refine
                          </button>
                        </div>
                      </div>

                      {/* AI Preview Box */}
                      {(previewLoading || previewResult) && (
                        <div className="mt-8 border border-white/5 bg-[#111111]/50 backdrop-blur-md rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-white/5 bg-muted/30 flex items-center justify-between">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                              <Sparkles size={12} className="text-primary" /> AI Sandbox Preview
                            </span>
                            {previewLoading && <RefreshCw size={12} className="animate-spin text-muted-foreground" />}
                          </div>
                          <div className="p-6">
                            {previewLoading ? (
                              <div className="space-y-4">
                                <div className="h-4 bg-muted/50 w-3/4 rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-full rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-5/6 rounded-xl animate-pulse"></div>
                                <div className="h-4 bg-muted/50 w-1/2 rounded-xl animate-pulse"></div>
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
                        <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider rounded-xl mb-4">
                          {selectedTone.category}
                        </div>
                      )}
                      <div className="p-6 bg-background border border-white/5 rounded-xl">
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                          {selectedTone.content_md || 'No content available.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-10">
                  {Object.entries(tones.reduce((acc, t) => {
                    const cat = t.category || 'Uncategorized';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(t);
                    return acc;
                  }, {} as Record<string, typeof tones>)).map(([category, group]) => (
                    <div key={category} className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                        <h3 className="text-base font-black text-foreground uppercase tracking-tight">{category.replace('_', '-')}</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {group.map(t => (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedTone(t)}
                            className="flex flex-col p-5 bg-white/[0.03] border border-white/5 rounded-xl shadow-sm hover:bg-white/[0.06] transition-colors cursor-pointer group"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                <Mail size={14} className="text-primary" />
                              </div>
                              <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-widest rounded-xl">
                                Active
                              </span>
                            </div>
                            <h3 className="text-[13px] font-bold text-white/90 mb-1">{t.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground/60 line-clamp-3">
                              {t.content_md ? t.content_md : 'No guidelines provided.'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
        </div>

        {/* Right-hand Threads Sidebar */}
        <ThreadsSidebar />

      </div>
    </Layout>
  );
}

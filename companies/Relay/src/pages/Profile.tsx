import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Activity, Upload, Plus, AlertTriangle, Users, Mail, Target, Zap, ArrowUpRight, Shield, Cpu, Eye, Trash2, CreditCard, Check, Sparkles, Building2, User } from 'lucide-react';
import Layout from '../components/layout/Layout';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/use-toast';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';

interface Business { id: string; name: string; slug: string; overview_md: string | null; status: string; }

export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';

  const { user } = useAuth();
  const { toast } = useToast();
  const { simpleMode, setSimpleMode } = useTheme();

  // Profile States
  const [identityLoading, setIdentityLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || 'Ethan',
    email: user?.email || 'ethan@relaysolutions.net',
    phone: user?.user_metadata?.phone || '+44 7864851184',
    industry: user?.user_metadata?.industry || 'Automation & Systems',
  });

  // Business States
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBiz, setSelectedBiz] = useState<Business | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: formData.full_name, phone: formData.phone, industry: formData.industry },
        email: formData.email,
      });
      if (error) throw error;
      toast({ title: 'Profile Updated', description: 'Your personal information has been saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIdentityLoading(false);
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

  const handleTabChange = (tabName: string) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-500">
        
        {/* Padded Header */}
        <div className="px-10 py-10 bg-background border-b border-border/50 shrink-0">
          <div className="flex flex-col gap-8 max-w-[1000px] mx-auto">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-card border border-border rounded-xl shadow-sm">
                <User size={24} className="text-muted-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Account Settings</h1>
                <p className="text-sm font-medium text-muted-foreground">Manage your profile, billing, and system intelligence.</p>
              </div>
            </div>
            
            {/* Elegant Tabs */}
            <div className="flex gap-2 p-1.5 bg-card border border-border rounded-2xl w-fit">
              {[
                { id: 'profile', label: 'My Profile' },
                { id: 'subscription', label: 'Subscription & Billing' },
                { id: 'business', label: 'Business AI Profiles' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab.id 
                      ? "bg-background text-foreground shadow-sm border border-border" 
                      : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-muted/50"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-10 max-w-[1000px] mx-auto w-full">
          
          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Personal Information</h3>
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Full Name</label>
                      <input
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Email Address</label>
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Phone Number</label>
                      <input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Department / Role</label>
                      <input
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    <button 
                      type="submit" 
                      disabled={identityLoading}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all flex items-center gap-2"
                    >
                      {identityLoading && <Activity size={16} className="animate-spin" />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Interface Preferences</h3>
                <div className="flex items-center justify-between p-4 bg-background rounded-2xl border border-border">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-muted rounded-xl">
                      <Zap size={18} className="text-foreground" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground">Theme Appearance</span>
                      <span className="text-xs font-medium text-muted-foreground">Toggle between light and dark modes.</span>
                    </div>
                  </div>
                  <ThemeToggle />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SUBSCRIPTION */}
          {activeTab === 'subscription' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Current Plan Card */}
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Sparkles size={120} className="text-primary" />
                </div>
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={12} /> Current Plan
                      </span>
                      <h2 className="text-4xl font-black text-foreground">Enterprise Elite</h2>
                    </div>
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 text-xs font-bold uppercase tracking-widest rounded-full border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/50 max-w-2xl">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Next Billing</span>
                      <span className="text-lg font-bold text-foreground">Oct 24, 2026</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amount</span>
                      <span className="text-lg font-bold text-foreground">$1,499.00 / mo</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">AI Credits Reset</span>
                      <span className="text-lg font-bold text-foreground">In 12 Days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage & Limits */}
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <h3 className="text-lg font-bold text-foreground mb-6">Monthly Usage & Limits</h3>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-foreground">AI Intelligence Credits</span>
                      <span className="text-muted-foreground">14,250 / 25,000</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 w-[57%]" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-foreground">Email Deliverability Volume</span>
                      <span className="text-muted-foreground">84,300 / 100,000</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[84%]" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold">
                      <span className="text-foreground">Active Campaigns</span>
                      <span className="text-muted-foreground">12 / Unlimited</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[15%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-foreground">Payment Method</h3>
                  <button className="text-sm font-bold text-primary hover:text-primary/80 transition-colors">Update</button>
                </div>
                <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-border">
                  <div className="p-3 bg-muted rounded-xl">
                    <CreditCard size={24} className="text-foreground" />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1">
                    <span className="text-sm font-bold text-foreground">Mastercard ending in 4242</span>
                    <span className="text-xs font-medium text-muted-foreground">Expires 12/2028</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BUSINESS AI PROFILES */}
          {activeTab === 'business' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground max-w-xl">
                  Business profiles act as the core intelligence source for the AI. Upload markdown documents describing products, tone of voice, and value propositions.
                </p>
                <button 
                  onClick={() => setShowUpload(!showUpload)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  New Profile
                </button>
              </div>

              {showUpload && (
                <div className="p-8 bg-card border border-border rounded-3xl animate-in slide-in-from-top-4 duration-300">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-12 text-center">
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
                      className="px-6 py-3 bg-secondary text-foreground rounded-xl text-sm font-bold hover:bg-secondary/80 transition-colors"
                    >
                      Select File
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {businesses.map(b => (
                  <div key={b.id} className="p-6 bg-card border border-border rounded-3xl shadow-sm group hover:border-primary/30 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-3 bg-primary/10 rounded-xl">
                        <Building2 size={20} className="text-primary" />
                      </div>
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded-md">
                        {b.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-2">{b.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {b.overview_md ? b.overview_md.substring(0, 150) + '...' : 'No context provided.'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}

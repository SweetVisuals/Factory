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



  const handleTabChange = (tabName: string) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-200">
        
        {/* Dynamic Header Section */}
        <div className="p-8 pb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Account Settings</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Manage your profile and system preferences
              </p>
            </div>
            
            {/* Elegant Tabs */}
            <div className="flex gap-2 p-1.5 bg-black/20 border border-white/5 rounded-2xl w-full md:w-fit overflow-x-auto custom-scrollbar">
              {[
                { id: 'profile', label: 'My Profile' },
                { id: 'subscription', label: 'Plan & Billing' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
                    activeTab === tab.id 
                      ? "bg-white/10 text-white shadow-sm" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          
          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-8 animate-in fade-in duration-200">
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
            <div className="space-y-8 animate-in fade-in duration-200">
              
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



        </div>
      </div>
    </Layout>
  );
}

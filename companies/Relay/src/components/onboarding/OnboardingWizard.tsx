import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/use-toast';
import { Sparkles, Globe, Building2, ChevronRight, Check, Loader2, ArrowRight } from 'lucide-react';
import Layout from '../layout/Layout';
import Logo from '../Logo';

const OnboardingWizard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);

  // Form State
  const [businessName, setBusinessName] = useState('');
  const [businessUrl, setBusinessUrl] = useState('');
  const [blurb, setBlurb] = useState('');

  // Generated State
  const [generatedData, setGeneratedData] = useState<{
    aims: string;
    objectives: string;
    industry: string;
    target_audience: string;
    overview_md: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!businessName) {
      toast({ title: 'Missing info', description: 'Please provide at least a business name.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/generate-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessUrl,
          blurb,
          userId: user?.id
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate profile');
      }

      setGeneratedData(result.data);
      setGenerationCount(result.usageCount);
      toast({ title: 'Success', description: 'AI successfully generated your business profile!' });
      setStep(3); // Move to review step
    } catch (err: any) {
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generatedData) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('businesses').insert({
        user_id: user?.id,
        name: businessName,
        aims: generatedData.aims,
        objectives: generatedData.objectives,
        industry: generatedData.industry,
        target_audience: generatedData.target_audience,
        overview_md: generatedData.overview_md
      });

      if (error) throw error;

      toast({ title: 'Welcome aboard!', description: 'Your business profile is set up. Let\'s get started!' });
      navigate('/dashboard'); // Go to dashboard!
    } catch (err: any) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="w-full h-full min-h-[calc(100vh-100px)] flex items-center justify-center bg-background/50 backdrop-blur-sm p-4 relative overflow-hidden">
        
        {/* Ambient background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-2xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
          
          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/5">
            <div 
              className="h-full bg-primary transition-all duration-700 ease-out" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          <div className="p-10 flex flex-col gap-8">
            <div className="flex flex-col items-center text-center gap-4">
              <Logo />
              <h2 className="text-3xl font-black text-white tracking-tight mt-4">
                {step === 1 ? 'Welcome to Relay' : step === 2 ? 'Tell us about your business' : 'Review your Profile'}
              </h2>
              <p className="text-muted-foreground max-w-md">
                {step === 1 && 'Let\'s get your account set up so you can start launching automated outreach campaigns.'}
                {step === 2 && 'We will use our DeepSeek AI agent to scrape your website and build a highly accurate business value proposition.'}
                {step === 3 && 'Here is what our AI agents learned about your business. Feel free to tweak it before saving.'}
              </p>
            </div>

            {step === 1 && (
              <div className="flex flex-col items-center justify-center gap-6 py-8">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                  <Check className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Email Verified!</h3>
                  <p className="text-sm text-white/50">Your account is active.</p>
                </div>
                <button 
                  onClick={() => setStep(2)}
                  className="bg-white text-black px-8 py-3 rounded-xl font-black uppercase tracking-widest text-[11px] hover:scale-105 active:scale-95 transition-all mt-4 flex items-center gap-2"
                >
                  Continue Setup <ArrowRight size={14} />
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-white/70 uppercase tracking-widest">Business Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input 
                      type="text" 
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Acme Corp" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-white/70 uppercase tracking-widest flex justify-between">
                    <span>Website URL</span>
                    <span className="text-white/30 font-normal normal-case tracking-normal">Optional</span>
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input 
                      type="url" 
                      value={businessUrl}
                      onChange={(e) => setBusinessUrl(e.target.value)}
                      placeholder="https://example.com" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-white/40 italic">We will scrape this site to automatically learn about your offerings.</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-white/70 uppercase tracking-widest flex justify-between">
                    <span>What do you do?</span>
                    <span className="text-white/30 font-normal normal-case tracking-normal">Optional</span>
                  </label>
                  <textarea 
                    value={blurb}
                    onChange={(e) => setBlurb(e.target.value)}
                    placeholder="Briefly describe what you sell or who you target..." 
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all min-h-[100px] resize-none"
                  />
                  <p className="text-[10px] text-white/40 italic">Add any extra hints you want the AI to focus on.</p>
                </div>

                <div className="mt-4 flex flex-col items-center gap-3">
                  <button 
                    onClick={handleGenerate}
                    disabled={loading || !businessName}
                    className="w-full bg-gradient-to-r from-primary to-purple-600 text-white p-4 rounded-xl font-black uppercase tracking-widest text-[11px] hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Generating Profile...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Generate with DeepSeek AI</>
                    )}
                  </button>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    {3 - generationCount} free generations remaining
                  </span>
                </div>
              </div>
            )}

            {step === 3 && generatedData && (
              <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-white/50 uppercase tracking-widest">Industry</label>
                    <input 
                      type="text" 
                      value={generatedData.industry}
                      onChange={(e) => setGeneratedData({...generatedData, industry: e.target.value})}
                      className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-white/50 uppercase tracking-widest">Target Audience</label>
                    <input 
                      type="text" 
                      value={generatedData.target_audience}
                      onChange={(e) => setGeneratedData({...generatedData, target_audience: e.target.value})}
                      className="bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-white/50 uppercase tracking-widest">Aims & Mission</label>
                  <textarea 
                    value={generatedData.aims}
                    onChange={(e) => setGeneratedData({...generatedData, aims: e.target.value})}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white min-h-[80px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-white/50 uppercase tracking-widest">Objectives</label>
                  <textarea 
                    value={generatedData.objectives}
                    onChange={(e) => setGeneratedData({...generatedData, objectives: e.target.value})}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white min-h-[80px]"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-black text-white/50 uppercase tracking-widest">Full Overview (Markdown)</label>
                  <textarea 
                    value={generatedData.overview_md}
                    onChange={(e) => setGeneratedData({...generatedData, overview_md: e.target.value})}
                    className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white min-h-[200px] font-mono"
                  />
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button 
                    onClick={() => setStep(2)}
                    disabled={loading}
                    className="flex-1 bg-white/5 text-white p-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
                  >
                    Regenerate
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="flex-2 bg-white text-black p-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save & Continue'}
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OnboardingWizard;

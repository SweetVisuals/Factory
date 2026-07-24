import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

export default function PricingCards({ hideHeader = false }: { hideHeader?: boolean }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
  const [planType, setPlanType] = useState<'individual' | 'business'>('individual');

  return (
    <div className="w-full text-white font-sans">
      <div className="w-full max-w-6xl mx-auto">
        
        {!hideHeader && (
          <>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight">Upgrade your plan</h1>
            <p className="text-gray-400 text-lg mb-10 max-w-2xl">
              Lock better prices with upgrade or scale your creativity maximizing your current plan
            </p>
          </>
        )}

        {/* Toggles Row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          
          {/* Plan Type Toggle */}
          <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
            <button 
              onClick={() => setPlanType('individual')}
              className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${planType === 'individual' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              INDIVIDUAL PLANS
            </button>
            <button 
              onClick={() => setPlanType('business')}
              className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-all ${planType === 'business' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              BUSINESS PLANS
            </button>
          </div>

          {/* Right Side Toggles */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-black/40 rounded-full p-1 px-4 border border-white/5">
              <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-gray-500'}`}>Monthly</span>
              <button 
                onClick={() => setBillingCycle(billingCycle === 'annual' ? 'monthly' : 'annual')}
                className="w-10 h-5 rounded-full bg-sky-500 relative transition-colors focus:outline-none"
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-black rounded-full transition-transform ${billingCycle === 'annual' ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className={`text-sm font-semibold ${billingCycle === 'annual' ? 'text-white' : 'text-gray-500'}`}>Annual</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* STARTER */}
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 flex flex-col">
            <h3 className="text-2xl font-black tracking-tight">STARTER</h3>
            <p className="text-gray-500 text-sm mb-6">For first-time AI content creators</p>
            
            <div className="bg-[#222222] rounded-xl p-4 mb-6 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <SparkleIcon color="white" />
                <span className="font-bold text-lg">10,000 Leads</span>
              </div>
              <div className="text-gray-400 text-xs pl-6 space-y-1 mb-4">
                <p>≈ 10,000 AI Researches</p>
                <p>≈ 5 Active Campaigns</p>
                <p>≈ 500,000 Edge invocations</p>
              </div>
              <div className="border-t border-white/10 pt-3 flex items-center gap-2 text-xs text-gray-400">
                <Check size={14} className="text-gray-500" /> 5GB Database & Egress
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black tracking-tighter">${billingCycle === 'annual' ? '14' : '19'}</span>
                <span className="text-gray-500 text-xs">/mo</span>
              </div>
            </div>

            <button className="w-full bg-white text-black font-bold py-3 rounded-xl mb-4 hover:bg-gray-200 transition-colors">
              Get Starter
            </button>
            <p className="text-center text-xs text-gray-500 mb-8 pb-4 border-b border-white/10">No difference compared to monthly</p>

            <div className="space-y-3 flex-grow">
              <Feature check>4 Concurrent Scrapers</Feature>
              <Feature check>Access to Cloud Scraper</Feature>
              <Feature check>Access to AI Enrichment</Feature>
              <Feature check>Access to selected models only</Feature>
              <Feature check={false}>Early access to advanced AI features</Feature>
              <Feature check={false}>Access to unlimited marketplace</Feature>
              <Feature check={false}>Lowest cost per credit</Feature>
            </div>

            <div className="mt-8 bg-[#222222] border border-white/5 rounded-xl p-4 text-xs text-gray-400">
              <p className="font-bold text-gray-300 flex items-center gap-2 mb-2 uppercase text-[10px] tracking-widest"><LockIcon /> No unlimited on top models</p>
              <p className="mb-4">Selected models only, without unlimited mode</p>
              
              <div className="flex flex-wrap gap-2">
                <span className="bg-[#111] px-2 py-1 rounded border border-white/5 flex items-center gap-1"><X size={10}/> DeepSeek Pro</span>
                <span className="bg-[#111] px-2 py-1 rounded border border-white/5 flex items-center gap-1"><X size={10}/> GPT-4o</span>
              </div>
            </div>
          </div>

          {/* PLUS */}
          <div className="bg-[#111827] border border-sky-500/30 rounded-2xl p-6 flex flex-col relative" style={{boxShadow: '0 0 40px rgba(14, 165, 233, 0.05)'}}>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-2xl font-black tracking-tight text-sky-400">PLUS</h3>
              <span className="bg-[#e11d48] text-white text-[10px] font-black px-2 py-0.5 rounded-sm">20% OFF</span>
            </div>
            <p className="text-gray-400 text-sm mb-6">For consistent and easy AI content creation</p>
            
            <div className="bg-[#1e293b] rounded-xl p-4 mb-6 border border-sky-500/20">
              <div className="flex items-center gap-2 mb-2">
                <SparkleIcon color="#0ea5e9" />
                <span className="font-bold text-lg text-white">25,000 Leads</span>
              </div>
              <div className="text-gray-400 text-xs pl-6 space-y-1 mb-4">
                <p>≈ 25,000 AI Researches</p>
                <p>≈ 15 Active Campaigns</p>
                <p>≈ 1,000,000 Edge invocations</p>
              </div>
              <div className="border-t border-sky-500/20 pt-3 flex items-center gap-2 text-xs text-gray-400">
                <Check size={14} className="text-sky-500" /> 15GB Database & Egress
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl text-[#e11d48] line-through font-bold">${billingCycle === 'annual' ? '59' : '59'}</span>
                <span className="text-4xl font-black tracking-tighter">${billingCycle === 'annual' ? '47' : '59'}</span>
                <span className="text-gray-500 text-xs">/mo</span>
              </div>
            </div>

            <button className="w-full bg-sky-500 text-white font-bold py-3 rounded-xl mb-4 hover:bg-sky-400 transition-colors" style={{boxShadow: '0 0 20px rgba(14, 165, 233, 0.4)'}}>
              Get Plus
            </button>
            <p className={`text-center text-xs ${billingCycle === 'annual' ? 'text-sky-400' : 'text-gray-500'} mb-8 pb-4 border-b border-white/10`}>{billingCycle === 'annual' ? 'Save $144 compared to monthly' : 'No difference compared to monthly'}</p>

            <div className="space-y-3 flex-grow">
              <Feature check color="#38bdf8">8 Concurrent Scrapers</Feature>
              <Feature check color="#38bdf8">Access to Cloud Scraper</Feature>
              <Feature check color="#38bdf8">Access to all Enrichment models</Feature>
              <Feature check color="#38bdf8">Access to all models & features</Feature>
              <Feature check color="#38bdf8">Early access to advanced AI features</Feature>
              <Feature check color="#38bdf8">Access to unlimited marketplace</Feature>
              <Feature check={false}>Lowest cost per credit</Feature>
            </div>

            <div className="mt-8 bg-[#1e293b] border border-sky-500/20 rounded-xl p-4 text-xs text-gray-400 relative overflow-hidden">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-[10px] tracking-widest uppercase">ALL MODELS 7-DAY UNLIMITED</span>
                <span className="bg-sky-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm">FULL POWER</span>
              </div>
              <p className="mb-4">Full power with extended duration & resolution</p>
              <div className="flex flex-col gap-2">
                <span className="bg-[#111111] px-2 py-1.5 rounded border border-sky-500/20 flex items-center gap-2"><InfinityIcon /> DeepSeek Pro</span>
                <span className="bg-[#111111] px-2 py-1.5 rounded border border-sky-500/20 flex items-center gap-2"><InfinityIcon /> GPT-4o Mini</span>
              </div>
            </div>
          </div>

          {/* ULTRA */}
          <div className="bg-[#24101e] border border-[#e11d48]/40 rounded-2xl p-6 flex flex-col relative" style={{boxShadow: '0 0 50px rgba(225, 29, 72, 0.08)'}}>
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-[#e11d48]/10 to-transparent pointer-events-none rounded-2xl" />
            <div className="flex items-center gap-3 mb-1 z-10">
              <h3 className="text-2xl font-black tracking-tight text-white">ULTRA</h3>
              <span className="bg-[#e11d48] text-white text-[10px] font-black px-2 py-0.5 rounded-sm">23% OFF</span>
              <span className="bg-blue-500 text-white text-[10px] font-black px-2 py-0.5 rounded-sm flex items-center gap-1"><DiamondIcon/> BEST VALUE</span>
            </div>
            <p className="text-gray-400 text-sm mb-6 z-10">For creators building AI projects</p>
            
            <div className="bg-[#38162d] rounded-xl p-4 mb-6 border border-[#e11d48]/30 z-10">
              <div className="flex items-center gap-2 mb-2">
                <SparkleIcon color="white" />
                <span className="font-bold text-lg text-white">100,000 Leads</span>
              </div>
              <div className="text-gray-400 text-xs pl-6 space-y-1 mb-4">
                <p>≈ 100,000 AI Researches</p>
                <p>≈ Unlimited Campaigns</p>
                <p>≈ 5,000,000 Edge invocations</p>
              </div>
              <div className="border-t border-[#e11d48]/30 pt-3 flex items-center gap-2 text-xs text-gray-400">
                <Check size={14} className="text-[#e11d48]" /> 50GB Database & Egress
              </div>
            </div>

            <div className="mb-6 z-10">
              <div className="flex items-baseline gap-2">
                <span className="text-xl text-[#e11d48] line-through font-bold">${billingCycle === 'annual' ? '129' : '129'}</span>
                <span className="text-4xl font-black tracking-tighter">${billingCycle === 'annual' ? '99' : '129'}</span>
                <span className="text-gray-500 text-xs">/mo</span>
              </div>
            </div>

            <button className="w-full bg-[#e11d48] text-white font-bold py-3 rounded-xl mb-4 hover:bg-red-500 transition-colors z-10 relative" style={{boxShadow: '0 0 20px rgba(225, 29, 72, 0.4)'}}>
              Get Ultra
            </button>
            <p className={`text-center text-xs ${billingCycle === 'annual' ? 'text-[#fda4af]' : 'text-gray-500'} mb-8 pb-4 border-b border-white/10 z-10`}>{billingCycle === 'annual' ? 'Save $360 compared to monthly' : 'No difference compared to monthly'}</p>

            <div className="space-y-3 flex-grow z-10">
              <Feature check color="white">20 Concurrent Scrapers</Feature>
              <Feature check color="white">Access to Cloud Scraper</Feature>
              <Feature check color="white">Access to all Enrichment models</Feature>
              <Feature check color="white">Access to all models & features</Feature>
              <Feature check color="white">Early access to advanced AI features</Feature>
              <Feature check color="white">Access to unlimited marketplace</Feature>
              <div className="flex justify-between items-center w-full">
                 <Feature check color="white">Lowest cost per credit</Feature>
                 <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-sm">55% CHEAPER</span>
              </div>
            </div>

            <div className="mt-8 bg-[#38162d] border border-[#e11d48]/30 rounded-xl p-4 text-xs text-gray-400 z-10 relative">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-[10px] tracking-widest uppercase">ALL MODELS 7-DAY UNLIMITED</span>
                <span className="bg-[#e11d48] text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm">FULL POWER</span>
              </div>
              <p className="mb-4">Full power with extended duration & resolution</p>
              <div className="flex flex-col gap-2">
                <span className="bg-[#24101e] px-2 py-1.5 rounded border border-[#e11d48]/30 flex items-center gap-2"><InfinityIcon /> DeepSeek Pro</span>
                <span className="bg-[#24101e] px-2 py-1.5 rounded border border-[#e11d48]/30 flex items-center gap-2"><InfinityIcon /> GPT-4o</span>
                <span className="bg-[#24101e] px-2 py-1.5 rounded border border-[#e11d48]/30 flex items-center gap-2"><InfinityIcon /> Claude 3.5 Sonnet</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

const Feature = ({ children, check, color = 'white' }: { children: React.ReactNode, check: boolean, color?: string }) => (
  <div className="flex items-center gap-2 text-xs">
    {check ? (
      <Check size={14} color={color} className="shrink-0" />
    ) : (
      <X size={14} className="text-gray-600 shrink-0" />
    )}
    <span className={check ? 'text-gray-300' : 'text-gray-600'}>{children}</span>
  </div>
);

const SparkleIcon = ({ color }: { color: string }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" fill={color} />
  </svg>
);

const LockIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const InfinityIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
    <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.33-6 4Z" />
  </svg>
);

const DiamondIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
  </svg>
);

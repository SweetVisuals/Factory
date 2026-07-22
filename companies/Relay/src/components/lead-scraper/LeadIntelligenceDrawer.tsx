import React, { useState, useEffect } from 'react';
import { Lead } from '@/types';
import {
  X, BrainCircuit, Globe, Mail, Phone, Linkedin, Facebook, Instagram, Twitter,
  Building2, MapPin, Users, Calendar, DollarSign, Target, Shield, Zap,
  TrendingUp, Newspaper, Star, ExternalLink, RefreshCw, Loader2,
  Briefcase, AlertTriangle, Award, ChevronRight, Cpu, MessageSquare,
  ArrowUpRight, CircleDot, Sparkles, Copy, Check
} from 'lucide-react';
import axios from 'axios';

interface LeadIntelligenceDrawerProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onReResearch?: (leadId: string) => void;
  onLeadUpdate?: (updatedLead: Lead) => void;
}

type TabId = 'overview' | 'people' | 'services' | 'intelligence' | 'email';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Building2 size={14} /> },
  { id: 'people', label: 'People', icon: <Users size={14} /> },
  { id: 'services', label: 'Services', icon: <Briefcase size={14} /> },
  { id: 'intelligence', label: 'Intel', icon: <BrainCircuit size={14} /> },
  { id: 'email', label: 'Email', icon: <MessageSquare size={14} /> },
];

// Research score circle
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/[0.05]" />
        <circle cx="22" cy="22" r={radius} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="text-[11px] font-black" style={{ color }}>{score}</span>
    </div>
  );
};

// Status pill
const StatusPill: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Researched' },
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Pending' },
    failed: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Failed' },
    error: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Error' },
    incomplete: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Incomplete' },
  };
  const c = config[status || ''] || { bg: 'bg-foreground/[0.05]', text: 'text-muted-foreground', label: 'Unknown' };

  return (
    <span className={`px-3 py-1 ${c.bg} ${c.text} font-black uppercase tracking-widest text-[9px] rounded-full`}>
      {c.label}
    </span>
  );
};

// Empty state
const EmptySection: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-16 opacity-20">
    {icon}
    <p className="text-[10px] font-black uppercase tracking-widest mt-4">{message}</p>
  </div>
);

// Fact card
const FactCard: React.FC<{ icon: React.ReactNode; label: string; value: string | null | undefined }> = ({ icon, label, value }) => (
  <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors group">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/40 group-hover:text-primary transition-colors">
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">{label}</span>
    </div>
    <p className="text-[13px] font-bold text-white/90 pl-9">{value || '—'}</p>
  </div>
);

// Tag chip
const TagChip: React.FC<{ label: string; variant?: 'primary' | 'secondary' }> = ({ label, variant = 'primary' }) => (
  <span className={`inline-block px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-lg border ${
    variant === 'primary' 
      ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20' 
      : 'bg-white/[0.04] text-white/60 border-white/5 hover:bg-white/[0.08]'
  }`}>
    {label}
  </span>
);

// Severity badge
const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => {
  const colors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400',
    medium: 'bg-amber-500/10 text-amber-400',
    low: 'bg-emerald-500/10 text-emerald-400',
  };
  return (
    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-widest rounded-full ${colors[severity] || colors.medium}`}>
      {severity}
    </span>
  );
};

// Growth signal type icon
const GrowthIcon: React.FC<{ type: string }> = ({ type }) => {
  const icons: Record<string, React.ReactNode> = {
    hiring: <Users size={14} />,
    expansion: <TrendingUp size={14} />,
    award: <Award size={14} />,
    funding: <DollarSign size={14} />,
    new_product: <Sparkles size={14} />,
  };
  return <>{icons[type] || <CircleDot size={14} />}</>;
};


export const LeadIntelligenceDrawer: React.FC<LeadIntelligenceDrawerProps> = ({ lead, open, onClose, onReResearch, onLeadUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isResearching, setIsResearching] = useState(false);
  const [enrichedLead, setEnrichedLead] = useState<Lead | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Fetch full enriched data when drawer opens
  useEffect(() => {
    if (open && lead?.id) {
      setActiveTab('overview');
      fetchLeadIntelligence(lead.id);
    }
  }, [open, lead?.id]);

  const fetchLeadIntelligence = async (id: string) => {
    try {
      const res = await axios.get(`/api/lead-intelligence/${id}`);
      if (res.data.success) {
        setEnrichedLead(res.data.data);
      }
    } catch (e) {
      // Fall back to the lead data we already have
      setEnrichedLead(lead);
    }
  };

  const handleReResearch = async () => {
    if (!lead?.id || isResearching) return;
    setIsResearching(true);
    try {
      const res = await axios.post('/api/deep-research', {
        company: lead.company,
        website: lead.website,
        notesContext: '',
        leadId: lead.id
      });
      if (res.data.success) {
        // Refresh the lead data
        await fetchLeadIntelligence(lead.id);
        onReResearch?.(lead.id);
      }
    } catch (e) {
      console.error('Re-research failed:', e);
    } finally {
      setIsResearching(false);
    }
  };

  const handleCopyEmail = () => {
    const emailText = displayLead?.personalized_email;
    if (emailText) {
      navigator.clipboard.writeText(emailText);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const displayLead = enrichedLead || lead;
  if (!displayLead) return null;

  const faviconUrl = displayLead.website
    ? `https://www.google.com/s2/favicons?domain=${new URL(displayLead.website.startsWith('http') ? displayLead.website : `https://${displayLead.website}`).hostname}&sz=64`
    : null;

  const score = displayLead.research_score || 0;
  const keyPeople = displayLead.key_people || [];
  const painPoints = displayLead.pain_points || [];
  const growthSignals = displayLead.growth_signals || [];
  const recentNews = displayLead.recent_news || [];
  const servicesOffered = displayLead.services_offered || [];
  const techStack = displayLead.tech_stack || [];
  const socialPresence = displayLead.social_presence || {};

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 z-[110] h-full w-full max-w-[780px] bg-[#0a0a0a] border-l border-white/10 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        
        {/* HEADER */}
        <div className="shrink-0 p-6 pb-4 border-b border-white/10 bg-[#111]">
          {/* Top row */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              {/* Company avatar / favicon */}
              <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                {faviconUrl ? (
                  <img src={faviconUrl} alt="" className="w-8 h-8" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <Building2 size={24} className="text-muted-foreground/40" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight leading-tight">
                  {displayLead.company || displayLead.name}
                </h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <StatusPill status={displayLead.research_status} />
                  {displayLead.industry && (
                    <span className="text-[10px] font-bold text-white/50">{displayLead.industry}</span>
                  )}
                </div>
              </div>
            </div>

            <button onClick={onClose} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Research Quality Score */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <ScoreBadge score={score} />
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Research Quality</span>
              <p className="text-[11px] font-bold text-white/60 mt-0.5">
                {score >= 70 ? 'Comprehensive data collected' : score >= 40 ? 'Partial data — consider re-scanning' : 'Minimal data — deep scan recommended'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleReResearch}
              disabled={isResearching}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-black uppercase tracking-widest text-[9px] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_15px_-5px_rgba(139,92,246,0.6)]"
            >
              {isResearching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {isResearching ? 'Researching...' : 'Deep Scan'}
            </button>

            {displayLead.website && (
              <a href={displayLead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.1] rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all">
                <Globe size={12} /> Website
              </a>
            )}
            {displayLead.email && (
              <a href={`mailto:${displayLead.email}`} className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.1] rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all">
                <Mail size={12} /> Email
              </a>
            )}
            {displayLead.linkedin && (
              <a href={displayLead.linkedin} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] border border-white/10 text-white/80 hover:text-white hover:bg-white/[0.1] rounded-xl font-bold uppercase tracking-widest text-[9px] transition-all">
                <Linkedin size={12} /> LinkedIn
              </a>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mt-5 border-b border-white/10 -mb-4 -mx-6 px-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 font-bold uppercase tracking-widest text-[9px] border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-white/40 hover:text-white/70 hover:border-white/20'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-6">
          {isResearching && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-pulse">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">AI is analyzing this company...</p>
              <p className="text-[9px] font-bold text-white/30">Scraping website, searching Google, extracting intelligence</p>
            </div>
          )}

          {!isResearching && activeTab === 'overview' && (
            <>
              {/* Company Description */}
              {displayLead.company_description && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Building2 size={12} /> Company Overview
                  </h3>
                  <p className="text-sm font-medium text-white/80 leading-relaxed pl-1">
                    {displayLead.company_description}
                  </p>
                </div>
              )}

              {/* Key Facts Grid */}
              <div className="grid grid-cols-2 gap-3">
                <FactCard icon={<Briefcase size={13} />} label="Industry" value={displayLead.industry} />
                <FactCard icon={<MapPin size={13} />} label="Location" value={displayLead.location} />
                <FactCard icon={<Users size={13} />} label="Company Size" value={displayLead.company_size || displayLead.employees} />
                <FactCard icon={<Calendar size={13} />} label="Founded" value={displayLead.year_founded} />
                <FactCard icon={<DollarSign size={13} />} label="Revenue" value={displayLead.annual_revenue} />
                <FactCard icon={<Target size={13} />} label="Target Market" value={displayLead.target_market} />
              </div>

              {/* Competitive Advantage */}
              {displayLead.competitive_advantage && (
                <div className="p-5 bg-primary/[0.05] border border-primary/20 rounded-xl">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-2 mb-2">
                    <Shield size={12} /> Competitive Advantage
                  </h3>
                  <p className="text-sm font-medium text-white/80 leading-relaxed">{displayLead.competitive_advantage}</p>
                </div>
              )}

              {/* Legacy summary fallback */}
              {!displayLead.company_description && displayLead.summary && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <BrainCircuit size={12} /> Research Summary
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none">
                    {displayLead.summary.split('\n').map((line, i) => {
                      if (!line.trim()) return <br key={i} />;
                      const isHeader = line.startsWith('##');
                      const isBold = line.startsWith('**');
                      return (
                        <p key={i} className={`${isHeader ? 'text-base font-black text-white uppercase tracking-tight mt-6 mb-2' : ''} ${isBold ? 'font-bold text-white' : 'font-medium text-white/60 leading-relaxed'}`}>
                          {line.replace(/##/g, '').replace(/\*\*/g, '')}
                        </p>
                      );
                    })}
                  </div>
                </div>
              )}

              {!displayLead.company_description && !displayLead.summary && (
                <EmptySection icon={<BrainCircuit size={40} />} message="No research data yet. Click Deep Scan to analyze." />
              )}
            </>
          )}

          {!isResearching && activeTab === 'people' && (
            <>
              {/* Lead Contact Info */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Mail size={12} /> Lead Contact
                </h3>
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-3">
                  {displayLead.name && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <span className="text-primary font-black text-sm">{displayLead.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-white">{displayLead.name}</p>
                        {(displayLead.title || displayLead.role) && (
                          <p className="text-[10px] font-bold text-white/50">{displayLead.title || displayLead.role}</p>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 pl-[52px]">
                    {displayLead.email && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-white/60">
                        <Mail size={12} className="text-white/40" /> {displayLead.email}
                      </div>
                    )}
                    {displayLead.phone && (
                      <div className="flex items-center gap-2 text-[11px] font-bold text-white/60">
                        <Phone size={12} className="text-white/40" /> {displayLead.phone}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Key People */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Users size={12} /> Key People ({keyPeople.length})
                </h3>
                {keyPeople.length > 0 ? (
                  <div className="space-y-2">
                    {keyPeople.map((person, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors group">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-white/[0.05] flex items-center justify-center">
                            <span className="text-[11px] font-black text-white/50">{person.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="text-[13px] font-bold text-white">{person.name}</p>
                            <p className="text-[10px] font-bold text-white/50">{person.title}</p>
                          </div>
                        </div>
                        {person.linkedin && (
                          <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 text-white/30 hover:text-primary transition-colors">
                            <Linkedin size={16} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<Users size={36} />} message="No key people identified" />
                )}
              </div>
            </>
          )}

          {!isResearching && activeTab === 'services' && (
            <>
              {/* Services */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Briefcase size={12} /> Services Offered ({servicesOffered.length})
                </h3>
                {servicesOffered.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {servicesOffered.map((service, i) => (
                      <TagChip key={i} label={service} variant="primary" />
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<Briefcase size={36} />} message="No services identified" />
                )}
              </div>

              {/* Tech Stack */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Cpu size={12} /> Tech Stack ({techStack.length})
                </h3>
                {techStack.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {techStack.map((tech, i) => (
                      <TagChip key={i} label={tech} variant="secondary" />
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<Cpu size={36} />} message="No technology data detected" />
                )}
              </div>
            </>
          )}

          {!isResearching && activeTab === 'intelligence' && (
            <>
              {/* Pain Points */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <AlertTriangle size={12} /> Pain Points ({painPoints.length})
                </h3>
                {painPoints.length > 0 ? (
                  <div className="space-y-2">
                    {painPoints.map((point, i) => (
                      <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] font-black text-white">{point.area}</span>
                          <SeverityBadge severity={point.severity || 'medium'} />
                        </div>
                        <p className="text-[11px] font-medium text-white/50 leading-relaxed">{point.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<AlertTriangle size={36} />} message="No pain points identified" />
                )}
              </div>

              {/* Growth Signals */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <TrendingUp size={12} /> Growth Signals ({growthSignals.length})
                </h3>
                {growthSignals.length > 0 ? (
                  <div className="space-y-0 border-l-2 border-white/10 ml-2">
                    {growthSignals.map((signal, i) => (
                      <div key={i} className="flex items-start gap-3 pl-4 py-3 hover:bg-white/[0.02] rounded-r-xl transition-colors relative">
                        <div className="absolute -left-[9px] top-4 w-4 h-4 rounded-full bg-white/10 border-2 border-[#0a0a0a] flex items-center justify-center text-white/70">
                          <GrowthIcon type={signal.type} />
                        </div>
                        <div className="ml-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">{signal.type.replace('_', ' ')}</span>
                            {signal.date && <span className="text-[9px] font-bold text-white/40">{signal.date}</span>}
                          </div>
                          <p className="text-[12px] font-medium text-white/70 mt-0.5">{signal.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<TrendingUp size={36} />} message="No growth signals detected" />
                )}
              </div>

              {/* Recent News */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Newspaper size={12} /> Recent News ({recentNews.length})
                </h3>
                {recentNews.length > 0 ? (
                  <div className="space-y-2">
                    {recentNews.map((news, i) => (
                      <div key={i} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors">
                        <p className="text-[12px] font-bold text-white/90">{news.headline}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {news.date && <span className="text-[9px] font-bold text-white/40">{news.date}</span>}
                          {news.source && <span className="text-[9px] font-bold text-primary/60">{news.source}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySection icon={<Newspaper size={36} />} message="No recent news found" />
                )}
              </div>

              {/* Social Presence */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Star size={12} /> Social Presence
                </h3>
                <div className="p-5 bg-white/[0.02] border border-white/5 rounded-xl">
                  {(socialPresence.google_rating || socialPresence.review_count) ? (
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={16}
                            className={i < Math.round(socialPresence.google_rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-white/10'}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-black text-white">{socialPresence.google_rating || '—'}</span>
                      {socialPresence.review_count && (
                        <span className="text-[10px] font-bold text-white/50">({socialPresence.review_count} reviews)</span>
                      )}
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    {(socialPresence.facebook_url || displayLead.facebook) && (
                      <a href={socialPresence.facebook_url || displayLead.facebook} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/50 hover:text-[#1877F2] hover:bg-[#1877F2]/10 hover:border-[#1877F2]/20 transition-all">
                        <Facebook size={16} />
                      </a>
                    )}
                    {(socialPresence.instagram_url || displayLead.instagram) && (
                      <a href={socialPresence.instagram_url || displayLead.instagram} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/50 hover:text-[#E4405F] hover:bg-[#E4405F]/10 hover:border-[#E4405F]/20 transition-all">
                        <Instagram size={16} />
                      </a>
                    )}
                    {(socialPresence.twitter_url || displayLead.twitter) && (
                      <a href={socialPresence.twitter_url || displayLead.twitter} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/50 hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10 hover:border-[#1DA1F2]/20 transition-all">
                        <Twitter size={16} />
                      </a>
                    )}
                    {(socialPresence.linkedin_url || displayLead.linkedin) && (
                      <a href={socialPresence.linkedin_url || displayLead.linkedin} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/5 flex items-center justify-center text-white/50 hover:text-[#0A66C2] hover:bg-[#0A66C2]/10 hover:border-[#0A66C2]/20 transition-all">
                        <Linkedin size={16} />
                      </a>
                    )}
                    {!(socialPresence.facebook_url || displayLead.facebook) && 
                     !(socialPresence.instagram_url || displayLead.instagram) && 
                     !(socialPresence.twitter_url || displayLead.twitter) && 
                     !(socialPresence.linkedin_url || displayLead.linkedin) && 
                     !socialPresence.google_rating && (
                      <EmptySection icon={<Star size={36} />} message="No social presence data" />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {!isResearching && activeTab === 'email' && (
            <>
              {displayLead.personalized_email ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                      <MessageSquare size={12} /> Personalised Email Draft
                    </h3>
                    <button onClick={handleCopyEmail} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/5 text-white/50 hover:text-white rounded-lg font-bold uppercase tracking-widest text-[9px] transition-all">
                      {copiedEmail ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      {copiedEmail ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-6 bg-white/[0.02] border border-white/5 rounded-xl">
                    <pre className="text-sm font-medium text-white/70 leading-relaxed whitespace-pre-wrap font-sans">
                      {displayLead.personalized_email}
                    </pre>
                  </div>
                </div>
              ) : (
                <EmptySection icon={<MessageSquare size={40} />} message="No email draft generated yet" />
              )}

              {/* Personalised Detail from summary */}
              {displayLead.summary && displayLead.summary.includes('Personalised Detail') && (
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Sparkles size={12} /> Personalisation Hook
                  </h3>
                  <div className="p-5 bg-primary/[0.05] border border-primary/20 rounded-xl">
                    {displayLead.summary.split('\n').filter(l => l.trim() && !l.startsWith('##')).map((line, i) => (
                      <p key={i} className="text-sm font-medium text-white/80 leading-relaxed">{line}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default LeadIntelligenceDrawer;

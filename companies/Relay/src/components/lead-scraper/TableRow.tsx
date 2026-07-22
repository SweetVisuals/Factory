import React from 'react';
import { Lead } from '@/types';
import {
  ExternalLink, Facebook, Instagram, Linkedin, Twitter, FileText,
  ShieldCheck, CheckCircle2, XCircle, Loader2, AlertTriangle, BrainCircuit, ChevronDown, ChevronUp, Globe, Mail, User, Building2, MapPin
} from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { CustomCheckbox } from '../ui/CustomCheckbox';
import { LeadIntelligenceDrawer } from './LeadIntelligenceDrawer';

import { Sparkles } from 'lucide-react';

interface Props {
  lead: Lead;
  selected: boolean;
  onSelect: (id: string) => void;
  hidePersonalColumns?: boolean;
  onDelete?: (id: string) => void;
}

// Inline research score dot indicator
const ResearchDot: React.FC<{ status?: string | null; score?: number }> = ({ status, score }) => {
  if (!status || status === 'pending') return null;
  
  let color = 'bg-foreground/10';
  let title = 'Unknown';
  
  if (status === 'completed') {
    if (score && score >= 70) {
      color = 'bg-emerald-400';
      title = `Research Score: ${score}/100`;
    } else if (score && score >= 40) {
      color = 'bg-amber-400';
      title = `Research Score: ${score}/100`;
    } else {
      color = 'bg-emerald-400/50';
      title = `Research Score: ${score || 0}/100`;
    }
  } else if (status === 'failed' || status === 'error') {
    color = 'bg-red-400';
    title = 'Research failed';
  } else if (status === 'incomplete') {
    color = 'bg-amber-400';
    title = `Incomplete — Score: ${score || 0}/100`;
  }
  
  return (
    <div className={`w-2 h-2 rounded-full ${color} shrink-0`} title={title} />
  );
};

export const TableRow: React.FC<Props & { validationStatus?: 'idle' | 'loading' | 'valid' | 'warning' | 'invalid', validationMessage?: string, onValidate?: () => void }> = ({ lead, selected, onSelect, hidePersonalColumns, onDelete, validationStatus = 'idle', validationMessage = '', onValidate }) => {
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  return (
    <>
      <tr className={`group transition-all duration-300 border-none ${selected ? 'bg-primary/10' : 'hover:bg-foreground/[0.02]'}`}>
        <td className="px-6 py-4 w-12">
          <CustomCheckbox
            checked={selected}
            onChange={() => onSelect(lead.id)}
          />
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-foreground/[0.03] flex items-center justify-center shrink-0 group-hover:bg-foreground/[0.05] transition-colors">
              <Mail size={14} className="text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-foreground tracking-tight">{lead.email}</span>
                {lead.email && onValidate && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onValidate(); }}
                    disabled={validationStatus === 'loading' || validationStatus === 'valid'}
                    className="focus:outline-none"
                  >
                    {validationStatus === 'idle' && <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />}
                    {validationStatus === 'loading' && <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />}
                    {validationStatus === 'valid' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {validationStatus === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                    {validationStatus === 'invalid' && <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  </button>
                )}
              </div>
              {lead.phone && <span className="text-[10px] font-bold text-muted-foreground/60">{lead.phone}</span>}
            </div>
          </div>
        </td>
        
        {!hidePersonalColumns && (
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-none bg-foreground/[0.03] flex items-center justify-center shrink-0 group-hover:bg-foreground/[0.05] transition-colors">
                <User size={14} className="text-muted-foreground" />
              </div>
              <span className="text-[13px] font-bold text-foreground/80">{lead.name || 'Unknown'}</span>
            </div>
          </td>
        )}

        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-foreground/[0.03] flex items-center justify-center shrink-0 group-hover:bg-foreground/[0.05] transition-colors">
              <Building2 size={14} className="text-muted-foreground" />
            </div>
            <span className="text-[13px] font-bold text-foreground/80 truncate max-w-[150px]">{lead.company}</span>
          </div>
        </td>

        <td className="px-6 py-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-none transition-all font-black uppercase tracking-widest text-[9px] ${
              lead.research_status === 'completed' 
                ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                : lead.research_status === 'failed' || lead.research_status === 'error'
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                  : 'bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.05]'
            }`}
          >
            <BrainCircuit size={12} />
            <ResearchDot status={lead.research_status} score={lead.research_score} />
            {lead.research_status === 'completed' ? 'Intelligence' : lead.research_status === 'failed' ? 'Failed' : 'Analyze'}
            {lead.research_score && lead.research_score > 0 && (
              <span className="ml-1 text-[8px] opacity-60">{lead.research_score}</span>
            )}
          </button>
        </td>

        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-foreground/[0.03] flex items-center justify-center shrink-0 group-hover:bg-foreground/[0.05] transition-colors">
              <MapPin size={14} className="text-muted-foreground" />
            </div>
            <span className="text-[13px] font-bold text-foreground/70 truncate max-w-[120px]">{lead.location || '-'}</span>
          </div>
        </td>

        <td className="px-6 py-4">
          {lead.website ? (
            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:text-foreground transition-colors group/link">
              <div className="w-8 h-8 rounded-none bg-primary/10 flex items-center justify-center group-hover/link:bg-primary transition-colors">
                <Globe size={14} className="group-hover/link:text-background" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Visit</span>
            </a>
          ) : <span className="text-foreground/10">-</span>}
        </td>

        <td className="px-6 py-4">
          <div className="flex gap-2">
            {lead.linkedin && <SocialLink href={lead.linkedin} icon={<Linkedin size={14} />} />}
            {lead.twitter && <SocialLink href={lead.twitter} icon={<Twitter size={14} />} />}
            {lead.facebook && <SocialLink href={lead.facebook} icon={<Facebook size={14} />} />}
            {lead.instagram && <SocialLink href={lead.instagram} icon={<Instagram size={14} />} />}
          </div>
        </td>

        {onDelete && (
          <td className="px-6 py-4 text-right">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(lead.id); }}
              className="p-2.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 rounded-none transition-all"
            >
              <XCircle size={16} />
            </button>
          </td>
        )}
      </tr>

      {/* Lead Intelligence Drawer */}
      <LeadIntelligenceDrawer
        lead={lead}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onReResearch={() => {
          // The drawer handles the re-research itself
        }}
      />
    </>
  );
};

const SocialLink = ({ href, icon }: { href: string, icon: React.ReactNode }) => (
  <a 
    href={href} 
    target="_blank" 
    rel="noreferrer" 
    className="w-8 h-8 rounded-none bg-foreground/[0.03] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/[0.1] transition-all"
  >
    {icon}
  </a>
);

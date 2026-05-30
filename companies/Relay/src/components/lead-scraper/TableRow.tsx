import React from 'react';
import { Lead } from '@/types';
import {
  ExternalLink, Facebook, Instagram, Linkedin, Twitter, FileText,
  ShieldCheck, CheckCircle2, XCircle, Loader2, AlertTriangle, BrainCircuit, ChevronDown, ChevronUp, Globe, Mail, User, Building2, MapPin
} from 'lucide-react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomCheckbox } from '../ui/CustomCheckbox';

interface Props {
  lead: Lead;
  selected: boolean;
  onSelect: (id: string) => void;
  hidePersonalColumns?: boolean;
  onDelete?: (id: string) => void;
}

export const TableRow: React.FC<Props & { validationStatus?: 'idle' | 'loading' | 'valid' | 'warning' | 'invalid', validationMessage?: string, onValidate?: () => void }> = ({ lead, selected, onSelect, hidePersonalColumns, onDelete, validationStatus = 'idle', validationMessage = '', onValidate }) => {
  const [deepResearch, setDeepResearch] = React.useState<string | null>(null);
  const [isResearching, setIsResearching] = React.useState(false);
  const [deepResearchOpen, setDeepResearchOpen] = React.useState(false);

  const hasDeepResearchContent = deepResearch || (lead.summary && (lead.summary.includes('##') || lead.summary.length > 200));
  const hasError = (deepResearch && deepResearch.startsWith('AI_ERROR')) || (lead.summary && lead.summary.startsWith('AI_ERROR'));
  const contentToShow = deepResearch || lead.summary;

  const handleDeepResearch = async () => {
    if (isResearching) return;
    setIsResearching(true);
    try {
      const res = await axios.post('/api/deep-research', {
        company: lead.company,
        website: lead.website,
        notesContext: ''
      });
      if (res.data.success) {
        setDeepResearch(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsResearching(false);
    }
  };


  return (
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
        <Dialog>
          <DialogTrigger asChild>
            <button className={`flex items-center gap-2 px-3 py-1.5 rounded-none transition-all font-black uppercase tracking-widest text-[9px] ${contentToShow ? 'bg-primary/10 text-primary hover:bg-primary/20' : 'bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.05]'}`}>
              <BrainCircuit size={12} />
              {contentToShow ? 'Intelligence' : 'Analyze'}
            </button>
          </DialogTrigger>
          <DialogContent className="bg-card text-foreground border-none max-w-2xl rounded-none p-0 overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="p-8 pb-4">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
                  <BrainCircuit className="text-primary" size={24} />
                  {lead.company} Intelligence
                </DialogTitle>
                <DialogDescription className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1">
                  AI-Powered Company Analysis & Lead Context
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-8 pt-4 max-h-[70vh] overflow-y-auto scrollbar-none space-y-6">
              <div className="flex items-center justify-between p-6 bg-foreground/[0.02] rounded-none">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-none flex items-center justify-center ${hasDeepResearchContent ? 'bg-primary/20 text-primary' : 'bg-foreground/[0.05] text-muted-foreground/60'}`}>
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-tight">
                      {hasDeepResearchContent ? "Deep Scan Active" : "Standard Intelligence"}
                    </h4>
                    <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
                      {hasDeepResearchContent ? "Comprehensive AI Analysis" : "Initial Scrape Results"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDeepResearch}
                  disabled={isResearching}
                  className={`px-6 py-2.5 rounded-none font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${hasDeepResearchContent ? 'bg-foreground/[0.05] text-foreground hover:bg-foreground/[0.1]' : 'bg-primary text-primary-foreground hover:scale-[1.02]'}`}
                >
                  {isResearching ? <Loader2 size={14} className="animate-spin" /> : <BrainCircuit size={14} />}
                  {isResearching ? "Processing..." : (hasError ? "Retry Scan" : "Deep Scan")}
                </button>
              </div>

              <div className="space-y-6 text-foreground/80">
                {isResearching ? (
                  <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                    <Loader2 size={32} className="animate-spin text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-widest">AI is thinking...</p>
                  </div>
                ) : hasError ? (
                  <div className="p-6 rounded-none bg-red-500/5 text-red-400 space-y-2">
                    <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
                      <AlertTriangle size={14} />
                      Research Interrupted
                    </div>
                    <p className="text-sm font-bold opacity-80">{contentToShow?.replace('AI_ERROR:', '')}</p>
                  </div>
                ) : contentToShow ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    {contentToShow.split('\n').map((line, i) => {
                      if (!line.trim()) return <br key={i} />;
                      const isHeader = line.startsWith('##');
                      const isBold = line.startsWith('**');
                      return (
                        <p key={i} className={`${isHeader ? 'text-lg font-black text-foreground uppercase tracking-tight mt-8 mb-4 border-b border-foreground/[0.03] pb-2' : ''} ${isBold ? 'font-black text-foreground' : 'font-medium text-foreground/60 leading-relaxed'}`}>
                          {line.replace(/##/g, '').replace(/\*\*/g, '')}
                        </p>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center space-y-6 opacity-20">
                    <BrainCircuit size={48} />
                    <p className="text-[10px] font-black uppercase tracking-widest">No Intelligence Data Found</p>
                    <button onClick={handleDeepResearch} className="px-8 py-3 bg-foreground text-background rounded-none font-black uppercase tracking-widest text-[10px]">Initialize Scan</button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
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

import { Sparkles } from 'lucide-react';


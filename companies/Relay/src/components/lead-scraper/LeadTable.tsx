import React from 'react';
import { Lead } from '@/types';
import { Button } from '@/components/ui/button';
import { TableHeader } from './TableHeader';
import { TableRow } from './TableRow';
import { SaveListDialog } from '../campaign/leads/SaveListDialog';
import { ShieldCheck, Loader2, Trash2, PlusCircle, BookmarkPlus, Zap } from 'lucide-react';
import axios from 'axios';
import { supabase } from '@/lib/supabase';

interface Props {
  leads: Lead[];
  selectedLeads: Set<string>;
  onLeadSelect: (selected: Set<string>) => void;
  onAddToCampaign: () => void;
  isLoading: boolean;
  onDelete?: (id: string) => void;
  onClearResults?: () => void;
  onRemoveInvalid?: (invalidLeadIds: string[]) => void;
}

const LoadingState = () => {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-1000">
      <div className="relative">
        <Loader2 className="w-16 h-16 text-primary animate-spin" />
        <div className="absolute inset-0 blur-2xl bg-primary/20 animate-pulse" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Initializing Extraction</h3>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Scanning digital signals...</p>
      </div>
    </div>
  );
};

export const LeadTable: React.FC<Props> = ({
  leads,
  selectedLeads,
  onLeadSelect,
  onAddToCampaign,
  isLoading,
  onDelete,
  onClearResults,
  onRemoveInvalid
}) => {
  const [showSaveList, setShowSaveList] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [validationResults, setValidationResults] = React.useState<Record<string, { status: 'idle' | 'loading' | 'valid' | 'warning' | 'invalid', msg: string }>>({});

  const invalidLeads = React.useMemo(() => {
    return leads.filter(lead => {
      const status = validationResults[lead.id]?.status || lead.validation_status;
      return status === 'invalid';
    });
  }, [leads, validationResults]);

  const handleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      onLeadSelect(new Set());
    } else {
      onLeadSelect(new Set(leads.map(lead => lead.id)));
    }
  };

  const handleValidateLeads = async (leadIds?: string[]) => {
    const idsToValidate = leadIds || Array.from(selectedLeads);
    if (idsToValidate.length === 0) return;

    setIsValidating(true);
    setValidationResults(prev => {
      const next = { ...prev };
      idsToValidate.forEach(id => {
        next[id] = { status: 'loading', msg: 'Validating...' };
      });
      return next;
    });

    try {
      const chunkSize = 5;
      for (let i = 0; i < idsToValidate.length; i += chunkSize) {
        const chunk = idsToValidate.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (id) => {
          const lead = leads.find(l => l.id === id);
          if (!lead?.email) {
            setValidationResults(prev => ({
              ...prev,
              [id]: { status: 'invalid', msg: 'No email' }
            }));
            return;
          }

          try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const res = await axios.post('/api/validate-email', {
              email: lead.email,
              leadId: lead.id
            }, {
              headers: { Authorization: token ? `Bearer ${token}` : '' }
            });

            if (res.data.success) {
              const status = res.data.isValid ? (res.data.warning ? 'warning' : 'valid') : 'invalid';
              const msg = res.data.isValid ? (res.data.warning ? res.data.details : 'Valid') : (res.data.reason || 'Invalid');
              setValidationResults(prev => ({ ...prev, [id]: { status, msg } }));
            } else {
              setValidationResults(prev => ({
                ...prev,
                [id]: { status: 'invalid', msg: res.data.error || 'Validation error' }
              }));
            }
          } catch (e) {
            setValidationResults(prev => ({
              ...prev,
              [id]: { status: 'invalid', msg: 'Network error' }
            }));
          }
        }));
      }
    } finally {
      setIsValidating(false);
    }
  };

  const selectedLeadsArray = leads.filter(lead => selectedLeads.has(lead.id));
  const hidePersonalColumns = !leads.some(lead => lead.source === 'LinkedIn');

  if (isLoading) return <LoadingState />;

  return (
    <div className="bg-card backdrop-blur-3xl rounded-none overflow-hidden flex flex-col h-full">
      {/* Action Header */}
      <div className="p-6 flex flex-wrap items-center justify-between gap-4 bg-foreground/[0.02] border-b border-foreground/[0.02]">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onAddToCampaign}
            disabled={selectedLeads.size === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-none font-black uppercase tracking-widest text-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100 shadow-[0_0_20px_-5px_hsl(var(--primary))]"
          >
            <PlusCircle size={14} />
            Deploy to Campaign
          </button>
          
          <button
            onClick={() => setShowSaveList(true)}
            disabled={selectedLeads.size === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-foreground/[0.03] text-foreground hover:bg-foreground/[0.05] rounded-none font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-30"
          >
            <BookmarkPlus size={14} />
            Save to List
          </button>

          <div className="w-[1px] h-6 bg-foreground/[0.05] mx-1 hidden sm:block" />

          <button
            onClick={() => handleValidateLeads()}
            disabled={selectedLeads.size === 0 || isValidating}
            className="flex items-center gap-2 px-6 py-2.5 bg-foreground/[0.03] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] rounded-none font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-30"
          >
            {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck size={14} />}
            Verify Selected
          </button>

          {onRemoveInvalid && invalidLeads.length > 0 && (
            <button
              onClick={() => onRemoveInvalid(invalidLeads.map(l => l.id))}
              disabled={isValidating}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-none font-black uppercase tracking-widest text-[10px] transition-all"
            >
              <Trash2 size={14} />
              Purge Invalid ({invalidLeads.length})
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-foreground/[0.02] rounded-none">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <span className="text-primary">{selectedLeads.size}</span> / {leads.length} Selected
            </span>
          </div>

          {onClearResults && (
            <button
              onClick={onClearResults}
              className="p-2.5 bg-foreground/[0.03] text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-none transition-all group"
              title="Clear all results"
            >
              <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left ">
          <TableHeader
            onSelectAll={handleSelectAll}
            allSelected={selectedLeads.size === leads.length}
            totalLeads={leads.length}
            hidePersonalColumns={hidePersonalColumns}
            showActions={!!onDelete}
          />
          <tbody className="divide-y divide-white/[0.02]">
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                lead={lead}
                selected={selectedLeads.has(lead.id)}
                hidePersonalColumns={hidePersonalColumns}
                validationStatus={validationResults[lead.id]?.status || lead.validation_status}
                validationMessage={validationResults[lead.id]?.msg || lead.validation_details}
                onValidate={() => handleValidateLeads([lead.id])}
                onDelete={onDelete}
                onSelect={(id) => {
                  const newSelected = new Set(selectedLeads);
                  if (newSelected.has(id)) {
                    newSelected.delete(id);
                  } else {
                    newSelected.add(id);
                  }
                  onLeadSelect(newSelected);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      <SaveListDialog
        open={showSaveList}
        onClose={() => setShowSaveList(false)}
        leads={selectedLeadsArray}
        onSuccess={() => {
          onLeadSelect(new Set());
          setShowSaveList(false);
        }}
      />
    </div>
  );
};


import React, { useState } from 'react';
import { mockLeads } from '@/lib/data/mockLeads';
import { LeadTable } from './LeadTable';
import { CampaignSelector } from './CampaignSelector';
import { Lead } from '@/types';
import { Loader2, Pause, Play, X, CheckCircle2, SearchX } from 'lucide-react';

interface Props {
  results: Lead[];
  hasSearched: boolean;
  scrapeStatus: 'idle' | 'running' | 'paused';
  logs: { timestamp: string, message: string }[];
  onClearResults?: () => void;
  onDeleteLead?: (id: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

const NeuralFeed = ({ logs }: { logs: { timestamp: string, message: string }[] }) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-black/40 p-6 font-mono text-[10px] space-y-2 h-[300px] flex flex-col">
      <div className="flex items-center justify-between mb-2 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary animate-pulse" />
          <span className="text-white font-black uppercase tracking-widest">Neural Link Feed</span>
        </div>
        <span className="text-muted-foreground/40 uppercase tracking-tighter">Live Telemetry</span>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-hide"
      >
        {logs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground/20 italic">
            Awaiting neural broadcast...
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-4 group animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-primary/40 shrink-0 select-none">
                [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
              </span>
              <span className="text-white/80 leading-relaxed break-words whitespace-pre-wrap">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const ScraperProgress = ({
  status,
  onPause,
  onResume,
  onCancel
}: {
  status: 'running' | 'paused',
  onPause?: () => void,
  onResume?: () => void,
  onCancel?: () => void
}) => {
  return (
    <div className="bg-white/[0.02] p-6 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-6">
        <div className="relative">
          {status === 'running' ? (
            <>
              <Loader2 className="animate-spin text-primary" size={24} />
              <div className="absolute inset-0 blur-md bg-primary/20 animate-pulse" />
            </>
          ) : (
            <Pause className="text-amber-500" size={24} />
          )}
        </div>
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-tight">
            {status === 'running' ? 'Active Extraction' : 'Extraction Paused'}
          </h3>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
            {status === 'running' ? 'AI is hunting for leads...' : 'Waiting for resume command'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {status === 'running' ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Pause size={14} />
            Pause
          </button>
        ) : (
          <button
            onClick={onResume}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
          >
            <Play size={14} />
            Resume
          </button>
        )}
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <X size={14} />
          Stop
        </button>
      </div>
    </div>
  );
};

const LeadScraperResults: React.FC<Props> = ({
  results,
  scrapeStatus,
  hasSearched,
  logs = [],
  onClearResults,
  onDeleteLead,
  onPause,
  onResume,
  onCancel
}) => {
  const [selectedLeads, setSelectedLeads] = useState(new Set<string>());
  const [showCampaignSelect, setShowCampaignSelect] = useState(false);

  const displayResults = hasSearched ? results : mockLeads;
  const isLoading = scrapeStatus !== 'idle';
  const isEmptyAfterSearch = !isLoading && hasSearched && results.length === 0;

  if (isEmptyAfterSearch) {
    return (
      <div className="space-y-6">
        <NeuralFeed logs={logs} />
        <div className="bg-white/[0.02] p-16 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 bg-white/[0.03] flex items-center justify-center mx-auto text-muted-foreground/20">
            <SearchX size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">No Leads Captured</h3>
            <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
              Try adjusting your filters or targeting a different location for better results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(scrapeStatus === 'running' || scrapeStatus === 'paused') && (
        <ScraperProgress
          status={scrapeStatus}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
        />
      )}

      <NeuralFeed logs={logs} />

      {!isLoading && hasSearched && results.length > 0 && (
        <div className="flex items-center justify-center gap-3 px-6 py-3 bg-emerald-500/10 text-emerald-500 animate-in zoom-in-95 duration-500 border-none border-emerald-500/10">
          <CheckCircle2 size={16} />
          <span className="text-xs font-black uppercase tracking-widest">
            Scan Complete • {results.length} Leads Retrieved
          </span>
        </div>
      )}

      <div className="bg-white/[0.01] overflow-hidden">
        <LeadTable
          leads={displayResults}
          selectedLeads={selectedLeads}
          onLeadSelect={setSelectedLeads}
          onAddToCampaign={() => setShowCampaignSelect(true)}
          isLoading={false}
          onClearResults={onClearResults}
          onDelete={onDeleteLead}
        />
      </div>

      <CampaignSelector
        open={showCampaignSelect}
        onClose={() => setShowCampaignSelect(false)}
        selectedLeads={selectedLeads}
        leads={displayResults}
        onSuccess={() => {
          setSelectedLeads(new Set());
          setShowCampaignSelect(false);
        }}
      />
    </div>
  );
};

export default LeadScraperResults;

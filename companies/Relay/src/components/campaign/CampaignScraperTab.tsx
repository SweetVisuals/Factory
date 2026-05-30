import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Lead } from '../../types';
import { api } from '../../lib/api/api';
import LeadScraperForm from '../lead-scraper/LeadScraperForm';
import LeadScraperResults from '../lead-scraper/LeadScraperResults';
import { Terminal, Brain, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CampaignScraperTabProps {
  campaignId: string;
}

const CampaignScraperTab = ({ campaignId }: CampaignScraperTabProps) => {
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [hasSearched, setHasSearched] = useState(false);
  const [logs, setLogs] = useState<{ timestamp: string, message: string }[]>([]);
  const [showForm, setShowForm] = useState(true);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Auto-show telemetry when scraping starts
  useEffect(() => {
    if (scrapeStatus !== 'idle') setShowTelemetry(true);
  }, [scrapeStatus]);

  // Fetch leads already in this campaign
  useEffect(() => {
    const fetchCampaignLeads = async () => {
      const { data, error } = await supabase
        .from('campaign_leads')
        .select('lead:leads(*)')
        .eq('campaign_id', campaignId);
      
      if (data && !error) {
        setSearchResults(data.map((d: any) => d.lead));
        setHasSearched(true);
      }
    };
    fetchCampaignLeads();
  }, [campaignId]);

  // Realtime Subscriptions
  useEffect(() => {
    let interval: any;
    let channel: any;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channel = supabase
        .channel(`campaign-scraper-${campaignId}`)
        .on(
          'broadcast',
          { event: 'new-lead' },
          (payload) => {
            const newLead = payload.payload as Lead;
            if (!newLead || !newLead.id) return;
            setSearchResults(prev => {
              const exists = prev.some(l => l.id === newLead.id);
              if (exists) return prev;
              return [newLead, ...prev];
            });
          }
        )
        .on(
          'broadcast',
          { event: 'scrape-status' },
          (payload) => {
            if (payload.payload.status) {
              setScrapeStatus(payload.payload.status);
              setHasSearched(true);
            }
          }
        )
        .on(
          'broadcast',
          { event: 'scrape-log' },
          (payload) => {
            const newLog = payload.payload;
            if (newLog && newLog.message) {
              setLogs(prev => {
                const exists = prev.some(l => l.timestamp === newLog.timestamp && l.message === newLog.message);
                if (exists) return prev;
                return [...prev, newLog].slice(-200);
              });
            }
          }
        )
        .subscribe();
    };

    setupRealtime();

    interval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const config = { headers: { Authorization: `Bearer ${session.access_token}` } };
        const logRes = await api.get('/scraper-logs', config);
        if (Array.isArray(logRes.data)) setLogs(logRes.data);

        const activeRes = await api.get('/scraper-active', config);
        if (activeRes.data && activeRes.data.active) {
           setScrapeStatus(activeRes.data.status || 'running');
        } else {
           setScrapeStatus('idle');
        }
      } catch (e) {}
    }, 2000);

    return () => {
      if (interval) clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [campaignId]);

  const handleSearch = async (searchParams: any) => {
    setScrapeStatus('running');
    setHasSearched(true);
    setSearchResults([]); 
    setLogs([{ timestamp: new Date().toISOString(), message: 'Starting search for leads...' }]);
    setShowForm(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const paramsWithCampaign = { ...searchParams, campaignId };

      api.post('/scrape-leads', paramsWithCampaign, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }).catch(() => setScrapeStatus('idle'));

    } catch (error) {
      setScrapeStatus('idle');
    }
  };

  const handlePause = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    return api.post('/scraper-pause', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
  };
  const handleResume = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    return api.post('/scraper-resume', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
  };
  const handleCancel = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    return api.post('/scraper-cancel', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Compact Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Brain size={20} className="text-primary" />
          <div>
            <h2 className="text-lg font-black text-foreground uppercase tracking-tight leading-none">Lead Scraper</h2>
            <p className="text-[9px] font-black text-foreground/20 uppercase tracking-[0.3em] mt-1">Targeted intelligence acquisition</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {scrapeStatus !== 'idle' && (
            <div className="flex items-center gap-3 px-4 py-2 bg-primary text-primary-foreground shadow-lg animate-pulse">
              <Activity size={12} className="animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">{scrapeStatus}</span>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Search Form */}
      <div className="bg-foreground/[0.02]">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-foreground/[0.03] transition-all"
        >
          <div className="flex items-center gap-3">
            {showForm ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
            <span className="text-[10px] font-black text-foreground/60 uppercase tracking-[0.2em]">Search Configuration</span>
          </div>
          <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">
            {showForm ? 'Collapse' : 'Expand'}
          </span>
        </button>
        
        {showForm && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <LeadScraperForm onSearch={handleSearch} />
          </div>
        )}
      </div>

      {/* Full-width Results */}
      <LeadScraperResults
        results={searchResults}
        scrapeStatus={scrapeStatus}
        hasSearched={hasSearched}
        logs={logs}
        onClearResults={() => setSearchResults([])}
        onDeleteLead={(id) => setSearchResults(prev => prev.filter(l => l.id !== id))}
        onPause={handlePause}
        onResume={handleResume}
        onCancel={handleCancel}
      />

      {/* Collapsible Telemetry Log */}
      <div className="bg-foreground/[0.02]">
        <button
          onClick={() => setShowTelemetry(!showTelemetry)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-foreground/[0.03] transition-all"
        >
          <div className="flex items-center gap-3">
            <Terminal size={12} className="text-primary" />
            <span className="text-[10px] font-black text-foreground/60 uppercase tracking-[0.2em]">Telemetry Log</span>
            {logs.length > 0 && (
              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5">{logs.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {scrapeStatus !== 'idle' && <div className="w-1.5 h-1.5 bg-primary animate-pulse" />}
            {showTelemetry ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
          </div>
        </button>
        
        {showTelemetry && (
          <div ref={scrollRef} className="max-h-[300px] overflow-y-auto custom-scrollbar px-6 pb-6 space-y-3 animate-in fade-in duration-300">
            {logs.map((log, i) => (
              <div key={i} className="group/log flex gap-4 transition-all">
                <div className="w-1 h-1 bg-primary/20 mt-2 group-hover/log:bg-primary transition-colors shrink-0" />
                <p className="text-[11px] font-bold text-foreground/40 leading-relaxed tracking-tight group-hover/log:text-foreground transition-colors">
                  {log.message}
                </p>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="py-8 flex flex-col items-center justify-center opacity-10">
                 <Terminal size={32} strokeWidth={1} />
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] mt-3 text-center">Awaiting data...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignScraperTab;

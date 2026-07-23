import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lead } from '../types';
import { api } from '../lib/api/api';
import LeadScraperForm from '../components/lead-scraper/LeadScraperForm';
import LeadScraperResults from '../components/lead-scraper/LeadScraperResults';
import Layout from '../components/layout/Layout';
import { Terminal, Brain, Sparkles, Activity, Filter, X } from 'lucide-react';

const LeadScraper = () => {
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [hasSearched, setHasSearched] = useState(false);
  const [logs, setLogs] = useState<{ timestamp: string, message: string }[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);


  // Fetch previous leads and check active status on mount
  useEffect(() => {
    const initPage = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const config = {
        headers: { Authorization: `Bearer ${session.access_token}` }
      };

      try {
        const { data } = await supabase.rpc('get_unmanaged_leads');
        if (data && data.length > 0) {
          setSearchResults(data as Lead[]);
          setHasSearched(true);
        }
      } catch (err) {
        console.error('Error fetching unmanaged leads:', err);
      }

      try {
        const activeRes = await api.get('/scraper-active', config);
        if (activeRes.data.active) {
          setScrapeStatus(activeRes.data.status || 'running');
          setHasSearched(true);
        }
      } catch (e) { }
    };
    initPage();
  }, []);

  // Log Polling & Realtime Results
  useEffect(() => {
    let interval: any;
    let channel: any;

    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      channel = supabase
        .channel(`scraped-leads-${session.user.id}`)
        .on(
          'broadcast',
          { event: 'new-lead' },
          (payload) => {
            const newLead = payload.payload as Lead;
            if (!newLead || !newLead.id) return;
            setSearchResults(prev => {
              const exists = prev.some(l => l.id === newLead.id || (l.email && l.email === newLead.email));
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
                const updated = [...prev, newLog];
                return updated.slice(-200); // Keep last 200
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

        const config = {
          headers: { Authorization: `Bearer ${session.access_token}` }
        };

        const logRes = await api.get('/scraper-logs', config);
        if (Array.isArray(logRes.data) && logRes.data.length > 0) {
          setLogs(logRes.data);
        }

        const activeRes = await api.get('/scraper-active', config);
        if (activeRes.data) {
          if (!activeRes.data.active && scrapeStatus !== 'idle') {
            setScrapeStatus('idle');
          } else if (activeRes.data.active && activeRes.data.status && activeRes.data.status !== scrapeStatus) {
            setScrapeStatus(activeRes.data.status);
          }
        }
      } catch (e) {
        // console.error('Polling error:', e);
      }
    }, 2000);

    return () => {
      if (interval) clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [scrapeStatus]);

  const handleSearch = async (searchParams: any) => {
    setScrapeStatus('running');
    setHasSearched(true);
    setSearchResults([]); 
    setLogs([{ timestamp: new Date().toISOString(), message: 'Initializing AI Brain...' }]);
    setShowMobileFilters(false);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setScrapeStatus('idle');
        return;
      }

      api.post('/scrape-leads', searchParams, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }).catch((error: any) => {
        setScrapeStatus('idle');
      });

    } catch (error: any) {
      setScrapeStatus('idle');
    }
  };

  const handlePause = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.post('/scraper-pause', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
      setScrapeStatus('paused');
    } catch (e) {}
  };

  const handleResume = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.post('/scraper-resume', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
      setScrapeStatus('running');
    } catch (e) {}
  };

  const handleCancel = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await api.post('/scraper-cancel', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
      setScrapeStatus('idle');
    } catch (e) {}
  };

  const handleClearResults = async () => {
    setSearchResults([]);
    setLogs([]);
    setHasSearched(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.rpc('clear_unmanaged_leads');
      }
    } catch (e) {}
  };

  const handleDeleteLead = async (leadId: string) => {
    setSearchResults(prev => prev.filter(l => l.id !== leadId));
    try {
      await supabase.from('leads').delete().eq('id', leadId);
    } catch (err) {}
  };

  return (
    <Layout fullHeight>
      <div className="flex flex-col h-full bg-transparent">
        {/* Compact Top Bar */}
        <div className="flex items-center justify-between px-4 lg:px-8 py-2 border-b border-white/5 bg-background shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="lg:hidden p-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-white/50 hover:text-white transition-colors"
            >
              <Filter size={14} />
            </button>
            {scrapeStatus !== 'idle' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-bold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 bg-primary animate-pulse rounded-full" />
                {scrapeStatus}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 px-3 py-1 text-muted-foreground/40 text-[10px] font-bold tracking-widest">
            <Activity size={12} />
            System Online
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex relative">
          
          {/* Mobile Overlay Background */}
          {showMobileFilters && (
            <div className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
          )}

          {/* Sidebar Form */}
          <div className={`
            absolute lg:relative z-50 lg:z-0
            inset-y-0 left-0
            w-[340px] lg:w-[400px] xl:w-[450px] shrink-0
            bg-[#111111] lg:bg-transparent
            border-r border-white/5 lg:border-none
            transform transition-transform duration-300 ease-in-out
            ${showMobileFilters ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            {/* Mobile Sidebar Header */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5">
              <span className="text-xs font-black uppercase tracking-widest text-white/50">Search Parameters</span>
              <button onClick={() => setShowMobileFilters(false)} className="p-2 text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <LeadScraperForm onSearch={handleSearch} />
          </div>

          {/* Main Content Area (Results) */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-10 custom-scrollbar relative">
            <LeadScraperResults
              results={searchResults}
              scrapeStatus={scrapeStatus}
              hasSearched={hasSearched}
              logs={logs}
              onClearResults={handleClearResults}
              onDeleteLead={handleDeleteLead}
              onPause={handlePause}
              onResume={handleResume}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LeadScraper;

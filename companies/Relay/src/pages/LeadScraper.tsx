import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lead } from '../types';
import { api } from '../lib/api/api';
import LeadScraperForm from '../components/lead-scraper/LeadScraperForm';
import LeadScraperResults from '../components/lead-scraper/LeadScraperResults';
import Layout from '../components/layout/Layout';
import { Terminal, Brain, Sparkles, Activity } from 'lucide-react';

const LeadScraper = () => {
  const [searchResults, setSearchResults] = useState<Lead[]>([]);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [hasSearched, setHasSearched] = useState(false);
  const [logs, setLogs] = useState<{ timestamp: string, message: string }[]>([]);


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
        {/* Header Section - Cleaned up and integrated */}
        <div className="flex items-center justify-between px-8 py-8">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-primary/10 flex items-center justify-center text-primary">
              <Brain size={36} />
            </div>
            <div>
              <h1 className="text-foreground text-4xl font-black uppercase tracking-tighter">Neural Scraper</h1>
              <p className="text-muted-foreground/30 text-[11px] font-black uppercase tracking-[0.5em] mt-1">Autonomous Lead Extraction Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {scrapeStatus !== 'idle' && (
              <div className="flex items-center gap-3 px-6 py-3 bg-primary/10 text-primary">
                <div className="w-2 h-2 bg-primary animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em]">{scrapeStatus}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-6 py-3 bg-foreground/[0.03] text-muted-foreground/30">
              <Activity size={16} />
              <span className="text-[11px] font-black uppercase tracking-widest">System Online</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 space-y-10 scrollbar-none">
          {/* Form */}
          <LeadScraperForm onSearch={handleSearch} />

          {/* Main Content Area */}
          <div className="pb-10">
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

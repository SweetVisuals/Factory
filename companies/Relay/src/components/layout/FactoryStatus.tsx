import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/use-toast';
import { Play, Pause, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { useNavigate } from 'react-router-dom';

const FactoryStatus: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scrapesUsed, setScrapesUsed] = useState(0);
  const [planType, setPlanType] = useState('free');
  const [showNoCampaignDialog, setShowNoCampaignDialog] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchStatus = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('account_settings')
        .select('is_scraping_active, scrapes_this_month, plan_type')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setIsPaused(!data.is_scraping_active);
        setScrapesUsed(data.scrapes_this_month || 0);
        setPlanType(data.plan_type || 'free');
      }
      setLoading(false);
    };

    fetchStatus();

    // Listen for status changes
    const subscription = supabase
      .channel('account_settings_changes')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'account_settings',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        setIsPaused(!payload.new.is_scraping_active);
        setScrapesUsed(payload.new.scrapes_this_month || 0);
        setPlanType(payload.new.plan_type || 'free');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const togglePause = async () => {
    if (!user || loading) return;

    const newActiveState = isPaused; // If it was paused, new state is active
    
    // Check if campaigns exist before switching to running
    if (newActiveState) {
      const { count } = await supabase.from('campaigns').select('id', { count: 'exact', head: true });
      if (!count || count === 0) {
        setShowNoCampaignDialog(true);
        setIsPaused(true);
        return;
      }
    }

    // Quick check if free plan limit exceeded
    if (newActiveState && planType === 'free' && scrapesUsed >= 50) {
      toast({
        title: "Free Tier Limit Reached",
        description: "You have used all 50 scrapes for this month. Upgrade to Pro to resume.",
        variant: "destructive"
      });
      return;
    }

    // Optimistic update
    setIsPaused(!newActiveState);

    const { error } = await supabase
      .from('account_settings')
      .update({ is_scraping_active: newActiveState })
      .eq('user_id', user.id);

    if (error) {
      // Revert on error
      setIsPaused(!isPaused);
      toast({
        title: "Error",
        description: "Failed to update scraper status.",
        variant: "destructive"
      });
    } else {
      toast({
        title: newActiveState ? "Scraper Resumed" : "Scraper Paused",
        description: newActiveState ? "Your campaigns will now collect leads." : "Lead collection paused.",
        style: {
          backgroundColor: newActiveState ? '#059669' : '#dc2626',
          color: 'white',
          border: 'none'
        }
      });
    }
  };

  if (!user) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(12px)',
        padding: '0.8rem 1rem',
        boxShadow: isPaused ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        zIndex: 1000,
        borderRadius: '1rem',
        transition: 'all 0.3s ease',
        border: isPaused ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em' }}>
            {planType.toUpperCase()} PLAN
          </span>
          <span style={{ fontSize: '0.8rem', color: planType === 'free' && scrapesUsed >= 50 ? '#ef4444' : '#e5e7eb', fontWeight: 500 }}>
            {scrapesUsed} {planType === 'free' ? '/ 50 Scrapes' : 'Scrapes'}
          </span>
        </div>

        <div style={{ width: '1px', height: '30px', backgroundColor: '#374151' }}></div>

        <button 
          onClick={togglePause}
          disabled={loading}
          style={{
            background: isPaused ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            color: isPaused ? '#ef4444' : '#10b981',
            border: isPaused ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s',
            opacity: loading ? 0.7 : 1
          }}
        >
          {isPaused ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
          {isPaused ? 'PAUSED' : 'ACTIVE'}
        </button>
      </div>

      <Dialog open={showNoCampaignDialog} onOpenChange={setShowNoCampaignDialog}>
        <DialogContent className="bg-background/95 backdrop-blur-3xl border border-white/10 max-w-md rounded-none p-6 overflow-hidden shadow-2xl flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tighter mb-2">
            No Campaign Found
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mb-6">
            Please create a campaign first before starting the lead collection engine.
          </DialogDescription>
          <div className="flex gap-3 w-full">
            <button
              onClick={() => {
                setShowNoCampaignDialog(false);
                navigate('/create-campaign');
              }}
              className="flex-1 bg-white text-black py-2 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
            >
              Create Campaign
            </button>
            <button
              onClick={() => setShowNoCampaignDialog(false)}
              className="flex-1 bg-white/5 border border-white/10 text-white hover:bg-white/10 py-2 rounded-lg text-xs font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FactoryStatus;

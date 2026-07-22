import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useApp } from '@/context/AppContext';
import { Play, Loader2, Eye, Mail, CalendarClock, Target, AlertCircle } from 'lucide-react';

interface ReviewTabProps {
  campaignId: string;
}

export default function ReviewTab({ campaignId }: ReviewTabProps) {
  const { campaigns, updateCampaign } = useApp();
  const [isApproving, setIsApproving] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const campaign = campaigns.find(c => c.id === campaignId);

  useEffect(() => {
    if (campaignId) {
      fetchPreview();
      fetchSchedules();
    }
  }, [campaignId]);

  const fetchPreview = async () => {
    try {
      // In production, might need full domain, but proxy handles /api
      const res = await fetch(`/api/campaigns/${campaignId}/preview-email`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPreviewData(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch preview', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select('*, templates(*)')
        .eq('campaign_id', campaignId)
        .order('scheduled_for', { ascending: true });
        
      if (!error && data) {
        setSchedules(data);
      }
    } catch (err) {
      console.error('Failed to fetch schedules', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      // Update Campaign Status
      await updateCampaign(campaignId, { status: 'in_progress' });

      // Unpause Schedules
      await supabase
        .from('scheduled_emails')
        .update({ status: 'scheduled' })
        .eq('campaign_id', campaignId)
        .eq('status', 'paused');

      toast({ 
        title: 'Campaign Approved', 
        description: 'Campaign is now live and schedules are active!' 
      });
    } catch (error: any) {
      toast({ 
        title: 'Approval Failed', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAlreadyActive = campaign?.status === 'in_progress' || campaign?.status === 'active';

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 animate-in fade-in duration-300">
      
      {/* Header & Actions */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Campaign Review & Approval
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review the final personalized copy for your sequence before setting this campaign live.
          </p>
        </div>
        
        <div>
          {isAlreadyActive ? (
            <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-lg font-bold text-sm flex items-center gap-2 border border-emerald-500/20">
              <Play className="w-4 h-4" />
              Campaign is Live
            </div>
          ) : (
            <button
              onClick={handleApprove}
              disabled={isApproving || schedules.length === 0}
              className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-lg shadow-md hover:bg-primary/90 transition-all flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
              Approve & Launch Autonomous Campaign
            </button>
          )}
        </div>
      </div>

      {schedules.length === 0 && !isAlreadyActive && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-500/90">
            <strong>No schedules found.</strong> Please generate your sequence and schedule in the "Sequences & Triggers" tab before reviewing.
          </div>
        </div>
      )}

      {/* Preview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Live Example */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-muted/30 border-b border-border/50 px-5 py-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">Live Example Preview</h3>
          </div>
          
          <div className="p-5 flex-1 bg-black/20">
            {previewData ? (
              <div className="space-y-4">
                <div className="bg-[#111] border border-white/5 rounded-xl p-4 shadow-sm">
                  <div className="text-xs text-muted-foreground mb-1">To: {previewData.lead?.name} ({previewData.lead?.email})</div>
                  <div className="text-xs text-muted-foreground mb-3 pb-3 border-b border-white/5">Subject: <strong className="text-foreground">{previewData.email?.subject}</strong></div>
                  
                  <div className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                    {previewData.email?.body}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 py-10">
                <Mail className="w-8 h-8 opacity-20" />
                <p className="text-sm">No leads available to generate a preview.</p>
              </div>
            )}
          </div>
        </div>

        {/* Schedule & Templates */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-muted/30 border-b border-border/50 px-5 py-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">Schedule Timeline ({schedules.length} steps)</h3>
          </div>
          
          <div className="p-5 max-h-[500px] overflow-y-auto space-y-4">
            {schedules.map((sched, idx) => (
              <div key={sched.id} className="border border-border/50 rounded-xl p-4 bg-[#111]">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-sm text-foreground">Step {idx + 1}</div>
                  <div className="text-xs font-mono text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                    {new Date(sched.scheduled_for).toLocaleString()}
                  </div>
                </div>
                
                {sched.templates && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="text-[10px] text-muted-foreground font-bold uppercase mb-1">Base Template</div>
                    <div className="text-xs text-foreground/70 italic truncate">"{sched.templates.subject}"</div>
                    <div className="text-xs text-foreground/50 line-clamp-2 mt-1">{sched.templates.content}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

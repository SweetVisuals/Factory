import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useApp } from '@/context/AppContext';
import { Play, Loader2, Eye, Mail, CalendarClock, Target, AlertCircle, ChevronLeft, ChevronRight, ExternalLink, FileText } from 'lucide-react';

interface ReviewTabProps {
  campaignId: string;
}

export default function ReviewTab({ campaignId }: ReviewTabProps) {
  const { campaigns, updateCampaign } = useApp();
  const [isApproving, setIsApproving] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showResearchNotes, setShowResearchNotes] = useState(true);

  const campaign = campaigns.find(c => c.id === campaignId);

  useEffect(() => {
    if (campaignId) {
      fetchPreview();
      fetchSchedules();
    }
  }, [campaignId]);

  const fetchPreview = async () => {
    try {
      setIsPreviewLoading(true);
      const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isDev ? 'http://localhost:3001' : '';
      const res = await fetch(`${baseUrl}/api/campaigns/${campaignId}/preview-email`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setPreviewData(data.data);
          setCurrentPreviewIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to fetch preview', err);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('scheduled_for', { ascending: true });
        
      if (!error && data) {
        // Fetch templates separately and map them client-side in JS (bypasses PostgREST join syntax issues)
        const { data: templates } = await supabase
          .from('templates')
          .select('*')
          .eq('campaign_id', campaignId);

        const enriched = data.map(sched => ({
          ...sched,
          templates: templates?.find(t => t.id === sched.template_id) || null
        }));
        
        setSchedules(enriched);
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
      await updateCampaign(campaignId, { status: 'in_progress' });

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
  const activeItem = previewData && previewData.length > 0 ? previewData[currentPreviewIndex] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-in fade-in duration-300">
      
      {/* Header & Actions */}
      <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Campaign Review & Approval
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Flick through the 5 real DeepSeek generated email previews and verify schedule timelines before setting the campaign live.
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

      {/* Main Review Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Email Preview Column (Takes 2/3 space on large screens) */}
        <div className="xl:col-span-2 space-y-6 flex flex-col">
          <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="bg-muted/30 border-b border-border/50 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">Real Email Output Previews</h3>
              </div>
              
              {/* Pagination Controls */}
              {previewData && previewData.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono">
                    Example {currentPreviewIndex + 1} of {previewData.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentPreviewIndex === 0}
                      className="p-1 rounded bg-white/5 border border-white/10 text-foreground hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPreviewIndex(prev => Math.min(previewData.length - 1, prev + 1))}
                      disabled={currentPreviewIndex === previewData.length - 1}
                      className="p-1 rounded bg-white/5 border border-white/10 text-foreground hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-5 flex-1 bg-black/10 flex flex-col gap-5">
              {isPreviewLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-3 py-24">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-bold uppercase tracking-widest text-white/50 text-[10px]">Generating email previews using DeepSeek...</p>
                </div>
              ) : activeItem ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch flex-1">
                  
                  {/* Outbound Email View */}
                  <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="bg-[#111] border border-white/5 rounded-xl p-5 shadow-sm flex flex-col flex-1">
                      <div className="text-xs text-muted-foreground mb-1 font-mono">To: <span className="text-foreground font-bold">{activeItem.lead?.name || 'Unknown'}</span> ({activeItem.lead?.email})</div>
                      
                      {activeItem.lead?.website && (
                        <div className="text-xs text-muted-foreground mb-1 font-mono flex items-center gap-1.5">
                          Website: 
                          <a 
                            href={activeItem.lead.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-primary hover:underline flex items-center gap-0.5 font-bold"
                          >
                            {activeItem.lead.website} <ExternalLink size={10} />
                          </a>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground mb-3 pb-3 border-b border-white/5 font-mono">
                        Subject: <strong className="text-foreground">{activeItem.email?.subject}</strong>
                      </div>
                      
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed flex-1">
                        {activeItem.email?.body}
                      </div>
                    </div>
                  </div>

                  {/* Lead Research Cross-Reference Side Panel */}
                  <div className="flex flex-col gap-4">
                    <div className="bg-[#111]/80 border border-white/5 rounded-xl p-4 shadow-sm flex flex-col flex-1 h-full max-h-[450px]">
                      <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                          <FileText size={12} className="text-primary" />
                          Research details
                        </span>
                        <button 
                          onClick={() => setShowResearchNotes(!showResearchNotes)}
                          className="text-[10px] font-bold text-primary hover:underline"
                        >
                          {showResearchNotes ? 'Hide' : 'Show'}
                        </button>
                      </div>

                      {showResearchNotes ? (
                        <div className="flex-1 overflow-y-auto text-xs text-foreground/80 space-y-4 pr-1 font-sans custom-scrollbar leading-relaxed">
                          <div>
                            <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Company Description</span>
                            <p className="bg-white/[0.02] p-2.5 rounded border border-white/5">{activeItem.lead?.company_description || 'No description available'}</p>
                          </div>
                          
                          {activeItem.lead?.personalised_detail && (
                            <div>
                              <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Personalised Detail</span>
                              <p className="bg-white/[0.02] p-2.5 rounded border border-white/5 text-emerald-400">{activeItem.lead.personalised_detail}</p>
                            </div>
                          )}

                          <div>
                            <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Filing & Industry Info</span>
                            <div className="bg-white/[0.02] p-2.5 rounded border border-white/5 grid grid-cols-2 gap-2 text-[11px]">
                              <div><span className="text-muted-foreground">Founded:</span> {activeItem.lead?.year_founded || 'N/A'}</div>
                              <div><span className="text-muted-foreground">Revenue:</span> {activeItem.lead?.annual_revenue || 'N/A'}</div>
                              <div className="col-span-2"><span className="text-muted-foreground">Size:</span> {activeItem.lead?.company_size || 'N/A'}</div>
                              <div className="col-span-2"><span className="text-muted-foreground">Location:</span> {activeItem.lead?.location || 'N/A'}</div>
                            </div>
                          </div>

                          <div>
                            <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raw Scraped Summary</span>
                            <div className="bg-white/[0.02] p-2.5 rounded border border-white/5 font-mono text-[10px] whitespace-pre-wrap leading-tight text-white/50 max-h-[150px] overflow-y-auto">
                              {activeItem.lead?.summary || 'No summary available.'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground/40 text-xs">
                          Research notes hidden
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 py-20">
                  <Mail className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No leads available to generate a preview.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schedule & Templates Timeline */}
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="bg-muted/30 border-b border-border/50 px-5 py-3 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Schedule Timeline ({schedules.length} steps)</h3>
          </div>
          
          <div className="p-5 overflow-y-auto space-y-4 flex-1 max-h-[600px] custom-scrollbar">
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

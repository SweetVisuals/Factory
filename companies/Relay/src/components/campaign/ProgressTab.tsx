import { useEffect, useState } from 'react';
import { CustomCheckbox } from '../ui/CustomCheckbox';
import { Button } from '../ui/button';
import { Target, Clock, Terminal, Timer, Edit3, Check, X, Settings2, Activity, Zap, Cpu, Layers, Shield, Database, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../ui/use-toast';
import { useApp } from '../../context/AppContext';
import { Loader2 } from 'lucide-react';
import { EditScheduleModal } from './schedule/EditScheduleModal';
import { cn } from '../../lib/utils';

interface ProgressTabProps {
  campaignId: string;
}

interface ScheduleProgress {
  id: string;
  templateId: string;
  templateName: string;
  startDate: string;
  endDate: string;
  scheduledFor: string;
  totalEmails: number;
  sentEmails: number;
  interval: number;
  emailsPerAccount: number;
  emailAccounts: Array<{
    id: string;
    email: string;
    sent: number;
  }>;
}

interface LeadProgress {
  id: string;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  completedSteps: string[];
}

interface ActivityLog {
  id: string;
  created_at: string;
  lead_id: string;
  email_account_id: string;
  status: 'sent' | 'failed';
  lead_email?: string;
  account_email?: string;
}

const ProgressTab = ({ campaignId }: ProgressTabProps) => {
  const { toast } = useToast();
  const [scheduleEntries, setScheduleEntries] = useState<ScheduleProgress[]>([]);
  const [leads, setLeads] = useState<LeadProgress[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNextSend, setEditingNextSend] = useState<string | null>(null);
  const [nextSendEdit, setNextSendEdit] = useState<string>('');
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedSchedules, setExpandedSchedules] = useState<string[]>([]);
  const [showLeadRegistry, setShowLeadRegistry] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const { campaigns } = useApp();
  const campaign = campaigns.find(c => c.id === campaignId);

  const isPersonalizing = (campaign?.status as any) === 'personalizing';

  const toggleSchedule = (id: string) => {
    setExpandedSchedules(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleLeadSelection = async (leadId: string) => {
    const newSelection = selectedLeads.includes(leadId)
      ? selectedLeads.filter(id => id !== leadId)
      : [...selectedLeads, leadId];

    setSelectedLeads(newSelection);

    try {
      const { error } = await supabase
        .from('campaign_progress')
        .upsert({
          campaign_id: campaignId,
          lead_id: leadId,
          selected: newSelection.includes(leadId),
          status: 'pending',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'campaign_id,lead_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating lead selection:', error);
    }
  };

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const { data: scheduledEmails } = await supabase
          .from('scheduled_emails')
          .select(`
            id,
            template_id,
            templates(name),
            total_emails,
            sent_emails,
            start_date,
            end_date,
            scheduled_for,
            interval_minutes,
            emails_per_account,
            schedule_email_accounts!inner(
              email_account_id,
              email_accounts:email_accounts!schedule_email_accounts_email_account_id_fkey(email)
            )
          `)
          .eq('campaign_id', campaignId)
          .order('start_date', { ascending: true });

        const { data: campaignLeads } = await supabase
          .from('campaign_leads')
          .select('leads(id, email)')
          .eq('campaign_id', campaignId);

        const realLeadCount = campaignLeads?.length || 0;

        const { data: leadProgressData } = await supabase
          .from('campaign_progress')
          .select('id, campaign_id, lead_id, status, schedule_id, sent_at, created_at, email_account_id')
          .eq('campaign_id', campaignId)
          .order('created_at', { ascending: false });

        const scheduleProgress = (scheduledEmails || []).map((entry: any) => {
          const sentCount = (leadProgressData || []).filter(
            (p: any) => p.status === 'sent' && p.schedule_id === entry.id
          ).length;

          return {
            id: entry.id,
            templateId: entry.template_id,
            templateName: entry.templates?.name || 'Unknown Template',
            startDate: entry.start_date,
            endDate: entry.end_date,
            scheduledFor: entry.scheduled_for,
            totalEmails: realLeadCount,
            sentEmails: sentCount,
            interval: entry.interval_minutes,
            emailsPerAccount: entry.emails_per_account,
            emailAccounts: (entry.schedule_email_accounts || []).map((account: any) => ({
              id: account.email_account_id,
              email: account.email_accounts?.email || 'Unknown Email',
              sent: (leadProgressData || []).filter(
                (p: any) => p.status === 'sent' && p.schedule_id === entry.id && p.email_account_id === account.email_account_id
              ).length
            }))
          };
        }) as ScheduleProgress[];

        const logs: ActivityLog[] = [];
        if (leadProgressData && campaignLeads) {
          leadProgressData.slice(0, 50).forEach((p: any) => {
            let accountEmail = 'System';
            for (const s of scheduleProgress) {
              const found = s.emailAccounts.find(a => a.id === p.email_account_id);
              if (found) {
                accountEmail = found.email;
                break;
              }
            }

            let leadEmail = 'Unknown Lead';
            const leadEntry = campaignLeads.find((l: any) => l.leads && (Array.isArray(l.leads) ? l.leads[0]?.id : l.leads.id) === p.lead_id);
            if (leadEntry && leadEntry.leads) {
              const leadsEntryData: any = leadEntry.leads;
              if (Array.isArray(leadsEntryData)) {
                leadEmail = leadsEntryData[0]?.email || 'Unknown Lead';
              } else {
                leadEmail = leadsEntryData.email || 'Unknown Lead';
              }
            }

            if (p.status === 'sent' || p.status === 'failed') {
              logs.push({
                id: p.id,
                created_at: p.sent_at || p.created_at,
                lead_id: p.lead_id,
                email_account_id: p.email_account_id,
                status: p.status,
                lead_email: leadEmail,
                account_email: accountEmail
              });
            }
          });
        }
        setActivityLogs(logs);

        const selected = leadProgressData
          ?.filter((progress: any) => progress.selected)
          .map((progress: any) => progress.lead_id) || [];
        setSelectedLeads(selected);

        const leadProgress = campaignLeads?.map((lead: any) => {
          const actualLead = Array.isArray(lead.leads) ? lead.leads[0] : lead.leads;
          if (!actualLead) return null;

          const progressRecords = leadProgressData?.filter(
            (p: any) => p.lead_id === actualLead.id
          ) || [];

          const latestStatus = progressRecords[0]?.status || 'pending';
          const completed = progressRecords
            .filter(p => p.status === 'sent')
            .map(p => p.schedule_id);

          return {
            id: actualLead.id,
            email: actualLead.email,
            status: latestStatus,
            completedSteps: completed
          };
        }).filter(Boolean) as LeadProgress[];

        setScheduleEntries(scheduleProgress);
        setLeads(leadProgress);

      } catch (error) {
        console.error('Error fetching campaign progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();

    const interval = setInterval(() => {
      if (!editingNextSend) fetchProgress();
    }, 5000);

    const channel = supabase
      .channel(`progress-${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_emails',
        filter: `campaign_id=eq.${campaignId}`
      }, () => { if (!editingNextSend) fetchProgress(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_progress',
        filter: `campaign_id=eq.${campaignId}`
      }, () => { if (!editingNextSend) fetchProgress(); })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };

  }, [campaignId, toast, editingNextSend]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
        <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.4em]">Acquiring Telemetry...</p>
      </div>
    );
  }

  const totalSent = scheduleEntries.reduce((acc, curr) => acc + curr.sentEmails, 0);
  const totalLeads = leads.length;

  return (
    <div className="space-y-6">
      <EditScheduleModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        schedule={editingSchedule}
        onSave={async (updates) => {
          if (!editingSchedule) return;
          try {
            const { error } = await supabase
              .from('scheduled_emails')
              .update({
                end_date: updates.endDate,
                total_emails: updates.totalEmails,
                interval_minutes: updates.intervalMinutes,
                emails_per_account: updates.emailsPerAccount,
              })
              .eq('id', editingSchedule.id);

            if (error) throw error;
            toast({ title: "Schedule Updated", description: "Operational parameters updated." });
          } catch (error: any) {
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
          }
        }}
      />

      {/* Modern Progress Stats */}
      <div className="grid grid-cols-3 bg-card/40 border border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
        <div className="p-6">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Delivered</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-foreground tracking-tight">{totalSent}</span>
            <span className="text-sm font-semibold text-muted-foreground">/ {totalLeads * scheduleEntries.length}</span>
          </div>
        </div>
        <div className="p-6 border-x border-white/5 bg-white/[0.01]">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sequences</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-primary tracking-tight">{scheduleEntries.length}</span>
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active</span>
          </div>
        </div>
        <div className="p-6 bg-white/[0.01]">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</span>
          <div className="flex items-center gap-3 mt-4">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-sm font-bold text-foreground uppercase tracking-widest">Nominal</span>
          </div>
        </div>
      </div>

      {/* Propagation Sequences — Expandable */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <Layers size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Propagation Sequences</h3>
        </div>

        <div className="space-y-3">
          {scheduleEntries.map((entry, index) => {
            const isExpanded = expandedSchedules.includes(entry.id);
            const progressPercent = Math.min(100, Math.max(0, (entry.sentEmails / entry.totalEmails) * 100));
            const isComplete = progressPercent === 100;
            
            return (
              <div key={entry.id} className="bg-card/40 border border-white/5 rounded-2xl hover:bg-card/60 transition-all overflow-hidden shadow-sm backdrop-blur-md">
                <div 
                  className="p-5 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleSchedule(entry.id)}
                >
                  <div className="flex items-center gap-5">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm", 
                      isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground')}>
                      {index + 1}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-foreground tracking-tight">{entry.templateName}</span>
                      <span className="text-xs font-semibold text-muted-foreground tracking-wide">{entry.interval}m • {entry.emailsPerAccount}/acc</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end gap-1.5 min-w-[120px]">
                      <span className="text-sm font-bold text-foreground">{entry.sentEmails} <span className="text-muted-foreground font-medium">/ {entry.totalEmails}</span></span>
                      <div className="w-24 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                    <button 
                      className="p-2 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-primary transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSchedule(entry);
                        setShowEditModal(true);
                      }}
                    >
                      <Settings2 size={16} />
                    </button>
                    <div className="p-1 rounded-full bg-muted/30">
                      {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-6 pb-6 pt-2 border-t border-white/5 animate-in fade-in duration-300 bg-background/20">
                    <div className="grid grid-cols-2 gap-8 mt-4">
                      <div className="space-y-4">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Node Distribution</span>
                        <div className="space-y-2">
                          {entry.emailAccounts.map(acc => (
                            <div key={acc.id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.02]">
                              <span className="text-sm font-medium text-foreground/80 truncate">{acc.email}</span>
                              <span className="text-sm font-bold text-primary">{acc.sent}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Schedule</span>
                        <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.02]">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-medium">Started</span>
                            <span className="text-foreground font-bold">{new Date(entry.startDate).toLocaleDateString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-medium">Next Send</span>
                            <span className="text-primary font-bold">{entry.scheduledFor ? new Date(entry.scheduledFor).toLocaleTimeString() : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {scheduleEntries.length === 0 && (
            <div className="py-16 text-center space-y-4 border border-dashed border-border rounded-2xl bg-muted/20">
              <Layers size={32} className="mx-auto text-muted-foreground/40" />
              <p className="text-sm font-semibold text-muted-foreground">No active sequences</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Log — Collapsible */}
      <div className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-card/60 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Terminal size={16} className="text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-wide">Activity Log</span>
            {activityLogs.length > 0 && (
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">{activityLogs.length}</span>
            )}
          </div>
          <div className="p-1 rounded-full bg-muted/30">
            {showActivity ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
          </div>
        </button>
        
        {showActivity && (
          <div className="px-6 pb-6 pt-2 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
            {activityLogs.slice(0, 15).map(log => (
              <div 
                key={log.id} 
                className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/[0.03] transition-all group cursor-pointer border border-transparent hover:border-white/[0.05]"
                onClick={() => {
                  const event = new CustomEvent('relay-navigate-tab', { 
                    detail: { tab: 'inbox', leadEmail: log.lead_email } 
                  });
                  window.dispatchEvent(event);
                }}
              >
                <div className={cn("w-2 h-2 rounded-full", log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500')} />
                <span className="text-xs font-medium text-muted-foreground shrink-0 w-20">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span className={cn("text-xs font-bold uppercase tracking-wider shrink-0 w-16", log.status === 'sent' ? 'text-emerald-500/80' : 'text-red-500/80')}>
                  {log.status}
                </span>
                <span className="text-sm font-medium text-foreground/80 truncate flex-1 group-hover:text-foreground transition-colors">{log.lead_email}</span>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors shrink-0 bg-white/[0.02] px-2.5 py-1 rounded-md">via {log.account_email?.split('@')[0]}</span>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <div className="py-12 text-center opacity-50">
                <p className="text-sm font-semibold">No activity yet</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lead Registry — Collapsible */}
      <div className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
        <button
          onClick={() => setShowLeadRegistry(!showLeadRegistry)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-card/60 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users size={16} className="text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground tracking-wide">Lead Registry</span>
            <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-2.5 py-0.5 rounded-full">{leads.length}</span>
          </div>
          <div className="p-1 rounded-full bg-muted/30">
            {showLeadRegistry ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
          </div>
        </button>
        
        {showLeadRegistry && (
          <div className="px-6 pb-6 pt-2 max-h-[350px] overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
            <div className="space-y-2">
              {leads.map(lead => (
                <div key={lead.id} className="flex items-center gap-4 py-3 px-4 rounded-xl hover:bg-white/[0.03] transition-all group border border-transparent hover:border-white/[0.05]">
                  <CustomCheckbox
                    checked={selectedLeads.includes(lead.id)}
                    onChange={() => handleLeadSelection(lead.id)}
                  />
                  <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground truncate flex-1 transition-colors">
                    {lead.email}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    {scheduleEntries.map((s, i) => (
                      <div 
                        key={s.id} 
                        className={cn("w-2 h-2 rounded-full transition-colors", lead.completedSteps.includes(s.id) ? 'bg-primary shadow-[0_0_8px_rgba(139,92,246,0.5)]' : 'bg-muted')} 
                        title={`Sequence ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressTab;

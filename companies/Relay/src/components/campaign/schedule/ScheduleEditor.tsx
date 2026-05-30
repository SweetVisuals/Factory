import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { fetchTemplates } from '../../../lib/api/templates';
import { supabase } from '../../../lib/supabase';
import { ScheduleForm } from './ScheduleForm';
import { NoTemplatesMessage } from './NoTemplatesMessage';
import { toast } from '../../ui/use-toast';
import {
  AlertCircle,
  Trash2,
  Mail,
  Users,
  Calendar,
  Sparkles,
  Search,
  History,
  CheckCircle2,
  Info,
  Timer,
  ChevronUp,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { EditScheduleModal } from './EditScheduleModal';
import { TestOutputModal } from './TestOutputModal';
import { CustomCheckbox } from '../../ui/CustomCheckbox';
import { EmailTemplate } from 'types';

interface Props {
  campaignId: string;
  onScheduleChange?: () => void;
}

const getLondonTimestamp = (dateStr: string, timeStr: string): string => {
  try {
    const asUtc = new Date(`${dateStr}T${timeStr}:00Z`);
    const parts: Record<string, string> = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/London',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).formatToParts(asUtc).forEach(p => { parts[p.type] = p.value; });
    const hr = parts.hour === '24' ? '00' : parts.hour;
    const londonAsUtc = new Date(`${parts.year}-${parts.month}-${parts.day}T${hr}:${parts.minute}:${parts.second}Z`);
    const offsetMs = londonAsUtc.getTime() - asUtc.getTime();
    return new Date(asUtc.getTime() - offsetMs).toISOString();
  } catch (err) {
    console.error("Timezone conversion error:", err);
    return `${dateStr}T${timeStr}:00Z`;
  }
};

const ScheduleEditor: React.FC<Props> = ({ campaignId, onScheduleChange }): React.ReactElement => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [emailsPerAccount, setEmailsPerAccount] = useState<number | undefined>(50);
  const [emailsPerDay, setEmailsPerDay] = useState<number | undefined>(500);
  const [interval, setInterval] = useState<number | undefined>(15);
  const [intervalAccount, setIntervalAccount] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allEmailAccounts, setAllEmailAccounts] = useState<Array<{ id: string; email: string }>>([]);
  const [selectedEmailAccounts, setSelectedEmailAccounts] = useState<string[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [stagedSchedules, setStagedSchedules] = useState<any[]>([]);
  const [filteredEmailAccounts, setFilteredEmailAccounts] = useState<Array<{ id: string; email: string }>>([]);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [isManualMode, setIsManualMode] = useState(false);
  const [visibleEmails, setVisibleEmails] = useState<Record<string, boolean>>({});

  const loadScheduledEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_emails')
        .select(`
          template_id,
          total_emails,
          sent_emails,
          start_date,
          end_date,
          interval_minutes,
          emails_per_account,
          schedule_id: id,
          schedule_email_accounts!inner(
            email_account_id,
            emails_sent,
            email_accounts: email_accounts!schedule_email_accounts_email_account_id_fkey(email)
          )
        `)
        .eq('campaign_id', campaignId);
      if (error) throw error;
      const templateMap = new Map();
      data.forEach((item: any) => {
        const scheduleKey = item.schedule_id;
        if (!templateMap.has(scheduleKey)) {
          templateMap.set(scheduleKey, {
            id: item.schedule_id,
            templateId: item.template_id,
            totalEmails: item.total_emails,
            sentEmails: item.sent_emails,
            startDate: item.start_date,
            endDate: item.end_date,
            interval: item.interval_minutes,
            emailsPerAccount: item.emails_per_account,
            emailAccounts: []
          });
        }
        const entry = templateMap.get(scheduleKey);
        if (item.schedule_email_accounts) {
          item.schedule_email_accounts.forEach((account: any) => {
            entry.emailAccounts.push({
              id: account.email_account_id,
              email: account.email_accounts?.email || 'Unknown',
              sent: account.emails_sent || 0
            });
          });
        }
      });
      setScheduledEmails(Array.from(templateMap.values()));
    } catch (error) {
      console.error('Error loading scheduled emails:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await fetchTemplates(campaignId);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmailAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('campaign_email_accounts')
        .select('email_account_id, email_accounts:email_accounts!campaign_email_accounts_email_account_id_fkey(email)')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      const accounts = data.map((item: any) => ({
        id: item.email_account_id,
        email: item.email_accounts.email
      }));
      setAllEmailAccounts(accounts);
    } catch (error) {
      console.error('Error loading email accounts:', error);
    }
  };

  useEffect(() => {
    loadTemplates();
    loadEmailAccounts();
    loadScheduledEmails();
    if (!startDate) {
      const today = new Date();
      setStartDate(today.toISOString().split('T')[0]);
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);
      setEndDate(nextMonth.toISOString().split('T')[0]);
    }
  }, [campaignId]);

  useEffect(() => {
    setFilteredEmailAccounts(allEmailAccounts);
  }, [allEmailAccounts]);

  const handleToggleAllAccounts = () => {
    if (selectedEmailAccounts.length === filteredEmailAccounts.length) {
      setSelectedEmailAccounts([]);
    } else {
      setSelectedEmailAccounts(filteredEmailAccounts.map(a => a.id));
    }
  };

  const handleSaveEdit = async (updated: any) => {
    try {
      const { error } = await supabase
        .from('scheduled_emails')
        .update({
          total_emails: updated.totalEmails,
          interval_minutes: updated.interval,
          emails_per_account: updated.emailsPerAccount,
          start_date: updated.startDate,
          end_date: updated.endDate
        })
        .eq('id', updated.id);
      if (error) throw error;
      await loadScheduledEmails();
      toast({ title: "Module Updated", description: "Temporal parameters recalibrated." });
    } catch (err: any) {
      toast({ title: "Sync Error", description: err.message });
    }
  };

  const handleRescheduleToToday = async () => {
    try {
      setIsSaving(true);
      const today = new Date().toISOString().split('T')[0];
      for (const item of scheduledEmails) {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const diff = end.getTime() - start.getTime();
        const newStart = today;
        const newEnd = new Date(new Date(today).getTime() + diff).toISOString().split('T')[0];
        
        await supabase
          .from('scheduled_emails')
          .update({
            start_date: getLondonTimestamp(newStart, '09:00'),
            end_date: getLondonTimestamp(newEnd, '09:00'),
            scheduled_for: getLondonTimestamp(newStart, '09:00'),
            status: 'scheduled'
          })
          .eq('id', item.id);
      }
      await loadScheduledEmails();
      toast({ title: "Temporal Shift", description: "All modules re-aligned to current timeframe." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchedule = async () => {
    if (selectedEmailAccounts.length === 0) {
      toast({ title: "Target Error", description: "Specify output relay accounts." });
      return;
    }
    try {
      setIsSaving(true);
      for (const tpl of templates) {
        const { data, error } = await supabase
          .from('scheduled_emails')
          .insert({
            campaign_id: campaignId,
            template_id: tpl.id,
            start_date: getLondonTimestamp(startDate, startTime),
            end_date: getLondonTimestamp(endDate, startTime),
            total_emails: emailsPerDay || 0,
            interval_minutes: interval || 15,
            emails_per_account: emailsPerAccount || 50,
            status: 'scheduled',
            scheduled_for: getLondonTimestamp(startDate, startTime)
          })
          .select().single();
        if (error) throw error;
        await supabase.from('schedule_email_accounts').insert(
          selectedEmailAccounts.map(accId => ({
            schedule_id: data.id,
            email_account_id: accId,
            emails_sent: 0,
            emails_remaining: emailsPerAccount || 50
          }))
        );
      }
      await supabase.from('campaigns').update({ status: 'in_progress' }).eq('id', campaignId);
      toast({ title: "Launch Successful", description: "Campaign core activated." });
      await loadScheduledEmails();
    } catch (err: any) {
      toast({ title: "Launch Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePersonalizeLaunch = () => {
    handleSchedule();
  };

  const handleToggleAccount = (id: string) => {
    setSelectedEmailAccounts(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleAutoSchedule = async () => {
    try {
      setIsLoading(true);
      const { count, error } = await supabase
        .from('campaign_leads')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);
      if (error) throw error;
      const totalLeads = count || 0;
      if (totalLeads === 0) {
        toast({ title: "Signal Lost", description: "No targets detected in campaign registry." });
        setIsLoading(false);
        return;
      }
      const latestTemplates = await fetchTemplates(campaignId);
      const sortedTemplates = [...latestTemplates].sort((a, b) => {
        const stepA = a.name.match(/Step (\d+)/i);
        const stepB = b.name.match(/Step (\d+)/i);
        if (stepA && stepB) return parseInt(stepA[1]) - parseInt(stepB[1]);
        return new Date((a as any).created_at || 0).getTime() - new Date((b as any).created_at || 0).getTime();
      });
      if (sortedTemplates.length === 0) {
        toast({ title: "Logic Error", description: "No email modules prepped for scheduling." });
        setIsLoading(false);
        return;
      }
      const limitPerDay = emailsPerDay || 500;
      const durationDays = Math.ceil(totalLeads / limitPerDay);
      const gapDays = 3;
      let currentStartDate = new Date();
      const proposed = sortedTemplates.map((tpl, index) => {
        const start = new Date(currentStartDate);
        start.setDate(start.getDate() + (index * gapDays));
        const end = new Date(start);
        end.setDate(end.getDate() + durationDays);
        return {
          templateId: tpl.id,
          templateName: tpl.name,
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          startTime: '09:00',
          totalEmails: limitPerDay,
          interval: Math.max(15, interval || 15),
          emailsPerAccount: emailsPerAccount || 50
        };
      });
      setStagedSchedules(proposed);
      setShowWizard(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWizardLaunch = async () => {
    if (selectedEmailAccounts.length === 0) {
      toast({ title: "Selection Error", description: "Select at least one relay account." });
      return;
    }
    try {
      setIsSaving(true);
      for (const schedule of stagedSchedules) {
        const londonStart = getLondonTimestamp(schedule.startDate, schedule.startTime);
        const { data: scheduleData, error: scheduleError } = await supabase
          .from('scheduled_emails')
          .insert({
            campaign_id: campaignId,
            template_id: schedule.templateId,
            start_date: londonStart,
            end_date: getLondonTimestamp(schedule.endDate, schedule.startTime),
            scheduled_for: londonStart,
            total_emails: schedule.totalEmails,
            interval_minutes: schedule.interval,
            emails_per_account: schedule.emailsPerAccount,
            status: 'scheduled'
          })
          .select().single();
        if (scheduleError) throw scheduleError;
        await supabase.from('schedule_email_accounts').insert(
          selectedEmailAccounts.map(accId => ({
            schedule_id: scheduleData.id,
            email_account_id: accId,
            emails_sent: 0,
            emails_remaining: schedule.emailsPerAccount
          }))
        );
      }
      await supabase.from('campaigns').update({ status: 'in_progress' }).eq('id', campaignId);
      toast({ title: "Launch Successful", description: "Temporal logic synced to campaign core." });
      setShowWizard(false);
      await loadScheduledEmails();
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    try {
      const { error } = await supabase.from('scheduled_emails').delete().eq('id', id);
      if (error) throw error;
      setScheduledEmails(prev => prev.filter(item => item.id !== id));
      toast({ title: "Module Purged", description: "Schedule removed from temporal registry." });
    } catch (error) {
      toast({ title: "Error", description: "Purge failed." });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 bg-foreground/[0.02] rounded-none w-1/3"></div>
        <div className="h-32 bg-foreground/[0.01] rounded-none"></div>
      </div>
    );
  }

  if (templates.length === 0) {
    return <NoTemplatesMessage />;
  }

  // --- AUTO SCHEDULE WIZARD SCREEN (Compact Redesign) ---
  if (showWizard) {
    return (
      <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between bg-foreground/[0.02] p-4 rounded-none">
          <div>
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Auto-Schedule Review</h3>
            <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest mt-0.5">Verify sequence timeline details</p>
          </div>
          <Button 
            variant="ghost" 
            onClick={() => setShowWizard(false)} 
            className="h-8 text-[9px] font-black uppercase tracking-widest hover:bg-foreground/[0.05]"
          >
            Cancel
          </Button>
        </div>

        {/* Stacked Wizard Flow */}
        <div className="space-y-6">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] block">
              Staged Campaign Sequences ({stagedSchedules.length})
            </span>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {stagedSchedules.map((schedule, i) => (
                <div key={i} className="p-4 bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all flex flex-col gap-3 rounded-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center justify-center h-5 w-5 bg-primary/10 text-primary text-[10px] font-black rounded-none shrink-0">
                      {i + 1}
                    </span>
                    <h4 className="font-black text-xs truncate text-foreground" title={schedule.templateName}>
                      {schedule.templateName}
                    </h4>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Start</label>
                      <input
                        type="date"
                        value={schedule.startDate}
                        onChange={(e) => {
                          const updated = [...stagedSchedules];
                          updated[i] = { ...updated[i], startDate: e.target.value };
                          setStagedSchedules(updated);
                        }}
                        className="h-9 px-3 bg-foreground/[0.02] border-none text-xs font-bold text-foreground focus:outline-none focus:bg-foreground/[0.05] rounded-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-foreground/30">End</label>
                      <input
                        type="date"
                        value={schedule.endDate}
                        min={schedule.startDate}
                        onChange={(e) => {
                          const updated = [...stagedSchedules];
                          updated[i] = { ...updated[i], endDate: e.target.value };
                          setStagedSchedules(updated);
                        }}
                        className="h-9 px-3 bg-foreground/[0.02] border-none text-xs font-bold text-foreground focus:outline-none focus:bg-foreground/[0.05] rounded-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Daily Vol</label>
                      <input
                        type="number"
                        value={schedule.totalEmails === undefined ? "" : schedule.totalEmails}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...stagedSchedules];
                          if (val === "") {
                            updated[i] = { ...updated[i], totalEmails: undefined as any };
                          } else {
                            const parsed = parseInt(val);
                            updated[i] = { ...updated[i], totalEmails: isNaN(parsed) ? (undefined as any) : parsed };
                          }
                          setStagedSchedules(updated);
                        }}
                        className="h-9 px-3 bg-foreground/[0.02] border-none text-xs font-bold text-foreground focus:outline-none focus:bg-foreground/[0.05] rounded-none text-center"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Interval (M)</label>
                      <input
                        type="number"
                        value={schedule.interval === undefined ? "" : schedule.interval}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...stagedSchedules];
                          if (val === "") {
                            updated[i] = { ...updated[i], interval: undefined as any };
                          } else {
                            const parsed = parseInt(val);
                            updated[i] = { ...updated[i], interval: isNaN(parsed) ? (undefined as any) : parsed };
                          }
                          setStagedSchedules(updated);
                        }}
                        className="h-9 px-3 bg-foreground/[0.02] border-none text-xs font-bold text-foreground focus:outline-none focus:bg-foreground/[0.05] rounded-none text-center"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-foreground/30">Acc Limit</label>
                      <input
                        type="number"
                        value={schedule.emailsPerAccount === undefined ? "" : schedule.emailsPerAccount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const updated = [...stagedSchedules];
                          if (val === "") {
                            updated[i] = { ...updated[i], emailsPerAccount: undefined as any };
                          } else {
                            const parsed = parseInt(val);
                            updated[i] = { ...updated[i], emailsPerAccount: isNaN(parsed) ? (undefined as any) : parsed };
                          }
                          setStagedSchedules(updated);
                        }}
                        className="h-9 px-3 bg-foreground/[0.02] border-none text-xs font-bold text-foreground focus:outline-none focus:bg-foreground/[0.05] rounded-none text-center"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
 
          {/* Senders selection nested for wizard review */}
          <div className="space-y-4 bg-foreground/[0.01] p-4 rounded-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">
                Schedule Senders
              </span>
              <button
                onClick={handleToggleAllAccounts}
                className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
              >
                {selectedEmailAccounts.length === filteredEmailAccounts.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {filteredEmailAccounts.map((account) => {
                const isSelected = selectedEmailAccounts.includes(account.id);
                return (
                  <div
                    key={account.id}
                    onClick={() => handleToggleAccount(account.id)}
                    className={`
                      flex items-center gap-3 p-2.5 rounded-none cursor-pointer transition-all duration-150 select-none
                      ${isSelected ? 'bg-primary/5 text-primary' : 'bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.04]'}
                    `}
                  >
                    <CustomCheckbox checked={isSelected} onChange={() => {}} />
                    <span className="text-xs truncate font-bold">{account.email}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-4">
              <Button
                onClick={handleWizardLaunch}
                disabled={selectedEmailAccounts.length === 0 || isSaving}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/95 rounded-none font-black text-[10px] uppercase tracking-[0.15em] border-none transition-all shadow-lg shadow-primary/10"
              >
                {isSaving ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-3 w-3 border-2 border-primary-foreground/30 border-t-white rounded-none animate-spin" />
                    <span>Synchronizing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Launch Staged Timeline</span>
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DEFAULT VIEW (Sleek Vertical Stack Redesign) ---
  return (
    <div className="space-y-6">
      {/* Test / Shift Header Strip */}
      <div className="flex items-center justify-between bg-foreground/[0.02] p-3 rounded-none">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.15em]">
            UK Execution Time (BST/GMT)
          </span>
        </div>
        <Button
          onClick={() => setShowTestModal(true)}
          variant="outline"
          className="h-7 px-3 bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.05] text-[9px] font-black uppercase tracking-widest rounded-none border-none transition-all flex items-center gap-1"
        >
          <Sparkles className="w-3 h-3 text-primary animate-pulse" />
          Test Email Output
        </Button>
      </div>

      <TestOutputModal
        open={showTestModal}
        onOpenChange={setShowTestModal}
        campaignId={campaignId}
        templates={templates}
      />

      <EditScheduleModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        schedule={editingSchedule}
        onSave={handleSaveEdit}
      />

      {/* Auto / Manual Setup Section */}
      <div className="bg-foreground/[0.01] p-4 rounded-none">
        {!isManualMode ? (
          <div className="flex flex-col gap-4 p-4 bg-gradient-to-br from-primary/5 to-transparent rounded-none">
            <div className="space-y-1 text-left">
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Auto-Schedule Wizard
              </h3>
              <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest leading-relaxed">
                Staggers your sequence steps automatically to ensure high inbox delivery.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={handleAutoSchedule}
                className="h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/95 rounded-none font-black text-[9px] uppercase tracking-widest border-none transition-all"
              >
                Auto-Schedule Sequence
              </Button>
              <button
                onClick={() => setIsManualMode(true)}
                className="text-[9px] text-foreground/30 hover:text-primary transition-colors font-black uppercase tracking-widest"
              >
                Configure Manual
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 space-y-4">
            <div className="flex items-center justify-between border-b border-foreground/[0.05] pb-2">
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Manual Scheduling Settings</h3>
              <Button
                variant="ghost"
                onClick={() => setIsManualMode(false)}
                className="text-[9px] font-black uppercase tracking-widest text-foreground/40 hover:text-primary gap-1 px-2 h-6"
              >
                <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                Use Auto Strategy
              </Button>
            </div>

            <ScheduleForm
              templates={templates}
              startDate={startDate}
              endDate={endDate}
              startTime={startTime}
              emailsPerAccount={emailsPerAccount}
              emailsPerDay={emailsPerDay}
              interval={interval}
              intervalAccount={intervalAccount}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onStartTimeChange={setStartTime}
              onEmailsPerAccountChange={setEmailsPerAccount}
              onEmailsPerDayChange={setEmailsPerDay}
              onIntervalChange={setInterval}
              onIntervalAccountChange={setIntervalAccount}
            />
          </div>
        )}
      </div>

      {/* Target Senders checklist (compact design stacked in flow) */}
      <div className="bg-foreground/[0.01] p-4 rounded-none space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.15em]">
              Senders for Schedule
            </span>
            <span className="px-2 py-0.5 bg-foreground/[0.05] text-foreground/50 text-[8px] font-black uppercase rounded-none">
              {selectedEmailAccounts.length} selected
            </span>
          </div>
          <button
            onClick={handleToggleAllAccounts}
            className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
          >
            {selectedEmailAccounts.length === filteredEmailAccounts.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground/20" />
          <input
            type="text"
            placeholder="Filter email addresses..."
            className="w-full pl-8 pr-3 py-2 bg-foreground/[0.02] border-none rounded-none focus:outline-none focus:bg-foreground/[0.04] text-[10px] text-foreground placeholder:text-foreground/20 font-bold uppercase tracking-wider"
            onChange={(e) => {
              const search = e.target.value.trim().toLowerCase();
              setFilteredEmailAccounts(
                allEmailAccounts.filter((account) =>
                  account.email.toLowerCase().includes(search)
                )
              );
            }}
          />
        </div>

        <div className="max-h-[150px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
          {filteredEmailAccounts.length > 0 ? (
            filteredEmailAccounts.map((account) => {
              const isSelected = selectedEmailAccounts.includes(account.id);
              return (
                <div
                  key={account.id}
                  onClick={() => handleToggleAccount(account.id)}
                  className={`
                    flex items-center justify-between p-2 rounded-none cursor-pointer transition-all duration-150 select-none
                    ${isSelected ? 'bg-primary/5 text-primary' : 'bg-foreground/[0.02] hover:bg-foreground/[0.04] text-foreground'}
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <CustomCheckbox checked={isSelected} onChange={() => {}} />
                    <span className="text-xs truncate font-bold">{account.email}</span>
                  </div>
                  <span className="text-[7px] bg-foreground/[0.05] px-1 py-0.5 rounded-none font-black text-foreground/30 uppercase tracking-widest shrink-0">
                    Ready
                  </span>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center bg-foreground/[0.01] rounded-none">
              <AlertCircle className="h-4 w-4 text-foreground/10 mb-1" />
              <p className="text-[9px] text-foreground/20 uppercase tracking-widest font-black">No accounts found</p>
            </div>
          )}
        </div>

        {/* Action buttons (only displayed in Manual mode) */}
        {isManualMode && (
          <div className="pt-3 border-t border-foreground/[0.05] space-y-2">
            <Button
              onClick={handleSchedule}
              disabled={templates.length === 0 || !startDate || !endDate || selectedEmailAccounts.length === 0 || isSaving}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/95 rounded-none font-black text-[10px] uppercase tracking-widest border-none transition-all shadow-md"
            >
              {isSaving ? (
                <div className="h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-white rounded-none animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              )}
              <span>{isSaving ? 'Processing...' : 'Launch Schedule'}</span>
            </Button>
            <Button
              onClick={handlePersonalizeLaunch}
              disabled={templates.length === 0 || !startDate || !endDate || selectedEmailAccounts.length === 0 || isSaving}
              className="w-full h-10 bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.05] rounded-none font-black text-[9px] uppercase tracking-widest border-none transition-all"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1 text-primary animate-pulse" />
              <span>Personalize & Launch</span>
            </Button>
          </div>
        )}
      </div>

      {/* Active Schedules Panel */}
      <div className="space-y-3 bg-foreground/[0.01] p-4 rounded-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.15em]">
              Active Schedules
            </span>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase rounded-none">
              {scheduledEmails.length} Running
            </span>
          </div>
          <Button
            onClick={handleRescheduleToToday}
            disabled={isSaving || scheduledEmails.length === 0}
            variant="outline"
            className="gap-1 bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.05] text-[9px] h-7 px-3 font-black rounded-none border-none transition-all"
            title="Shift all schedules to start from today"
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Resume from Today
          </Button>
        </div>

        <div className="space-y-2">
          {scheduledEmails.length > 0 ? (
            scheduledEmails.map((item) => {
              const template = templates.find(t => t.id === item.templateId);
              const entryId = item.id;
              const showEmails = visibleEmails[entryId] || false;
              const progress = Math.min(100, Math.max(0, (item.sentEmails / (item.totalEmails || 1)) * 100));

              return (
                <div key={entryId} className="p-3 bg-foreground/[0.02] hover:bg-foreground/[0.03] rounded-none transition-all flex flex-col gap-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    
                    {/* Name and Meta */}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                        <h4 className="font-bold text-xs text-foreground truncate max-w-[200px]" title={item.templateId ? (template?.name || 'Loading...') : 'Paused'}>
                          {item.templateId ? (template?.name || 'Loading Template...') : 'Paused - Template Missing'}
                        </h4>
                        <div className={`
                          px-1.5 py-0.5 rounded-none text-[8px] font-black uppercase tracking-wider
                          ${!item.templateId
                            ? 'bg-amber-500/10 text-amber-500'
                            : item.sentEmails >= item.totalEmails
                              ? 'bg-green-500/10 text-green-500'
                              : 'bg-primary/10 text-primary'
                          }
                        `}>
                          {!item.templateId ? 'Paused' : item.sentEmails >= item.totalEmails ? 'Completed' : 'Running'}
                        </div>
                      </div>
                      <p className="text-[8px] font-bold text-foreground/40 uppercase tracking-widest flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span>{new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.emailAccounts.length} Accs</span>
                        <span>•</span>
                        <span>{item.totalEmails} vol</span>
                        <span>•</span>
                        <span>{item.interval}m gap</span>
                      </p>
                    </div>

                    {/* Progress Bar & Value (Compact) */}
                    <div className="w-full sm:w-36 space-y-1">
                      <div className="flex justify-between items-center text-[9px] font-bold text-foreground/40 uppercase tracking-widest">
                        <span>{item.sentEmails}/{item.totalEmails} sent</span>
                        <span className="font-mono">{Math.round(progress)}%</span>
                      </div>
                      <div className="h-1 w-full bg-foreground/[0.05] rounded-none overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Micro Actions */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => setVisibleEmails(prev => ({ ...prev, [entryId]: !showEmails }))}
                        className="h-7 px-2 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-[9px] font-black uppercase tracking-widest text-foreground/50 hover:text-primary transition-all flex items-center gap-0.5 rounded-none"
                        title="Toggle Accounts details"
                      >
                        {showEmails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>Relays</span>
                      </button>
                      <button
                        onClick={() => { setEditingSchedule(item); setShowEditModal(true); }}
                        className="h-7 w-7 p-0 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-foreground/40 hover:text-primary transition-all flex items-center justify-center rounded-none"
                        title="Edit Schedule Parameters"
                      >
                        <Info className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSchedule(item.id)}
                        className="h-7 w-7 p-0 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center rounded-none"
                        title="Delete Schedule"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expandable Account Details */}
                  {showEmails && (
                    <div className="mt-2 p-2 bg-foreground/[0.01] rounded-none space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      {item.emailAccounts.map(account => {
                        const accProgress = (account.sent / item.emailsPerAccount) * 100;
                        return (
                          <div key={account.id} className="flex flex-col gap-1 p-2 bg-foreground/[0.02] rounded-none">
                            <span className="text-[10px] font-bold truncate text-foreground/60">{account.email || 'Unknown'}</span>
                            <div className="flex items-center justify-between text-[8px] font-bold text-foreground/30 uppercase tracking-widest">
                              <span>{account.sent} / {item.emailsPerAccount} sent</span>
                              <span className="font-mono">{Math.round(accProgress)}%</span>
                            </div>
                            <div className="h-1 w-full bg-foreground/[0.05] rounded-none overflow-hidden">
                              <div className="h-full bg-primary/60" style={{ width: `${accProgress}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-foreground/[0.01] rounded-none">
              <div className="p-3 bg-foreground/[0.02] rounded-none mb-2 text-foreground/20">
                <Mail className="h-5 w-5 animate-pulse" />
              </div>
              <h4 className="text-xs font-black text-foreground/40 uppercase tracking-wider mb-0.5">No Active Schedules</h4>
              <p className="text-[9px] text-foreground/20 text-center max-w-[200px] leading-relaxed font-black uppercase tracking-widest">
                Configure and launch a schedule to see its active propagation here.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleEditor;

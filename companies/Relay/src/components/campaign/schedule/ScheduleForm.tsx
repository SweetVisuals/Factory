import React from 'react';
import { Label } from 'components/ui/label';
import { Input } from 'components/ui/input';
import { EmailTemplate } from 'types';
import { Calendar, Clock, Mail, Timer, Target, Users, Zap, Shield, Activity } from 'lucide-react';

interface ScheduleFormProps {
  templates: EmailTemplate[];
  startDate: string;
  endDate: string;
  startTime: string;
  emailsPerAccount?: number;
  emailsPerDay?: number;
  interval?: number;
  intervalAccount?: number;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStartTimeChange: (value: string) => void;
  onEmailsPerAccountChange: (value?: number) => void;
  onEmailsPerDayChange: (value?: number) => void;
  onIntervalChange: (value?: number) => void;
  onIntervalAccountChange: (value?: number) => void;
}

export const ScheduleForm: React.FC<ScheduleFormProps> = ({
  templates,
  startDate,
  endDate,
  startTime,
  emailsPerAccount,
  emailsPerDay,
  interval,
  intervalAccount,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEmailsPerAccountChange,
  onEmailsPerDayChange,
  onIntervalChange,
  onIntervalAccountChange,
}) => {
  return (
    <div className="space-y-12">
      {/* Propagation Logic Registry */}
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/[0.02] rounded-none">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Propagation Logic</h3>
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-black">Configure automated sequence distribution</p>
          </div>
        </div>
        
        <div className="p-6 bg-white/[0.01] rounded-none flex items-center justify-between group hover:bg-white/[0.02] transition-all">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-none">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-black text-white uppercase tracking-tighter">{templates.length} Modules Prepped</div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest font-black">Automatic 3-day stagger active</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-none">
            <Activity size={12} className="text-primary animate-pulse" />
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Optimized</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Temporal Matrix */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/[0.02] rounded-none">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tighter">Temporal Matrix</h4>
              <p className="text-[9px] text-white/20 uppercase tracking-widest font-black">Sync with London (BST/GMT)</p>
            </div>
          </div>

          <div className="space-y-5 p-8 bg-white/[0.01] rounded-none relative overflow-hidden">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Initiation Date</Label>
                <div className="relative group">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onStartDateChange(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Daily Trigger</Label>
                <div className="relative group">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onStartTimeChange(e.target.value)}
                    className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Termination Threshold</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEndDateChange(e.target.value)}
                min={startDate || new Date().toISOString().split('T')[0]}
                className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all"
              />
            </div>
          </div>
        </div>

        {/* Volume Metrics */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/[0.02] rounded-none">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-black uppercase tracking-tighter">Volume Protocols</h4>
              <p className="text-[9px] text-white/20 uppercase tracking-widest font-black">Safety and performance limits</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 p-8 bg-white/[0.01] rounded-none">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Max Daily Load</Label>
              <div className="relative group">
                <Input
                  type="text"
                  value={emailsPerDay === undefined ? "" : String(emailsPerDay)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value === "") onEmailsPerDayChange(undefined);
                    else {
                      const parsed = parseInt(value);
                      if (!isNaN(parsed)) onEmailsPerDayChange(parsed);
                    }
                  }}
                  className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all pr-10"
                  placeholder="Total emails"
                />
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Burst Gap (Min)</Label>
              <div className="relative group">
                <Input
                  type="text"
                  value={interval === undefined ? "" : String(interval)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value === "") onIntervalChange(undefined);
                    else {
                      const parsed = parseInt(value);
                      if (!isNaN(parsed)) onIntervalChange(parsed);
                    }
                  }}
                  className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all pr-10"
                  placeholder="Min 15"
                />
                <Timer className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Per Account</Label>
              <div className="relative group">
                <Input
                  type="text"
                  value={emailsPerAccount === undefined ? "" : String(emailsPerAccount)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value === "") onEmailsPerAccountChange(undefined);
                    else {
                      const parsed = parseInt(value);
                      if (!isNaN(parsed)) onEmailsPerAccountChange(parsed);
                    }
                  }}
                  className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all pr-10"
                  placeholder="Load/Acc"
                />
                <Users className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10 group-focus-within:text-primary transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-white/20 ml-1">Relay Gap (Min)</Label>
              <div className="relative group">
                <Input
                  type="text"
                  value={intervalAccount === undefined ? "" : String(intervalAccount)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const value = e.target.value;
                    if (value === "") onIntervalAccountChange(undefined);
                    else {
                      const parsed = parseInt(value);
                      if (!isNaN(parsed)) onIntervalAccountChange(parsed);
                    }
                  }}
                  className="bg-white/[0.02] border-none focus:bg-white/[0.04] h-12 rounded-none font-bold text-sm transition-all pr-10"
                  placeholder="Relay gap"
                />
                <Clock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10 group-focus-within:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


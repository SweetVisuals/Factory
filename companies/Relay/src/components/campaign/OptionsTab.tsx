import { useState } from 'react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Trash2, ShieldAlert, Settings, RefreshCw, Power, Play, Check, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';

interface OptionsTabProps {
  campaignId: string;
  campaignName: string;
  campaignStatus?: string;
  onNameChange: (newName: string) => void;
  onDelete: () => void;
  onResume?: () => void;
}

const OptionsTab = ({ campaignId, campaignName, campaignStatus = 'draft', onNameChange, onDelete, onResume }: OptionsTabProps) => {
  const { updateCampaign } = useApp();
  const [name, setName] = useState(campaignName);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { toast } = useToast();

  const currentStatus = (campaignStatus || 'draft').toLowerCase();

  const handleUpdateName = async () => {
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      await onNameChange(name.trim());
      toast({ title: 'Campaign Renamed', description: 'System identifier has been updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Rename Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      setStatusUpdating(true);
      await updateCampaign(campaignId, { status: newStatus as any });
      
      // Additional side effects based on status
      if (newStatus === 'in_progress') {
        // Resume scheduled emails
        await supabase
          .from('scheduled_emails')
          .update({ status: 'scheduled' })
          .eq('campaign_id', campaignId)
          .eq('status', 'paused');
      } else if (newStatus === 'paused') {
        // Pause scheduled emails
        await supabase
          .from('scheduled_emails')
          .update({ status: 'paused' })
          .eq('campaign_id', campaignId)
          .eq('status', 'scheduled');
      }

      toast({ 
        title: 'Status Updated', 
        description: `Campaign is now set to ${newStatus.replace('_', ' ')}.` 
      });
    } catch (error: any) {
      toast({ 
        title: 'Failed to Update Status', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      toast({ title: 'Campaign Terminated', description: 'Campaign has been deleted and resources deallocated.' });
    } catch (error: any) {
      toast({ title: 'Delete Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-4xl">
      {/* Grid containing Rename and Status Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Status Control Panel */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Campaign Status</h3>
            <p className="text-xs text-muted-foreground mb-4">Set current routing and communication state.</p>
          </div>
          
          <div className="flex flex-col gap-2.5">
            {[
              { id: 'draft', label: 'Draft', color: 'border-white/10 hover:bg-white/[0.02]', activeClass: 'bg-white/10 border-white/30 text-white' },
              { id: 'in_progress', label: 'Active', color: 'border-emerald-500/10 hover:bg-emerald-500/[0.02]', activeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' },
              { id: 'paused', label: 'Paused', color: 'border-amber-500/10 hover:bg-amber-500/[0.02]', activeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]' }
            ].map(item => {
              const isActive = currentStatus === item.id || (item.id === 'in_progress' && currentStatus === 'active');
              return (
                <button
                  key={item.id}
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange(item.id)}
                  className={cn(
                    "flex items-center justify-between px-5 py-3.5 border rounded-xl font-semibold text-xs tracking-wider uppercase transition-all duration-300",
                    isActive ? item.activeClass : cn("bg-transparent border-border/50 text-muted-foreground", item.color)
                  )}
                >
                  <span>{item.label}</span>
                  {isActive && <Check size={14} className="animate-in zoom-in duration-300" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Rename Input Panel */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">Rename Campaign</h3>
            <p className="text-xs text-muted-foreground mb-4">Update the system name for this outbound campaign.</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-foreground/[0.03] border border-border/50 rounded-xl px-4 py-3.5 text-sm font-semibold text-foreground uppercase tracking-tight focus:bg-foreground/[0.05] focus:border-primary/50 outline-none transition-all placeholder:text-foreground/10"
                placeholder="Campaign name..."
              />
            </div>
            
            <Button 
              onClick={handleUpdateName} 
              disabled={isSaving || !name.trim() || name === campaignName}
              className="w-full bg-white hover:bg-neutral-200 text-black rounded-xl py-6 font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Apply Rename'}
            </Button>
          </div>
        </div>

      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/[0.02] border border-red-500/10 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex gap-4 items-start">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-500 shrink-0">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-red-500 uppercase tracking-wider mb-0.5">Danger Zone</h3>
              <p className="text-xs text-muted-foreground max-w-md">
                Deleting this campaign is permanent. All metrics, history, scheduled tasks, and linked data will be deleted.
              </p>
            </div>
          </div>

          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all shrink-0"
            >
              Delete Campaign
            </Button>
          ) : (
            <div className="flex flex-col gap-3 min-w-[260px] animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-2 text-xs text-red-400 font-bold uppercase tracking-wider">
                <AlertTriangle size={14} className="animate-bounce" />
                Are you absolutely sure?
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-500 hover:bg-red-600 text-white flex-1 py-4 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                >
                  {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Yes, Delete'}
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white flex-1 py-4 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OptionsTab;

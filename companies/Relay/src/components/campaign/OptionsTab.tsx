import { useState } from 'react';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Trash2, ShieldAlert, Settings, RefreshCw, Power, Play } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OptionsTabProps {
  campaignName: string;
  campaignStatus?: string;
  onNameChange: (newName: string) => void;
  onDelete: () => void;
  onResume?: () => void;
}

const OptionsTab = ({ campaignName, campaignStatus, onNameChange, onDelete, onResume }: OptionsTabProps) => {
  const [name, setName] = useState(campaignName);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const { toast } = useToast();

  const handleUpdateName = async () => {
    if (!name.trim()) return;
    try {
      setIsSaving(true);
      await onNameChange(name.trim());
      toast({ title: 'Configuration Synced', description: 'System identifier has been updated.' });
    } catch (error: any) {
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResume = async () => {
    if (onResume) {
      setIsResuming(true);
      try {
        await onResume();
        toast({
          title: 'Deployment Resumed',
          description: 'Propagation vectors and cluster schedules have been reactivated.',
        });
      } catch (e) {
        toast({
          title: 'Resumption Failed',
          description: 'An error occurred while re-initializing the propagation sequence.',
          variant: 'destructive',
        });
      } finally {
        setIsResuming(false);
      }
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Initialize termination sequence for this deployment? This action is irreversible.')) return;
    try {
      setIsDeleting(true);
      await onDelete();
      toast({ title: 'Deployment Terminated', description: 'System resources have been deallocated.' });
    } catch (error: any) {
      toast({ title: 'Termination Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Resume Banner */}
      {campaignStatus === 'out_of_balance' && (
        <div className="bg-primary/10 p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Play className="h-5 w-5 text-primary animate-pulse" />
            <div>
              <h3 className="text-sm font-black text-primary uppercase tracking-tight">Resume Campaign</h3>
              <p className="text-[9px] font-bold text-primary/40 uppercase tracking-widest mt-0.5">Paused due to low balance</p>
            </div>
          </div>
          <Button
            onClick={handleResume}
            disabled={isResuming}
            className="bg-primary hover:bg-primary/80 text-primary-foreground px-6 h-10 font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {isResuming ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Resume'}
          </Button>
        </div>
      )}

      {/* Compact Campaign Name Edit */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <Settings className="h-3.5 w-3.5 text-foreground/30" />
          <label className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">Name</label>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-foreground/[0.03] px-4 py-2.5 text-sm font-bold text-foreground uppercase tracking-tight focus:bg-foreground/[0.05] outline-none transition-all placeholder:text-foreground/10"
          placeholder="Campaign name..."
        />
        <Button 
          onClick={handleUpdateName} 
          disabled={isSaving}
          className="bg-primary hover:bg-primary/80 text-primary-foreground px-5 h-10 font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isSaving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
        </Button>
      </div>

      {/* Danger Zone — Compact Inline */}
      <div className="flex items-center justify-between p-5 bg-red-500/[0.03] group hover:bg-red-500/[0.05] transition-all">
        <div className="flex items-center gap-4">
          <ShieldAlert className="h-4 w-4 text-red-500/40" />
          <div>
            <h4 className="text-xs font-black text-red-500/70 uppercase tracking-tight">Terminate Campaign</h4>
            <p className="text-[9px] font-bold text-red-500/30 uppercase tracking-widest mt-0.5">
              Permanently delete all data
            </p>
          </div>
        </div>
        
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 h-10 font-black text-[9px] uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isDeleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : (
            <div className="flex items-center gap-2">
              <Power className="h-3.5 w-3.5" />
              Terminate
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default OptionsTab;

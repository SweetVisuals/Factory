import React, { useState, useEffect } from 'react';
import { EmailAccount } from '../../types';
import { X, User, Send, Activity, Trash2 } from 'lucide-react';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import WarmupTab from './sidebar/WarmupTab';
import SettingsTab from './sidebar/SettingsTab';
import CampaignsTab from './sidebar/CampaignsTab';
import { toast } from '../ui/use-toast';
import { fetchEmailAccounts, updateWarmupSettings } from '../../lib/api/email-accounts';
import { cn } from '../../lib/utils';

interface EmailAccountSidebarProps {
  account: EmailAccount;
  onClose: () => void;
  onToggleWarmup?: (account: EmailAccount, e: React.MouseEvent, resume?: boolean) => void;
  onDeleteAccount?: (account: EmailAccount) => Promise<void>;
}

const EmailAccountSidebar = ({ account, onClose, onToggleWarmup, onDeleteAccount }: EmailAccountSidebarProps) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentAccount, setCurrentAccount] = useState(account);
  const [activeTab, setActiveTab] = useState('warmup');

  // Fetch latest account data on mount and when account prop changes
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const accounts = await fetchEmailAccounts();
        const updatedAccount = accounts.find(a => a.id === account.id);
        if (updatedAccount) {
          setCurrentAccount(updatedAccount);
        }
      } catch (error) {
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to fetch account data',
          variant: 'destructive',
        });
      }
    };

    fetchAccount();
  }, [account.id]);

  const handleToggleWarmup = async (account: EmailAccount, e: React.MouseEvent, resume?: boolean) => {
    try {
      const currentStatus = account.warmup_status || 'disabled';
      const nextStatus: 'enabled' | 'paused' | 'disabled' =
        resume ? 'enabled' :
          currentStatus === 'disabled' ? 'enabled' :
            currentStatus === 'enabled' ? 'paused' : 'disabled';

      const updates = {
        warmup_status: nextStatus,
        warmup_enabled: nextStatus !== 'disabled',
        warmup_start_date: nextStatus === 'enabled' ? new Date().toISOString() :
          nextStatus === 'disabled' ? null : account.warmup_start_date
      };

      const updatedAccount = await updateWarmupSettings({
        emailAccountId: account.id,
        ...updates
      });

      // Update both local state and parent component
      setCurrentAccount(updatedAccount);

      if (onToggleWarmup) {
        onToggleWarmup(updatedAccount, e, resume);
      }

      // Force re-render of WarmupTab by updating activeTab state - trick to refresh
      setActiveTab(prev => {
        return prev; // No need to switch tabs if we update state correctly
      });

      toast({
        title: 'Success',
        description: `Warmup ${nextStatus === 'enabled' ? 'enabled' : 'paused'} successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update warmup status',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    try {
      if (onDeleteAccount) {
        await onDeleteAccount(account);
        toast({
          title: 'Success',
          description: 'Email account deleted successfully',
        });
        onClose();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete email account',
        variant: 'destructive',
      });
    }
  };

  const tabs = [
    { id: 'warmup', label: 'Warmup', icon: Activity },
    { id: 'settings', label: 'Settings', icon: User },
    { id: 'campaigns', label: 'Campaigns', icon: Send },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'warmup':
        return <WarmupTab account={currentAccount} onToggleWarmup={handleToggleWarmup} />;
      case 'settings':
        return <SettingsTab account={currentAccount} onUpdate={setCurrentAccount} />;
      case 'campaigns':
        return <CampaignsTab account={currentAccount} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed xl:hidden inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="fixed xl:relative inset-y-0 right-0 w-full sm:w-[500px] xl:w-full h-full bg-[#0A0A0A] border-l border-white/5 shadow-2xl xl:shadow-none transform xl:transform-none transition-transform duration-300 ease-in-out z-50 xl:z-auto flex flex-col">
        <div className="p-8 pb-0 flex-shrink-0">
          <div className="flex justify-between items-start mb-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-black text-white tracking-tight">{currentAccount.email}</h2>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em]">{currentAccount.name || 'No name set'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsDeleteDialogOpen(true)}
                className="p-2.5 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
                title="Delete account"
              >
                <Trash2 size={16} />
              </button>
              <ConfirmationDialog
                isOpen={isDeleteDialogOpen}
                onClose={() => setIsDeleteDialogOpen(false)}
                onConfirm={handleDelete}
                title="Delete Email Account"
                description="Are you sure you want to delete this email account? This action cannot be undone."
              />
              <button
                onClick={onClose}
                className="p-2.5 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 p-1.5 bg-white/[0.03] border border-white/5 rounded-2xl w-full mb-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                  activeTab === tab.id
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
              >
                <tab.icon size={14} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-0">
          {renderTabContent()}
        </div>
      </div>
    </>
  );
};

export default EmailAccountSidebar;

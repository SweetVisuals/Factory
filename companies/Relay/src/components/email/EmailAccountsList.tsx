import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/use-toast';
import { EmailAccount } from '../../types';
import EmailAccountSidebar from './EmailAccountSidebar';
import { Flame, MoreVertical, Activity, CheckCircle2, AlertCircle, PlayCircle, PauseCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';

const EmailAccountsList: React.FC = () => {
  const { emailAccounts, updateEmailAccount, deleteEmailAccount } = useApp();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    if (emailAccounts.length > 0) {
      if (selectedAccount) {
        const updatedAccount = emailAccounts.find(a => a.id === selectedAccount.id);
        if (updatedAccount && JSON.stringify(updatedAccount) !== JSON.stringify(selectedAccount)) {
          setSelectedAccount(updatedAccount);
        }
      } else {
        setSelectedAccount(emailAccounts[0]);
        setShowSidebar(true);
      }
    } else {
      setSelectedAccount(null);
      setShowSidebar(false);
    }
  }, [emailAccounts, selectedAccount]);

  const handleAccountClick = (account: EmailAccount) => {
    setSelectedAccount(account);
    setShowSidebar(true);
  };

  const toggleWarmup = async (account: EmailAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStatus = account.warmup_status || 'disabled';
    const nextStatus = currentStatus === 'disabled' ? 'enabled' : currentStatus === 'enabled' ? 'paused' : 'disabled';

    const updates = {
      warmup_status: nextStatus,
      warmup_enabled: nextStatus !== 'disabled',
      warmup_start_date: nextStatus === 'enabled' ? new Date().toISOString() : nextStatus === 'disabled' ? null : account.warmup_start_date
    };

    try {
      await updateEmailAccount(account.id, updates);
      toast({
        title: nextStatus === 'enabled' ? 'Warmup Enabled' : nextStatus === 'paused' ? 'Warmup Paused' : 'Warmup Disabled',
        description: `Warmup is now ${nextStatus} for ${account.email}`,
      });
    } catch (error) {
      console.error('Error toggling warmup:', error);
      toast({ title: 'Error', description: 'Failed to toggle warmup', variant: 'destructive' });
    }
  };

  const relayAccounts = emailAccounts.filter(acc => acc.email.toLowerCase().includes('relay'));
  const mrmedicAccounts = emailAccounts.filter(acc => !acc.email.toLowerCase().includes('relay'));

  const renderAccountGroup = (title: string, accounts: EmailAccount[]) => (
    <div className="flex flex-col gap-4 mb-10">
      <div className="flex items-center gap-3 px-1">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">{title}</h3>
        <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-black text-white">{accounts.length}</span>
      </div>

      {accounts.length === 0 ? (
        <div className="p-10 rounded-2xl border border-white/5 border-dashed flex flex-col items-center justify-center text-center bg-white/[0.01]">
          <Activity size={24} className="text-white/20 mb-3" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">No accounts configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => handleAccountClick(account)}
              className={cn(
                "group bg-white/[0.02] border rounded-2xl p-5 transition-all duration-200 cursor-pointer hover:bg-white/[0.04] relative overflow-hidden",
                selectedAccount?.id === account.id ? "border-primary/50 bg-primary/[0.05]" : "border-white/5"
              )}
            >
              {selectedAccount?.id === account.id && (
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              )}
              <div className="flex flex-col gap-5">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-white truncate text-sm tracking-tight">{account.email}</span>
                    <div className="flex items-center mt-1.5">
                      <span className={cn(
                        "flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest",
                        account.status === 'active' ? "text-emerald-400" : "text-red-400"
                      )}>
                        {account.status === 'active' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                        {account.status}
                      </span>
                    </div>
                  </div>
                  
                  <Tooltip.Provider>
                    <Tooltip.Root delayDuration={0}>
                      <Tooltip.Trigger asChild>
                        <button
                          onClick={(e) => toggleWarmup(account, e)}
                          className={cn(
                            "p-2 rounded-lg transition-all border",
                            account.warmup_status === 'enabled' ? "text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20" :
                            account.warmup_status === 'paused' ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20" :
                            "text-white/30 bg-white/5 border-white/5 hover:text-white hover:bg-white/10"
                          )}
                        >
                          <Flame size={14} className={account.warmup_status === 'enabled' ? "animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" : ""} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content side="top" className="bg-black text-white font-bold tracking-wider px-3 py-1.5 rounded-md text-[10px] uppercase border border-white/10 shadow-xl" sideOffset={5}>
                        {account.warmup_status === 'enabled' ? 'Pause Warmup' : account.warmup_status === 'paused' ? 'Resume Warmup' : 'Enable Warmup'}
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>

                <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Sent</span>
                    <span className="text-sm font-black text-white">{account.emailsSent || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Warmup</span>
                    <span className="text-sm font-black text-white">{account.warmupEmails || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-1">Health</span>
                    <span className={cn(
                      "text-sm font-black",
                      (account.healthScore || 0) > 90 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" : (account.healthScore || 0) > 70 ? "text-yellow-400" : "text-red-400"
                    )}>{account.healthScore || 'N/A'}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex gap-8 animate-in fade-in duration-200">
      <div className="flex-1 flex flex-col min-w-0">
        {renderAccountGroup("Relay Solutions", relayAccounts)}
        {renderAccountGroup("MrMedic Events", mrmedicAccounts)}
      </div>

      {showSidebar && selectedAccount && (
        <div className="w-[500px] shrink-0 animate-in slide-in-from-right-8 duration-200">
          <EmailAccountSidebar
            account={selectedAccount}
            onClose={() => setShowSidebar(false)}
            onToggleWarmup={toggleWarmup}
            onDeleteAccount={async (account) => {
              try {
                await deleteEmailAccount(account.id);
                toast({ title: 'Success', description: 'Email account deleted successfully' });
              } catch (error) {
                toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete email account', variant: 'destructive' });
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default EmailAccountsList;

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
    <div className="flex flex-col gap-3 mb-8">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">{accounts.length}</span>
      </div>

      {accounts.length === 0 ? (
        <div className="p-8 rounded-xl border border-border border-dashed flex flex-col items-center justify-center text-center">
          <Activity size={24} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No accounts configured.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => handleAccountClick(account)}
              className={cn(
                "group bg-card border border-border rounded-xl p-4 transition-all duration-200 cursor-pointer hover:border-border/80 hover:bg-muted/20",
                selectedAccount?.id === account.id ? "ring-1 ring-primary border-primary" : ""
              )}
            >
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-foreground truncate text-sm">{account.email}</span>
                    <div className="flex items-center mt-1">
                      <span className={cn(
                        "flex items-center gap-1 text-[10px] font-medium",
                        account.status === 'active' ? "text-emerald-500" : "text-red-500"
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
                            "p-1.5 rounded-md transition-colors",
                            account.warmup_status === 'enabled' ? "text-amber-500 hover:bg-amber-500/10" :
                            account.warmup_status === 'paused' ? "text-yellow-600 hover:bg-yellow-600/10" :
                            "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <Flame size={16} className={account.warmup_status === 'enabled' ? "animate-pulse" : ""} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content side="top" className="bg-popover text-popover-foreground px-2 py-1 rounded text-xs border border-border shadow-md" sideOffset={5}>
                        {account.warmup_status === 'enabled' ? 'Pause Warmup' : account.warmup_status === 'paused' ? 'Resume Warmup' : 'Enable Warmup'}
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Sent</span>
                    <span className="text-sm font-medium text-foreground">{account.emailsSent || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Warmup</span>
                    <span className="text-sm font-medium text-foreground">{account.warmupEmails || 0}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground mb-0.5">Health</span>
                    <span className={cn(
                      "text-sm font-medium",
                      (account.healthScore || 0) > 90 ? "text-emerald-500" : (account.healthScore || 0) > 70 ? "text-yellow-600" : "text-red-500"
                    )}>{account.healthScore || 'N/A'}</span>
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
    <div className="relative flex gap-8">
      <div className="flex-1 flex flex-col min-w-0">
        {renderAccountGroup("Relay Solutions", relayAccounts)}
        {renderAccountGroup("MrMedic Events", mrmedicAccounts)}
      </div>

      {showSidebar && selectedAccount && (
        <div className="w-[450px] shrink-0 animate-in slide-in-from-right duration-300">
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

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

  const renderAccountGroup = (title: string, accounts: EmailAccount[], colorClass: string, bgTint: string) => (
    <div className="flex flex-col gap-4 mb-10">
      <div className="flex items-center gap-3 px-2">
        <div className={cn("w-3 h-3 rounded-full shadow-sm", colorClass)} />
        <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
        <span className="px-2.5 py-0.5 rounded-full bg-muted text-xs font-bold text-muted-foreground">{accounts.length}</span>
      </div>

      {accounts.length === 0 ? (
        <div className="p-10 rounded-2xl bg-card border border-border flex flex-col items-center justify-center text-center shadow-sm">
          <Activity size={32} className="text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No accounts configured for this business.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {accounts.map(account => (
            <div
              key={account.id}
              onClick={() => handleAccountClick(account)}
              className={cn(
                "group relative bg-card border border-border rounded-2xl p-6 transition-all duration-300 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-1 overflow-hidden",
                selectedAccount?.id === account.id ? "ring-2 ring-primary border-primary/50" : ""
              )}
            >
              {/* Subtle tint overlay */}
              <div className={cn("absolute inset-0 opacity-[0.03] transition-opacity group-hover:opacity-[0.05]", bgTint)} />

              <div className="relative z-10 flex flex-col gap-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-bold text-foreground truncate text-base">{account.email}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest",
                        account.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
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
                            "p-2.5 rounded-xl transition-all shadow-sm border",
                            account.warmup_status === 'enabled' ? "bg-amber-500/20 text-amber-500 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]" :
                            account.warmup_status === 'paused' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" :
                            "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                          )}
                        >
                          <Flame size={18} className={account.warmup_status === 'enabled' ? "animate-pulse" : ""} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content side="top" className="bg-popover text-popover-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border border-border" sideOffset={5}>
                        {account.warmup_status === 'enabled' ? 'Pause Warmup' : account.warmup_status === 'paused' ? 'Resume Warmup' : 'Enable Warmup'}
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </Tooltip.Provider>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1 bg-background/50 p-3 rounded-xl border border-border/50">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Sent</span>
                    <span className="text-lg font-light text-foreground">{account.emailsSent || 0}</span>
                  </div>
                  <div className="flex flex-col gap-1 bg-background/50 p-3 rounded-xl border border-border/50">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Warmup</span>
                    <span className="text-lg font-light text-foreground">{account.warmupEmails || 0}</span>
                  </div>
                  <div className="flex flex-col gap-1 bg-background/50 p-3 rounded-xl border border-border/50">
                    <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Health</span>
                    <span className={cn(
                      "text-lg font-bold",
                      (account.healthScore || 0) > 90 ? "text-emerald-500" : (account.healthScore || 0) > 70 ? "text-yellow-500" : "text-red-500"
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
        {renderAccountGroup("Relay Solutions", relayAccounts, "bg-emerald-500", "bg-emerald-500")}
        {renderAccountGroup("MrMedic Events", mrmedicAccounts, "bg-blue-500", "bg-blue-500")}
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

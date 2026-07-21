import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/use-toast';
import { EmailAccount } from '../../types';
import EmailAccountSidebar from './EmailAccountSidebar';
import { Flame, Activity, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Mail } from 'lucide-react';
import { cn } from '../../lib/utils';
import * as Tooltip from '@radix-ui/react-tooltip';
import { CustomCheckbox } from '../ui/CustomCheckbox';

const EmailAccountsList: React.FC = () => {
  const { emailAccounts, updateEmailAccount, deleteEmailAccount } = useApp();
  const { toast } = useToast();
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [expandedDomains, setExpandedDomains] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Keep selected account updated if it changes
    if (selectedAccount && emailAccounts.length > 0) {
      const updatedAccount = emailAccounts.find(a => a.id === selectedAccount.id);
      if (updatedAccount && JSON.stringify(updatedAccount) !== JSON.stringify(selectedAccount)) {
        setSelectedAccount(updatedAccount);
      }
    } else if (emailAccounts.length === 0) {
      setSelectedAccount(null);
      setShowSidebar(false);
    }
    // We intentionally removed the auto-select logic here to fix the auto-expanding sidebar!
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

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, EmailAccount[]> = {};
    emailAccounts.forEach(acc => {
      const domain = acc.email.split('@')[1] || 'Unknown Domain';
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(acc);
    });
    return groups;
  }, [emailAccounts]);

  // Expand all by default initially
  useEffect(() => {
    if (Object.keys(expandedDomains).length === 0 && Object.keys(groupedAccounts).length > 0) {
      const initial: Record<string, boolean> = {};
      Object.keys(groupedAccounts).forEach(d => initial[d] = true);
      setExpandedDomains(initial);
    }
  }, [groupedAccounts]);

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => ({ ...prev, [domain]: !prev[domain] }));
  };

  return (
    <div className="relative flex gap-8 animate-in fade-in duration-200 h-full">
      <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex-1 overflow-auto relative custom-scrollbar w-full">
          {emailAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
              <Activity className="w-8 h-8 text-white/10 mb-3" />
              <div className="text-sm font-bold text-white/40">No accounts configured</div>
              <p className="mt-2 text-xs text-white/20">Add your first email account to get started.</p>
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-left text-[13px] border-collapse">
              <thead className="bg-[#111] sticky top-0 z-10 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none w-1/3">Account</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none">Status</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none text-center">Sent</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none text-center">Warmup</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none text-center">Health</th>
                  <th className="pr-6 pl-4 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest select-none text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedAccounts).map(([domain, accounts]) => (
                  <React.Fragment key={domain}>
                    {/* Domain Header Row */}
                    <tr 
                      className="bg-[#111111]/50 border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => toggleDomain(domain)}
                    >
                      <td colSpan={6} className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          {expandedDomains[domain] ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
                          <span className="text-xs font-black text-white tracking-wide">{domain}</span>
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-bold text-white/50">{accounts.length}</span>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Accounts Rows */}
                    {expandedDomains[domain] && accounts.map((account, index) => {
                      const isSelected = selectedAccount?.id === account.id;
                      const isLast = index === accounts.length - 1;
                      
                      return (
                        <tr
                          key={account.id}
                          onClick={() => handleAccountClick(account)}
                          className={cn(
                            "group cursor-pointer transition-colors",
                            isSelected ? 'bg-primary/[0.06] border-l-2 border-l-primary' : 'hover:bg-white/[0.02] border-l-2 border-l-transparent',
                            !isLast && 'border-b border-white/[0.03]'
                          )}
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                                account.status === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400"
                              )}>
                                <Mail size={14} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-white truncate text-sm">{account.email}</div>
                                <div className="text-[10px] text-white/30 truncate mt-0.5">Added {new Date(account.created_at).toLocaleDateString()}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <Tooltip.Provider>
                              <Tooltip.Root delayDuration={0}>
                                <Tooltip.Trigger asChild>
                                  <span className={cn(
                                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-widest border cursor-help",
                                    account.status === 'active' ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"
                                  )}>
                                    {account.status === 'active' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                                    {account.status}
                                  </span>
                                </Tooltip.Trigger>
                                {account.status !== 'active' && account.error_message && (
                                  <Tooltip.Content side="top" className="bg-black text-white font-bold tracking-wider px-3 py-1.5 rounded-md text-[10px] uppercase border border-white/10 shadow-xl z-50 max-w-xs text-center" sideOffset={5}>
                                    {account.error_message}
                                  </Tooltip.Content>
                                )}
                              </Tooltip.Root>
                            </Tooltip.Provider>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-sm font-black text-white">{account.emailsSent || 0}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className="text-sm font-black text-white">{account.warmupEmails || 0}</span>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={cn(
                              "text-sm font-black",
                              (account.healthScore ? parseInt(account.healthScore) : 100) > 90 ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]" : (account.healthScore ? parseInt(account.healthScore) : 100) > 70 ? "text-yellow-400" : "text-red-400"
                            )}>{account.healthScore || '100'}%</span>
                          </td>
                          <td className="pr-6 pl-4 py-3.5 text-right">
                            <div className="flex justify-end">
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
                                  <Tooltip.Content side="top" className="bg-black text-white font-bold tracking-wider px-3 py-1.5 rounded-md text-[10px] uppercase border border-white/10 shadow-xl z-50" sideOffset={5}>
                                    {account.warmup_status === 'enabled' ? 'Pause Warmup' : account.warmup_status === 'paused' ? 'Resume Warmup' : 'Enable Warmup'}
                                  </Tooltip.Content>
                                </Tooltip.Root>
                              </Tooltip.Provider>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showSidebar && selectedAccount && (
        <div className="w-full xl:w-[450px] xl:shrink-0 animate-in slide-in-from-right-8 duration-200">
          <EmailAccountSidebar
            account={selectedAccount}
            onClose={() => setShowSidebar(false)}
            onToggleWarmup={toggleWarmup}
            onDeleteAccount={async (account) => {
              try {
                await deleteEmailAccount(account.id);
                toast({ title: 'Success', description: 'Email account deleted successfully' });
                setShowSidebar(false);
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

import React, { useState } from 'react';
import { Plus, Search, Trash2, Zap, Send, AtSign } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/ui/use-toast';
import EmailAccountsList from '../components/email/EmailAccountsList';
import AddEmailModal from '../components/modals/AddEmailModal';
import TestDesignModal from '../components/modals/TestDesignModal';
import Layout from '../components/layout/Layout';
import { forceWarmupEmail } from '../lib/api/email-accounts';

const EmailAccounts = () => {
  const [showAddEmailModal, setShowAddEmailModal] = useState(false);
  const [showTestDesignModal, setShowTestDesignModal] = useState(false);
  const { emailAccounts, deleteEmailAccount, refreshEmailAccounts } = useApp();
  const { toast } = useToast();
  const [isForcingWarmup, setIsForcingWarmup] = useState(false);

  const handleForceWarmup = async () => {
    const activeWarmups = emailAccounts.filter(acc => acc.warmup_status === 'enabled' || acc.warmup_enabled);
    if (activeWarmups.length === 0) {
      toast({ title: "No active warmups", description: "Enable warmup for at least one account to force it.", variant: "destructive" });
      return;
    }

    setIsForcingWarmup(true);
    let successCount = 0;
    
    for (const acc of activeWarmups) {
      try {
        await forceWarmupEmail(acc);
        successCount++;
      } catch (err) {
        console.error(`Failed force warmup for ${acc.email}:`, err);
      }
    }

    if (successCount > 0) {
      toast({ title: "Force Warmup Complete", description: `Successfully triggered warmup email for ${successCount}/${activeWarmups.length} accounts.` });
      await refreshEmailAccounts();
    } else {
      toast({ title: "Force Warmup Failed", description: "Failed to send force warmup emails.", variant: "destructive" });
    }
    setIsForcingWarmup(false);
  };

  const handleCleanup = async () => {
    const invalidEmails = ['manirae2@coldspark.org', 'nicolas@coldspark.org'];
    const toDelete = emailAccounts.filter(acc => invalidEmails.includes(acc.email));

    if (toDelete.length === 0) {
      toast({ title: "No invalid emails found", description: "The specified emails were not found in your accounts list." });
      return;
    }

    let deletedCount = 0;
    for (const acc of toDelete) {
      try {
        await deleteEmailAccount(acc.id);
        deletedCount++;
      } catch (err) {
        console.error(err);
      }
    }

    if (deletedCount > 0) {
      toast({ title: "Cleanup Successful", description: `Removed ${deletedCount} invalid email accounts.` });
    } else {
      toast({ title: "Cleanup Failed", description: "Could not delete accounts due to an error.", variant: "destructive" });
    }
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-200">
        
        {/* Dynamic Header Section */}
        <div className="p-8 pb-4 shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 max-w-[1600px] mx-auto w-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
                <h1 className="text-4xl font-black text-white tracking-tighter">Email Accounts</h1>
              </div>
              <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] ml-5">
                Manage your connected sender domains
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  type="text"
                  placeholder="Search domains..."
                  className="pl-9 pr-4 py-2 w-48 text-xs font-medium rounded-lg bg-black/40 border border-white/5 focus:outline-none focus:ring-1 focus:ring-primary text-white"
                />
              </div>
              <button
                onClick={handleCleanup}
                className="p-2 rounded-lg text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                title="Cleanup Invalid"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setShowTestDesignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 hover:bg-white/5 hover:border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm"
              >
                <Send size={14} className="text-white/50" />
                Test Engine
              </button>
              <button
                onClick={handleForceWarmup}
                disabled={isForcingWarmup}
                className="flex items-center gap-2 px-4 py-2 bg-black/40 border border-white/5 hover:bg-white/5 hover:border-white/10 rounded-lg text-xs font-bold uppercase tracking-wider text-white transition-all shadow-sm disabled:opacity-50"
              >
                <Zap size={14} className="text-white/50" />
                {isForcingWarmup ? 'Forcing...' : 'Force Warmup'}
              </button>
              <button
                onClick={() => setShowAddEmailModal(true)}
                className="flex items-center gap-2 bg-white text-black px-6 py-2 hover:bg-gray-200 transition-all rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] font-black uppercase tracking-widest text-[10px]"
              >
                <Plus size={14} />
                Add Account
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 p-8 max-w-[1600px] mx-auto w-full">
          <EmailAccountsList />
        </div>
      </div>

      {showAddEmailModal && (
        <AddEmailModal onClose={() => setShowAddEmailModal(false)} />
      )}
      {showTestDesignModal && (
        <TestDesignModal onClose={() => setShowTestDesignModal(false)} emailAccounts={emailAccounts} />
      )}
    </Layout>
  );
};

export default EmailAccounts;

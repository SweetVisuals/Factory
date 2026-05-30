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
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-500">
        
        {/* Thick Padded Header */}
        <div className="px-10 py-10 bg-background border-b border-border/50 shrink-0">
          <div className="flex flex-col gap-8 max-w-[1400px] mx-auto">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              
              <div className="flex items-center gap-4">
                <div className="p-3 bg-card border border-border rounded-xl shadow-sm">
                  <AtSign size={24} className="text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">Email Accounts</h1>
                  <p className="text-sm font-medium text-muted-foreground">Manage your connected sender domains and warmup health.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    type="text"
                    placeholder="Search domains..."
                    className="pl-10 pr-4 py-2.5 w-64 text-sm font-medium rounded-xl bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  />
                </div>
                <div className="h-8 w-px bg-border" />
                <button
                  onClick={handleCleanup}
                  className="p-2.5 rounded-xl border border-transparent hover:bg-destructive/10 text-destructive transition-colors"
                  title="Cleanup Invalid"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setShowTestDesignModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors shadow-sm"
                >
                  <Send size={16} className="text-purple-500" />
                  Test Engine
                </button>
                <button
                  onClick={handleForceWarmup}
                  disabled={isForcingWarmup}
                  className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50"
                >
                  <Zap size={16} className="text-amber-500" />
                  {isForcingWarmup ? 'Forcing...' : 'Force Warmup'}
                </button>
                <button
                  onClick={() => setShowAddEmailModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all"
                >
                  <Plus size={18} />
                  Add Account
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 p-10 max-w-[1400px] mx-auto w-full">
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

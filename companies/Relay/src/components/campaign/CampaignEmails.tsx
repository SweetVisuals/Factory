import { useState, useEffect } from 'react';
import { Mail, Plus, Trash, Shield, Activity, Zap, CheckCircle2, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from '../ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { fetchEmailAccounts, addEmailAccountsToCampaign, removeEmailAccountFromCampaign } from '../../lib/api/email-accounts';

interface Props {
  campaignId: string;
}

const CampaignEmails = ({ campaignId }: Props) => {
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    loadEmailAccounts();
  }, []);

  const loadEmailAccounts = async () => {
    try {
      setIsLoading(true);
      const [campaignAccounts, availableAccountsData] = await Promise.all([
        fetchEmailAccounts(campaignId),
        fetchEmailAccounts()
      ]);
      setEmailAccounts(campaignAccounts);
      setAvailableAccounts(availableAccountsData);
    } catch (error) {
      console.error('Error loading email accounts:', error);
      toast({ title: "Signal Error", description: "Failed to establish relay connection.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setSelectedAccounts([]);
    setIsDialogOpen(true);
  };

  const handleAccountSelection = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]
    );
  };

  const handleAddEmailAccounts = async () => {
    try {
      if (selectedAccounts.length === 0) {
        toast({ title: "Selection Missing", description: "At least one relay account must be assigned." });
        return;
      }
      await addEmailAccountsToCampaign(campaignId, selectedAccounts);
      toast({ title: "Relays Assigned", description: `${selectedAccounts.length} accounts linked to transmission cluster.` });
      setIsDialogOpen(false);
      loadEmailAccounts();
    } catch (error) {
      toast({ title: "Assignment Failed", description: "Failed to link relay accounts.", variant: "destructive" });
    }
  };

  const handleRemoveEmailAccount = async (emailAccountId: string) => {
    try {
      await removeEmailAccountFromCampaign(campaignId, emailAccountId);
      toast({ title: "Relay Purged", description: "Account removed from cluster registry." });
      loadEmailAccounts();
    } catch (error) {
      toast({ title: "Purge Failed", description: "Failed to remove relay account.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-8 bg-foreground/[0.02] rounded-none w-full"></div>
        <div className="h-8 bg-foreground/[0.02] rounded-none w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compact Mini-Header */}
      <div className="flex justify-between items-center bg-foreground/[0.02] p-3 rounded-none">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.15em]">
            Sender Registry
          </span>
          <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black uppercase tracking-wider rounded-none">
            {emailAccounts.length} Connected
          </span>
        </div>
        <Button
          onClick={handleOpenDialog}
          variant="ghost"
          className="h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-none text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 border-none"
        >
          <Plus size={10} />
          Link Accounts
        </Button>
      </div>

      {/* Select Accounts Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] bg-[#09090e] border-none shadow-2xl rounded-none p-8 animate-in zoom-in-95 duration-200 text-foreground">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight">Select Accounts</DialogTitle>
            <p className="text-[9px] text-foreground/30 font-black uppercase tracking-widest mt-1">
              Choose outbound accounts for sequence transmission.
            </p>
          </DialogHeader>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            {availableAccounts.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Info className="mx-auto h-8 w-8 text-foreground/10" />
                <p className="text-[9px] font-black text-foreground/20 uppercase tracking-widest">No email accounts found.</p>
              </div>
            ) : (
              availableAccounts.map(account => {
                const isSelected = selectedAccounts.includes(account.id);
                return (
                  <div 
                    key={account.id} 
                    className={`flex items-center space-x-4 p-4 rounded-none transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-primary text-primary-foreground scale-[1.01]'
                        : 'bg-foreground/[0.02] text-foreground/50 hover:bg-foreground/[0.04]'
                    }`}
                    onClick={() => handleAccountSelection(account.id)}
                  >
                    <Checkbox
                      id={`dialog-${account.id}`}
                      checked={isSelected}
                      className="border-foreground/10 data-[state=checked]:bg-foreground data-[state=checked]:text-background w-5 h-5 rounded-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold truncate ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {account.email}
                      </div>
                      <div className={`text-[8px] font-black uppercase tracking-widest mt-0.5 opacity-40`}>
                        {account.provider || 'SMTP'} REGISTERED
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="pt-6">
            <Button
              onClick={handleAddEmailAccounts}
              disabled={selectedAccounts.length === 0}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/95 rounded-none font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/10 transition-all border-none"
            >
              Link Selected Accounts
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connected Accounts List */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {emailAccounts.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center bg-foreground/[0.01] rounded-none space-y-4">
            <div className="p-4 bg-foreground/[0.02] rounded-none text-foreground/20">
              <Mail size={24} className="animate-pulse" />
            </div>
            <div className="text-center">
              <h4 className="text-xs font-black text-foreground/40 uppercase tracking-wider">No Senders Connected</h4>
              <p className="text-[8px] text-foreground/20 font-black uppercase tracking-widest mt-1 max-w-[200px] leading-relaxed">
                Connect outbound accounts to enable sequence scheduling.
              </p>
            </div>
          </div>
        ) : (
          emailAccounts.map((account) => (
            <div key={account.id} className="p-3 bg-foreground/[0.02] hover:bg-foreground/[0.04] rounded-none transition-all group flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-primary/10 rounded-none text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <Zap size={14} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate max-w-[240px] group-hover:text-primary transition-colors">{account.email}</h4>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest mt-0.5 text-foreground/40">
                    <span className="bg-foreground/[0.05] px-1.5 py-0.5 rounded-none">{account.provider || 'SMTP'}</span>
                    <span className="flex items-center gap-1 text-primary">
                      <Activity size={10} className="animate-pulse" />
                      Active
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveEmailAccount(account.id)}
                className="p-2 text-foreground/20 hover:text-red-500 hover:bg-red-500/10 rounded-none transition-all opacity-0 group-hover:opacity-100"
                title="Disconnect Account"
              >
                <Trash size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CampaignEmails;

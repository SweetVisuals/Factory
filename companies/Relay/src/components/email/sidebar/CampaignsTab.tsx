import { useState, useEffect } from 'react';
import { Plus, Trash2, Send, Check, Activity, Layers, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { EmailAccount, Campaign } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { addEmailAccountsToCampaign, removeEmailAccountFromCampaign } from '../../../lib/api/email-accounts';
import { useToast } from '../../ui/use-toast';
import { cn } from '../../../lib/utils';
import { CustomSelect } from '../../ui/CustomSelect';

interface CampaignsTabProps {
  account: EmailAccount;
}

const CampaignsTab = ({ account }: CampaignsTabProps) => {
  const { campaigns } = useApp();
  const { toast } = useToast();
  
  const [assignedCampaigns, setAssignedCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddCampaign, setShowAddCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');

  const loadAssignedCampaigns = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('campaign_email_accounts')
        .select(`
          campaign_id,
          campaigns:campaigns!fk_campaign_email_accounts_campaigns (*)
        `)
        .eq('email_account_id', account.id);

      if (error) throw error;

      if (data) {
        const fetchedCampaigns: Campaign[] = data
          .map((item: any) => item.campaigns)
          .filter(Boolean);
        setAssignedCampaigns(fetchedCampaigns);
      }
    } catch (err) {
      console.error('Failed to load assigned campaigns:', err);
      // Fallback to client-side filtering if RPC/foreign key fails
      const fallback = campaigns.filter(c => (c as any).emailId === account.id || (c as any).primary_email === account.email);
      setAssignedCampaigns(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const handleAssignToCampaign = async () => {
    if (!selectedCampaignId) {
      toast({ title: 'Select Campaign', description: 'Please select a campaign to assign.', variant: 'destructive' });
      return;
    }

    try {
      setIsSubmitting(true);
      await addEmailAccountsToCampaign(selectedCampaignId, [account.id]);
      toast({ title: 'Assigned Successfully', description: `Linked ${account.email} to campaign.` });
      setSelectedCampaignId('');
      setShowAddCampaign(false);
      await loadAssignedCampaigns();
    } catch (err: any) {
      toast({ title: 'Assignment Failed', description: err.message || 'Failed to link campaign.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveFromCampaign = async (campaignId: string) => {
    try {
      setIsSubmitting(true);
      await removeEmailAccountFromCampaign(campaignId, account.id);
      toast({ title: 'Removed', description: 'Unlinked email from campaign.' });
      await loadAssignedCampaigns();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove campaign.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const assignedIds = new Set(assignedCampaigns.map(c => c.id));
  const unassignedCampaigns = campaigns.filter(c => !assignedIds.has(c.id));
  const selectOptions = unassignedCampaigns.map(c => ({
    value: c.id,
    label: c.name + (c.niche ? ` (${c.niche})` : '')
  }));

  return (
    <div className="space-y-5 p-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Layers className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Campaign Assignments</h3>
        </div>
        <button
          type="button"
          onClick={() => setShowAddCampaign(!showAddCampaign)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 rounded-xl text-xs font-bold text-primary uppercase tracking-wider transition-all"
        >
          {showAddCampaign ? 'Cancel' : <><Plus size={14} /> Assign</>}
        </button>
      </div>

      {/* Add Campaign Form */}
      {showAddCampaign && (
        <div className="bg-white/[0.02] border border-white/10 p-4 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/60">Select Outbound Campaign</label>
            {selectOptions.length > 0 ? (
              <CustomSelect
                value={selectedCampaignId}
                onChange={setSelectedCampaignId}
                options={selectOptions}
                placeholder="Choose a campaign..."
                className="h-10 text-xs bg-black/40 border border-white/10 rounded-xl text-white"
              />
            ) : (
              <div className="p-3 border border-white/10 rounded-xl bg-black/30 text-center">
                <p className="text-xs text-white/40">No available unassigned campaigns found.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddCampaign(false)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-medium text-white/70 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignToCampaign}
              disabled={isSubmitting || !selectedCampaignId}
              className="px-4 py-1.5 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {isSubmitting ? 'Linking...' : 'Add to Campaign'}
            </button>
          </div>
        </div>
      )}

      {/* Assigned Campaigns List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-6 border border-white/5 rounded-2xl text-center bg-white/[0.01] animate-pulse">
            <Loader2 size={20} className="mx-auto text-primary animate-spin mb-2" />
            <p className="text-xs text-white/40">Loading campaign assignments...</p>
          </div>
        ) : assignedCampaigns.length === 0 ? (
          <div className="p-6 border border-dashed border-white/10 rounded-2xl text-center bg-white/[0.01]">
            <Send size={24} className="mx-auto text-white/20 mb-2" />
            <p className="text-xs font-medium text-white/50">This email account is not assigned to any campaigns yet.</p>
            <p className="text-[10px] text-white/30 mt-1">Assign it to a campaign to begin automated sequence sends.</p>
          </div>
        ) : (
          assignedCampaigns.map((campaign) => (
            <div 
              key={campaign.id} 
              className="p-4 bg-white/[0.02] border border-white/5 hover:border-white/15 rounded-2xl transition-all"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-xs text-white truncate uppercase">{campaign.name}</h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      campaign.status === 'Active' || campaign.status === 'in_progress'
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-white/5 text-white/40 border-white/10"
                    )}>
                      {campaign.status || 'Active'}
                    </span>
                  </div>
                  {campaign.niche && (
                    <p className="text-[10px] text-primary/80 font-medium">{campaign.niche}</p>
                  )}
                  <p className="text-[10px] text-white/40">
                    {campaign.prospects || '0'} leads • {campaign.replyRate || '0%'} reply rate
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFromCampaign(campaign.id)}
                  disabled={isSubmitting}
                  className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                  title="Remove from Campaign"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CampaignsTab;

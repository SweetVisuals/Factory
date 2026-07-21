import React, { useState } from 'react';
import { X, Loader2, Target, Sparkles, Network } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../components/ui/use-toast';
import { Campaign } from '../../types';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const CreateCampaignModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const { addCampaign } = useApp();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    niche: '',
    objective: '',
    maxEmailsPerDay: '100',
    frequency: 'daily' as 'daily' | 'weekly',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newCampaign: Omit<Campaign, 'id'> = {
        name: formData.name,
        status: 'Draft',
        prospects: '0',
        replies: '0',
        replyRate: '0%',
        niche: formData.niche,
        objective: formData.objective,
        schedule: {
          frequency: formData.frequency,
          maxEmailsPerDay: parseInt(formData.maxEmailsPerDay),
        },
      };

      await addCampaign(newCampaign);
      
      toast({
        title: 'Campaign Created',
        description: `Successfully created campaign "${formData.name}".`,
      });
      
      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create campaign',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const inputClassName = "mt-1.5 block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all";
  const labelClassName = "block text-[10px] font-bold text-white/40 uppercase tracking-widest";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[200] p-0 sm:p-4 animate-in fade-in duration-200">
      {/* Modal Container */}
      <div className="bg-[#0A0A0A] border-0 sm:border border-white/5 w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-[650px] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 shrink-0 bg-[#111]">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(139,92,246,0.6)]" />
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Create Campaign</h2>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.15em] mt-0.5">Configure your outreach sequence</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            type="button"
            className="p-2 hover:bg-white/5 text-white/40 hover:text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* Campaign Name & Niche */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className={labelClassName}>Campaign Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputClassName}
                  placeholder="e.g. Q1 SaaS Outreach"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Niche / Target Market</label>
                <input
                  type="text"
                  required
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  className={inputClassName}
                  placeholder="e.g. Founders, Marketing Leads"
                />
              </div>
            </div>

            {/* Boss Objective */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className={labelClassName}>Boss Objective</label>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={10} /> AI Agent Directive
                </span>
              </div>
              <textarea
                required
                value={formData.objective}
                onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                rows={4}
                className="mt-1.5 block w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all resize-none min-h-[120px]"
                placeholder="Describe your exact outreach goal. E.g. Find 500 SaaS companies that received seed funding in the last 6 months, find their marketing heads, and pitch our design services."
              />
              <p className="text-[9px] font-medium text-white/30 tracking-wide mt-1">
                Your autonomous agents will use this directive to automatically find, verify, and message prospects.
              </p>
            </div>

            {/* Limits & Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-white/5 pt-6">
              <div className="space-y-1">
                <label className={labelClassName}>Daily Send Limit</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="1000"
                  value={formData.maxEmailsPerDay}
                  onChange={(e) => setFormData({ ...formData, maxEmailsPerDay: e.target.value })}
                  className={inputClassName}
                  placeholder="100"
                />
                <span className="text-[9px] text-white/30 block mt-1">Max recommended limit: 1,000/day</span>
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Sending Frequency</label>
                <div className="relative mt-1.5">
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value as 'daily' | 'weekly' })}
                    className="block w-full rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all appearance-none"
                  >
                    <option value="daily">Daily Sequence</option>
                    <option value="weekly">Weekly Sequence</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white/40">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                      <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Actions Footer */}
          <div className="p-6 border-t border-white/5 flex flex-col-reverse sm:flex-row justify-end gap-3 bg-[#111] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 text-xs font-bold uppercase tracking-wider transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 bg-white text-black hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Campaign'
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default CreateCampaignModal;

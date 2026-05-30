import React, { useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { EmailAccount } from '../../types';
import { toast } from '../../components/ui/use-toast';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api/api';

interface Props {
  onClose: () => void;
  emailAccounts: EmailAccount[];
}

const TestDesignModal: React.FC<Props> = ({ onClose, emailAccounts }) => {
  const [formData, setFormData] = useState({
    accountId: emailAccounts.length > 0 ? emailAccounts[0].id : '',
    templateName: 'web',
    toEmail: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId || !formData.toEmail) {
      toast({
        title: 'Error',
        description: 'Please select an account and enter a destination email.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await api.post(`/email-accounts/${formData.accountId}/test-design`, {
        templateName: formData.templateName,
        toEmail: formData.toEmail,
      });

      if (!response.data?.success) {
        throw new Error('Failed to send test design');
      }

      toast({
        title: 'Success',
        description: 'Test email design sent successfully!',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-none p-6 w-[500px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold font-mono text-primary">Test Marketing Design</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Send From Account</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              className="w-full bg-background border border-input px-3 py-2 text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {emailAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.email} {acc.name ? `(${acc.name})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Design Template</label>
            <select
              value={formData.templateName}
              onChange={(e) => setFormData({ ...formData, templateName: e.target.value })}
              className="w-full bg-background border border-input px-3 py-2 text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="web">Website Development & Renovation</option>
              <option value="ai">AI Systems & Automation</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Destination Email</label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={formData.toEmail}
              onChange={(e) => setFormData({ ...formData, toEmail: e.target.value })}
              className="w-full bg-background border border-input px-3 py-2 text-sm rounded-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-none hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send size={16} />
              )}
              <span>{isLoading ? 'Sending...' : 'Send Test Design'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TestDesignModal;

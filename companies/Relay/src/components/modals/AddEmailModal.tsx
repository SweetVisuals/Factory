import React, { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { verifyImap, verifySmtp } from '../../lib/api/email-verification';
import { supabase } from '../../lib/supabase';
import { EmailAccount } from '../../types';
import { useToast } from '../../components/ui/use-toast';

interface Props {
  onClose: () => void;
}

const AddEmailModal: React.FC<Props> = ({ onClose }) => {
  const { addEmailAccount } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    company: '',
    phone_number: '',
    imap_host: '',
    imap_port: '993',
    smtp_host: '',
    smtp_port: '587',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [bypassVerification, setBypassVerification] = useState(false);

  const verifyEmailConnection = async () => {
    try {
      setConnectionStatus('verifying');

      // Verify IMAP connection
      const imapResult = await verifyImap({
        host: formData.imap_host,
        port: Number(formData.imap_port),
        username: formData.email,
        password: formData.password
      });

      if (!imapResult.success) throw new Error(imapResult.message || 'IMAP connection failed');

      // Verify SMTP connection
      const smtpResult = await verifySmtp({
        host: formData.smtp_host,
        port: Number(formData.smtp_port),
        username: formData.email,
        password: formData.password
      });

      if (!smtpResult.success) throw new Error(smtpResult.message || 'SMTP connection failed');

      setConnectionStatus('success');
      return true;
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to verify email connection',
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!bypassVerification) {
        const isVerified = await verifyEmailConnection();
        if (!isVerified) {
          setIsLoading(false);
          return;
        }
      }

      if (!user) {
        throw new Error('User not authenticated');
      }

      const newAccount: EmailAccount = {
        id: crypto.randomUUID(),
        email: formData.email,
        name: formData.name,
        imap_host: formData.imap_host,
        imap_port: formData.imap_port,
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        user_id: user.id,
        created_at: new Date().toISOString(),
        warmup_enabled: false,
        warmup_filter_tag: null,
        warmup_increase_per_day: 0,
        warmup_daily_limit: 0,
        warmup_status: 'disabled',
        warmup_start_date: null,
        smtp_password: formData.password,
        password: '', // Required by type, but we use encrypted_password
        company: formData.company,
        phone_number: formData.phone_number
      };

      try {
        const { data: encryptedData, error: encryptError } = await supabase
          .rpc('encrypt_password', { password: formData.password });

        if (!encryptError && encryptedData) {
          newAccount.encrypted_password = encryptedData;
        } else {
          console.error('Encryption failed:', encryptError);
          throw new Error('Failed to encrypt password');
        }
      } catch (err) {
        console.error('Encryption error:', err);
        throw new Error('Failed to encrypt password');
      }

      await addEmailAccount(newAccount);
      onClose();
      toast({
        title: 'Success',
        description: 'Email account added successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add email account',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper styling for input fields
  const inputClassName = "mt-1.5 block w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all";
  const labelClassName = "block text-xs font-bold text-muted-foreground uppercase tracking-wider";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-3xl p-8 w-full max-w-[620px] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">Add Email Account</h2>
            <p className="text-sm text-muted-foreground mt-1">Configure your SMTP and IMAP connection parameters.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Display Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputClassName}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className={labelClassName}>Company</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className={inputClassName}
                placeholder="MyCorp"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>Email Address</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClassName}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className={labelClassName}>Phone Number</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className={inputClassName}
                placeholder="+1 555-0123"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>IMAP Host</label>
              <input
                type="text"
                required
                value={formData.imap_host}
                onChange={(e) => setFormData({ ...formData, imap_host: e.target.value })}
                className={inputClassName}
                placeholder="imap.example.com"
              />
            </div>
            <div>
              <label className={labelClassName}>IMAP Port</label>
              <input
                type="number"
                required
                value={formData.imap_port}
                onChange={(e) => setFormData({ ...formData, imap_port: e.target.value })}
                className={inputClassName}
                placeholder="993"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClassName}>SMTP Host</label>
              <input
                type="text"
                required
                value={formData.smtp_host}
                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                className={inputClassName}
                placeholder="smtp.example.com"
              />
            </div>
            <div>
              <label className={labelClassName}>SMTP Port</label>
              <input
                type="number"
                required
                value={formData.smtp_port}
                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                className={inputClassName}
                placeholder="587"
              />
            </div>
          </div>

          <div>
            <label className={labelClassName}>Password / App Password</label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={inputClassName}
              placeholder="••••••••••••"
            />
          </div>

          {/* Connection bypass checkbox */}
          <div className="flex items-center space-x-3 p-3 bg-muted/40 rounded-xl border border-border/50">
            <input
              id="bypass-verif"
              type="checkbox"
              checked={bypassVerification}
              onChange={(e) => setBypassVerification(e.target.checked)}
              className="h-4.5 w-4.5 rounded-md border-border text-primary focus:ring-primary bg-background"
            />
            <label htmlFor="bypass-verif" className="text-xs text-foreground font-medium select-none cursor-pointer">
              Skip connection verification (Proceed even if IMAP/SMTP cannot connect right now)
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center space-x-2">
              {connectionStatus === 'verifying' && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
              {connectionStatus === 'success' && (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
              {connectionStatus === 'error' && (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-xs text-muted-foreground font-medium">
                {connectionStatus === 'verifying' && 'Verifying connection...'}
                {connectionStatus === 'success' && 'Connection verified'}
                {connectionStatus === 'error' && 'Connection failed'}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-secondary text-foreground hover:bg-secondary/80 rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || connectionStatus === 'verifying'}
                className="px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Add Account'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEmailModal;

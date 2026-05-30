import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Lock, Mail, Palette, Trash2, Shield, Fingerprint, Activity, Zap, Cpu } from 'lucide-react';
import { ConfirmationDialog } from '../components/ui/confirmation-dialog';
import { useToast } from '../components/ui/use-toast';
import { supabase } from '../lib/supabase';
import Layout from '../components/layout/Layout';
import PageHeader from '../components/layout/PageHeader';
import { ThemeToggle } from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function AccountSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { simpleMode, setSimpleMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.user_metadata?.full_name || 'Relay Solutions',
    email: user?.email || 'ethan@relaysolutions.net',
    phone: user?.user_metadata?.phone || '+44 7864851184',
    industry: user?.user_metadata?.industry || 'Automation & Systems',
  });

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: formData.full_name,
          phone: formData.phone,
          industry: formData.industry
        },
        email: formData.email,
      });

      if (error) throw error;

      toast({
        title: 'Intelligence Synced',
        description: 'Identity parameters updated successfully.',
      });
    } catch (error: unknown) {
      let errorMessage = 'Protocol error detected';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({
        title: 'Sync Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        <PageHeader
          title="Account Intelligence"
          description="Refine your operator profile and security parameters"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Profile & Appearance */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Identity Matrix */}
            <section className="bg-white/[0.01] backdrop-blur-xl rounded-none p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-none">
                  <Fingerprint className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Identity Matrix</h2>
                  <p className="text-sm text-white/40">Core operator credentials and identification</p>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="fullName" className="text-xs uppercase tracking-widest text-white/30 font-bold ml-1">Operator Name</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="fullName"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="Operator Name"
                        className="pl-12 h-12 bg-white/[0.02] border-none rounded-none focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-xs uppercase tracking-widest text-white/30 font-bold ml-1">Access Protocol (Email)</Label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="access@coldspark.ai"
                        className="pl-12 h-12 bg-white/[0.02] border-none rounded-none focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="phone" className="text-xs uppercase tracking-widest text-white/30 font-bold ml-1">Secure Line (Phone)</Label>
                    <div className="relative group">
                      <Zap className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+44 7864851184"
                        className="pl-12 h-12 bg-white/[0.02] border-none rounded-none focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="industry" className="text-xs uppercase tracking-widest text-white/30 font-bold ml-1">Neural Niche (Department)</Label>
                    <div className="relative group">
                      <Cpu className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
                      <Input
                        id="industry"
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                        placeholder="Automation & Systems"
                        className="pl-12 h-12 bg-white/[0.02] border-none rounded-none focus:bg-white/[0.04] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 text-white rounded-none h-12 px-8 font-bold uppercase tracking-tighter transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {loading ? (
                      <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-spin" />
                        Syncing...
                      </div>
                    ) : 'Update Identity'}
                  </Button>
                </div>
              </form>
            </section>

            {/* Interface Aesthetics */}
            <section className="bg-white/[0.01] backdrop-blur-xl rounded-none p-8 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-none">
                  <Palette className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">Interface Aesthetics</h2>
                  <p className="text-sm text-white/40">Calibrate your visual environment</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-white/[0.02] rounded-none group transition-all hover:bg-white/[0.03]">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/5 rounded-none">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold uppercase tracking-tighter text-sm">Visual Spectrum</h4>
                    <p className="text-xs text-white/40">Switch between standard and specialized modes</p>
                  </div>
                </div>
                <ThemeToggle />
              </div>

              <div className="flex items-center justify-between p-6 bg-white/[0.02] rounded-none group transition-all hover:bg-white/[0.03]">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/5 rounded-none">
                    <Palette className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold uppercase tracking-tighter text-sm">Simple Interface Mode</h4>
                    <p className="text-xs text-white/40">Simplifies typography, disables animation and CRT scanning effects</p>
                  </div>
                </div>
                <button
                  onClick={() => setSimpleMode(!simpleMode)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-none transition-all ${
                    simpleMode
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {simpleMode ? "Enabled" : "Disabled"}
                </button>
              </div>
            </section>
          </div>

          {/* Right Column: Security & System */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* Security Protocols */}
            <section className="bg-white/[0.01] backdrop-blur-xl rounded-none p-8 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-emerald-500/10 rounded-none">
                  <Shield className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter">Security Protocols</h2>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] rounded-none space-y-3">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-emerald-500/50" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Access Key</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">Your password is encrypted via AES-256 protocols.</p>
                  <Button variant="outline" className="w-full rounded-none h-10 text-xs font-bold uppercase bg-white/[0.02] border-none hover:bg-white/[0.05]" disabled>
                    Modify Access Key
                  </Button>
                </div>

                <div className="p-4 bg-white/[0.02] rounded-none space-y-3">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-4 h-4 text-emerald-500/50" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Session Integrity</span>
                  </div>
                  <p className="text-xs text-white/30 leading-relaxed">Last verified session: {new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </section>

            {/* System Override (Danger Zone) */}
            <section className="bg-red-500/[0.02] backdrop-blur-xl rounded-none p-8 space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-red-500/10 rounded-none">
                  <Trash2 className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter text-red-500">System Override</h2>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs text-red-500/50 leading-relaxed font-medium">
                  CAUTION: Initiating account termination will irrevocably purge all identity matrix data and active scrapers.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-none h-12 font-bold uppercase tracking-tighter transition-all"
                >
                  Terminate Account
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={async () => {
          try {
            const user_id = user?.id;
            if (!user_id) {
              throw new Error('Operator ID not found');
            }

            await supabase.rpc('delete_user', {
              p_user_id: user_id
            });

            toast({
              title: 'Purge Complete',
              description: 'Identity successfully removed from mainframe.',
            });

            await supabase.auth.signOut();
            window.location.href = '/';
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Override failed';
            toast({
              title: 'System Error',
              description: message,
              variant: 'destructive',
            });
          }
        }}
        title="Confirm Termination"
        description="Are you sure you want to terminate this account? This action will irrevocably purge all data from the ColdSpark mainframe."
      />
    </Layout>
  );
}

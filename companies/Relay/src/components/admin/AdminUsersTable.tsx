import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, Key, Pause, Trash2, Mail, Megaphone, Check } from 'lucide-react';
import { useToast } from '../ui/use-toast';

export const AdminUsersTable = ({ users, setUsers }) => {
  const [expandedUser, setExpandedUser] = useState(null);
  const [userData, setUserData] = useState({ campaigns: [], emails: [] });
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const { toast } = useToast();

  const handleExpand = async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    setLoadingExtra(true);
    setNewPassword('');
    try {
      const [campRes, emailRes] = await Promise.all([
        supabase.rpc('admin_get_user_campaigns', { target_uid: userId }),
        supabase.rpc('admin_get_user_emails', { target_uid: userId })
      ]);
      setUserData({
        campaigns: campRes.data || [],
        emails: emailRes.data || []
      });
    } catch (e) {
      console.error(e);
      toast({ title: 'Error fetching user details', variant: 'destructive' });
    } finally {
      setLoadingExtra(false);
    }
  };

  const handleForcePasswordChange = async (userId) => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.rpc('admin_force_change_password', { target_uid: userId, new_pass: newPassword });
      if (error) throw error;
      toast({ title: 'Password forced changed successfully', icon: <Check className="text-emerald-500"/> });
      setNewPassword('');
    } catch (e) {
      toast({ title: 'Error changing password', variant: 'destructive' });
    }
  };

  const handleForcePauseCampaign = async (campId) => {
    try {
      const { error } = await supabase.rpc('admin_force_pause_campaign', { camp_id: campId });
      if (error) throw error;
      setUserData(prev => ({
        ...prev,
        campaigns: prev.campaigns.map(c => c.id === campId ? { ...c, status: 'paused' } : c)
      }));
      toast({ title: 'Campaign forced paused', icon: <Pause className="text-amber-500"/> });
    } catch (e) {
      toast({ title: 'Error pausing campaign', variant: 'destructive' });
    }
  };

  const handleForceDeleteCampaign = async (campId) => {
    if (!window.confirm('Are you sure you want to completely delete this campaign?')) return;
    try {
      const { error } = await supabase.rpc('admin_force_delete_campaign', { camp_id: campId });
      if (error) throw error;
      setUserData(prev => ({
        ...prev,
        campaigns: prev.campaigns.filter(c => c.id !== campId)
      }));
      // update top level stats
      setUsers(prev => prev.map(u => u.id === expandedUser ? { ...u, campaign_count: Math.max(0, u.campaign_count - 1) } : u));
      toast({ title: 'Campaign forced deleted', icon: <Trash2 className="text-destructive"/> });
    } catch (e) {
      toast({ title: 'Error deleting campaign', variant: 'destructive' });
    }
  };

  const handleForceDeleteEmail = async (emailId) => {
    if (!window.confirm('Are you sure you want to completely delete this email account?')) return;
    try {
      const { error } = await supabase.rpc('admin_force_delete_email', { target_email_id: emailId });
      if (error) throw error;
      setUserData(prev => ({
        ...prev,
        emails: prev.emails.filter(e => e.id !== emailId)
      }));
      setUsers(prev => prev.map(u => u.id === expandedUser ? { ...u, email_account_count: Math.max(0, u.email_account_count - 1) } : u));
      toast({ title: 'Email account forced deleted', icon: <Trash2 className="text-destructive"/> });
    } catch (e) {
      toast({ title: 'Error deleting email', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {users.map(u => (
        <div key={u.id} className="bg-card border border-border rounded-2xl overflow-hidden transition-all">
          <div 
            onClick={() => handleExpand(u.id)}
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="font-bold text-foreground tracking-tight">{u.email}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">ID: {u.id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Type: <strong className="text-white uppercase">{u.provider}</strong></span>
                <span className="text-xs text-muted-foreground">Joined: {format(new Date(u.created_at), 'MMM d, yyyy')}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-background border border-border text-xs font-bold text-foreground">
                  <Megaphone size={12} className="text-primary"/> {u.campaign_count}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-background border border-border text-xs font-bold text-foreground">
                  <Mail size={12} className="text-violet-500"/> {u.email_account_count}
                </div>
              </div>
            </div>
            <div>
              {expandedUser === u.id ? <ChevronUp size={20} className="text-muted-foreground" /> : <ChevronDown size={20} className="text-muted-foreground" />}
            </div>
          </div>

          {expandedUser === u.id && (
            <div className="p-4 border-t border-border bg-background flex flex-col gap-6 animate-in slide-in-from-top-2">
              
              {/* Password Management */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Key size={16} className="text-amber-500" />
                  Force Change Password
                </div>
                <input 
                  type="text"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-card border border-border px-3 py-1.5 text-sm focus:outline-none focus:border-primary w-64"
                />
                <button 
                  onClick={() => handleForcePasswordChange(u.id)}
                  className="bg-primary/10 text-primary border border-primary/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-colors"
                >
                  Force Change
                </button>
              </div>

              {loadingExtra ? (
                <div className="text-xs text-muted-foreground animate-pulse">Loading usage data...</div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  {/* Campaigns */}
                  <div className="flex flex-col border border-border p-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <Megaphone size={12} /> Campaigns
                    </h4>
                    {userData.campaigns.length === 0 ? <div className="text-xs text-muted-foreground italic">No campaigns</div> : (
                      <div className="flex flex-col gap-2">
                        {userData.campaigns.map(c => (
                          <div key={c.id} className="flex items-center justify-between bg-card border border-border p-2">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="text-sm font-bold truncate">{c.name}</span>
                              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{c.status}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.status !== 'paused' && (
                                <button onClick={() => handleForcePauseCampaign(c.id)} className="p-1.5 hover:bg-amber-500/10 text-amber-500 border border-transparent hover:border-amber-500/20 transition-colors" title="Force Pause">
                                  <Pause size={14} />
                                </button>
                              )}
                              <button onClick={() => handleForceDeleteCampaign(c.id)} className="p-1.5 hover:bg-destructive/10 text-destructive border border-transparent hover:border-destructive/20 transition-colors" title="Force Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Emails */}
                  <div className="flex flex-col border border-border p-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <Mail size={12} /> Connected Emails
                    </h4>
                    {userData.emails.length === 0 ? <div className="text-xs text-muted-foreground italic">No emails</div> : (
                      <div className="flex flex-col gap-2">
                        {userData.emails.map(e => (
                          <div key={e.id} className="flex items-center justify-between bg-card border border-border p-2">
                            <div className="flex flex-col min-w-0 pr-2">
                              <span className="text-sm font-bold truncate">{e.email}</span>
                              <span className="text-[10px] uppercase text-muted-foreground tracking-wider">{e.provider || 'IMAP'}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => handleForceDeleteEmail(e.id)} className="p-1.5 hover:bg-destructive/10 text-destructive border border-transparent hover:border-destructive/20 transition-colors" title="Force Delete">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

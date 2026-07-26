import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Layout from '../../components/layout/Layout';
import { Users, Target, ArrowLeft, Target as TargetIcon } from 'lucide-react';
import CampaignCard from '../../components/CampaignCard';

export const AdminCampaignHub = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await supabase.rpc('admin_get_users_list');
        if (data) setUsers(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setLoadingCampaigns(true);
    try {
      const { data } = await supabase.rpc('admin_get_user_campaigns', { target_uid: user.id });
      if (data) setCampaigns(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  return (
    <Layout>
      <div className="w-full flex flex-col h-full bg-background overflow-y-auto">
        <div className="p-6 pb-2 flex items-center justify-between border-b border-border mb-6">
          <div className="flex items-center gap-4">
            {selectedUser && (
              <button 
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft size={16} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Back to Users</span>
              </button>
            )}
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <TargetIcon className="w-6 h-6 text-primary" />
                {selectedUser ? `${selectedUser.email}'s Campaigns` : 'User Campaigns Hub'}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs tracking-widest uppercase font-bold">
                {selectedUser ? `Managing campaigns for ${selectedUser.id}` : 'Select a user to view their campaigns'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 pt-0">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-card rounded-2xl border border-border" />)}
            </div>
          ) : !selectedUser ? (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {users.map(u => (
                <div 
                  key={u.id}
                  onClick={() => handleUserClick(u)}
                  className="bg-card border border-border rounded-2xl p-6 cursor-pointer hover:border-primary/50 transition-all hover:-translate-y-1 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary opacity-0 group-hover:opacity-5 transition-opacity rounded-bl-full" />
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center group-hover:border-primary/30 transition-colors">
                      <Users size={20} className="text-primary" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground truncate">{u.email}</span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Joined {new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Campaigns</span>
                    <span className="font-black text-lg text-foreground">{u.campaign_count}</span>
                  </div>
                  
                  <div className="flex flex-col gap-2 pt-4 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Subscription</span>
                    <select
                      value={u.plan_type || 'free'}
                      onChange={async (e) => {
                        const newPlan = e.target.value;
                        setUsers(prev => prev.map(user => user.id === u.id ? { ...user, plan_type: newPlan } : user));
                        await supabase.rpc('admin_update_user_plan', { target_uid: u.id, new_plan: newPlan });
                      }}
                      className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary/50 cursor-pointer"
                    >
                      <option value="free">Free ($0/mo)</option>
                      <option value="starter">Starter ($49/mo)</option>
                      <option value="pro">Pro ($99/mo)</option>
                      <option value="enterprise">Enterprise ($299/mo)</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {loadingCampaigns ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-pulse">
                    {[1,2,3].map(i => <div key={i} className="h-64 bg-card rounded-2xl border border-border" />)}
                 </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-border">
                  <Target className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-widest text-center">
                    This user has no campaigns
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {campaigns.map(c => (
                    <CampaignCard key={c.id} {...c} onClick={() => {}} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

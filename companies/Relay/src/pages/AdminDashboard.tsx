import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AdminStatsGrid } from '../components/admin/AdminStatsGrid';
import { AdminUsersTable } from '../components/admin/AdminUsersTable';
import Layout from '../components/layout/Layout';
import { Activity, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email !== 'admin@relaysolutions.net') return;
    
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const [statsRes, usersRes] = await Promise.all([
          supabase.rpc('admin_get_stats'),
          supabase.rpc('admin_get_users_list')
        ]);
        
        if (statsRes.data) setStats(statsRes.data);
        if (usersRes.data) setUsers(usersRes.data);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdminData();
  }, [user]);

  if (user?.email !== 'admin@relaysolutions.net') {
    return (
      <Layout>
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-background">
          <ShieldAlert className="w-16 h-16 text-destructive mb-4" />
          <h2 className="text-2xl font-black uppercase text-foreground">Unauthorized Access</h2>
          <p className="text-muted-foreground mt-2">You do not have permission to view the admin overview.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full h-full flex flex-col p-8 bg-background overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <Activity className="w-8 h-8 text-primary" />
              Global Admin Overview
            </h1>
            <p className="text-muted-foreground mt-1 text-sm tracking-widest uppercase font-bold">
              System wide statistics and management
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-32 bg-card border border-border w-full rounded-none"></div>
            <div className="h-96 bg-card border border-border w-full rounded-none mt-8"></div>
          </div>
        ) : (
          <>
            <AdminStatsGrid stats={stats} />
            <div className="mt-8 flex-1">
              <h2 className="text-xl font-black uppercase tracking-tight text-foreground mb-4">User Accounts ({users.length})</h2>
              <AdminUsersTable users={users} setUsers={setUsers} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AdminStatsGrid } from '../components/admin/AdminStatsGrid';
import { AdminGrowthChart } from '../components/admin/AdminGrowthChart';
import { AdminActivityFeed } from '../components/admin/AdminActivityFeed';
import { AdminSystemHealth } from '../components/admin/AdminSystemHealth';
import Layout from '../components/layout/Layout';
import { Activity, ShieldAlert, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email !== 'admin@relaysolutions.net') return;
    
    const fetchAdminData = async () => {
      setLoading(true);
      try {
        const [statsRes, growthRes, activityRes] = await Promise.all([
          supabase.rpc('admin_get_stats'),
          supabase.rpc('admin_get_growth_data'),
          supabase.rpc('admin_get_recent_activity')
        ]);
        
        if (statsRes.data) setStats(statsRes.data);
        if (growthRes.data) setGrowthData(growthRes.data);
        if (activityRes.data) setActivities(activityRes.data);
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
      <div className="w-full h-full flex flex-col p-4 md:p-8 bg-background overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Business Owner Dashboard
            </h1>
            <p className="text-muted-foreground mt-1 text-sm tracking-widest uppercase font-bold">
              Global Platform Command Center
            </p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/campaigns')} className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all">
              Manage Users
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6 animate-pulse">
            <div className="h-32 bg-card border border-border w-full rounded-2xl"></div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-8 h-96 bg-card border border-border rounded-2xl"></div>
              <div className="md:col-span-4 h-96 bg-card border border-border rounded-2xl"></div>
            </div>
            <div className="h-96 bg-card border border-border w-full rounded-2xl"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Top KPI Grid */}
            <AdminStatsGrid stats={stats} />
            
            {/* Middle Section: Charts and Health */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8">
                <AdminGrowthChart data={growthData} />
              </div>
              <div className="xl:col-span-4">
                <AdminSystemHealth stats={stats} />
              </div>
            </div>

            {/* Bottom Section: Activity Feed */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              <div className="xl:col-span-8">
                <AdminActivityFeed activities={activities} />
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

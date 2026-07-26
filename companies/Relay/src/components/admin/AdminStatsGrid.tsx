import React from 'react';
import { Users, Mail, Megaphone, Activity } from 'lucide-react';

export const AdminStatsGrid = ({ stats }) => {
  if (!stats) return null;

  const statCards = [
    { name: 'Registered Users', value: stats.total_users || 0, icon: Users, color: 'text-primary' },
    { name: 'Live Users (1h)', value: stats.live_users || 0, icon: Activity, color: 'text-emerald-500' },
    { name: 'Total Campaigns', value: stats.total_campaigns || 0, icon: Megaphone, color: 'text-blue-500' },
    { name: 'Connected Emails', value: stats.total_emails || 0, icon: Mail, color: 'text-violet-500' }
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {statCards.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div key={i} className="flex flex-col bg-card border border-border rounded-none p-6 relative overflow-hidden group hover:border-border/80 transition-all duration-300">
            <div className={`absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.02] -mr-8 -mt-8 rounded-full transition-transform duration-500 group-hover:scale-110 ${stat.color}`} />
            
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={`p-3 bg-background border border-border rounded-none shadow-sm ${stat.color}`}>
                <Icon size={20} />
              </div>
            </div>
            
            <div className="relative z-10">
              <h3 className="font-black text-3xl text-foreground tracking-tight drop-shadow-sm mb-1">{stat.value}</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{stat.name}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

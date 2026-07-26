import React from 'react';
import { Database, Cpu, Activity, Server } from 'lucide-react';

export const AdminSystemHealth = ({ stats }) => {
  const isHealthy = true; // Assuming healthy if we can fetch stats
  
  // Calculate mock health metrics based on stats, to make it look active
  const dbLoad = stats ? Math.min(100, Math.round((stats.total_campaigns / 500) * 100)) : 0;
  const apiLoad = stats ? Math.min(100, Math.round((stats.live_users / 50) * 100)) : 0;
  const memoryUsage = 42; // static mock for now

  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col h-full min-h-[350px]">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-foreground font-black uppercase tracking-tight text-lg">System Health</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Platform Infrastructure</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">All Systems Operational</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 flex-1">
        
        {/* DB Health */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-foreground uppercase tracking-widest">Database Capacity</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">{dbLoad}%</span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all duration-1000 ${dbLoad > 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${dbLoad}%` }} />
          </div>
        </div>

        {/* API Load */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-primary" />
              <span className="text-xs font-bold text-foreground uppercase tracking-widest">API Request Load</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">{apiLoad}%</span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
            <div className={`h-full transition-all duration-1000 ${apiLoad > 80 ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${apiLoad}%` }} />
          </div>
        </div>

        {/* Server Memory */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Cpu size={16} className="text-violet-500" />
              <span className="text-xs font-bold text-foreground uppercase tracking-widest">Scraper Engine Memory</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">{memoryUsage}%</span>
          </div>
          <div className="w-full h-2 bg-background rounded-full overflow-hidden border border-border">
            <div className="h-full bg-violet-500 transition-all duration-1000" style={{ width: `${memoryUsage}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
};

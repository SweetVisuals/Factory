import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, Megaphone, Activity } from 'lucide-react';

export const AdminActivityFeed = ({ activities }) => {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col h-full max-h-[400px]">
      <div className="p-4 border-b border-border/50 bg-background/50 flex items-center gap-2">
        <Activity size={16} className="text-primary" />
        <h3 className="text-foreground font-bold uppercase tracking-widest text-xs">Platform Activity Feed</h3>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {(!activities || activities.length === 0) ? (
          <div className="flex items-center justify-center h-full p-8">
            <span className="text-muted-foreground text-[10px] uppercase tracking-widest font-bold">No recent activity</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {activities.map((item, index) => {
              const isUser = item.type === 'user_joined';
              const Icon = isUser ? UserPlus : Megaphone;
              const colorClass = isUser ? 'text-primary' : 'text-blue-500';
              
              return (
                <div key={`${item.id}-${index}`} className="flex items-center justify-between p-3 border-b border-border/30 hover:bg-white/[0.02] transition-colors group">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Icon size={14} className={`${colorClass} shrink-0 opacity-80 group-hover:opacity-100 transition-opacity`} />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-foreground truncate">
                        {isUser ? 'New User Joined' : 'New Campaign Launched'}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase font-bold text-muted-foreground/60 shrink-0 ml-4 group-hover:text-muted-foreground transition-colors">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

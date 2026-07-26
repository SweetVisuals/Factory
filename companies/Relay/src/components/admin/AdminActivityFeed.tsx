import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, Megaphone } from 'lucide-react';

export const AdminActivityFeed = ({ activities }) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col h-full min-h-[350px]">
      <div className="mb-6">
        <h3 className="text-foreground font-black uppercase tracking-tight text-lg">Live Activity Feed</h3>
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Platform-wide events</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {(!activities || activities.length === 0) ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-muted-foreground text-xs uppercase tracking-widest font-bold">No recent activity</span>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activities.map((item, index) => {
              const isUser = item.type === 'user_joined';
              const Icon = isUser ? UserPlus : Megaphone;
              const colorClass = isUser ? 'text-primary bg-primary/10 border-primary/20' : 'text-blue-500 bg-blue-500/10 border-blue-500/20';
              
              return (
                <div key={`${item.id}-${index}`} className="flex gap-4 items-start relative group">
                  {/* Timeline connector */}
                  {index !== activities.length - 1 && (
                    <div className="absolute top-8 left-[19px] bottom-[-24px] w-px bg-border/50 group-hover:bg-primary/30 transition-colors" />
                  )}
                  
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border z-10 ${colorClass}`}>
                    <Icon size={16} />
                  </div>
                  
                  <div className="flex flex-col pt-1 w-full bg-background/50 hover:bg-white/[0.02] p-2 -my-2 rounded-lg transition-colors border border-transparent hover:border-border">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {isUser ? 'New User Joined' : 'New Campaign Launched'}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1 truncate">
                      {item.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

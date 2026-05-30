import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronUp, ChevronDown, Terminal, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ChatLog {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

export const AgentLogs: React.FC = () => {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .like('agent_name', 'Scheduler_%')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setLogs(data.reverse()); // Show chronological top to bottom
      }
    };

    fetchLogs();

    // Subscribe to new logs
    const subscription = supabase
      .channel('chat_logs_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_logs',
          filter: "agent_name=like.Scheduler_*"
        },
        (payload) => {
          setLogs(prev => [...prev, payload.new as ChatLog].slice(-20)); // Keep last 20
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-[100] transition-all duration-300 ease-in-out border-t border-white/10 bg-black/90 backdrop-blur-md shadow-2xl",
      isOpen ? "h-64" : "h-10"
    )}>
      {/* Header bar */}
      <div 
        className="flex items-center justify-between px-4 h-10 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 text-primary font-mono text-sm">
          <Terminal className="w-4 h-4" />
          <span>Agent Console {logs.length > 0 && `(Last event: ${format(new Date(logs[logs.length-1].created_at), 'HH:mm:ss')})`}</span>
        </div>
        <button className="text-muted-foreground hover:text-white transition-colors">
          {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {/* Logs container */}
      <div className={cn(
        "overflow-y-auto p-4 space-y-3 font-mono text-xs transition-opacity duration-300",
        isOpen ? "opacity-100 h-[calc(100%-2.5rem)]" : "opacity-0 h-0 hidden"
      )}>
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 text-muted-foreground break-all">
            <span className="shrink-0 text-white/40">
              [{format(new Date(log.created_at), 'HH:mm:ss')}]
            </span>
            <div className="flex flex-col gap-1 w-full">
              <span className="text-primary font-semibold flex items-center gap-1">
                <Bot className="w-3 h-3" /> {log.agent_name.replace('Scheduler_', '')}
              </span>
              <span className="whitespace-pre-wrap text-white/80">{log.message}</span>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-center text-muted-foreground/50 py-4 italic">
            Waiting for AI Agents to spin up...
          </div>
        )}
      </div>
    </div>
  );
};

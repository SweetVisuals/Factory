import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, Maximize2, Minimize2, X, Cpu, Activity, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { openclawSupabase } from '../lib/openclaw';
import { format } from 'date-fns';

interface ChatLogEntry {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

const AgentChatLog = ({ isExpanded, onToggle }: { isExpanded: boolean, onToggle: () => void }) => {
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [command, setCommand] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [chatWidth, setChatWidth] = useState(450); 
  const [isResizing, setIsResizing] = useState(false);
  const endOfLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth >= 320 && newWidth <= 1200) setChatWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isResizing]);

  useEffect(() => {
    fetchLogs();
    const subscription = openclawSupabase.channel('chat_logs_realtime_terminal')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_logs' }, (payload) => {
        setLogs(prev => [...prev, payload.new as ChatLogEntry]);
      }).subscribe();
    return () => { openclawSupabase.removeChannel(subscription); };
  }, []);

  useEffect(() => {
    if (isExpanded && endOfLogRef.current) {
      endOfLogRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  const fetchLogs = async () => {
    const { data } = await openclawSupabase.from('chat_logs').select('*').order('created_at', { ascending: true }).limit(200);
    if (data) setLogs(data);
  };

  const handleClearLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to clear all logs?")) return;
    const { error } = await openclawSupabase.from('chat_logs').delete().not('id', 'is', null);
    if (!error) setLogs([]);
  };

  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsSubmitting(true);
    await openclawSupabase.from('tasks').insert([{ description: command, status: 'pending', assigned_to: 'Boss' }]);
    await openclawSupabase.from('chat_logs').insert([{ agent_name: 'USER', message: command }]);
    setCommand('');
    setIsSubmitting(false);
  };

  const getAgentStyles = (name: string) => {
    const n = name.toUpperCase();
    if (n === 'USER' || n === 'BOSS') return { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    if (n === 'CEO' || n === 'SYSTEM') return { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    return { bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
  };

  const renderLogEntry = (log: ChatLogEntry) => {
    if (log.message.includes("The factory is idle")) return null;

    let response = log.message;
    let thought = "";
    const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/);
    if (thoughtMatch) { thought = thoughtMatch[1].trim(); }
    response = response.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();

    const isUser = log.agent_name.toUpperCase() === 'USER' || log.agent_name.toUpperCase() === 'BOSS';
    const style = getAgentStyles(log.agent_name);

    return (
      <div key={log.id} className="flex flex-col gap-2 p-4 border-b border-border/50 hover:bg-muted/30 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border", style.bg)}>
              {log.agent_name.toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'h:mm:ss a')}</span>
          </div>
        </div>

        {thought && (
          <div className="bg-muted/50 border-l-2 border-primary/50 pl-3 py-2 my-1 rounded-r-md">
            <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-primary/80">
              <Info size={12} />
              Internal Thought Process
            </div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">
              {thought}
            </div>
          </div>
        )}
        
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {response}
        </div>
      </div>
    );
  };

  return (
    <div 
      className={cn(
        "h-full z-[1000] flex flex-col border-l border-border shadow-xl bg-background relative flex-shrink-0",
        !isExpanded ? "w-0 opacity-0 overflow-hidden" : "opacity-100",
        isMaximized && "fixed inset-0 w-full z-[2000]"
      )}
      style={{
        width: !isExpanded ? 0 : (isMaximized ? '100%' : `${chatWidth}px`),
        transition: isResizing ? 'none' : 'width 0.3s ease-out, opacity 0.3s ease-out'
      }}
    >
      {/* Resizer */}
      {isExpanded && !isMaximized && (
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize z-10 hover:bg-primary/50 transition-colors -ml-[1px]"
        />
      )}
      
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-primary" />
          <span className="font-semibold text-foreground text-sm">System Logs</span>
          <span className="ml-2 px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground font-medium">{logs.length}</span>
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={handleClearLogs} className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-md transition-colors" title="Clear Logs">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Toggle Fullscreen">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={onToggle} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Close Panel">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 overflow-y-auto bg-background scrollbar-thin">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4">
            <Terminal size={48} className="opacity-20" />
            <p className="text-sm">No activity logged.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {logs.map(log => renderLogEntry(log))}
            <div ref={endOfLogRef} className="h-4" />
          </div>
        )}
      </div>
      
      {/* Input Area */}
      <div className="p-4 border-t border-border bg-card shrink-0">
        <div className="relative flex items-center">
          <input 
            type="text" 
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            placeholder="Type a command or message..."
            className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 pr-12 transition-all"
            disabled={isSubmitting}
          />
          <button 
            onClick={handleExecute}
            disabled={isSubmitting || !command.trim()}
            className="absolute right-2 p-1.5 bg-primary text-primary-foreground rounded-md disabled:opacity-50 hover:bg-primary/90 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgentChatLog;

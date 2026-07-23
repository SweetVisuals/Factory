import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Send, Trash2, Maximize2, Minimize2, X, Cpu, Activity, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { openclawSupabase } from '../lib/openclaw';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatLogEntry {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

const TelemetryLogsContainer = () => {
  const [telemetryLogs, setTelemetryLogs] = useState<{ timestamp: string, message: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: any;
    const fetchTelemetry = async () => {
      try {
        const { data: { session } } = await openclawSupabase.auth.getSession();
        if (!session) return;
        const config = { headers: { Authorization: `Bearer ${session.access_token}` } };
        // We import the api module or fetch directly
        const res = await fetch('/api/scraper-logs', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setTelemetryLogs(data);
          }
        }
      } catch (e) {}
    };
    fetchTelemetry();
    interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [telemetryLogs]);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto space-y-1 pr-1 custom-scrollbar">
      {telemetryLogs.length === 0 ? (
        <div className="text-muted-foreground/30 italic text-center py-4">Awaiting log updates...</div>
      ) : (
        telemetryLogs.map((log, i) => (
          <div key={i} className="flex gap-2 text-foreground/70">
            <span className="text-primary/40 shrink-0 select-none">
              [{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
            </span>
            <span className="leading-relaxed break-words whitespace-pre-wrap">{log.message}</span>
          </div>
        ))
      )}
    </div>
  );
};

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
    const { data } = await openclawSupabase.from('chat_logs').select('*').order('created_at', { ascending: true }).limit(50);
    if (data) setLogs(data);
  };

  const handleClearLogs = async () => {
    await openclawSupabase.from('chat_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    setLogs([]);
  };

  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsSubmitting(true);
    const newLog = { agent_name: 'User', message: command, created_at: new Date().toISOString() };
    setLogs(prev => [...prev, newLog as any]);
    setCommand('');
    try {
      await fetch('/api/execute-agent-command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) });
    } catch (e) {}
    setIsSubmitting(false);
  };

  const renderLogEntry = (log: ChatLogEntry) => {
    const isUser = log.agent_name === 'User';
    return (
      <div key={log.id || log.created_at} className={cn("p-4 border-b border-border/50", isUser ? "bg-muted/30" : "bg-transparent")}>
        <div className="flex items-center gap-2 mb-2">
          {isUser ? <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center"><Terminal size={12} className="text-muted-foreground" /></div> : <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center"><Cpu size={12} className="text-primary" /></div>}
          <span className="font-bold text-sm text-foreground">{log.agent_name}</span>
          <span className="text-xs text-muted-foreground ml-auto">{format(new Date(log.created_at), 'HH:mm:ss')}</span>
        </div>
        <div className="text-sm text-foreground/80 leading-relaxed prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{log.message}</ReactMarkdown>
        </div>
      </div>
    );
  };

  if (!isExpanded) return null;

  return (
    <div 
      style={{ width: isMaximized ? '100%' : `${chatWidth}px` }} 
      className={cn(
        "bg-card border-l border-border flex flex-col shadow-2xl transition-all duration-300 z-50",
        isMaximized ? "fixed inset-0 w-full h-full" : "h-full shrink-0"
      )}
    >
      {/* Resizer Handle */}
      {!isMaximized && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
          onMouseDown={() => setIsResizing(true)}
        />
      )}

      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/20 rounded-md">
            <Terminal size={16} className="text-primary" />
          </div>
          <span className="font-bold text-sm text-foreground tracking-wide">Relay Terminal</span>
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background scrollbar-thin flex flex-col">
        {/* Render Neural Link Feed telemetry logs here */}
        <div className={cn(
          "border-b border-border bg-black/20 p-4 font-mono text-[10px] space-y-2 shrink-0 flex flex-col",
          logs.length === 0 ? "flex-1" : "max-h-[250px]"
        )}>
          <div className="flex items-center justify-between mb-1 pb-1 border-b border-border/30 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary animate-pulse" />
              <span className="text-foreground font-black uppercase tracking-widest text-[9px]">Scraper Log</span>
            </div>
            <span className="text-muted-foreground/40 uppercase tracking-tighter text-[8px]">Live Logs</span>
          </div>
          <TelemetryLogsContainer />
        </div>

        {logs.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col">
              {logs.map(log => renderLogEntry(log))}
              <div ref={endOfLogRef} className="h-4" />
            </div>
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

import { useState, useEffect } from 'react';
import { openclawSupabase } from '../../lib/openclaw';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Send, Terminal, Loader2, MessageSquare, Shield, Zap, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';

interface DirectivesTabProps {
  campaignId: string;
  campaignName: string;
}

interface Directive {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

const DirectivesTab = ({ campaignId, campaignName }: DirectivesTabProps) => {
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDirectives();

    const subscription = openclawSupabase
      .channel(`directives-${campaignId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_logs' 
      }, (payload) => {
        const newLog = payload.new as Directive;
        if (newLog.message.includes(`[CAMPAIGN: ${campaignName}]`)) {
          setDirectives(prev => [newLog, ...prev]);
        }
      })
      .subscribe();

    return () => {
      openclawSupabase.removeChannel(subscription);
    };
  }, [campaignId, campaignName]);

  const fetchDirectives = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await openclawSupabase
        .from('chat_logs')
        .select('*')
        .ilike('message', `%[CAMPAIGN: ${campaignName}]%`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDirectives(data || []);
    } catch (err: any) {
      console.error('Error fetching directives:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostDirective = async () => {
    if (!message.trim()) return;
    setIsSubmitting(true);

    const fullMessage = `[CAMPAIGN: ${campaignName}] ${message}`;

    try {
      // Post to chat_logs so agents see it
      const { error: logError } = await openclawSupabase
        .from('chat_logs')
        .insert([
          { 
            agent_name: 'CEO', 
            message: fullMessage 
          }
        ]);

      if (logError) throw logError;

      // Also create a task for the Boss to acknowledge/act on it
      const { error: taskError } = await openclawSupabase
        .from('tasks')
        .insert([
          { 
            description: `New strategic directive for ${campaignName}: ${message}`, 
            status: 'pending',
            assigned_to: 'Boss' 
          }
        ]);

      if (taskError) throw taskError;

      setMessage('');
      toast({
        title: 'Directive Dispatched',
        description: 'Agents have been notified of the strategic pivot.',
      });
      
      // Local update if subscription is slow
      fetchDirectives();
    } catch (err: any) {
      toast({
        title: 'Dispatch Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* Directive Input */}
      <div className="bg-white/[0.02] rounded-none p-10 space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
          <Shield size={120} strokeWidth={0.5} />
        </div>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center text-primary">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.4em]">Strategic Directive</h3>
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mt-1">Issue commands directly to the autonomous assembly line</p>
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="E.g., 'Prioritize tech leads', 'Tone down the aggressive hooks', 'Focus on follow-ups this week'..."
            className="w-full h-32 bg-white/[0.03] border-none rounded-none p-8 text-sm font-medium text-white placeholder:text-white/10 outline-none focus:bg-white/[0.05] transition-all resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handlePostDirective}
              disabled={isSubmitting || !message.trim()}
              className="bg-primary hover:bg-primary/80 text-white rounded-none px-10 h-14 font-black text-[10px] uppercase tracking-widest gap-4 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(139,92,246,0.3)]"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Dispatch Directive
            </Button>
          </div>
        </div>
      </div>

      {/* Directive History */}
      <div className="space-y-6">
        <div className="flex items-center gap-4 px-2">
          <Terminal className="h-4 w-4 text-primary" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Transmission History</h3>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4 opacity-20">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-[9px] font-black uppercase tracking-[0.2em]">Syncing Feed...</p>
            </div>
          ) : directives.length === 0 ? (
            <div className="bg-white/[0.01] rounded-none p-20 text-center space-y-4">
              <MessageSquare className="mx-auto text-white/5" size={40} strokeWidth={1} />
              <p className="text-[10px] font-black text-white/10 uppercase tracking-[0.2em]">No directives issued yet</p>
            </div>
          ) : (
            directives.map((directive) => (
              <div 
                key={directive.id}
                className="bg-white/[0.02] rounded-none p-8 hover:bg-white/[0.03] transition-all duration-500 flex flex-col gap-4 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-none bg-primary" />
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.3em] italic">Human Command [CEO]</span>
                  </div>
                  <span className="text-[9px] font-bold text-white/10 uppercase tracking-widest">
                    {format(new Date(directive.created_at), 'MMM dd, HH:mm:ss')}
                  </span>
                </div>
                <p className="text-[13px] font-medium text-white/80 leading-relaxed pl-4 border-l border-white/5 group-hover:border-primary/20 transition-colors">
                  {directive.message.replace(`[CAMPAIGN: ${campaignName}] `, '')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectivesTab;

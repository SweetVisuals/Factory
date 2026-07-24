import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Mail, Search, MessageSquare, ChevronRight, PanelRightClose, PanelRightOpen, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface EmailMessage {
  id: string;
  accountId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  is_read: boolean;
  campaign_id?: string;
}

export default function ThreadsSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchEmails();
    }
  }, [isOpen]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inbox_emails')
        .select('*')
        .order('date', { ascending: false })
        .limit(20);
        
      if (data && !error) {
        setEmails(data as EmailMessage[]);
      }
    } catch (err) {
      console.error('Error fetching emails', err);
    } finally {
      setLoading(false);
    }
  };

  // Group emails by subject
  const groupedEmails = emails.reduce((acc, email) => {
    const key = email.subject || 'No Subject';
    if (!acc[key]) acc[key] = [];
    if (acc[key].length < 5) acc[key].push(email);
    return acc;
  }, {} as Record<string, EmailMessage[]>);

  if (!isOpen) {
    return (
      <div className="w-12 border-l border-white/5 bg-[#111111] flex flex-col items-center py-4 shrink-0 h-full transition-all">
        <button 
          onClick={() => setIsOpen(true)}
          className="p-2 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-xl transition-colors"
          title="Open Threads"
        >
          <PanelRightOpen size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 border-l border-white/5 bg-[#111111] flex flex-col shrink-0 h-full transition-all animate-in slide-in-from-right-8 duration-200">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-foreground">
          <MessageSquare size={16} className="text-primary" />
          <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground">Recent Threads</h2>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="p-1.5 hover:bg-white/5 text-muted-foreground hover:text-foreground rounded-xl transition-colors"
        >
          <PanelRightClose size={16} />
        </button>
      </div>

      <div className="p-3 border-b border-white/5 bg-[#111111]">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search threads..." 
            className="w-full bg-[#111111] border border-white/5 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors rounded-xl"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {loading ? (
          <div className="p-6 flex flex-col items-center justify-center space-y-3 opacity-50">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Syncing Threads...</span>
          </div>
        ) : Object.keys(groupedEmails).length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <Mail size={24} className="mx-auto mb-2 opacity-20" />
            <p className="text-xs">No recent threads found.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {Object.entries(groupedEmails).map(([subject, msgs]) => (
              <div key={subject} className="border-b border-white/5 last:border-0 group">
                <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-xl bg-primary/70" />
                  <span className="text-[10px] font-black uppercase tracking-tight text-muted-foreground truncate" title={subject}>
                    {subject}
                  </span>
                </div>
                
                <div className="flex flex-col">
                  {msgs.map((msg, i) => (
                    <div 
                      key={msg.id || i} 
                      className="px-4 py-3 hover:bg-white/[0.04] transition-colors cursor-pointer border-b border-white/5 last:border-0"
                    >
                      <div className="flex justify-between items-start mb-1 gap-2">
                        <span className="text-xs font-bold text-foreground truncate">
                          {msg.from?.split('<')[0] || msg.from || 'Unknown'}
                        </span>
                        <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                          {msg.date ? formatDistanceToNow(new Date(msg.date), { addSuffix: true }) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {msg.snippet || 'No preview available...'}
                      </p>
                    </div>
                  ))}
                </div>
                
                <div className="px-4 py-2 bg-[#111111] hover:bg-white/[0.04] cursor-pointer flex items-center gap-1.5 group/btn transition-colors">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">View Full Thread</span>
                  <ArrowRight size={10} className="text-primary group-hover/btn:translate-x-0.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EmailAccount } from '../types';
import { X, Paperclip, Send, Search, Image as ImageIcon, FileText, Bot, ChevronRight, Settings } from 'lucide-react';
import { api } from '../lib/api/api';
import { cn } from '../lib/utils';
import { useToast } from './ui/use-toast';
import { subjectLines, emailBodies, htmlTemplates } from '../lib/templates';

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface ComposePaneProps {
  onClose: () => void;
  accounts: EmailAccount[];
}

export const ComposePane: React.FC<ComposePaneProps> = ({ onClose, accounts }) => {
  const { toast } = useToast();
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // Lead Search State
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Custom To Email (if not a lead)
  const [customToEmail, setCustomToEmail] = useState('');

  // Email Content
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  // Templates
  const [selectedHtmlTemplate, setSelectedHtmlTemplate] = useState('plain');

  const [isSending, setIsSending] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  
  // Attachments
  const [attachments, setAttachments] = useState<{name: string, content: string, type: string}[]>([]);

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Debounced Lead Search
  useEffect(() => {
    const searchLeads = async () => {
      if (leadSearch.length < 2) {
        setLeadResults([]);
        return;
      }
      const { data } = await supabase
        .from('leads')
        .select('id, name, email, company')
        .or(`email.ilike.%${leadSearch}%,name.ilike.%${leadSearch}%,company.ilike.%${leadSearch}%`)
        .limit(10);
      
      if (data) setLeadResults(data);
    };

    const debounce = setTimeout(searchLeads, 300);
    return () => clearTimeout(debounce);
  }, [leadSearch]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Attachments must be under 5MB to avoid junk filters.', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64String = (ev.target?.result as string).split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, content: base64String, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const generateRandomSubject = () => {
    const randomSubj = subjectLines[Math.floor(Math.random() * subjectLines.length)];
    setSubject(randomSubj);
  };

  const generateRandomBody = () => {
    const randomBody = emailBodies[Math.floor(Math.random() * emailBodies.length)];
    setBody(randomBody);
  };

  const handleSend = async () => {
    if (!selectedAccount) {
      toast({ title: 'Error', description: 'Please select a sending account.', variant: 'destructive' });
      return;
    }
    
    const targetEmail = selectedLead ? selectedLead.email : customToEmail;
    if (!targetEmail) {
      toast({ title: 'Error', description: 'Please specify a recipient.', variant: 'destructive' });
      return;
    }

    if (!subject.trim() || !body.trim()) {
      toast({ title: 'Error', description: 'Subject and body cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      // 1. Process variables
      const firstName = selectedLead?.name ? selectedLead.name.split(' ')[0] : 'there';
      const company = selectedLead?.company ? selectedLead.company : 'your company';
      
      let processedBody = body
        .replace(/{first_name}/g, firstName)
        .replace(/{company}/g, company);
        
      let processedSubject = subject
        .replace(/{first_name}/g, firstName)
        .replace(/{company}/g, company);

      // 2. Append Signature
      if (selectedAccount.signature) {
        processedBody += `\n\n${selectedAccount.signature}`;
      } else {
        const senderName = selectedAccount.name || selectedAccount.email.split('@')[0];
        processedBody += `\n\nBest,\n${senderName}`;
      }

      // 3. Apply HTML Template
      const template = htmlTemplates.find(t => t.id === selectedHtmlTemplate) || htmlTemplates[0];
      const htmlBody = template.render(processedBody);

      // 4. Send via backend API
      const res = await api.post('/send-direct-email', {
        accountId: selectedAccount.id,
        to: targetEmail,
        subject: processedSubject,
        text: processedBody,
        html: htmlBody,
        attachments: attachments
      });

      if (res.status === 200) {
        toast({ title: 'Success', description: 'Email sent successfully!' });
        onClose();
      }
    } catch (err: any) {
      toast({ title: 'Send Failed', description: err.message || 'Could not send email', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background relative animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="h-14 flex items-center px-4 md:px-6 justify-between border-b border-white/5 bg-background sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/20 shrink-0">
            <Send size={14} className="text-primary" />
          </div>
          <span className="font-bold text-sm text-white">Compose Email</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSettingsExpanded(!settingsExpanded)} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all lg:hidden">
            <Settings size={16} />
          </button>
          <button onClick={onClose} className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Composer Area */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Account Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">From Account</label>
              <select 
                value={selectedAccountId} 
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="h-[46px] bg-black/40 border border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all appearance-none"
              >
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.email} {acc.name ? `(${acc.name})` : ''}</option>
                ))}
              </select>
            </div>

            {/* Lead Search */}
            <div className="flex flex-col gap-2 relative">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">To Recipient</label>
              {selectedLead ? (
                <div className="h-[46px] flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4">
                  <div className="flex flex-col justify-center">
                    <span className="text-sm font-bold text-primary leading-tight">{selectedLead.name || selectedLead.email}</span>
                    {selectedLead.company && <span className="text-[10px] text-primary/70 leading-tight">{selectedLead.company}</span>}
                  </div>
                  <button onClick={() => setSelectedLead(null)} className="p-1.5 hover:bg-primary/20 rounded-md text-primary transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative h-[46px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input 
                      type="text" 
                      value={leadSearch}
                      onChange={(e) => {
                        setLeadSearch(e.target.value);
                        setCustomToEmail(e.target.value);
                      }}
                      placeholder="Search leads or type email..."
                      className="w-full h-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all"
                    />
                  </div>
                  {leadSearch.length >= 2 && leadResults.length > 0 && !selectedLead && (
                    <div className="absolute top-[72px] left-0 right-0 z-10 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto custom-scrollbar">
                      {leadResults.map(lead => (
                        <div 
                          key={lead.id} 
                          onClick={() => { setSelectedLead(lead); setLeadSearch(''); }}
                          className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer flex flex-col"
                        >
                          <span className="text-sm font-bold text-white">{lead.name || lead.email}</span>
                          <span className="text-xs text-muted-foreground">{lead.email} {lead.company ? `• ${lead.company}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subject</label>
              <button onClick={generateRandomSubject} className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
                <Bot size={12} /> Generate
              </button>
            </div>
            <input 
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Keep it short & curious..."
              className="w-full h-[46px] bg-black/40 border border-white/10 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all"
            />
          </div>

          {/* Body */}
          <div className="flex flex-col gap-2 flex-1 min-h-[300px] mb-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Message Body</label>
              <button onClick={generateRandomBody} className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest">
                <Bot size={12} /> Generate
              </button>
            </div>
            <textarea 
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here... Use {first_name} and {company} as variables."
              className="w-full h-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all resize-none font-sans"
            />
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg">
                  <FileText size={14} className="text-primary" />
                  <span className="text-xs text-white max-w-[150px] truncate">{att.name}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-400">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Settings/Templates Column */}
        {settingsExpanded && (
          <div className="w-64 border-l border-white/5 bg-[#1a1a1a]/30 p-6 flex flex-col gap-8 overflow-y-auto shrink-0 animate-in slide-in-from-right-4 duration-200">
            
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">HTML Templates</span>
              <p className="text-[10px] text-muted-foreground/80 mb-2 leading-relaxed">Choose a visual wrapper for your message. Plain text is best for deliverability.</p>
              
              <div className="flex flex-col gap-2">
                {htmlTemplates.map(tmpl => (
                  <button 
                    key={tmpl.id}
                    onClick={() => setSelectedHtmlTemplate(tmpl.id)}
                    className={cn(
                      "px-4 py-3 rounded-xl border text-left text-sm transition-all flex items-center justify-between", 
                      selectedHtmlTemplate === tmpl.id 
                        ? "bg-primary/10 border-primary/30 text-primary shadow-[0_0_15px_rgba(139,92,246,0.1)]" 
                        : "bg-black/20 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10"
                    )}
                  >
                    <span className="font-bold text-[11px] uppercase tracking-wider">{tmpl.name}</span>
                    {selectedHtmlTemplate === tmpl.id && <ChevronRight size={14} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tools</span>
              
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-[11px] uppercase tracking-wider font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                <Paperclip size={14} /> Attach File
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              </label>

              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-[11px] uppercase tracking-wider font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                <ImageIcon size={14} /> Attach Image
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-2">
              <button 
                onClick={handleSend}
                disabled={isSending}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-black text-sm uppercase tracking-widest shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:bg-primary/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
              >
                {isSending ? 'Sending...' : 'Send Message'} <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

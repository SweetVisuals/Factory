import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EmailAccount } from '../types';
import { X, Paperclip, Send, Search, Image as ImageIcon, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { api } from '../lib/api/api';
import { cn } from '../lib/utils';
import { useToast } from './ui/use-toast';

interface Lead {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({ isOpen, onClose, accounts }) => {
  const { toast } = useToast();
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  
  // Lead Search State
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Custom To Email (if not a lead)
  const [customToEmail, setCustomToEmail] = useState('');

  // Email Content
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  
  // Templates
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [isSending, setIsSending] = useState(false);
  
  // Attachments (Base64)
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
      setIsSearching(true);
      const { data } = await supabase
        .from('leads')
        .select('id, name, email, company')
        .or(`email.ilike.%${leadSearch}%,name.ilike.%${leadSearch}%,company.ilike.%${leadSearch}%`)
        .limit(10);
      
      if (data) setLeadResults(data);
      setIsSearching(false);
    };

    const debounce = setTimeout(searchLeads, 300);
    return () => clearTimeout(debounce);
  }, [leadSearch]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);
  
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (templateId === 'quick_question') {
      setSubject('Quick question');
      setBody('Hi {first_name},\n\nJust came across {company} and was wondering how you currently handle your backend automation?\n\nI built a tool that saves teams around 10 hours a week on this. Would you be open to a quick chat to see if it makes sense for you?');
    } else if (templateId === 'value_add') {
      setSubject('Resource for {company}');
      setBody('Hi {first_name},\n\nNoticed {company} is growing fast. I put together a quick 1-pager on how similar companies are streamlining their operations to handle scale without adding headcount.\n\nHappy to send it over if you think it would be useful?');
    } else if (templateId === 'soft_bump') {
      setSubject(''); // leave existing subject or use a generic one
      setBody('Hi {first_name},\n\nJust bumping this to the top of your inbox. Let me know if you have any questions!');
    }
  };

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

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

      // Convert newlines to HTML breaks for proper rendering, but keep it clean
      const htmlBody = processedBody.replace(/\n/g, '<br/>');

      // 3. Send via backend API
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
        // Clear form
        setSelectedLead(null);
        setCustomToEmail('');
        setSubject('');
        setBody('');
        setAttachments([]);
      }
    } catch (err: any) {
      toast({ title: 'Send Failed', description: err.message || 'Could not send email', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-4xl max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1a1a1a]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Send size={16} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Compose Email</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          
          {/* Main Composer */}
          <div className="flex-1 flex flex-col p-6 overflow-y-auto custom-scrollbar">
            
            {/* Accounts & Leads */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              
              {/* Account Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">From Account</label>
                <select 
                  value={selectedAccountId} 
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all appearance-none"
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
                  <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-primary">{selectedLead.name || selectedLead.email}</span>
                      {selectedLead.company && <span className="text-[10px] text-primary/70">{selectedLead.company}</span>}
                    </div>
                    <button onClick={() => setSelectedLead(null)} className="p-1 hover:bg-primary/20 rounded-md text-primary transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                      <input 
                        type="text" 
                        value={leadSearch}
                        onChange={(e) => {
                          setLeadSearch(e.target.value);
                          setCustomToEmail(e.target.value);
                        }}
                        placeholder="Search leads or type email..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all"
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
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Subject</label>
              <input 
                type="text" 
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Keep it short & curious..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-2 flex-1 min-h-[250px] mb-4">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Message Body</label>
              <textarea 
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here... Use {first_name} and {company} as variables."
                className="w-full h-full bg-black/40 border border-white/10 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-all resize-none font-sans"
              />
            </div>

            {/* Signature Preview */}
            {selectedAccount?.signature && (
              <div className="mb-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Signature (Appended Automatically)</span>
                <div className="text-sm text-white/60 whitespace-pre-wrap font-sans">
                  {selectedAccount.signature}
                </div>
              </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-6">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg">
                    <FileText size={14} className="text-primary" />
                    <span className="text-xs text-white max-w-[150px] truncate">{att.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-red-400">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* Right Sidebar - Tools & Templates */}
          <div className="w-full md:w-64 bg-[#1a1a1a]/50 border-l border-white/5 p-6 flex flex-col gap-6 overflow-y-auto">
            
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Deliverability Templates</span>
              <p className="text-[10px] text-muted-foreground mb-2">Pre-formatted templates designed to avoid the junk folder by keeping HTML minimal.</p>
              
              <button 
                onClick={() => handleTemplateSelect('quick_question')}
                className={cn("px-4 py-3 rounded-xl border text-left text-sm transition-all flex flex-col gap-1", selectedTemplate === 'quick_question' ? "bg-primary/10 border-primary text-primary" : "bg-black/20 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10")}
              >
                <span className="font-bold">1. Quick Question</span>
                <span className="text-[10px] opacity-70">Short, plain-text style opener.</span>
              </button>

              <button 
                onClick={() => handleTemplateSelect('value_add')}
                className={cn("px-4 py-3 rounded-xl border text-left text-sm transition-all flex flex-col gap-1", selectedTemplate === 'value_add' ? "bg-primary/10 border-primary text-primary" : "bg-black/20 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10")}
              >
                <span className="font-bold">2. Value Add</span>
                <span className="text-[10px] opacity-70">Offer a specific resource.</span>
              </button>

              <button 
                onClick={() => handleTemplateSelect('soft_bump')}
                className={cn("px-4 py-3 rounded-xl border text-left text-sm transition-all flex flex-col gap-1", selectedTemplate === 'soft_bump' ? "bg-primary/10 border-primary text-primary" : "bg-black/20 border-white/5 text-white/70 hover:bg-white/5 hover:border-white/10")}
              >
                <span className="font-bold">3. Soft Bump</span>
                <span className="text-[10px] opacity-70">2-sentence follow-up.</span>
              </button>
            </div>

            <div className="flex flex-col gap-3 mt-4">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tools</span>
              
              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                <Paperclip size={16} /> Attach File
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              </label>

              <label className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm font-bold text-white/70 hover:bg-white/5 hover:text-white transition-all cursor-pointer">
                <ImageIcon size={16} /> Attach Image
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="mt-auto pt-6 flex flex-col gap-2">
              <button 
                onClick={handleSend}
                disabled={isSending}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isSending ? 'Sending...' : 'Send Message'} <Send size={16} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { EmailAccount } from '../types';
import { X, Paperclip, Send, Search, Image as ImageIcon, FileText, Bot, Settings, Minimize2, Maximize2, Minus, ChevronUp, ChevronDown, Edit3 } from 'lucide-react';
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

interface ComposeDockProps {
  onClose: () => void;
  accounts: EmailAccount[];
  isOpen: boolean;
}

export const ComposeDock: React.FC<ComposeDockProps> = ({ onClose, accounts, isOpen }) => {
  const { toast } = useToast();
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Lead Search State
  const [leadSearch, setLeadSearch] = useState('');
  const [leadResults, setLeadResults] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Custom To Email (if not a lead)
  const [customToEmail, setCustomToEmail] = useState('');

  // Email Content
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('<div><br/></div>');
  const editorRef = useRef<HTMLDivElement>(null);
  
  // Templates
  const [selectedHtmlTemplate, setSelectedHtmlTemplate] = useState('plain');
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);

  const [isSending, setIsSending] = useState(false);
  
  // Attachments
  const [attachments, setAttachments] = useState<{name: string, content: string, type: string}[]>([]);
  const [showSignatureDropdown, setShowSignatureDropdown] = useState(false);
  const [showFromDropdown, setShowFromDropdown] = useState(false);

  const getSignatureHtml = (sig: any) => {
    if (!sig) return '';
    const textHtml = sig.content.replace(/\n/g, '<br/>');
    const imgHtml = sig.imageUrl ? `<img src="${sig.imageUrl}" alt="Signature Logo" style="max-width: 100%; display: block; margin-top: 6px;" />` : '';
    return `<div class="composer-signature-block" style="margin-top: 16px; line-height: 1.5;">${textHtml}${imgHtml}</div>`;
  };

  const injectSignature = (sig: any) => {
    if (!editorRef.current) return;
    
    let currentHtml = editorRef.current.innerHTML;
    
    // Remove existing signature block
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentHtml, 'text/html');
    const existingSig = doc.querySelector('.composer-signature-block');
    if (existingSig) {
      existingSig.remove();
    }
    
    let cleanBody = doc.body.innerHTML.trim();
    // Trim trailing linebreaks or spacing at the end of text
    cleanBody = cleanBody.replace(/(?:<br\s*\/?>|\s)+$/, '');
    if (cleanBody === '') {
      cleanBody = '<div><br/></div>';
    }
    
    const sigHtml = getSignatureHtml(sig);
    const finalHtml = `${cleanBody}<br/>${sigHtml}`;
    
    setHtmlContent(finalHtml);
    editorRef.current.innerHTML = finalHtml;
    editorRef.current.focus();
  };

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Inject signature when account changes
  useEffect(() => {
    const acc = accounts.find(a => a.id === selectedAccountId);
    if (acc) {
      let defaultSig = null;
      if (acc.signatures && Array.isArray(acc.signatures)) {
        defaultSig = acc.signatures.find(s => s.isDefault) || acc.signatures[0];
      }

      let sigHtml = '';
      if (defaultSig) {
        sigHtml = getSignatureHtml(defaultSig);
      } else {
        const rawSig = acc.signature || `Best,<br/>${acc.name || acc.email.split('@')[0]}`;
        const legacySig = rawSig
          .replace(/max-height:\s*(?:50|30)px/gi, 'max-height: 200px')
          .replace(/height:\s*(?:50|30)px/gi, 'height: 200px');
        sigHtml = `<div class="composer-signature-block" style="margin-top: 16px; line-height: 1.5;">${legacySig}</div>`;
      }

      const newHtml = `<div><br/></div><br/>${sigHtml}`;
      setHtmlContent(newHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = newHtml;
      }
    }
  }, [selectedAccountId, accounts]);

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
    const acc = accounts.find(a => a.id === selectedAccountId);
    const rawSig = acc?.signature || `<br/>Best,<br/>${acc?.name || acc?.email.split('@')[0]}`;
    const sig = rawSig
      .replace(/max-height:\s*(?:50|30)px/gi, 'max-height: 200px')
      .replace(/height:\s*(?:50|30)px/gi, 'height: 200px');
    
    const formattedBody = randomBody.replace(/\n/g, '<br/>');
    const newHtml = `<div>${formattedBody}</div><div style="margin-top: 16px; color: #888;">--<br/>${sig}</div>`;
    
    setHtmlContent(newHtml);
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml;
    }
  };

  const execFormat = (command: string) => {
    document.execCommand(command, false, '');
    if (editorRef.current) {
      editorRef.current.focus();
    }
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

    if (!subject.trim()) {
      toast({ title: 'Error', description: 'Subject cannot be empty.', variant: 'destructive' });
      return;
    }

    setIsSending(true);

    try {
      // 1. Process variables in subject and body
      const firstName = selectedLead?.name ? selectedLead.name.split(' ')[0] : 'there';
      const company = selectedLead?.company ? selectedLead.company : 'your company';
      
      let finalHtml = htmlContent
        .replace(/{first_name}/g, firstName)
        .replace(/{company}/g, company);
        
      let processedSubject = subject
        .replace(/{first_name}/g, firstName)
        .replace(/{company}/g, company);

      // 2. Apply HTML Template Wrapper
      const template = htmlTemplates.find(t => t.id === selectedHtmlTemplate) || htmlTemplates[0];
      const htmlBody = template.render(finalHtml);
      
      // We will send the plain text version too by stripping HTML tags
      const plainText = finalHtml.replace(/<br\s*[\/]?>/gi, '\n').replace(/<\/?[^>]+(>|$)/g, "");

      // 3. Send via backend API
      const res = await api.post('/send-direct-email', {
        accountId: selectedAccount.id,
        to: targetEmail,
        subject: processedSubject,
        text: plainText,
        html: htmlBody,
        attachments: attachments
      });

      if (res.status === 200) {
        toast({ title: 'Success', description: 'Email sent successfully!' });
        onClose();
        // Reset state
        setSubject('');
        setHtmlContent('<div><br/></div>');
        if (editorRef.current) editorRef.current.innerHTML = '<div><br/></div>';
        setSelectedLead(null);
        setCustomToEmail('');
        setLeadSearch('');
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
    <div 
      className={cn(
        "fixed z-[200] bg-[#1e1e1e] border border-white/10 rounded-t-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        isMaximized 
          ? "bottom-0 right-0 left-0 top-0 sm:right-[5%] sm:left-[5%] sm:top-[10vh] md:right-24 md:left-24 rounded-b-none" 
          : "bottom-0 right-0 left-0 sm:left-auto w-full sm:w-[500px] sm:right-24",
        isMinimized ? "h-12" : isMaximized ? "h-full sm:h-[90vh]" : "h-[500px]"
      )}
    >
      {/* Header */}
      <div 
        className="h-12 bg-[#2a2a2a] flex items-center justify-between px-4 cursor-pointer shrink-0"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-white">New Message</span>
        </div>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <Minus size={14} />
          </button>
          <button onClick={() => setIsMaximized(!isMaximized)} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0 bg-background relative">
          
          {/* To Field */}
          <div className="px-4 py-2 border-b border-white/5 flex items-center relative gap-2 shrink-0">
            <span className="text-sm text-white/50 w-8">To</span>
            
            {selectedLead ? (
              <div className="flex-1 flex items-center gap-2">
                <div className="bg-primary/20 border border-primary/30 rounded px-2 py-0.5 flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">{selectedLead.name || selectedLead.email}</span>
                  <button onClick={() => setSelectedLead(null)} className="text-primary hover:text-white">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setCustomToEmail(e.target.value);
                  }}
                  placeholder="Recipients"
                  className="w-full bg-transparent text-sm focus:outline-none text-white h-7"
                />
                {leadSearch.length >= 2 && leadResults.length > 0 && !selectedLead && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-[#2a2a2a] border border-white/10 rounded shadow-xl max-h-48 overflow-y-auto">
                    {leadResults.map(lead => (
                      <div 
                        key={lead.id} 
                        onClick={() => { setSelectedLead(lead); setLeadSearch(''); }}
                        className="px-3 py-2 border-b border-white/5 hover:bg-white/10 cursor-pointer flex justify-between items-center"
                      >
                        <span className="text-sm font-medium text-white">{lead.name || lead.email}</span>
                        {lead.company && <span className="text-xs text-white/40">{lead.company}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subject Field */}
          <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2 shrink-0 group">
            <input 
              type="text" 
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 bg-transparent text-sm focus:outline-none text-white h-7 placeholder:text-white/50 font-medium"
            />
            <button 
              onClick={generateRandomSubject} 
              title="Generate AI Subject"
              className="text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110"
            >
              <Bot size={16} />
            </button>
          </div>

          {/* Rich Text Editor */}
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative group">
            <button 
              onClick={generateRandomBody} 
              title="Generate AI Message Body"
              className="absolute top-4 right-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 z-10 bg-black/50 p-2 rounded-full border border-primary/20 backdrop-blur"
            >
              <Bot size={16} />
            </button>

            {/* If a template is selected, we inject some CSS variables to preview it roughly */}
            <div 
              ref={editorRef}
              contentEditable
              onInput={(e) => setHtmlContent(e.currentTarget.innerHTML)}
              className={cn(
                "w-full h-full min-h-[200px] outline-none text-sm leading-relaxed",
                selectedHtmlTemplate === 'minimal' ? "font-sans max-w-[600px] mx-auto text-white/90" : 
                selectedHtmlTemplate === 'bold' ? "font-sans max-w-[600px] mx-auto bg-[#111] p-4 rounded-lg border border-white/10" :
                "font-sans text-white"
              )}
            />
          </div>

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 flex flex-wrap gap-2 shrink-0 bg-[#222]">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 bg-black/40 border border-white/10 px-2 py-1 rounded">
                  <FileText size={12} className="text-white/60" />
                  <span className="text-[11px] text-white/80 max-w-[100px] truncate">{att.name}</span>
                  <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-white/40 hover:text-red-400">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Toolbar */}
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between bg-[#1e1e1e] shrink-0">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSend}
                disabled={isSending}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-sm transition-all disabled:opacity-50"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>

              <div className="flex items-center gap-1 border-l border-white/10 pl-4">
                <button onClick={() => execFormat('bold')} className="p-1.5 text-white/60 hover:bg-white/10 rounded font-bold transition-colors">B</button>
                <button onClick={() => execFormat('italic')} className="p-1.5 text-white/60 hover:bg-white/10 rounded italic transition-colors">I</button>
                <button onClick={() => execFormat('underline')} className="p-1.5 text-white/60 hover:bg-white/10 rounded underline transition-colors">U</button>
              </div>

              <div className="flex items-center gap-1 border-l border-white/10 pl-4 relative">
                <label className="p-1.5 text-white/60 hover:bg-white/10 rounded cursor-pointer transition-colors" title="Attach Files">
                  <Paperclip size={16} />
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>
                <label className="p-1.5 text-white/60 hover:bg-white/10 rounded cursor-pointer transition-colors" title="Insert Image">
                  <ImageIcon size={16} />
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileUpload} />
                </label>
                
                {/* Signatures Selection */}
                <div className="relative inline-block">
                  <button 
                    onClick={() => setShowSignatureDropdown(!showSignatureDropdown)}
                    type="button"
                    className="p-1.5 text-white/60 hover:bg-white/10 rounded transition-colors"
                    title="Insert Signature"
                  >
                    <Edit3 size={16} />
                  </button>
                  {showSignatureDropdown && selectedAccount && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                      <div className="px-3 py-2 border-b border-white/5 bg-[#1a1a1a]">
                        <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Select Signature</span>
                      </div>
                      {selectedAccount.signatures && selectedAccount.signatures.length > 0 ? (
                        selectedAccount.signatures.map(sig => (
                          <button
                            key={sig.id}
                            type="button"
                            onClick={() => { injectSignature(sig); setShowSignatureDropdown(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-white transition-colors hover:bg-white/5 flex items-center justify-between"
                          >
                            <span className="truncate">{sig.name}</span>
                            {sig.isDefault && <span className="text-[8px] text-primary uppercase font-bold">Def</span>}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-white/40 italic">
                          No custom signatures
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 relative">
              <span className="text-xs text-white/40">From:</span>
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setShowFromDropdown(!showFromDropdown)}
                  className="bg-black/20 border border-white/5 px-2.5 py-1 rounded-lg text-xs text-white/70 hover:text-white transition-colors flex items-center gap-1 min-w-[110px] justify-between"
                >
                  <span className="truncate max-w-[90px]">{selectedAccount?.email || 'Select Account'}</span>
                  <ChevronDown size={12} className="opacity-50" />
                </button>
                {showFromDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-56 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                    <div className="px-3 py-2 border-b border-white/5 bg-[#1a1a1a]">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Send Email As</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar">
                      {accounts.map(acc => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => { setSelectedAccountId(acc.id); setShowFromDropdown(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5 flex items-center justify-between",
                            selectedAccountId === acc.id ? "bg-primary/10 text-primary font-bold" : "text-white"
                          )}
                        >
                          <span className="truncate">{acc.email}</span>
                          {acc.status === 'active' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-l border-white/10 pl-2 ml-1">
                <button 
                  onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                  className="p-1.5 text-primary hover:bg-primary/20 rounded transition-colors"
                  title="HTML Templates"
                >
                  <Settings size={16} />
                </button>

                {showTemplateDropdown && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 bg-[#2a2a2a] border border-white/10 rounded-lg shadow-xl overflow-hidden z-20">
                    <div className="px-3 py-2 border-b border-white/5 bg-[#1a1a1a]">
                      <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Select Template</span>
                    </div>
                    {htmlTemplates.map(tmpl => (
                      <button
                        key={tmpl.id}
                        onClick={() => { setSelectedHtmlTemplate(tmpl.id); setShowTemplateDropdown(false); }}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs transition-colors hover:bg-white/5",
                          selectedHtmlTemplate === tmpl.id ? "bg-primary/10 text-primary font-medium" : "text-white"
                        )}
                      >
                        {tmpl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

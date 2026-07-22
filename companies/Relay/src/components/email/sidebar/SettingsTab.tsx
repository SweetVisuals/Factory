import React, { useState, useEffect, useRef } from 'react';
import { User, Send, Activity, Trash2, Plus, CheckCircle, Image as ImageIcon, Sparkles, UploadCloud, Link as LinkIcon, X } from 'lucide-react';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { EmailAccount } from '../../../types';
import { updateEmailAccount } from '../../../lib/api/email-accounts';
import { useToast } from '../../ui/use-toast';
import { cn } from '../../../lib/utils';

interface SettingsTabProps {
  account: EmailAccount;
  onUpdate?: (account: EmailAccount) => void;
}

interface SignatureItem {
  id: string;
  name: string;
  content: string;
  imageUrl?: string | null;
  isDefault?: boolean;
}

const SettingsTab = ({ account, onUpdate }: SettingsTabProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  
  // State for new signature form
  const [isAddingSig, setIsAddingSig] = useState(false);
  const [newSigName, setNewSigName] = useState('');
  const [newSigContent, setNewSigContent] = useState('');
  const [newSigImageUrl, setNewSigImageUrl] = useState('');
  const [sigImageMode, setSigImageMode] = useState<'upload' | 'url'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with account signatures
  useEffect(() => {
    if (account.signatures && Array.isArray(account.signatures)) {
      setSignatures(account.signatures);
    } else if (account.signature) {
      // Seed default signature if legacy exists
      const initialSig: SignatureItem = {
        id: 'legacy-default',
        name: 'Default Signature',
        content: account.signature,
        imageUrl: null,
        isDefault: true
      };
      setSignatures([initialSig]);
      // Silently save it back to JSON
      handleUpdate('signatures', [initialSig], true);
    } else {
      setSignatures([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id, account.signatures]);

  const handleUpdate = async (field: keyof EmailAccount, value: any, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const updated = await updateEmailAccount(account.id, { [field]: value });
      onUpdate?.(updated);
      if (!silent) {
        toast({
          title: 'Success',
          description: 'Settings updated successfully',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update settings',
        variant: 'destructive',
      });
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleSaveSignatures = async (updatedSigs: SignatureItem[]) => {
    setSignatures(updatedSigs);
    
    // Find default signature to format into legacy signature column for automated sends
    const defaultSig = updatedSigs.find(s => s.isDefault) || updatedSigs[0];
    let legacySigHtml = '';
    if (defaultSig) {
      const textHtml = defaultSig.content.replace(/\n/g, '<br/>');
      const imgHtml = defaultSig.imageUrl ? `<br/><img src="${defaultSig.imageUrl}" alt="Signature Logo" style="max-height: 50px; object-fit: contain; display: block; margin-top: 6px;" />` : '';
      legacySigHtml = `${textHtml}${imgHtml}`;
    }

    try {
      setLoading(true);
      const updated = await updateEmailAccount(account.id, {
        signatures: updatedSigs,
        signature: legacySigHtml
      });
      onUpdate?.(updated);
      toast({
        title: 'Success',
        description: 'Signatures updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save signature changes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!account.warmup_filter_tag) {
      const newTag = Math.random().toString(36).substring(2, 10).toUpperCase();
      handleUpdate('warmup_filter_tag', newTag, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.warmup_filter_tag]);

  // Image File Processor
  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid File', description: 'Please upload an image file (PNG, JPG, SVG, GIF)', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: 'Image size should be under 2MB for fast email loading', variant: 'destructive' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setNewSigImageUrl(e.target.result as string);
        toast({ title: 'Image Uploaded', description: 'Logo attached to signature template' });
      }
    };
    reader.readAsDataURL(file);
  };

  // Signatures Logic
  const handleAddSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSigName.trim() || !newSigContent.trim()) {
      toast({ title: 'Error', description: 'Name and content are required', variant: 'destructive' });
      return;
    }

    const isFirstSig = signatures.length === 0;

    const newSig: SignatureItem = {
      id: crypto.randomUUID(),
      name: newSigName.trim(),
      content: newSigContent.trim(),
      imageUrl: newSigImageUrl.trim() || null,
      isDefault: isFirstSig
    };

    let updatedSigs = [...signatures];
    if (isFirstSig) {
      updatedSigs = [newSig];
    } else {
      updatedSigs = [...signatures, newSig];
    }

    await handleSaveSignatures(updatedSigs);
    
    // Reset form
    setNewSigName('');
    setNewSigContent('');
    setNewSigImageUrl('');
    setIsAddingSig(false);
  };

  const handleDeleteSignature = async (id: string) => {
    let updatedSigs = signatures.filter(sig => sig.id !== id);
    // If we deleted the default signature, set the first remaining one as default
    if (signatures.find(sig => sig.id === id)?.isDefault && updatedSigs.length > 0) {
      updatedSigs[0] = { ...updatedSigs[0], isDefault: true };
    }
    await handleSaveSignatures(updatedSigs);
  };

  const handleSetDefaultSignature = async (id: string) => {
    const updatedSigs = signatures.map(sig => ({
      ...sig,
      isDefault: sig.id === id
    }));
    await handleSaveSignatures(updatedSigs);
  };

  return (
    <div className="space-y-5 p-4">
      
      {/* Sender Details */}
      <section className="space-y-3">
        <div className="flex items-center space-x-3">
          <User className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Sender Details</h3>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium text-white/70">Sender Name</Label>
          <Input
            id="name"
            type="text"
            defaultValue={account.name}
            disabled={loading}
            className="focus-visible:ring-primary bg-black/40 border-white/10 text-white rounded-xl"
            onBlur={(e) => {
              if (e.target.value !== account.name) {
                handleUpdate('name', e.target.value);
              }
            }}
          />
        </div>
      </section>

      {/* Campaign Settings */}
      <section className="space-y-3">
        <div className="flex items-center space-x-3">
          <Send className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Campaign Settings</h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dailyLimit" className="text-sm font-medium text-white/77">Daily campaign limit</Label>
            <div className="flex items-center gap-3">
              <Input
                id="dailyLimit"
                type="number"
                defaultValue={account.daily_limit || 100}
                className="w-24 focus-visible:ring-primary bg-black/40 border-white/10 text-white rounded-xl"
                disabled={loading}
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== (account.daily_limit || 100)) {
                    handleUpdate('daily_limit', val);
                  }
                }}
              />
              <span className="text-xs text-white/40 font-medium">emails per day</span>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Manager */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white">Signature Manager</h3>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingSig(!isAddingSig)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-xl text-xs font-bold text-white uppercase tracking-wider transition-all"
          >
            {isAddingSig ? 'Cancel' : <><Plus size={14} /> Add New</>}
          </button>
        </div>

        {/* Add Signature Form */}
        {isAddingSig && (
          <form onSubmit={handleAddSignature} className="bg-white/[0.02] border border-white/10 p-4 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-white/60">Signature Name</Label>
              <Input
                type="text"
                required
                value={newSigName}
                onChange={(e) => setNewSigName(e.target.value)}
                placeholder="e.g. Executive Signature"
                className="bg-black/40 border-white/10 text-white rounded-xl text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-white/60">Content / Text Body</Label>
              <Textarea
                required
                value={newSigContent}
                onChange={(e) => setNewSigContent(e.target.value)}
                placeholder="Best regards,&#10;John Doe&#10;Head of Partnerships | Company Inc."
                className="min-h-[80px] bg-black/40 border-white/10 text-white rounded-xl text-xs"
              />
            </div>

            {/* Logo/Image Section with Drag & Drop and URL Mode Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-white/60">Signature Image / Logo</Label>
                
                {/* Mode Toggle */}
                <div className="flex items-center p-0.5 bg-black/40 border border-white/10 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSigImageMode('upload')}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                      sigImageMode === 'upload'
                        ? "bg-primary text-white shadow-sm"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    <UploadCloud size={11} />
                    Drag & Drop
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigImageMode('url')}
                    className={cn(
                      "flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md transition-all",
                      sigImageMode === 'url'
                        ? "bg-primary text-white shadow-sm"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    <LinkIcon size={11} />
                    Image URL
                  </button>
                </div>
              </div>

              {sigImageMode === 'upload' ? (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processImageFile(file);
                    }}
                  />
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) processImageFile(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2",
                      isDragging 
                        ? "border-primary bg-primary/10" 
                        : "border-white/10 hover:border-white/20 bg-black/30 hover:bg-black/40"
                    )}
                  >
                    <UploadCloud className={cn("w-6 h-6", isDragging ? "text-primary animate-bounce" : "text-white/40")} />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-white/80">
                        Drag & drop logo image here, or <span className="text-primary underline">browse</span>
                      </p>
                      <p className="text-[10px] text-white/40">Supports PNG, JPG, SVG, GIF (max 2MB)</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Input
                  type="text"
                  value={newSigImageUrl}
                  onChange={(e) => setNewSigImageUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                  className="bg-black/40 border-white/10 text-white rounded-xl text-xs"
                />
              )}

              {/* Image Preview & Clear */}
              {newSigImageUrl && (
                <div className="mt-2 p-2 border border-white/10 rounded-xl bg-black/50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] text-white/40 uppercase font-black shrink-0">Preview:</span>
                    <img
                      src={newSigImageUrl}
                      alt="Signature Preview"
                      className="max-h-10 max-w-[120px] object-contain rounded border border-white/5 bg-white/5 p-1"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewSigImageUrl('')}
                    className="p-1 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Remove Image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-white hover:bg-primary/90 font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)]"
            >
              Save Signature
            </button>
          </form>
        )}

        {/* Existing Signatures List */}
        <div className="space-y-3">
          {signatures.length === 0 ? (
            <div className="p-4 border border-dashed border-white/10 rounded-2xl text-center bg-white/[0.01]">
              <p className="text-xs text-white/40">No signatures configured yet.</p>
            </div>
          ) : (
            signatures.map((sig) => (
              <div 
                key={sig.id}
                className={cn(
                  "p-4 border rounded-2xl transition-all bg-white/[0.01]",
                  sig.isDefault ? "border-primary/50 bg-primary/[0.03] shadow-[0_0_15px_rgba(139,92,246,0.1)]" : "border-white/5 hover:border-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white truncate">{sig.name}</span>
                      {sig.isDefault && (
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-[8px] font-black text-primary uppercase tracking-widest">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/50 mt-1 whitespace-pre-wrap truncate max-h-[60px]">{sig.content}</p>
                    {sig.imageUrl && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Logo:</span>
                        <img 
                          src={sig.imageUrl} 
                          alt="Signature Logo" 
                          className="max-h-7 object-contain rounded border border-white/10 bg-white/5 p-0.5" 
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!sig.isDefault ? (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultSignature(sig.id)}
                        className="px-2 py-1 bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/30 text-white/60 hover:text-primary rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                        title="Set as Account Default Signature"
                      >
                        <CheckCircle size={12} />
                        Set Default
                      </button>
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[10px] font-bold text-primary">
                        <CheckCircle size={12} />
                        Active Default
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteSignature(sig.id)}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Delete Signature"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Warmup Limits */}
      <section className="space-y-3">
        <div className="flex items-center space-x-3">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Warmup Settings</h3>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="filterTag" className="text-sm font-medium text-white/70">Warmup filter tag</Label>
            <Input
              id="filterTag"
              type="text"
              value={account.warmup_filter_tag || 'Not Set'}
              disabled={true}
              className="bg-white/5 text-white/30 border-white/5 cursor-not-allowed rounded-xl"
              readOnly
            />
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="increasePerDay" className="text-sm font-medium text-white/70">Increase per day</Label>
              <Input
                id="increasePerDay"
                type="number"
                defaultValue={account.warmup_increase_per_day}
                min="1"
                max="10"
                disabled={loading}
                className="focus-visible:ring-primary bg-black/40 border-white/10 text-white rounded-xl"
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== account.warmup_increase_per_day) {
                    handleUpdate('warmup_increase_per_day', val);
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyWarmupLimit" className="text-sm font-medium text-white/70">Daily warmup limit (Max)</Label>
              <Input
                id="dailyWarmupLimit"
                type="number"
                defaultValue={account.warmup_daily_limit}
                disabled={loading}
                className="focus-visible:ring-primary bg-black/40 border-white/10 text-white rounded-xl"
                onBlur={(e) => {
                  const val = parseInt(e.target.value);
                  if (val !== account.warmup_daily_limit) {
                    handleUpdate('warmup_daily_limit', val);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsTab;

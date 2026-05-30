"use client";

import React, { useState, useRef } from "react";
import { X, Plus, Upload, AlertCircle, Check, Link, Clipboard, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { imageService } from "@/lib/imageService";
import { UploadedImage } from "@/types";
import { cn } from "@/lib/utils";

interface UrlUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onImagesUploaded: (images: UploadedImage[]) => void;
  currentFolderId?: string | null;
}

interface UrlInput {
  id: string;
  url: string;
  filename: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress?: number;
}

export const UrlUploader: React.FC<UrlUploaderProps> = ({
  isOpen,
  onClose,
  onImagesUploaded,
  currentFolderId
}) => {
  const [urlInputs, setUrlInputs] = useState<UrlInput[]>([
    { id: '1', url: '', filename: '', status: 'pending' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [globalProgress, setGlobalProgress] = useState(0);

  const addUrlInput = () => {
    const newId = Math.random().toString(36).substr(2, 9);
    setUrlInputs([...urlInputs, { id: newId, url: '', filename: '', status: 'pending' }]);
  };

  const removeUrlInput = (id: string) => {
    if (urlInputs.length > 1) {
      setUrlInputs(urlInputs.filter(input => input.id !== id));
    }
  };

  const updateUrlInput = (id: string, field: 'url' | 'filename', value: string) => {
    setUrlInputs(urlInputs.map(input => {
      if (input.id === id) {
        const updated = { ...input, [field]: value };
        
        if (field === 'url' && value && !updated.filename) {
          try {
            const url = new URL(value);
            const pathname = url.pathname;
            const fileName = pathname.split('/').pop() || 'image';
            const cleanFileName = fileName.split('?')[0].split('#')[0];
            updated.filename = cleanFileName || 'image';
          } catch { }
        }
        
        if (field === 'url' && value.trim()) {
          const isLastInput = id === urlInputs[urlInputs.length - 1].id;
          if (isLastInput) {
            const newId = Math.random().toString(36).substr(2, 9);
            setUrlInputs(prev => [...prev, { id: newId, url: '', filename: '', status: 'pending' }]);
          }
        }
        
        return updated;
      }
      return input;
    }));
  };

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const downloadImageFromUrl = async (url: string, filename: string): Promise<File> => {
    try {
      // Method 1: Use server-side proxy
      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          const blob = await response.blob();
          return new File([blob], filename, { type: blob.type });
        }
      }
      
      // Method 2: Direct fetch fallback
      const directResponse = await fetch(url, { mode: 'cors' }).catch(() => null);
      if (directResponse && directResponse.ok) {
        const blob = await directResponse.blob();
        return new File([blob], filename, { type: blob.type || 'image/jpeg' });
      }

      throw new Error(`Unable to access image at ${url}`);
    } catch (error) {
      throw error;
    }
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error('Failed to detect dimensions'));
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadFromUrl = async (urlInput: UrlInput): Promise<UploadedImage> => {
    try {
      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id ? { ...input, status: 'uploading', progress: 10 } : input
      ));

      const file = await downloadImageFromUrl(urlInput.url, urlInput.filename || 'image');
      const dimensions = await getImageDimensions(file);

      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id ? { ...input, progress: 50 } : input
      ));

      const uploadedImage = await imageService.uploadImage(file, currentFolderId || undefined);

      setUrlInputs(prev => prev.map(input => 
        input.id === urlInput.id ? { ...input, status: 'success', progress: 100 } : input
      ));

      return uploadedImage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUrlInputs(prev => prev.map(input =>
        input.id === urlInput.id ? { ...input, status: 'error', error: errorMessage, progress: 0 } : input
      ));
      throw error;
    }
  };

  const handleUpload = async () => {
    const validInputs = urlInputs.filter(input => input.url.trim() && input.status !== 'success');
    
    if (validInputs.length === 0) {
      toast.error('No new URLs to upload');
      return;
    }

    const invalidUrls = validInputs.filter(input => !validateUrl(input.url));
    if (invalidUrls.length > 0) {
      toast.error('Invalid URLs found');
      return;
    }

    setIsUploading(true);
    setGlobalProgress(0);
    const uploadedImages: UploadedImage[] = [];
    let completed = 0;

    try {
      const uploadPromises = validInputs.map(async (input) => {
        try {
          const uploadedImage = await uploadFromUrl(input);
          uploadedImages.push(uploadedImage);
        } catch (error) {
          console.error('Upload failed for URL:', input.url);
        } finally {
          completed++;
          setGlobalProgress((completed / validInputs.length) * 100);
        }
      });

      await Promise.all(uploadPromises);

      if (uploadedImages.length > 0) {
        onImagesUploaded(uploadedImages);
        toast.success(`Uploaded ${uploadedImages.length} images!`);
        setTimeout(() => {
          onClose();
          setUrlInputs([{ id: '1', url: '', filename: '', status: 'pending' }]);
        }, 1000);
      }
    } catch (error) {
      toast.error('Upload process failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-zinc-950/80 backdrop-blur-3xl border border-white/5 rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white flex items-center">
              <Link className="w-6 h-6 mr-3 text-primary" />
              Import from URL
            </h2>
            <p className="text-sm text-white/40">
              Bulk paste image links to build your library instantly
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Progress Bar */}
        <AnimatePresence>
          {isUploading && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-8 mb-6"
            >
              <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-primary to-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${globalProgress}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[10px] uppercase tracking-widest font-bold text-white/40">
                <span>Uploading...</span>
                <span>{Math.round(globalProgress)}%</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
          {/* Bulk Paste Area */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Quick Paste</h4>
              <button 
                onClick={() => setBulkPasteText('')}
                className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                CLEAR
              </button>
            </div>
            <div className="relative group">
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="Paste list of URLs here..."
                className="w-full h-32 px-4 py-3 bg-white/5 rounded-2xl text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all border-none resize-none"
              />
              <button
                onClick={() => {
                  const urls = bulkPasteText.match(/https?:\/\/[^\s<>"'()]+/g) || [];
                  if (urls.length > 0) {
                    const newInputs = urls.map((url, i) => ({
                      id: Math.random().toString(36).substr(2, 9),
                      url,
                      filename: url.split('/').pop()?.split('?')[0] || `image_${i}`,
                      status: 'pending' as const
                    }));
                    setUrlInputs(newInputs);
                    setBulkPasteText('');
                    toast.success(`Found ${urls.length} URLs`);
                  }
                }}
                className="absolute bottom-4 right-4 px-4 py-2 bg-primary/20 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all"
              >
                Extract URLs
              </button>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Individual Inputs */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40">Manual Entry</h4>
            <div className="space-y-3">
              {urlInputs.map((input) => (
                <motion.div
                  layout
                  key={input.id}
                  className={cn(
                    "group relative flex items-center space-x-3 p-2 pl-4 rounded-2xl transition-all",
                    input.status === 'error' ? "bg-destructive/10" : "bg-white/5 hover:bg-white/10"
                  )}
                >
                  <Link className={cn(
                    "w-4 h-4",
                    input.status === 'success' ? "text-emerald-500" : "text-white/20"
                  )} />
                  
                  <input
                    type="text"
                    value={input.url}
                    onChange={(e) => updateUrlInput(input.id, 'url', e.target.value)}
                    placeholder="Image URL"
                    className="flex-1 bg-transparent border-none text-sm text-white placeholder-white/10 focus:outline-none h-10"
                    disabled={isUploading}
                  />

                  {input.status === 'uploading' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                  ) : input.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2" />
                  ) : (
                    <button
                      onClick={() => removeUrlInput(input.id)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-white/20 hover:text-destructive transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
              
              <button
                onClick={addUrlInput}
                className="w-full py-4 border-2 border-dashed border-white/5 hover:border-primary/20 hover:bg-primary/5 rounded-2xl text-white/20 hover:text-primary transition-all flex items-center justify-center space-x-2 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another URL</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-black/40 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
              {urlInputs.filter(i => i.url.trim()).length} links ready
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="px-6 py-3 text-sm font-bold text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !urlInputs.some(i => i.url.trim() && i.status !== 'success')}
              className="px-8 py-6 rounded-2xl bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-lg shadow-primary/20"
            >
              {isUploading ? 'Uploading...' : 'Import All'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

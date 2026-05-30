import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, CheckSquare, Square, Trash2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadedImage, SlideshowTemplate, TemplateApplicationResult } from '../../types';
import { uploadToFreeImage, getImageDimensions } from '../../lib/freeimage';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ImageUploaderProps {
  onImagesUploaded: (images: UploadedImage[]) => void;
  images: UploadedImage[];
  selectedImages?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onTemplateApplied?: (result: TemplateApplicationResult) => void;
  availableTemplates?: SlideshowTemplate[];
  onApplyTemplateToBulk?: (templateId: string, images: UploadedImage[]) => Promise<void>;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImagesUploaded,
  images,
  selectedImages = [],
  onSelectionChange,
  onTemplateApplied,
  availableTemplates = [],
  onApplyTemplateToBulk,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStats, setUploadStats] = useState({ completed: 0, total: 0 });
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file =>
      file.type.startsWith('image/')
    );
    
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    if (!user) {
      setUploadError('You must be logged in to upload images');
      return;
    }

    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    setUploadStats({ completed: 0, total: files.length });

    try {
      let completedCount = 0;
      const results: UploadedImage[] = [];

      // We'll process uploads in small batches or sequentially to give better progress feedback
      // Using Promise.all but updating progress as each finishes
      const uploadPromises = files.map(async (file) => {
        try {
          // Get image dimensions
          const dimensions = await getImageDimensions(file);

          // Upload to FreeImage.host
          const freeImageResponse = await uploadToFreeImage(file);

          // Save to database
          const { data: dbImage, error: dbError } = await supabase
            .from('images')
            .insert({
              user_id: user.id,
              filename: freeImageResponse.image.name,
              file_path: freeImageResponse.image.url,
              file_size: freeImageResponse.image.filesize,
              mime_type: freeImageResponse.image.mime,
              width: freeImageResponse.image.width,
              height: freeImageResponse.image.height,
            })
            .select()
            .single();

          if (dbError) {
            throw new Error(`Database error: ${dbError.message}`);
          }

          const uploadedImg = {
            id: dbImage.id,
            file,
            url: freeImageResponse.image.url,
            preview: URL.createObjectURL(file),
            permanentUrl: freeImageResponse.image.url,
            deleteUrl: freeImageResponse.image.delete_url,
            filename: freeImageResponse.image.name,
            fileSize: freeImageResponse.image.filesize,
            mimeType: freeImageResponse.image.mime,
            width: freeImageResponse.image.width,
            height: freeImageResponse.image.height,
          } as UploadedImage;

          completedCount++;
          setUploadStats(prev => ({ ...prev, completed: completedCount }));
          setUploadProgress((completedCount / files.length) * 100);
          
          return uploadedImg;
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err);
          throw err;
        }
      });

      const newImages = await Promise.all(uploadPromises);
      onImagesUploaded([...images, ...newImages]);
      
      // Keep showing 100% for a brief moment before resetting
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 800);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      setIsUploading(false);
    }
  };

  const removeImage = async (imageId: string) => {
    const imageToRemove = images.find(img => img.id === imageId);
    if (!imageToRemove) return;

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId);

      if (dbError) {
        console.error('Database delete error:', dbError);
      }

      // Remove from local state
      const updatedImages = images.filter(img => img.id !== imageId);
      onImagesUploaded(updatedImages);
      // Remove from selection if selected
      if (onSelectionChange) {
        onSelectionChange(selectedImages.filter(id => id !== imageId));
      }
    } catch (error) {
      console.error('Delete error:', error);
      const updatedImages = images.filter(img => img.id !== imageId);
      onImagesUploaded(updatedImages);
      if (onSelectionChange) {
        onSelectionChange(selectedImages.filter(id => id !== imageId));
      }
    }
  };

  const handleApplyTemplateToSelected = async (templateId: string) => {
    if (!user || !onApplyTemplateToBulk) return;

    const targetImages = selectedImages.length > 0
      ? images.filter(img => selectedImages.includes(img.id))
      : images;

    if (targetImages.length === 0) {
      setUploadError('No images selected to apply template to');
      return;
    }

    setIsApplyingTemplate(true);
    setUploadError(null);

    try {
      await onApplyTemplateToBulk(templateId, targetImages);
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
      setUploadError('Failed to apply template. Please try again.');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleApplyTemplateToAll = async (templateId: string) => {
    if (!user || !onApplyTemplateToBulk || images.length === 0) return;

    setIsApplyingTemplate(true);
    setUploadError(null);

    try {
      await onApplyTemplateToBulk(templateId, images);
    } catch (error) {
      console.error('Failed to apply template:', error);
      setUploadError('Failed to apply template. Please try again.');
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const removeSelectedImages = async () => {
    if (selectedImages.length === 0) return;

    try {
      const deletePromises = selectedImages.map(async (imageId) => {
        const { error: dbError } = await supabase
          .from('images')
          .delete()
          .eq('id', imageId);

        if (dbError) console.error('Database delete error:', dbError);
      });

      await Promise.all(deletePromises);

      const updatedImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(updatedImages);
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      const updatedImages = images.filter(img => !selectedImages.includes(img.id));
      onImagesUploaded(updatedImages);
      if (onSelectionChange) {
        onSelectionChange([]);
      }
    }
  };

  const toggleSelection = (imageId: string) => {
    if (!onSelectionChange) return;
    if (selectedImages.includes(imageId)) {
      onSelectionChange(selectedImages.filter(id => id !== imageId));
    } else {
      onSelectionChange([...selectedImages, imageId]);
    }
  };

  const selectAll = () => {
    if (!onSelectionChange) return;
    if (selectedImages.length === images.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(images.map(img => img.id));
    }
  };

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {uploadError && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-destructive/10 backdrop-blur-md rounded-2xl p-4 flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5 text-destructive" />
            <p className="text-destructive text-sm font-medium">{uploadError}</p>
            <button onClick={() => setUploadError(null)} className="ml-auto text-destructive/50 hover:text-destructive">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        layout
        className={cn(
          "relative group rounded-3xl overflow-hidden transition-all duration-500",
          "bg-white/[0.03] backdrop-blur-2xl border-none shadow-2xl shadow-black/40",
          isDragOver && "bg-primary/[0.08] ring-2 ring-primary/30"
        )}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="relative p-12 flex flex-col items-center justify-center text-center space-y-6">
          {/* Animated Background Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className={cn(
              "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/20 blur-[100px] transition-all duration-700",
              (isDragOver || isUploading) ? "opacity-100 scale-150" : "opacity-0 scale-50"
            )} />
          </div>

          <AnimatePresence mode="wait">
            {isUploading ? (
              <motion.div 
                key="uploading"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="w-full max-w-md space-y-6 relative z-50"
              >
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <div className="relative w-full h-full rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight text-white">
                    Uploading your vision
                  </h3>
                  <p className="text-muted-foreground">
                    Processing {uploadStats.completed} of {uploadStats.total} files...
                  </p>
                </div>

                {/* The Improved Upload Bar */}
                <div className="relative h-3 w-full bg-white/5 rounded-full overflow-hidden shadow-inner ring-1 ring-white/10">
                  <motion.div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] z-10"
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${uploadProgress}%`,
                      backgroundPosition: ["0% 0%", "100% 0%"]
                    }}
                    transition={{ 
                      width: { type: "spring", stiffness: 50, damping: 20 },
                      backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
                    }}
                  />
                  {/* Subtle Glow Trail */}
                  <motion.div 
                    className="absolute top-0 h-full w-20 bg-white/20 blur-md z-20"
                    animate={{ left: [`-20%`, `100%`] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                
                <div className="flex justify-between text-xs font-medium text-muted-foreground px-1">
                  <span>{Math.round(uploadProgress)}% Complete</span>
                  <span>{uploadStats.total - uploadStats.completed} remaining</span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className={cn(
                  "w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center transition-all duration-500 bg-white/5 shadow-2xl",
                  isDragOver ? "rotate-12 scale-110 bg-primary/20 text-primary" : "text-white/40"
                )}>
                  <Upload className="w-10 h-10" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-3xl font-bold tracking-tight text-white">
                    Drop images here
                  </h3>
                  <p className="text-muted-foreground text-lg max-w-sm mx-auto">
                    Transform your local files into stunning slideshows in seconds.
                  </p>
                </div>

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!user}
                  className={cn(
                    "relative px-10 py-7 rounded-2xl text-lg font-semibold overflow-hidden group transition-all duration-300",
                    "bg-gradient-to-r from-primary to-accent hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]",
                    "border-none"
                  )}
                >
                  <span className="relative z-10 flex items-center">
                    <ImageIcon className="w-5 h-5 mr-3" />
                    {user ? 'Choose Files' : 'Sign in to Upload'}
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </Button>

                <p className="text-xs text-white/20 uppercase tracking-[0.2em] font-medium">
                  Supports JPG, PNG, WEBP & GIF (Max 25MB)
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {images.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <h4 className="text-xl font-bold text-white flex items-center">
                Library 
                <span className="ml-3 px-2 py-0.5 rounded-full bg-white/5 text-sm font-medium text-white/40">
                  {images.length}
                </span>
              </h4>
              
              {onSelectionChange && (
                <button
                  onClick={selectAll}
                  className="flex items-center space-x-2 text-sm font-medium text-white/40 hover:text-white transition-colors"
                >
                  {selectedImages.length === images.length ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>{selectedImages.length === images.length ? 'Deselect All' : 'Select All'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-3">
              {selectedImages.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center space-x-3"
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={removeSelectedImages}
                    className="rounded-xl h-9 px-4 bg-destructive/10 hover:bg-destructive/20 text-destructive border-none"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete {selectedImages.length}
                  </Button>
                  
                  {availableTemplates.length > 0 && onApplyTemplateToBulk && (
                    <select
                      className="h-9 rounded-xl bg-white/5 text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all border-none"
                      onChange={(e) => {
                        const templateId = e.target.value;
                        if (templateId) {
                          handleApplyTemplateToSelected(templateId);
                          e.target.value = '';
                        }
                      }}
                      disabled={isApplyingTemplate}
                    >
                      <option value="" className="bg-background">Apply Template...</option>
                      {availableTemplates.map(template => (
                        <option key={template.id} value={template.id} className="bg-background">
                          {template.name}
                        </option>
                      ))}
                    </select>
                  )}
                </motion.div>
              )}
              
              <button
                onClick={() => onImagesUploaded([])}
                className="text-sm font-medium text-white/20 hover:text-white/40 transition-colors px-2"
              >
                Clear Library
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {images.map((image, index) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                key={image.id}
                className={cn(
                  "relative group aspect-square rounded-[1.5rem] overflow-hidden bg-white/[0.03] transition-all duration-300 cursor-pointer shadow-lg",
                  selectedImages.includes(image.id) ? "ring-4 ring-primary ring-offset-4 ring-offset-background" : "hover:shadow-2xl hover:shadow-primary/10"
                )}
                onClick={() => onSelectionChange && toggleSelection(image.id)}
              >
                <img
                  src={image.preview}
                  alt="Uploaded"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {selectedImages.includes(image.id) && (
                  <div className="absolute top-3 left-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg z-20">
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(image.id);
                  }}
                  className="absolute top-3 right-3 w-8 h-8 bg-black/40 backdrop-blur-md text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-destructive shadow-lg z-20"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="absolute bottom-3 left-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                  <p className="text-[10px] font-medium text-white/60 truncate bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md">
                    {image.filename}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
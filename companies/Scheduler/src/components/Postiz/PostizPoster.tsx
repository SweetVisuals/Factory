"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { 
  Calendar, 
  Clock, 
  Send, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  User, 
  CalendarDays,
  Image,
  FileText,
  Hash,
  Eye,
  Settings,
  ArrowRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  PostizProfile,
  PostizSlideshowData,
  SlideshowMetadata
} from '../../types';
import { postizAPI } from '../../lib/postiz';
import { slideshowService } from '../../lib/slideshowService';
import { postizUploadService } from '../../lib/postizUploadService';

interface PostizPosterProps {
  slideshow: SlideshowMetadata | null;
  onPostSuccess?: (postId: string) => void;
  onClose?: () => void;
}

export const PostizPoster: React.FC<PostizPosterProps> = ({
  slideshow,
  onPostSuccess,
  onClose
}) => {
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [profiles, setProfiles] = useState<PostizProfile[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postResult, setPostResult] = useState<{
    success: boolean;
    message: string;
    postId?: string;
    isUploading?: boolean;
    uploadProgress?: string;
    step?: number;
  } | null>(null);
  
  // Scheduling state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Auto-hide notifications ONLY on success/error, keep uploading visible
  useEffect(() => {
    if (postResult && !postResult.isUploading) {
      const timer = setTimeout(() => {
        setPostResult(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [postResult]);

  // Load TikTok profiles on component mount
  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const loadedProfiles = await postizAPI.getProfiles();
      
      const tiktokProfiles = loadedProfiles.filter(profile => {
        const provider = profile.provider?.toLowerCase() || '';
        const displayName = profile.displayName?.toLowerCase() || '';
        const username = profile.username?.toLowerCase() || '';
        
        return provider.includes('tiktok') ||
               displayName.includes('tiktok') ||
               username.includes('tiktok') ||
               provider === 'tt' ||
               provider === 'social';
      });
      
      const finalProfiles = tiktokProfiles.length > 0 ? tiktokProfiles : loadedProfiles;
      setProfiles(finalProfiles);
      
      if (finalProfiles.length === 1) {
        setSelectedProfiles([finalProfiles[0].id]);
      }
    } catch (error) {
      setPostResult({
        success: false,
        message: 'Failed to load TikTok profiles. Please check your API key.'
      });
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleProfileToggle = (profileId: string) => {
    setSelectedProfiles(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProfiles.length === profiles.length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(profiles.map(p => p.id));
    }
  };

  const handleScheduleToggle = () => {
    setIsScheduled(!isScheduled);
    if (!isScheduled) {
      const now = new Date();
      now.setHours(now.getHours() + 1);
      setScheduledDate(now.toISOString().split('T')[0]);
      setScheduledTime(now.toTimeString().slice(0, 5));
    }
  };

  const getScheduledDateTime = (): Date | undefined => {
    if (!isScheduled || !scheduledDate || !scheduledTime) return undefined;
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (scheduledDateTime <= new Date()) {
      throw new Error('Scheduled time must be in the future');
    }
    return scheduledDateTime;
  };

  const handlePost = async () => {
    if (!slideshow) return;

    if (selectedProfiles.length === 0) {
      setPostResult({ success: false, message: 'Please select at least one account' });
      return;
    }

    setIsPosting(true);

    try {
      const scheduledDateTime = getScheduledDateTime();
      
      // STEP 1
      setPostResult({
        success: false,
        message: 'Uploading images to Postiz media gallery...',
        isUploading: true,
        uploadProgress: 'Step 1: Media Transfer',
        step: 1
      });

      const postizMedia = await postizUploadService.uploadImagesToPostizStorage(slideshow);
      
      // STEP 2
      setPostResult({
        success: false,
        message: 'Creating TikTok post with your media...',
        isUploading: true,
        uploadProgress: 'Step 2: Post Creation',
        step: 2
      });

      const captionText = slideshowService.formatCaptionForBuffer(slideshow.caption, slideshow.hashtags);
      
      const result = await postizUploadService.createPostWithUploadedImages(
        captionText,
        selectedProfiles[0],
        postizMedia,
        scheduledDateTime,
        !isScheduled
      );

      // Success!
      setPostResult({
        success: true,
        message: isScheduled
          ? `Post scheduled for ${scheduledDate} at ${scheduledTime}`
          : `Post successfully published to TikTok!`,
        postId: result.postId,
        isUploading: false,
        step: 3
      });

      if (onPostSuccess && result.postId) {
        onPostSuccess(result.postId);
      }

      setTimeout(() => {
        setSelectedProfiles([]);
        setIsScheduled(false);
      }, 3000);

    } catch (error: any) {
      setPostResult({
        success: false,
        message: error.message || 'Failed to post slideshow.',
        isUploading: false
      });
    } finally {
      setIsPosting(false);
    }
  };

  if (!slideshow) return null;

  return (
    <div className="space-y-8 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-white flex items-center">
            <Send className="w-6 h-6 mr-3 text-primary" />
            Publish to TikTok
          </h3>
          <p className="text-sm text-white/40">Finalize and schedule your slideshow</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Config */}
        <div className="space-y-8">
          {/* Account Selection */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center">
                <User className="w-3 h-3 mr-2" />
                Select Accounts
              </h4>
              <button 
                onClick={handleSelectAll}
                className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest"
              >
                {selectedProfiles.length === profiles.length ? 'None' : 'All'}
              </button>
            </div>
            
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
              {profiles.map((profile) => (
                <motion.label
                  key={profile.id}
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center space-x-4 p-4 rounded-[1.25rem] cursor-pointer transition-all border-none shadow-sm",
                    selectedProfiles.includes(profile.id)
                      ? "bg-primary/20 ring-1 ring-primary/50"
                      : "bg-white/[0.03] hover:bg-white/[0.06]"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                    selectedProfiles.includes(profile.id) ? "bg-primary text-white scale-110" : "bg-white/10"
                  )}>
                    {selectedProfiles.includes(profile.id) && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedProfiles.includes(profile.id)}
                    onChange={() => handleProfileToggle(profile.id)}
                    className="hidden"
                  />
                  {profile.avatar && (
                    <img src={profile.avatar} alt="" className="w-10 h-10 rounded-full ring-2 ring-white/5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white text-sm truncate">{profile.displayName}</div>
                    <div className="text-xs text-white/30 truncate">@{profile.username}</div>
                  </div>
                </motion.label>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center">
              <Calendar className="w-3 h-3 mr-2" />
              Timing
            </h4>
            <div className="p-6 bg-white/[0.03] rounded-[2rem] space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white/60">Schedule for later?</span>
                <button
                  onClick={handleScheduleToggle}
                  className={cn(
                    "w-12 h-6 rounded-full transition-all relative",
                    isScheduled ? "bg-primary" : "bg-white/10"
                  )}
                >
                  <motion.div
                    animate={{ x: isScheduled ? 26 : 4 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
              </div>

              <AnimatePresence>
                {isScheduled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="grid grid-cols-2 gap-4 pt-2 overflow-hidden"
                  >
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Date</span>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border-none text-white text-sm focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Time</span>
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full px-4 py-3 bg-white/5 rounded-xl border-none text-white text-sm focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Side: Preview & Status */}
        <div className="space-y-6">
          <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center">
            <Eye className="w-3 h-3 mr-2" />
            Preview
          </h4>
          
          {/* Status Panel moved above Preview */}
          <AnimatePresence mode="wait">
            {postResult && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={cn(
                  "p-6 rounded-[2rem] relative overflow-hidden z-20 shadow-xl",
                  postResult.success ? "bg-emerald-500/10 ring-1 ring-emerald-500/20" : 
                  postResult.isUploading ? "bg-primary/10 ring-1 ring-primary/20" : 
                  "bg-destructive/10 ring-1 ring-destructive/20"
                )}
              >
                <div className="flex items-start space-x-4">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                    postResult.success ? "bg-emerald-500/20 text-emerald-500" : 
                    postResult.isUploading ? "bg-primary/20 text-primary" : 
                    "bg-destructive/20 text-destructive"
                  )}>
                    {postResult.success ? <CheckCircle className="w-5 h-5" /> : 
                     postResult.isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                     <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">
                      {postResult.success ? 'Success!' : postResult.isUploading ? 'Publishing in Progress' : 'Error Occurred'}
                    </div>
                    <div className="text-xs text-white/60 leading-relaxed">
                      {postResult.message}
                    </div>
                    
                    {postResult.isUploading && (
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                          <span className="text-primary">{postResult.uploadProgress}</span>
                          <span className="text-white/20">{postResult.step === 1 ? '50%' : '90%'}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-primary to-accent"
                            initial={{ width: 0 }}
                            animate={{ width: postResult.step === 1 ? '50%' : '90%' }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-white/[0.03] rounded-[2rem] p-8 space-y-6 relative overflow-hidden group">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
            
            <div className="space-y-4 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1 min-w-0 pr-4">
                  <h5 className="font-bold text-white truncate">{slideshow.title}</h5>
                  <p className="text-sm text-white/40 line-clamp-2 italic">"{slideshow.caption}"</p>
                </div>
                <div className="flex -space-x-3">
                  {slideshow.condensedSlides?.slice(0, 3).map((slide, i) => (
                    <img 
                      key={i} 
                      src={slide.imageUrl} 
                      className="w-12 h-12 rounded-xl object-cover ring-4 ring-zinc-950 shadow-xl" 
                    />
                  ))}
                  {(slideshow.condensedSlides?.length || 0) > 3 && (
                    <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-xs font-bold text-white ring-4 ring-zinc-950 shadow-xl">
                      +{(slideshow.condensedSlides?.length || 0) - 3}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2 text-xs font-bold text-white/40 uppercase tracking-widest">
                  <Hash className="w-3 h-3" />
                  <span>{slideshow.hashtags.split(' ').length} Tags</span>
                </div>
                <div className="flex items-center space-x-2 text-xs font-bold text-white/40 uppercase tracking-widest">
                  <Image className="w-3 h-3" />
                  <span>{slideshow.aspectRatio}</span>
                </div>
              </div>
            </div>
          </div>


          <div className="pt-4">
            <Button
              onClick={handlePost}
              disabled={isPosting || selectedProfiles.length === 0}
              className="w-full py-8 rounded-[2rem] bg-primary hover:bg-primary/90 text-white font-bold text-lg shadow-2xl shadow-primary/20 group overflow-hidden relative"
            >
              <div className="relative z-10 flex items-center justify-center">
                {isPosting ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                    {isScheduled ? 'Scheduling...' : 'Publishing...'}
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-3 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    {isScheduled ? 'Confirm Schedule' : 'Post to TikTok'}
                  </>
                )}
              </div>
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
            </Button>
            
            <p className="text-center mt-4 text-[10px] font-bold text-white/20 uppercase tracking-widest">
              Direct Publishing via Postiz API v2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
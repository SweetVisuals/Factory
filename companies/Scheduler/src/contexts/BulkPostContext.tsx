import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { SlideshowMetadata } from '../types';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { postizAPI } from '../lib/postiz';
import { addMinutes, addHours } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const applyScheduleConstraints = (baseTime: Date, timezone: string = 'UTC'): Date => {
    // Convert baseTime (which is a JS Date with a specific timestamp) to the user's timezone
    // toZonedTime returns a Date object representing the time in the target timezone
    const zonedDate = toZonedTime(baseTime, timezone);
    const hour = zonedDate.getHours();

    // If post falls between 10pm (22:00) and midnight, move to 9am next day
    if (hour >= 22) {
        const adjustedZoned = new Date(zonedDate);
        adjustedZoned.setDate(adjustedZoned.getDate() + 1);
        adjustedZoned.setHours(9, 0, 0, 0);
        return fromZonedTime(adjustedZoned, timezone);
    }

    // If post falls between midnight and 9am, move to 9am same day
    if (hour >= 0 && hour < 9) {
        const adjustedZoned = new Date(zonedDate);
        adjustedZoned.setHours(9, 0, 0, 0);
        return fromZonedTime(adjustedZoned, timezone);
    }

    return baseTime;
};

interface JobPayload {
    slideshows: SlideshowMetadata[];
    profiles: string[];
    strategy: 'interval' | 'first-now' | 'batch';
    settings: {
        intervalHours: number;
        startTime: string; // ISO string for JSON serialization
        batchSize: number;
        postIntervalMinutes: number;
        timezone?: string;
    };
}

export interface JobQueueItem {
    id: string;
    user_id: string;
    account_id?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    scheduled_start_time: string;
    batch_index: number;
    total_batches: number;
    payload: JobPayload;
    created_at: string;
    updated_at: string;
    error?: string;
}



interface BulkPostContextType {
    jobQueue: JobQueueItem[];
    lastScheduledTime: Date | null;
    startBulkPost: (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            postIntervalMinutes: number;
        }
    ) => Promise<void>;
    refreshQueue: () => Promise<void>;
    rescheduleQueue: () => Promise<void>;
    nextBatchStartTime: Date | null;
}

const BulkPostContext = createContext<BulkPostContextType | undefined>(undefined);

export const useBulkPost = () => {
    const context = useContext(BulkPostContext);
    if (!context) {
        throw new Error('useBulkPost must be used within a BulkPostProvider');
    }
    return context;
};

export const BulkPostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [jobQueue, setJobQueue] = useState<JobQueueItem[]>([]);
    const [lastScheduledTime, setLastScheduledTime] = useState<Date | null>(null);
    const [userTimezone, setUserTimezone] = useState('UTC');

    // Load initial queue and subscribe to changes
    const fetchQueue = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch user timezone
        const { data: userData } = await supabase
            .from('users')
            .select('timezone')
            .eq('id', user.id)
            .single();

        if (userData?.timezone) {
            setUserTimezone(userData.timezone);
        }

        const { data, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['pending', 'processing', 'failed', 'completed'])
            .order('scheduled_start_time', { ascending: true });

        if (error) {
            console.error('Failed to fetch job queue:', error);
        } else {
            setJobQueue(data || []);
            updateLastScheduledTime(data || []);
        }
    }, []);

    useEffect(() => {
        fetchQueue();

        const subscription = supabase
            .channel('job_queue_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'job_queue'
                },
                (payload) => {
                    console.log('Job queue change received:', payload);
                    fetchQueue();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchQueue]);

    // Calculate the projected end time of the entire queue
    const updateLastScheduledTime = (queue: JobQueueItem[]) => {
        if (queue.length === 0) {
            setLastScheduledTime(null);
            return;
        }

        // Find the last job in the queue
        const lastJob = queue[queue.length - 1];
        const payload = lastJob.payload;
        const startTime = new Date(lastJob.scheduled_start_time);

        // Calculate duration of this specific job/batch
        const totalItems = payload.slideshows.length;
        const postIntervalMinutes = payload.settings.postIntervalMinutes;
        const intervalHours = payload.settings.intervalHours;

        let durationMinutes = 0;

        if (payload.strategy === 'batch') {
            // Since we split batches into separate jobs, a "batch job" is just one batch
            // Duration is just (Items - 1) * PostInterval
            durationMinutes = (totalItems - 1) * postIntervalMinutes;
        } else {
            // Interval strategy
            durationMinutes = (totalItems - 1) * (intervalHours * 60);
        }

        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        setLastScheduledTime(endTime);
    };

    // Poll for pending jobs that are ready to run - REMOVED (Backend processing only)

    // Helper to wait with UI feedback - REMOVED (Backend processing only)

    // postSingleSlideshow - REMOVED (Backend processing only)

    // processJob - REMOVED (Backend processing only)

    const startBulkPost = useCallback(async (
        slideshows: SlideshowMetadata[],
        profiles: string[],
        strategy: 'interval' | 'first-now' | 'batch',
        settings: {
            intervalHours: number;
            startTime: Date;
            batchSize: number;
            postIntervalMinutes: number;
        }
    ) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            toast.error('You must be logged in to schedule posts');
            return;
        }

        // --- SYNC API KEY TO DATABASE ---
        try {
            const apiKey = postizAPI.getApiKey();
            if (apiKey) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ postiz_api_key: apiKey.trim() })
                    .eq('id', user.id);

                if (updateError) {
                    console.error('Failed to sync Postiz API key:', updateError);
                } else {
                    console.log('Synced Postiz API key to database');
                }
            } else {
                console.warn('No Postiz API key found in local storage to sync');
            }
        } catch (e) {
            console.error('Error syncing API key:', e);
        }
        // --------------------------------

        // ==========================================
        // ACCOUNT-SEQUENTIAL SCHEDULING
        // When multiple profiles are selected, we schedule ALL batches for account 1
        // first, then ALL batches for account 2, etc.
        // ==========================================

        const allJobsToInsert: any[] = [];

        // Global processing time cursor — tracks when the NEXT batch can be processed
        // This is used for the Edge Function's scheduled_start_time (when to run the batch)
        let globalProcessingCursor = new Date();
        globalProcessingCursor.setSeconds(0, 0);

        // Global post time cursor — tracks the content schedule across ALL accounts
        // This ensures account 2's posts start after account 1's posts finish
        let globalPostTimeCursor = new Date(settings.startTime);
        globalPostTimeCursor.setSeconds(0, 0);

        // Track global batch index across all accounts
        let globalBatchIndex = 0;

        for (let profileIdx = 0; profileIdx < profiles.length; profileIdx++) {
            const profileId = profiles[profileIdx];

            // For each account, we use the SAME set of slideshows
            // (same content posted to multiple accounts sequentially)

            if (strategy === 'batch') {
                const batchSize = settings.batchSize;
                const totalBatches = Math.ceil(slideshows.length / batchSize);

                // Deep clone slideshows for this account to avoid mutating shared references
                const accountSlideshows = slideshows.map(s => ({ ...s }));

                // Track post time for THIS account's content
                let accountPostTime = new Date(globalPostTimeCursor);

                for (let i = 0; i < totalBatches; i++) {
                    const batchSlideshows = accountSlideshows.slice(i * batchSize, (i + 1) * batchSize);

                    // Processing time: 67 minutes apart per batch across ALL accounts
                    const scheduledProcessingTime = addMinutes(globalProcessingCursor, globalBatchIndex * 67);

                    // Post Start Time for THIS batch
                    const batchPostStartTime = new Date(accountPostTime);

                    // Advance post time for the NEXT batch by simulating this batch's posts
                    const effectiveInterval = settings.postIntervalMinutes || 240;
                    for (let j = 0; j < batchSlideshows.length; j++) {
                        accountPostTime = applyScheduleConstraints(accountPostTime, userTimezone);
                        batchSlideshows[j].scheduledTime = accountPostTime.toISOString();
                        accountPostTime = addMinutes(accountPostTime, effectiveInterval);
                    }

                    const payload: JobPayload = {
                        slideshows: batchSlideshows,
                        profiles: [profileId], // Single profile per job
                        strategy: 'batch',
                        settings: {
                            ...settings,
                            startTime: batchPostStartTime.toISOString(),
                            timezone: userTimezone
                        }
                    };

                    allJobsToInsert.push({
                        user_id: user.id,
                        account_id: profileId,
                        status: 'pending',
                        scheduled_start_time: scheduledProcessingTime.toISOString(),
                        batch_index: globalBatchIndex + 1,
                        total_batches: -1, // Will be set below after we know grand total
                        payload
                    });

                    globalBatchIndex++;
                }

                // After all batches for this account, update the global post time cursor
                // so the next account's posts start after this account finishes
                globalPostTimeCursor = new Date(accountPostTime);

            } else {
                // Interval or First-Now strategy — treat as single job per account

                const accountSlideshows = slideshows.map(s => ({ ...s }));
                let accountPostTime = new Date(globalPostTimeCursor);
                accountPostTime.setSeconds(0, 0);

                for (let j = 0; j < accountSlideshows.length; j++) {
                    if (strategy === 'first-now' && j === 0 && profileIdx === 0) {
                        accountPostTime = new Date(); // Immediate for first post of first account only
                    } else if (strategy === 'first-now' && j === 1 && profileIdx === 0) {
                        accountPostTime = new Date(settings.startTime);
                        accountPostTime = addHours(accountPostTime, settings.intervalHours);
                    } else if (j > 0) {
                        accountPostTime = addHours(accountPostTime, settings.intervalHours);
                    }

                    accountPostTime = applyScheduleConstraints(accountPostTime, userTimezone);
                    accountSlideshows[j].scheduledTime = accountPostTime.toISOString();
                }

                // Processing time
                const scheduledProcessingTime = addMinutes(globalProcessingCursor, globalBatchIndex * 67);

                const payload: JobPayload = {
                    slideshows: accountSlideshows,
                    profiles: [profileId],
                    strategy,
                    settings: {
                        ...settings,
                        startTime: globalPostTimeCursor.toISOString(),
                        timezone: userTimezone
                    }
                };

                allJobsToInsert.push({
                    user_id: user.id,
                    account_id: profileId,
                    status: 'pending',
                    scheduled_start_time: scheduledProcessingTime.toISOString(),
                    batch_index: globalBatchIndex + 1,
                    total_batches: -1,
                    payload
                });

                globalBatchIndex++;

                // Advance global post time past this account's last post
                if (accountSlideshows.length > 0) {
                    const lastPost = new Date(accountSlideshows[accountSlideshows.length - 1].scheduledTime!);
                    globalPostTimeCursor = addHours(lastPost, settings.intervalHours);
                }
            }
        }

        // Set the correct total_batches on all jobs
        const grandTotalBatches = allJobsToInsert.length;
        for (const job of allJobsToInsert) {
            job.total_batches = grandTotalBatches;
        }

        const { error } = await supabase
            .from('job_queue')
            .insert(allJobsToInsert);

        // Also bulk save all slideshow objects into Supabase to persist their scheduled times explicitly
        try {
            const allAssignedSlideshows = allJobsToInsert.flatMap((job) => job.payload.slideshows);
            const formattedDbSlideshows = allAssignedSlideshows.map(s => ({
                id: s.id,
                user_id: user.id,
                metadata: s,
                folder_id: s.folder_id || null,
                account_ids: s.account_ids || [],
                account_id: s.account_id || null,
                updated_at: new Date().toISOString()
            }));

            const { error: slideError } = await supabase.from('slideshows').upsert(formattedDbSlideshows, { onConflict: 'id' });
            if (slideError) console.error('Failed to save slideshow scheduled times:', slideError);
        } catch (e) { console.error(e) }

        if (error) {
            console.error('Failed to queue jobs:', error);
            toast.error('Failed to add jobs to queue');
        } else {
            const accountCount = profiles.length;
            const batchWord = grandTotalBatches === 1 ? 'batch' : 'batches';
            const accountWord = accountCount === 1 ? 'account' : 'accounts';
            toast.success(`Scheduled! ${grandTotalBatches} ${batchWord} across ${accountCount} ${accountWord} queued for background processing.`);
            await fetchQueue();

            // Trigger the processor Edge Function immediately so we don't wait for the cron
            try {
                const { data: { session } } = await supabase.auth.getSession();
                fetch('https://wtsckulmgegamnovlrbf.supabase.co/functions/v1/process-job-queue', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session?.access_token || ''}`,
                        'Content-Type': 'application/json'
                    }
                }).catch(e => console.warn('Background trigger fired (async)'));
            } catch (triggerError) {
                console.warn('Failed to fire immediate background trigger:', triggerError);
            }
        }
    }, [fetchQueue, userTimezone]);





    const rescheduleQueue = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch all pending jobs
        const { data: jobs, error } = await supabase
            .from('job_queue')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'pending');

        if (error || !jobs || jobs.length === 0) {
            toast.error('No pending jobs to reschedule');
            return;
        }

        // Fetch last completed/processing job to find where we left off
        const { data: lastJobs } = await supabase
            .from('job_queue')
            .select('scheduled_start_time, status, batch_index')
            .eq('user_id', user.id)
            .in('status', ['completed', 'processing'])
            .order('scheduled_start_time', { ascending: false })
            .limit(1);

        let currentProcessingTime = new Date();
        const lastJob = lastJobs?.[0];

        // If a job is currently processing or recently completed, start 70 mins after it
        if (lastJob) {
            const lastTime = new Date(lastJob.scheduled_start_time);
            const nextPossibleTime = addMinutes(lastTime, 70);
            if (nextPossibleTime > currentProcessingTime) {
                currentProcessingTime = nextPossibleTime;
            } else {
                currentProcessingTime = addMinutes(new Date(), 2);
            }
        } else {
            currentProcessingTime = addMinutes(new Date(), 2);
        }

        // RESPECT FUTURE USER SCHEDULE
        const earliestPendingJob = jobs.reduce((earliest, job) => {
            const jobTime = new Date(job.scheduled_start_time);
            return (!earliest || jobTime < new Date(earliest.scheduled_start_time)) ? job : earliest;
        }, null as any);

        if (earliestPendingJob) {
            const pendingTime = new Date(earliestPendingJob.scheduled_start_time);
            if (pendingTime > addMinutes(currentProcessingTime, 5)) {
                console.log(`Preserving future schedule: jumping to ${pendingTime.toISOString()}`);
                currentProcessingTime = pendingTime;
            }
        }

        // SPLIT LARGE BATCHES LOGIC
        let hasSplit = false;

        for (const job of jobs) {
            const slideshows = job.payload.slideshows || [];
            const BATCH_LIMIT = 10;

            if (slideshows.length > BATCH_LIMIT) {
                console.log(`Splitting large batch ${job.id} with ${slideshows.length} items`);
                hasSplit = true;

                const totalChunks = Math.ceil(slideshows.length / BATCH_LIMIT);
                const baseBatchIndex = job.batch_index;
                const baseSettings = job.payload.settings;

                const baseTime = new Date(job.scheduled_start_time);

                for (let i = 0; i < totalChunks; i++) {
                    const chunkSlides = slideshows.slice(i * BATCH_LIMIT, (i + 1) * BATCH_LIMIT);

                    const newPayload = {
                        ...job.payload,
                        strategy: 'batch',
                        slideshows: chunkSlides,
                        settings: {
                            ...baseSettings,
                            batchSize: BATCH_LIMIT
                        }
                    };

                    const chunkTime = i === 0 ? baseTime : addMinutes(baseTime, i * 70);

                    await supabase.from('job_queue').insert({
                        user_id: user.id,
                        account_id: job.account_id,
                        status: 'pending',
                        scheduled_start_time: chunkTime.toISOString(),
                        batch_index: baseBatchIndex + i,
                        total_batches: (job.total_batches || 0) + totalChunks - 1,
                        payload: newPayload
                    });
                }

                await supabase.from('job_queue').delete().eq('id', job.id);
            }
        }

        if (hasSplit) {
            toast.success('Large batches detected and split into smaller chunks. Recalibrating...');
            const { data: refreshedJobs } = await supabase
                .from('job_queue')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'pending');

            if (refreshedJobs) {
                jobs.length = 0;
                jobs.push(...refreshedJobs);
            }
        }

        // ==========================================
        // ACCOUNT-SEQUENTIAL RESCHEDULE
        // Group pending jobs by account_id, then reschedule
        // account by account sequentially
        // ==========================================

        // Group jobs by account_id
        const accountGroups = new Map<string, typeof jobs>();
        for (const job of jobs) {
            const accountId = job.account_id || 'unknown';
            if (!accountGroups.has(accountId)) {
                accountGroups.set(accountId, []);
            }
            accountGroups.get(accountId)!.push(job);
        }

        // Sort each group by batch_index, then by created_at
        for (const [, groupJobs] of accountGroups) {
            groupJobs.sort((a: any, b: any) => {
                const batchDiff = (a.batch_index || 0) - (b.batch_index || 0);
                if (batchDiff !== 0) return batchDiff;
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            });
        }

        // Track post time across accounts to ensure sequential ordering
        let currentPostTime = new Date(currentProcessingTime);
        currentPostTime.setSeconds(0, 0);

        let globalIdx = 0;

        console.log(`Rescheduling ${jobs.length} jobs across ${accountGroups.size} accounts starting from ${currentProcessingTime.toISOString()}`);

        for (const [accountId, groupJobs] of accountGroups) {
            console.log(`Rescheduling account ${accountId}: ${groupJobs.length} batches`);

            for (let i = 0; i < groupJobs.length; i++) {
                const job = groupJobs[i];
                let settings = { ...job.payload.settings };

                if (!settings.postIntervalMinutes || isNaN(settings.postIntervalMinutes)) {
                    settings.postIntervalMinutes = 1;
                }

                const batchPostStartTime = new Date(currentPostTime);
                settings.startTime = batchPostStartTime.toISOString();

                const slideshows = job.payload.slideshows || [];
                const strategy = job.payload.strategy;

                for (let j = 0; j < slideshows.length; j++) {
                    currentPostTime = applyScheduleConstraints(currentPostTime, userTimezone);
                    if (strategy === 'batch') {
                        currentPostTime = addMinutes(currentPostTime, settings.postIntervalMinutes);
                    } else {
                        currentPostTime = addHours(currentPostTime, settings.intervalHours || 1);
                    }
                }

                const updatePayload = {
                    scheduled_start_time: currentProcessingTime.toISOString(),
                    batch_index: globalIdx + 1,
                    payload: {
                        ...job.payload,
                        settings
                    }
                };

                const { error: updateError } = await supabase
                    .from('job_queue')
                    .update(updatePayload)
                    .eq('id', job.id);

                if (updateError) {
                    console.error(`Failed to reschedule job ${job.id}:`, updateError);
                }

                // Move to next processing window (70 mins)
                currentProcessingTime = addMinutes(currentProcessingTime, 70);
                globalIdx++;
            }
        }

        toast.success('Queue rescheduled successfully');
        fetchQueue();
    };

    const nextBatchStartTime = useMemo(() => {
        const pendingJobs = jobQueue.filter(j => j.status === 'pending');
        if (pendingJobs.length === 0) return null;

        // Sort by scheduled_start_time to find the next one
        const sorted = [...pendingJobs].sort((a, b) =>
            new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
        );

        return new Date(sorted[0].scheduled_start_time);
    }, [jobQueue]);

    return (
        <BulkPostContext.Provider value={{
            jobQueue,
            lastScheduledTime,
            startBulkPost,
            refreshQueue: fetchQueue,
            rescheduleQueue,
            nextBatchStartTime
        }}>
            {children}
        </BulkPostContext.Provider>
    );
};

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ListOrdered, Loader2, CheckCircle, AlertCircle, Clock, Trash2, RefreshCw, ChevronDown, ChevronRight, Layers, User } from 'lucide-react';
import { Button } from '../ui/button';
import { useBulkPost } from '../../contexts/BulkPostContext';
import { cn } from '@/lib/utils';
import { postizAPI } from '../../lib/postiz';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { addMinutes, addHours } from 'date-fns';

interface QueueViewerProps {
    onClose: () => void;
}

export const QueueViewer: React.FC<QueueViewerProps> = ({ onClose }) => {
    const { jobQueue, refreshQueue, rescheduleQueue } = useBulkPost();
    const [profiles, setProfiles] = useState<any[]>([]);
    const [expandedJobs, setExpandedJobs] = useState<string[]>([]);
    const [expandedAccounts, setExpandedAccounts] = useState<string[]>([]);
    const [jobLogs, setJobLogs] = useState<Record<string, any[]>>({});
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

    const fetchLogs = async (jobId: string) => {
        try {
            const { data, error } = await supabase
                .from('job_logs')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setJobLogs(prev => ({ ...prev, [jobId]: data || [] }));
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        }
    };

    const totalPosts = jobQueue.reduce((acc, job) => acc + (job.payload.slideshows?.length || 0), 0);
    const totalBatches = jobQueue.length;
    const pendingPosts = jobQueue
        .filter(j => j.status === 'pending' || j.status === 'processing')
        .reduce((acc, job) => acc + (job.payload.slideshows?.length || 0), 0);

    // Group jobs by account_id
    const accountGroups = React.useMemo(() => {
        const groups = new Map<string, typeof jobQueue>();
        const sorted = [...jobQueue].sort((a, b) => {
            const statusOrder = { processing: 0, pending: 1, failed: 2, completed: 3 } as any;
            if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
            return (a.batch_index || 0) - (b.batch_index || 0);
        });
        for (const job of sorted) {
            const key = job.account_id || job.payload.profiles?.[0] || 'unknown';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(job);
        }
        return groups;
    }, [jobQueue]);

    // Auto-expand all accounts on mount
    useEffect(() => {
        setExpandedAccounts(Array.from(accountGroups.keys()));
    }, [accountGroups.size]);

    const toggleExpandAll = () => {
        if (expandedJobs.length === jobQueue.length) {
            setExpandedJobs([]);
        } else {
            setExpandedJobs(jobQueue.map(j => j.id));
        }
    };

    const applyScheduleConstraints = (baseTime: Date): Date => {
        const hour = baseTime.getHours();
        if (hour >= 22) { const a = new Date(baseTime); a.setDate(a.getDate() + 1); a.setHours(9, 0, 0, 0); return a; }
        if (hour >= 0 && hour < 9) { const a = new Date(baseTime); a.setHours(9, 0, 0, 0); return a; }
        return baseTime;
    };

    const getPostTime = (job: any, index: number) => {
        const { strategy, settings } = job.payload;
        let currentTime = new Date(job.scheduled_start_time);
        const intervalHours = settings.intervalHours || 1;
        const postIntervalMinutes = settings.postIntervalMinutes || 1;
        for (let i = 0; i <= index; i++) {
            currentTime = applyScheduleConstraints(currentTime);
            if (i === index) return currentTime;
            if (strategy === 'batch') currentTime = addMinutes(currentTime, postIntervalMinutes);
            else currentTime = addHours(currentTime, intervalHours);
        }
        return currentTime;
    };

    useEffect(() => { loadProfiles(); }, []);

    const loadProfiles = async () => {
        try {
            const connectedProfiles = await postizAPI.getProfiles();
            setProfiles(connectedProfiles);
        } catch (error) {
            console.error('Failed to load profiles:', error);
        }
    };

    const getProfileInfo = (profileId: string) => {
        const profile = profiles.find(p => p.id === profileId);
        return profile || { displayName: 'Unknown Account', avatar: null, username: '' };
    };

    const getProfileName = (profileId: string) => getProfileInfo(profileId).displayName || 'Unknown Account';

    const handleDeleteJob = async (jobId: string) => {
        try {
            const { error } = await supabase.from('job_queue').delete().eq('id', jobId);
            if (error) throw error;
            toast.success('Job removed from queue');
            refreshQueue();
        } catch (error) {
            console.error('Failed to delete job:', error);
            toast.error('Failed to delete job');
        }
    };

    const handleClearCompleted = async () => {
        try {
            const { error } = await supabase.from('job_queue').delete().in('status', ['completed', 'failed']);
            if (error) throw error;
            toast.success('Cleared completed jobs');
            refreshQueue();
        } catch (error) { toast.error('Failed to clear jobs'); }
    };

    const handleClearPending = async () => {
        try {
            const { error } = await supabase.from('job_queue').delete().in('status', ['pending', 'processing']);
            if (error) throw error;
            toast.success('Cleared pending jobs');
            refreshQueue();
        } catch (error) { toast.error('Failed to clear jobs'); }
    };

    const getAccountStats = (jobs: typeof jobQueue) => {
        const pending = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
        const completed = jobs.filter(j => j.status === 'completed');
        const failed = jobs.filter(j => j.status === 'failed');
        const totalPosts = jobs.reduce((acc, j) => acc + (j.payload.slideshows?.length || 0), 0);
        return { pending: pending.length, completed: completed.length, failed: failed.length, totalPosts, total: jobs.length };
    };

    const toggleAccount = (accountId: string) => {
        setExpandedAccounts(prev => prev.includes(accountId) ? prev.filter(id => id !== accountId) : [...prev, accountId]);
    };

    // Determine account order — first account with pending/processing jobs runs first
    const getAccountOrder = (jobs: typeof jobQueue): number => {
        const hasPending = jobs.some(j => j.status === 'pending' || j.status === 'processing');
        if (!hasPending) return 999;
        const earliest = jobs.filter(j => j.status === 'pending' || j.status === 'processing')
            .sort((a, b) => new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime());
        return earliest.length > 0 ? new Date(earliest[0].scheduled_start_time).getTime() : 999;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <motion.div
                className="bg-[#09090b] w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-white/5">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent flex items-center">
                            <ListOrdered className="w-5 h-5 mr-3 text-primary" />
                            Background Job Queue
                        </h3>
                        {jobQueue.some(j => j.status === 'pending') && (
                            <div className="text-xs text-blue-400 mt-1 flex items-center gap-1.5 ml-8">
                                <Clock className="w-3 h-3" />
                                Next Batch: {(() => {
                                    const pending = jobQueue.filter(j => j.status === 'pending')
                                        .sort((a, b) => new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime());
                                    return new Date(pending[0].scheduled_start_time).toLocaleString();
                                })()}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={rescheduleQueue} className="text-xs bg-primary/5 hover:bg-primary/10 text-primary-foreground hidden sm:flex">
                            <RefreshCw className="w-3.5 h-3.5 mr-2" /> Sync & Calibrate
                        </Button>
                        <Button variant="ghost" size="sm" onClick={refreshQueue} className="hover:bg-white/10">
                            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/10 rounded-full">
                            <X className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </div>
                </div>

                {/* Summary */}
                <div className="px-6 py-3 bg-white/5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-2"><User className="w-4 h-4" /><span className="text-white font-medium">{accountGroups.size}</span> Accounts</div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2"><Layers className="w-4 h-4" /><span className="text-white font-medium">{totalBatches}</span> Batches</div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2"><ListOrdered className="w-4 h-4" /><span className="text-white font-medium">{totalPosts}</span> Posts</div>
                        <div className="w-px h-4 bg-white/10" />
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span className="text-blue-400 font-medium">{pendingPosts}</span> Pending</div>
                    </div>
                    {jobQueue.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={toggleExpandAll} className="text-xs h-7 hover:bg-white/10">
                            {expandedJobs.length === jobQueue.length ? (<><ChevronDown className="w-3 h-3 mr-1.5" /> Collapse All</>) : (<><ChevronRight className="w-3 h-3 mr-1.5" /> Expand All ({jobQueue.length})</>)}
                        </Button>
                    )}
                </div>

                {/* Content — Grouped by Account */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {jobQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed border-white/10 rounded-xl">
                            <ListOrdered className="w-12 h-12 mb-4 opacity-20" />
                            <p>No jobs in the queue</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Array.from(accountGroups.entries())
                                .sort(([, a], [, b]) => getAccountOrder(a) - getAccountOrder(b))
                                .map(([accountId, accountJobs], accountIdx) => {
                                    const profile = getProfileInfo(accountId);
                                    const stats = getAccountStats(accountJobs);
                                    const isExpanded = expandedAccounts.includes(accountId);
                                    const isActiveAccount = accountJobs.some(j => j.status === 'processing');
                                    const isNextAccount = !isActiveAccount && accountJobs.some(j => j.status === 'pending');

                                    return (
                                        <div key={accountId} className="rounded-xl overflow-hidden bg-white/[0.02]">
                                            {/* Account Header */}
                                            <button
                                                onClick={() => toggleAccount(accountId)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-4 py-3 transition-colors",
                                                    isActiveAccount ? "bg-blue-500/10" : isNextAccount ? "bg-white/5" : "bg-white/[0.02]",
                                                    "hover:bg-white/[0.06]"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                                    {profile.avatar ? (
                                                        <img src={profile.avatar} alt={profile.displayName} className="w-8 h-8 rounded-full ring-2 ring-white/10" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center ring-2 ring-white/10">
                                                            <User className="w-4 h-4 text-white/70" />
                                                        </div>
                                                    )}
                                                    <div className="text-left">
                                                        <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                            {profile.displayName || 'Unknown Account'}
                                                            {isActiveAccount && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold uppercase flex items-center gap-1">
                                                                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Active
                                                                </span>
                                                            )}
                                                            {!isActiveAccount && isNextAccount && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold uppercase">Queued</span>
                                                            )}
                                                        </div>
                                                        {profile.username && <div className="text-xs text-muted-foreground">@{profile.username}</div>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{stats.total} {stats.total === 1 ? 'batch' : 'batches'}</span>
                                                    <span className="text-white/40">•</span>
                                                    <span>{stats.totalPosts} posts</span>
                                                    {stats.pending > 0 && (<><span className="text-white/40">•</span><span className="text-blue-400">{stats.pending} pending</span></>)}
                                                    {stats.completed > 0 && (<><span className="text-white/40">•</span><span className="text-green-400">{stats.completed} done</span></>)}
                                                    {stats.failed > 0 && (<><span className="text-white/40">•</span><span className="text-red-400">{stats.failed} failed</span></>)}
                                                </div>
                                            </button>

                                            {/* Account Jobs */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 space-y-2">
                                                    {accountJobs.map((job) => (
                                                        <div key={job.id} className="relative flex flex-col bg-black/40 rounded-xl overflow-hidden hover:bg-black/50 transition-all">
                                                            <div
                                                                className={cn("flex items-center justify-between p-3 cursor-pointer transition-colors", expandedJobs.includes(job.id) ? "bg-white/5" : "hover:bg-white/[0.02]")}
                                                                onClick={() => {
                                                                    const expanding = !expandedJobs.includes(job.id);
                                                                    setExpandedJobs(prev => expanding ? [...prev, job.id] : prev.filter(id => id !== job.id));
                                                                    if (expanding) fetchLogs(job.id);
                                                                }}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
                                                                        job.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                                                        job.status === 'processing' ? "bg-blue-500/10 text-blue-500" :
                                                                        job.status === 'failed' ? "bg-red-500/10 text-red-500" : "bg-white/5 text-muted-foreground"
                                                                    )}>
                                                                        {job.status === 'completed' ? <CheckCircle className="w-4 h-4" /> :
                                                                         job.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                                                         job.status === 'failed' ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <span className={cn("text-xs font-bold px-2 py-0.5 rounded text-black",
                                                                                job.status === 'completed' ? "bg-green-500" : job.status === 'processing' ? "bg-blue-500" : "bg-white"
                                                                            )}>Batch {job.batch_index}/{job.total_batches}</span>
                                                                            <span className="text-xs font-medium text-white/90">• {job.payload.slideshows.length} Posts</span>
                                                                        </div>
                                                                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                                            <span className="bg-white/5 px-1.5 py-0.5 rounded">{job.payload.strategy}</span>
                                                                            <span>•</span>
                                                                            <span>Scheduled: {new Date(job.scheduled_start_time).toLocaleString()}</span>
                                                                            {job.status === 'pending' && new Date(job.scheduled_start_time) > new Date() && (
                                                                                <span className="text-blue-400 ml-1">
                                                                                    (in {(() => {
                                                                                        const m = Math.ceil((new Date(job.scheduled_start_time).getTime() - Date.now()) / 60000);
                                                                                        const h = Math.floor(m / 60);
                                                                                        return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
                                                                                    })()})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {job.error && <div className="text-xs text-red-400 mt-0.5">Error: {job.error}</div>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {expandedJobs.includes(job.id) ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                                                    <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7"
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}>
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* Expanded: Posts list */}
                                                            {expandedJobs.includes(job.id) && job.status !== 'processing' && (
                                                                <div className="px-3 pb-3 bg-black/20">
                                                                    <div className="text-xs text-muted-foreground my-2 font-medium flex items-center gap-2">
                                                                        <ListOrdered className="w-3 h-3" /><span>Posts in this batch</span><div className="h-px bg-white/10 flex-1" />
                                                                    </div>
                                                                    <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                                                        {job.payload.slideshows.map((slideshow, sIdx) => (
                                                                            <div key={slideshow.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs bg-white/5">
                                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                                    <span className="text-muted-foreground font-mono">#{sIdx + 1}</span>
                                                                                    <span className="truncate text-white/90">{slideshow.title}</span>
                                                                                    <span className="text-muted-foreground ml-2 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">
                                                                                        {getPostTime(job, sIdx).toLocaleString([], { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                </div>
                                                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Processing indicator */}
                                                            {expandedJobs.includes(job.id) && job.status === 'processing' && (
                                                                <div className="px-3 pb-3 bg-black/20">
                                                                    <div className="flex flex-col items-center justify-center py-4 text-muted-foreground space-y-2">
                                                                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                                                        <span className="text-xs">Processing in background (Server)...</span>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Logs */}
                                                            {expandedJobs.includes(job.id) && (
                                                                <div className="px-3 pb-3 bg-white/[0.02]">
                                                                    <div className="text-xs text-muted-foreground my-2 font-medium flex items-center justify-between">
                                                                        <div className="flex items-center gap-2"><RefreshCw className={cn("w-3 h-3", isRefreshingLogs && "animate-spin")} /><span>Logs</span></div>
                                                                        <button onClick={(e) => { e.stopPropagation(); fetchLogs(job.id); }} className="text-[10px] text-blue-400 hover:underline">Refresh</button>
                                                                    </div>
                                                                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar bg-black/40 rounded-lg p-2 font-mono text-[10px]">
                                                                        {jobLogs[job.id]?.length > 0 ? (
                                                                            jobLogs[job.id].map((log) => (
                                                                                <div key={log.id} className="flex gap-2">
                                                                                    <span className="text-muted-foreground/50">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                                                                                    <span className={cn("font-bold uppercase", log.level === 'error' ? "text-red-400" : log.level === 'warning' ? "text-yellow-400" : "text-blue-400")}>[{log.level}]</span>
                                                                                    <span className="text-white/80">{log.message}</span>
                                                                                </div>
                                                                            ))
                                                                        ) : (<div className="text-center py-2 text-muted-foreground italic">No logs yet.</div>)}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
                        Jobs run sequentially by account. First account completes before second starts.
                    </div>
                    <div className="flex gap-2">
                        {jobQueue.some(j => ['pending', 'processing'].includes(j.status)) && (
                            <Button variant="outline" size="sm" onClick={handleClearPending} className="hover:bg-white/5 text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4 mr-2" /> Clear Pending
                            </Button>
                        )}
                        {jobQueue.some(j => j.status === 'pending') && (
                            <Button variant="outline" size="sm" onClick={rescheduleQueue} className="hover:bg-white/5 text-blue-400 hover:text-blue-300">
                                <Clock className="w-4 h-4 mr-2" /> Reschedule All
                            </Button>
                        )}
                        {jobQueue.some(j => ['completed', 'failed'].includes(j.status)) && (
                            <Button variant="outline" size="sm" onClick={handleClearCompleted} className="hover:bg-white/5">Clear Completed</Button>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

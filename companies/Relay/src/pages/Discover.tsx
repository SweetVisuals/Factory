import { useState, useEffect, useMemo, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { fetchLists, removeDuplicatesFromList, removeLeadFromList, removeLeadsFromList, deleteList, deleteMultipleLists, findCrossListDuplicates, removeDuplicateEntries, CrossListDuplicate, fetchFolders, createFolder, updateFolder, deleteFolder, moveListToFolder, moveMultipleListsToFolder } from '../lib/api/lists';
import { Lead } from '../types';
import { LeadTable } from '../components/lead-scraper/LeadTable';
import { CampaignSelector } from '../components/lead-scraper/CampaignSelector';
import { List, Search, Hash, AlertTriangle, Trash2, Copy, ChevronDown, ChevronUp, X, Zap, Folder, FolderPlus, MoreVertical, Edit2, Move, ShieldCheck, Loader2, Sparkles, Filter, Terminal, Brain, Activity } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { toast } from '../components/ui/use-toast';
import { cn } from '../lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { Archive, Database, Download } from 'lucide-react';
import LeadScraperForm from '../components/lead-scraper/LeadScraperForm';
import LeadScraperResults from '../components/lead-scraper/LeadScraperResults';
import { api } from '../lib/api/api';

const Discover = () => {
    const [lists, setLists] = useState<any[]>([]);
    const [folders, setFolders] = useState<any[]>([]);
    const [selectedListId, setSelectedListId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
    const [showCampaignSelect, setShowCampaignSelect] = useState(false);
    const [isCleaning, setIsCleaning] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDuplicateCardExpanded, setIsDuplicateCardExpanded] = useState(false);
    const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);
    const [removingEmail, setRemovingEmail] = useState<string | null>(null);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

    // Multi-selection and Drag & Drop state
    const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
    const [draggedLists, setDraggedLists] = useState<string[]>([]);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [lastSelectedListId, setLastSelectedListId] = useState<string | null>(null);

    // Local Archives State
    const [localLists, setLocalLists] = useState<any[]>([]);
    const [selectedLocalFilename, setSelectedLocalFilename] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [activeTab, setActiveTab] = useState<'cloud' | 'local' | 'discovery'>('cloud');

    // Scraper States
    const [searchResults, setSearchResults] = useState<Lead[]>([]);
    const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'running' | 'paused'>('idle');
    const [hasSearched, setHasSearched] = useState(false);
    const [logs, setLogs] = useState<{ timestamp: string, message: string }[]>([]);


    // Scraper Initialization
    useEffect(() => {
        const initPage = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const config = {
                headers: { Authorization: `Bearer ${session.access_token}` }
            };

            try {
                const { data } = await supabase.rpc('get_unmanaged_leads');
                if (data && data.length > 0) {
                    setSearchResults(data as Lead[]);
                    setHasSearched(true);
                }
            } catch (err) {
                console.error('Error fetching unmanaged leads:', err);
            }

            try {
                const activeRes = await api.get('/scraper-active', config);
                if (activeRes.data.active) {
                    setScrapeStatus(activeRes.data.status || 'running');
                    setHasSearched(true);
                }
            } catch (e) { }
        };
        initPage();
    }, []);

    // Scraper Polling and Realtime Subscriptions
    useEffect(() => {
        let interval: any;
        let channel: any;

        const setupRealtime = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            channel = supabase
                .channel(`scraped-leads-${session.user.id}`)
                .on(
                    'broadcast',
                    { event: 'new-lead' },
                    (payload) => {
                        const newLead = payload.payload as Lead;
                        if (!newLead || !newLead.id) return;
                        setSearchResults(prev => {
                            const exists = prev.some(l => l.id === newLead.id || (l.email && l.email === newLead.email));
                            if (exists) return prev;
                            return [newLead, ...prev];
                        });
                    }
                )
                .on(
                    'broadcast',
                    { event: 'scrape-status' },
                    (payload) => {
                        if (payload.payload.status) {
                            setScrapeStatus(payload.payload.status);
                            setHasSearched(true);
                        }
                    }
                )
                .on(
                    'broadcast',
                    { event: 'scrape-log' },
                    (payload) => {
                        const newLog = payload.payload;
                        if (newLog && newLog.message) {
                            setLogs(prev => {
                                const exists = prev.some(l => l.timestamp === newLog.timestamp && l.message === newLog.message);
                                if (exists) return prev;
                                const updated = [...prev, newLog];
                                return updated.slice(-200); // Keep last 200
                            });
                        }
                    }
                )
                .subscribe();
        };

        setupRealtime();

        interval = setInterval(async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const config = {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                };

                const logRes = await api.get('/scraper-logs', config);
                if (Array.isArray(logRes.data) && logRes.data.length > 0) {
                    setLogs(logRes.data);
                }

                const activeRes = await api.get('/scraper-active', config);
                if (activeRes.data) {
                    if (!activeRes.data.active && scrapeStatus !== 'idle') {
                        setScrapeStatus('idle');
                    } else if (activeRes.data.active && activeRes.data.status && activeRes.data.status !== scrapeStatus) {
                        setScrapeStatus(activeRes.data.status);
                    }
                }
            } catch (e) {
                // console.error('Polling error:', e);
            }
        }, 2000);

        return () => {
            if (interval) clearInterval(interval);
            if (channel) supabase.removeChannel(channel);
        };
    }, [scrapeStatus]);

    const handleSearch = async (searchParams: any) => {
        setScrapeStatus('running');
        setHasSearched(true);
        setSearchResults([]); 
        setLogs([{ timestamp: new Date().toISOString(), message: 'Initializing AI Brain...' }]);
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setScrapeStatus('idle');
                return;
            }

            api.post('/scrape-leads', searchParams, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            }).catch((error: any) => {
                setScrapeStatus('idle');
            });

        } catch (error: any) {
            setScrapeStatus('idle');
        }
    };

    const handlePause = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await api.post('/scraper-pause', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
            setScrapeStatus('paused');
        } catch (e) {}
    };

    const handleResume = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await api.post('/scraper-resume', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
            setScrapeStatus('running');
        } catch (e) {}
    };

    const handleCancel = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            await api.post('/scraper-cancel', {}, { headers: { Authorization: `Bearer ${session.access_token}` } });
            setScrapeStatus('idle');
        } catch (e) {}
    };

    const handleClearResults = async () => {
        setSearchResults([]);
        setLogs([]);
        setHasSearched(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                await supabase.rpc('clear_unmanaged_leads');
            }
        } catch (e) {}
    };

    const handleDeleteScrapeLead = async (leadId: string) => {
        setSearchResults(prev => prev.filter(l => l.id !== leadId));
        try {
            await supabase.from('leads').delete().eq('id', leadId);
        } catch (err) {}
    };

    // Folder Validation State
    const [isFolderValidating, setIsFolderValidating] = useState(false);
    const [folderValidationStats, setFolderValidationStats] = useState({ total: 0, current: 0, valid: 0, invalid: 0 });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [listsData, foldersData, localData] = await Promise.all([
                fetchLists().then(res => res || []),
                fetchFolders().then(res => res || []),
                axios.get('/api/local-lists').then(res => res.data?.lists || []).catch(() => [])
            ]);
            setLists(listsData);
            setFolders(foldersData);
            setLocalLists(localData);
            
            if (listsData && listsData.length > 0 && !selectedListId) {
                setSelectedListId(listsData[0].id);
                setActiveTab('cloud');
            } else if (localData && localData.length > 0 && !selectedListId) {
                setSelectedLocalFilename(localData[0].filename);
                setActiveTab('local');
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadLists = async () => {
        try {
            const data = await fetchLists();
            setLists(data);
        } catch (error) {
            console.error('Error loading lists:', error);
        }
    };

    // Cross-list duplicate detection
    const crossListDuplicates = useMemo(() => {
        return findCrossListDuplicates(lists);
    }, [lists]);

    const hasDuplicates = (list: any) => {
        if (!list || !list.list_leads) return false;
        const emails = list.list_leads
            .map((item: any) => item.lead?.email?.toLowerCase())
            .filter(Boolean);
        const uniqueEmails = new Set(emails);
        return emails.length > uniqueEmails.size;
    };

    const handleDeleteList = async (listId: string) => {
        if (!window.confirm("Delete this registry? This cannot be reversed.")) {
            return;
        }

        try {
            setIsDeleting(true);
            await deleteList(listId);

            toast({
                title: "Registry Removed",
                description: "The target list has been purged.",
            });

            if (selectedListId === listId) {
                const remainingLists = lists.filter(l => l.id !== listId);
                setSelectedListId(remainingLists.length > 0 ? remainingLists[0].id : null);
            }
            
            if (selectedListIds.has(listId)) {
                setSelectedListIds(prev => {
                    const next = new Set(prev);
                    next.delete(listId);
                    return next;
                });
            }

            await loadLists();
        } catch (error) {
            console.error('Error deleting list:', error);
            toast({
                title: "Error",
                description: "Failed to purge registry",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteSelectedLists = async () => {
        const count = selectedListIds.size;
        if (count === 0) return;
        
        if (!window.confirm(`Purge ${count} selected registries? This cannot be reversed.`)) {
            return;
        }

        try {
            setIsDeleting(true);
            await deleteMultipleLists(Array.from(selectedListIds));

            toast({
                title: "Purge Complete",
                description: `${count} registries have been removed.`,
            });

            const remainingLists = lists.filter(l => !selectedListIds.has(l.id));
            setLists(remainingLists);
            
            if (selectedListId && selectedListIds.has(selectedListId)) {
                setSelectedListId(remainingLists.length > 0 ? remainingLists[0].id : null);
            }
            
            setSelectedListIds(new Set());
            setLastSelectedListId(null);
            
            await loadLists();
        } catch (error) {
            console.error('Error deleting selected lists:', error);
            toast({
                title: "Error",
                description: "Purge sequence failed",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleRemoveDuplicates = async (listId: string) => {
        try {
            setIsCleaning(true);
            const removedCount = await removeDuplicatesFromList(listId);
            toast({
                title: "Cleanup Complete",
                description: `Removed ${removedCount} duplicate targets.`,
            });
            await loadLists();
        } catch (error) {
            console.error('Error removing duplicates:', error);
            toast({
                title: "Error",
                description: "Cleanup sequence failed",
                variant: "destructive",
            });
        } finally {
            setIsCleaning(false);
        }
    };

    const handleDeleteLead = async (leadId: string) => {
        if (!selectedListId) return;

        try {
            setLists(prevLists => prevLists.map(list => {
                if (list.id === selectedListId) {
                    return {
                        ...list,
                        list_leads: list.list_leads.filter((item: any) => item.lead.id !== leadId)
                    };
                }
                return list;
            }));

            await removeLeadFromList(selectedListId, leadId);

            toast({
                title: "Target Removed",
                description: "Individual target purged from registry.",
            });
        } catch (error) {
            console.error('Error removing lead:', error);
            await loadLists();
            toast({
                title: "Error",
                description: "Failed to remove target",
                variant: "destructive",
            });
        }
    };

    const handleRemoveSingleDuplicate = async (duplicate: CrossListDuplicate) => {
        try {
            setRemovingEmail(duplicate.email);
            const [_keep, ...toRemove] = duplicate.lists;
            const entriesToRemove = toRemove.map(entry => ({
                listId: entry.listId,
                leadId: entry.leadId,
            }));

            const removedCount = await removeDuplicateEntries(entriesToRemove);
            toast({
                title: "Cleaned",
                description: `Purged ${duplicate.email} from ${removedCount} registries.`,
            });
            await loadLists();
        } catch (error) {
            console.error('Error removing duplicate:', error);
            toast({
                title: "Error",
                description: "Failed to remove duplicate",
                variant: "destructive",
            });
        } finally {
            setRemovingEmail(null);
        }
    };

    const handleRemoveAllCrossListDuplicates = async () => {
        if (!window.confirm(`Purge ${crossListDuplicates.length} duplicate targets across all registries?`)) {
            return;
        }

        try {
            setIsRemovingDuplicates(true);
            const allEntries: { listId: string; leadId: string }[] = [];

            for (const duplicate of crossListDuplicates) {
                const [_keep, ...toRemove] = duplicate.lists;
                toRemove.forEach(entry => {
                    allEntries.push({ listId: entry.listId, leadId: entry.leadId });
                });
            }

            const removedCount = await removeDuplicateEntries(allEntries);
            toast({
                title: "System Cleaned",
                description: `Purged ${removedCount} duplicate entries globally.`,
            });
            await loadLists();
        } catch (error) {
            console.error('Error removing all duplicates:', error);
            toast({
                title: "Error",
                description: "Global cleanup failed",
                variant: "destructive",
            });
        } finally {
            setIsRemovingDuplicates(false);
        }
    };

    const handleRemoveInvalidLeads = async (invalidLeadIds: string[]) => {
        if (!selectedListId) return;

        try {
            setLists(prevLists => prevLists.map(list => {
                if (list.id === selectedListId) {
                    return {
                        ...list,
                        list_leads: list.list_leads.filter((item: any) => !invalidLeadIds.includes(item.lead.id))
                    };
                }
                return list;
            }));

            await removeLeadsFromList(selectedListId, invalidLeadIds);

            toast({
                title: "Registry Optimized",
                description: `Purged ${invalidLeadIds.length} invalid targets.`,
            });
        } catch (error) {
            console.error('Error removing invalid leads:', error);
            await loadLists();
            toast({
                title: "Error",
                description: "Failed to optimize registry",
                variant: "destructive",
            });
        }
    };

    const handleValidateFolder = async (folderId: string) => {
        const folderLists = lists.filter(l => l.folder_id === folderId);
        const folderLeads = folderLists.flatMap(l => l.list_leads?.map((ll: any) => ll.lead) || []);
        const leadsToValidate = folderLeads.filter(l => l.email && (!l.validation_status || l.validation_status === 'idle'));
        const uniqueLeadsToValidate = Array.from(new Map(leadsToValidate.map(l => [l.email, l])).values());

        if (uniqueLeadsToValidate.length === 0) {
            toast({ title: "Analysis Complete", description: "No new targets require validation in this sector." });
            return;
        }

        setIsFolderValidating(true);
        setFolderValidationStats({ total: uniqueLeadsToValidate.length, current: 0, valid: 0, invalid: 0 });

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            let validCount = 0;
            let invalidCount = 0;

            const chunkSize = 5;
            for (let i = 0; i < uniqueLeadsToValidate.length; i += chunkSize) {
                const chunk = uniqueLeadsToValidate.slice(i, i + chunkSize);

                await Promise.all(chunk.map(async (lead) => {
                    try {
                        const res = await axios.post('/api/validate-email', {
                            email: lead.email,
                            leadId: lead.id
                        }, {
                            headers: { Authorization: token ? `Bearer ${token}` : '' }
                        });

                        if (res.data.success) {
                            if (res.data.isValid) validCount++;
                            else invalidCount++;
                        } else {
                            invalidCount++;
                        }
                    } catch (e) {
                        invalidCount++;
                    }
                }));

                setFolderValidationStats(prev => ({
                    ...prev,
                    current: i + chunk.length > prev.total ? prev.total : i + chunk.length,
                    valid: validCount,
                    invalid: invalidCount
                }));
            }

            toast({
                title: "Validation Finished",
                description: `Analyzed ${uniqueLeadsToValidate.length} targets. ${validCount} valid, ${invalidCount} purged.`,
            });
            await loadLists();
        } catch (error) {
            console.error('Error validating folder:', error);
            toast({ title: "Error", description: "Validation sequence interrupted", variant: "destructive" });
        } finally {
            setIsFolderValidating(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            await createFolder(newFolderName.trim());
            setNewFolderName('');
            setIsCreatingFolder(false);
            const foldersData = await fetchFolders();
            setFolders(foldersData);
            toast({ title: "Sector Created", description: "Target sector successfully established." });
        } catch (error) {
            console.error('Error creating folder:', error);
            toast({ title: "Error", description: "Failed to establish sector", variant: "destructive" });
        }
    };

    const handleUpdateFolder = async (id: string, name: string) => {
        try {
            await updateFolder(id, name);
            setEditingFolderId(null);
            const foldersData = await fetchFolders();
            setFolders(foldersData);
            toast({ title: "Success", description: "Sector renamed." });
        } catch (error) {
            console.error('Error updating folder:', error);
            toast({ title: "Error", description: "Failed to rename sector", variant: "destructive" });
        }
    };

    const handleDeleteFolder = async (id: string) => {
        if (!window.confirm("Dissolve this sector? Registries will be moved to unassigned.")) return;
        try {
            await deleteFolder(id);
            const [listsData, foldersData] = await Promise.all([fetchLists(), fetchFolders()]);
            setLists(listsData);
            setFolders(foldersData);
            toast({ title: "Sector Dissolved", description: "Target registries preserved in root." });
        } catch (error) {
            console.error('Error deleting folder:', error);
            toast({ title: "Error", description: "Failed to dissolve sector", variant: "destructive" });
        }
    };

    const handleMoveToList = async (listId: string, folderId: string | null) => {
        try {
            if (selectedListIds.has(listId) && selectedListIds.size > 1) {
                await moveMultipleListsToFolder(Array.from(selectedListIds), folderId);
                toast({ title: "Transfer Complete", description: `${selectedListIds.size} registries relocated.` });
                setSelectedListIds(new Set());
            } else {
                await moveListToFolder(listId, folderId);
                toast({ title: "Transfer Complete", description: "Registry relocated." });
                setSelectedListIds(new Set());
            }
            await loadLists();
        } catch (error) {
            console.error('Error moving list:', error);
            toast({ title: "Error", description: "Transfer sequence failed", variant: "destructive" });
        }
    };

    const handleDragStart = (e: React.DragEvent, listId: string) => {
        let toDrag = [listId];
        if (selectedListIds.has(listId)) {
            toDrag = Array.from(selectedListIds);
        } else {
            setSelectedListIds(new Set([listId]));
        }
        setDraggedLists(toDrag);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedLists([]);
        setDropTargetId(null);
    };

    const handleDragOver = (e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropTargetId !== folderId) {
            setDropTargetId(folderId);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDropTargetId(null);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        const itemsToMove = draggedLists;
        setDraggedLists([]);
        setDropTargetId(null);

        if (itemsToMove.length === 0) return;

        try {
            await moveMultipleListsToFolder(itemsToMove, targetFolderId);
            toast({
                title: "Relocation Complete",
                description: `Transferred ${itemsToMove.length} registries.`
            });
            setSelectedListIds(new Set());
            await loadLists();
        } catch (error) {
            console.error('Error moving lists:', error);
            toast({ title: "Error", description: "Relocation failed", variant: "destructive" });
        }
    };

    const handleListClick = (e: React.MouseEvent, listId: string, index: number, arrayToSelectFrom: any[]) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedListIds(prev => {
                const next = new Set(prev);
                if (next.has(listId)) next.delete(listId);
                else next.add(listId);
                return next;
            });
            setLastSelectedListId(listId);
            setSelectedListId(listId);
        } else if (e.shiftKey && lastSelectedListId) {
            const lastIdx = arrayToSelectFrom.findIndex((l: any) => l.id === lastSelectedListId);
            const thisIdx = index;
            if (lastIdx !== -1 && thisIdx !== -1) {
                const start = Math.min(lastIdx, thisIdx);
                const end = Math.max(lastIdx, thisIdx);
                const newSelection = new Set(selectedListIds);
                for (let i = start; i <= end; i++) {
                    newSelection.add(arrayToSelectFrom[i].id);
                }
                setSelectedListIds(newSelection);
            }
            setSelectedListId(listId);
        } else {
            setSelectedListId(listId);
            setSelectedListIds(new Set([listId]));
            setLastSelectedListId(listId);
        }
    };

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    const selectedList = lists.find(l => l.id === selectedListId);
    const currentLeads: Lead[] = selectedList?.list_leads?.map((item: any) => item.lead) || [];
    const duplicatesFound = selectedList ? hasDuplicates(selectedList) : false;

    const filteredLists = lists.filter(list =>
        list.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groupedLists = useMemo(() => {
        const groups: Record<string, any[]> = { unassigned: [] };
        folders.forEach(f => groups[f.id] = []);

        filteredLists.forEach(list => {
            if (list.folder_id && groups[list.folder_id]) {
                groups[list.folder_id].push(list);
            } else {
                groups.unassigned.push(list);
            }
        });
        return groups;
    }, [filteredLists, folders]);

    const folderLeadCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        folders.forEach(folder => {
            const folderLists = lists.filter(l => l.folder_id === folder.id);
            const totalLeads = folderLists.reduce((sum, list) => sum + (list.list_leads?.length || 0), 0);
            counts[folder.id] = totalLeads;
        });
        return counts;
    }, [lists, folders]);

    const renderListCard = (list: any, index: number, arrayContext: any[]) => {
        const isDuplicate = hasDuplicates(list);
        const isSelected = selectedListIds.has(list.id);
        const isDragging = draggedLists.includes(list.id);
        const isActive = selectedListId === list.id;

        return (
            <div
                key={list.id}
                onClick={(e) => handleListClick(e, list.id, index, arrayContext)}
                draggable
                onDragStart={(e) => handleDragStart(e, list.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                    "cursor-pointer p-4 rounded-none transition-all group relative overflow-hidden active:cursor-grabbing",
                    isDragging ? "opacity-50 scale-[0.98] bg-primary/5" : "",
                    isSelected
                        ? "bg-primary/10"
                        : isActive
                            ? "bg-foreground/[0.03]"
                            : "bg-foreground/[0.01] hover:bg-foreground/[0.02]"
                )}
            >
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "p-1.5 rounded-none transition-all",
                            isSelected || isActive ? "text-primary bg-primary/10" : "text-muted-foreground/30 bg-foreground/[0.02]"
                        )}>
                            <List size={14} />
                        </div>
                        {isDuplicate && (
                            <div className="w-1.5 h-1.5 rounded-none bg-destructive animate-pulse" />
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/40 font-black font-mono tracking-widest">
                            {list.list_leads?.length || 0}
                        </span>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                                    <MoreVertical size={16} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[#000000] border border-white/10 rounded-xl shadow-2xl">
                                <DropdownMenuItem onClick={() => handleMoveToList(list.id, null)} disabled={!list.folder_id} className="text-[10px] font-black uppercase tracking-widest gap-2">
                                    <Move size={12} />
                                    Relocate to Root
                                </DropdownMenuItem>
                                {folders.filter(f => f.id !== list.folder_id).map(folder => (
                                    <DropdownMenuItem key={folder.id} onClick={() => handleMoveToList(list.id, folder.id)} className="text-[10px] font-black uppercase tracking-widest gap-2">
                                        <Folder size={12} />
                                        Move to: {folder.name}
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuItem className="text-destructive text-[10px] font-black uppercase tracking-widest gap-2" onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id); }}>
                                    <Trash2 size={12} />
                                    Purge Registry
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <h3 className={cn(
                    "text-[11px] font-black uppercase tracking-[0.1em] truncate pr-4 transition-colors",
                    isSelected || isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
                )}>
                    {list.name}
                </h3>
                
                {isSelected && (
                    <div className="absolute inset-y-0 left-0 w-[2px] bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                )}
            </div>
        );
    };

    return (
        <Layout>
            <div className="flex flex-col h-[calc(100vh-theme(spacing.12))] gap-6 p-6 overflow-y-auto">
                {/* Borderless Tab Selector */}
                <div className="flex gap-2 p-1 bg-foreground/[0.02] w-fit">
                    <button
                        onClick={() => {
                            setActiveTab('cloud');
                            if (lists.length > 0 && !selectedListId) {
                                setSelectedListId(lists[0].id);
                                setSelectedLocalFilename(null);
                            }
                        }}
                        className={cn(
                            "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab !== 'discovery' 
                                ? "bg-primary text-primary-foreground shadow-lg" 
                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
                        )}
                    >
                        Target Registry
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('discovery');
                            setSelectedListId(null);
                            setSelectedLocalFilename(null);
                        }}
                        className={cn(
                            "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                            activeTab === 'discovery' 
                                ? "bg-primary text-primary-foreground shadow-lg" 
                                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
                        )}
                    >
                        Discovery Engine
                    </button>
                </div>
                {/* Cross-List Duplicate Alert */}
                {crossListDuplicates.length > 0 && (
                    <div className="bg-foreground/[0.01] rounded-none overflow-hidden transition-all duration-700 animate-in fade-in slide-in-from-top-4">
                        <div
                            className="flex items-center justify-between px-8 py-6 cursor-pointer hover:bg-foreground/[0.01] transition-all"
                            onClick={() => setIsDuplicateCardExpanded(!isDuplicateCardExpanded)}
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-none bg-amber-500/10">
                                    <Sparkles className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-3">
                                        Global Redundancies
                                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-3 py-1 tracking-[0.2em]">
                                            {crossListDuplicates.length} DETECTED
                                        </span>
                                    </h3>
                                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.15em] mt-1">
                                        Targets appearing across multiple registries
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {isDuplicateCardExpanded && (
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveAllCrossListDuplicates();
                                        }}
                                        disabled={isRemovingDuplicates}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest px-6 h-10 shadow-lg shadow-primary/20 rounded-none"
                                    >
                                        <Zap className="w-3 h-3 mr-2" />
                                        {isRemovingDuplicates ? 'Processing...' : 'Global Cleanup'}
                                    </Button>
                                )}
                                <div className={cn("p-2 bg-foreground/[0.02] text-muted-foreground/40 transition-transform duration-500 rounded-none", isDuplicateCardExpanded && "rotate-180")}>
                                    <ChevronDown size={14} />
                                </div>
                            </div>
                        </div>

                        {isDuplicateCardExpanded && (
                            <div className="px-8 pb-8 pt-2 animate-in slide-in-from-top-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-none">
                                    {crossListDuplicates.map((dup) => {
                                        const uniqueLists = Array.from(
                                            new Map(dup.lists.map(l => [l.listId, l.listName])).entries()
                                        );
                                        const isRemoving = removingEmail === dup.email;

                                        return (
                                            <div
                                                key={dup.email}
                                                className="flex flex-col p-5 bg-foreground/[0.02] hover:bg-foreground/[0.03] transition-all group relative overflow-hidden rounded-none"
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] font-black text-foreground truncate mb-3">{dup.email}</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {uniqueLists.map(([listId, listName]) => (
                                                                <span
                                                                    key={listId}
                                                                    className="inline-flex items-center text-[8px] font-black text-muted-foreground/60 bg-foreground/[0.02] px-2 py-1 uppercase tracking-widest"
                                                                >
                                                                    {listName}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRemoveSingleDuplicate(dup)}
                                                        disabled={isRemoving}
                                                        className="h-8 w-8 text-destructive/40 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-none"
                                                    >
                                                        {isRemoving ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Main area */}
                <div className="flex-1 flex gap-6 min-h-0">
                    {/* Sidebar */}
                    {activeTab !== 'discovery' && (
                        <div className="w-[320px] flex-shrink-0 flex flex-col gap-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">Target Registry</h1>
                                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">{lists.length} ACTIVE LISTS</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 bg-foreground/[0.02] hover:bg-primary/10 hover:text-primary transition-all duration-500 rounded-none"
                                    onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                                >
                                    <FolderPlus size={16} />
                                </Button>
                            </div>

                            {selectedListIds.size > 0 && (
                                <div className="p-4 bg-primary/10 flex items-center justify-between animate-in fade-in slide-in-from-top-4 duration-500 shadow-lg shadow-primary/5 rounded-none">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-none">
                                            <span className="text-[10px] font-black uppercase tracking-widest">{selectedListIds.size}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 text-[10px] font-black uppercase tracking-widest text-primary/60 hover:text-primary rounded-none"
                                            onClick={() => setSelectedListIds(new Set())}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-9 px-4 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-destructive/20 rounded-none"
                                        onClick={handleDeleteSelectedLists}
                                        disabled={isDeleting}
                                    >
                                        <Trash2 className="w-3 h-3 mr-2" />
                                        Purge
                                    </Button>
                                </div>
                            )}

                            {isCreatingFolder && (
                                <div className="flex items-center gap-2 p-2 bg-foreground/[0.01] animate-in zoom-in-95 duration-500 rounded-none">
                                    <Input
                                        placeholder="Sector name..."
                                        value={newFolderName}
                                        onChange={(e) => setNewFolderName(e.target.value)}
                                        className="h-10 text-[10px] font-black uppercase tracking-widest bg-transparent border-none focus-visible:ring-0 rounded-none"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCreateFolder();
                                            if (e.key === 'Escape') setIsCreatingFolder(false);
                                        }}
                                    />
                                    <Button size="sm" className="h-10 px-4 bg-primary text-primary-foreground rounded-none" onClick={handleCreateFolder}>ADD</Button>
                                </div>
                            )}

                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Filter registries..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-12 pl-12 bg-foreground/[0.01] border-none text-[10px] font-black uppercase tracking-widest focus-visible:ring-1 ring-primary/20 transition-all rounded-none"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-none">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="h-16 bg-foreground/[0.01] animate-pulse rounded-none" />
                                ))
                            ) : filteredLists.length === 0 ? (
                                <div className="text-center py-24 space-y-4">
                                    <div className="w-16 h-16 bg-foreground/[0.01] flex items-center justify-center mx-auto rounded-none">
                                        <Filter className="text-muted-foreground/10" size={32} />
                                    </div>
                                    <p className="text-[10px] font-black text-muted-foreground/20 uppercase tracking-[0.2em]">Silence Detected</p>
                                </div>
                            ) : (
                                <>
                                    {folders.map(folder => {
                                        const folderLists = groupedLists[folder.id] || [];
                                        const isExpanded = expandedFolders.has(folder.id);
                                        const leadCount = folderLeadCounts[folder.id] || 0;
                                        const isDropTarget = dropTargetId === folder.id;

                                        return (
                                            <div
                                                key={folder.id}
                                                className={cn(
                                                    "space-y-1 transition-all rounded-none p-1",
                                                    isDropTarget ? "bg-primary/10 shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]" : "bg-transparent"
                                                )}
                                                onDragOver={(e) => handleDragOver(e, folder.id)}
                                                onDragLeave={handleDragLeave}
                                                onDrop={(e) => handleDrop(e, folder.id)}
                                            >
                                                <div
                                                    className={cn(
                                                        "flex items-center justify-between group px-4 py-3 transition-all cursor-pointer rounded-none",
                                                        isExpanded ? "bg-foreground/[0.02]" : "hover:bg-foreground/[0.01]"
                                                    )}
                                                    onClick={() => toggleFolder(folder.id)}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={cn("transition-transform duration-500", isExpanded && "rotate-90")}>
                                                            <ChevronUp size={12} className="text-muted-foreground/30 rotate-90" />
                                                        </div>
                                                        <Folder size={14} className={cn("shrink-0 transition-colors", isExpanded ? "text-primary" : "text-muted-foreground/30")} />
                                                        <span className="text-[11px] font-black uppercase tracking-widest truncate text-foreground/80">{folder.name}</span>
                                                        <span className="text-[8px] font-black text-muted-foreground/30 bg-foreground/[0.02] px-2 py-0.5 tracking-widest rounded-none">
                                                            {leadCount}
                                                        </span>
                                                    </div>

                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                            <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                                                                <MoreVertical size={16} />
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="bg-[#000000] border border-white/10 rounded-xl shadow-2xl">
                                                            <DropdownMenuItem onClick={() => {
                                                                const newSelection = new Set(selectedListIds);
                                                                folderLists.forEach(l => newSelection.add(l.id));
                                                                setSelectedListIds(newSelection);
                                                            }} className="text-[10px] font-black uppercase tracking-widest gap-2">
                                                                <List size={12} />
                                                                Select Sector
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => {
                                                                const newName = window.prompt("Rename sector:", folder.name);
                                                                if (newName) handleUpdateFolder(folder.id, newName);
                                                            }} className="text-[10px] font-black uppercase tracking-widest gap-2">
                                                                <Edit2 size={12} />
                                                                Rename
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleValidateFolder(folder.id)} className="text-[10px] font-black uppercase tracking-widest gap-2">
                                                                <ShieldCheck size={12} />
                                                                Deep Validation
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive text-[10px] font-black uppercase tracking-widest gap-2" onClick={() => handleDeleteFolder(folder.id)}>
                                                                <Trash2 size={12} />
                                                                Dissolve Sector
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>

                                                {isExpanded && (
                                                    <div className="space-y-1 mt-1 pl-4 animate-in slide-in-from-top-2 duration-500">
                                                        {folderLists.length === 0 ? (
                                                            <p className="text-[8px] font-black text-muted-foreground/20 uppercase tracking-[0.2em] py-4 pl-8">Sector Offline</p>
                                                        ) : (
                                                            folderLists.map((list, idx) => renderListCard(list, idx, folderLists))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Local Archives Section */}
                                    <div className="pt-8">
                                        <div className="flex items-center justify-between px-4 mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40">Local Backups</h4>
                                            <span className="text-[8px] font-black text-muted-foreground/20 bg-foreground/[0.02] px-2 py-0.5 tracking-widest rounded-none">{localLists.length} FILES</span>
                                        </div>
                                        <div className="space-y-2">
                                            {localLists.map((local) => (
                                                <div
                                                    key={local.filename}
                                                    onClick={() => {
                                                        setSelectedLocalFilename(local.filename);
                                                        setActiveTab('local');
                                                        setSelectedListId(null);
                                                    }}
                                                    className={cn(
                                                        "cursor-pointer p-4 transition-all group relative overflow-hidden rounded-none",
                                                        selectedLocalFilename === local.filename && activeTab === 'local'
                                                            ? "bg-primary/10"
                                                            : "bg-foreground/[0.01] hover:bg-foreground/[0.02]"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Archive size={14} className={selectedLocalFilename === local.filename && activeTab === 'local' ? "text-primary" : "text-muted-foreground/30"} />
                                                                <div className="flex flex-col">
                                                                  <span className="text-[10px] font-black">{local.name}</span>
                                                                  <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">{local.niche}</span>
                                                                </div>
                                                        </div>
                                                        <span className="text-[8px] font-mono text-muted-foreground/20">{Math.round(local.size / 1024)} KB</span>
                                                    </div>
                                                    {selectedLocalFilename === local.filename && activeTab === 'local' && (
                                                        <div className="absolute inset-y-0 left-0 w-[2px] bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {groupedLists.unassigned.length > 0 && (
                                        <div
                                            className={cn(
                                                "space-y-2 transition-all p-1 group/unassigned rounded-none",
                                                dropTargetId === null && draggedLists.length > 0 ? "bg-primary/10 shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]" : "bg-transparent"
                                            )}
                                            onDragOver={(e) => handleDragOver(e, null)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, null)}
                                        >
                                            {folders.length > 0 && (
                                                <div className="flex items-center justify-between px-4 mt-8 mb-2">
                                                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 transition-colors duration-500">Unassigned</h4>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-5 px-2 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover/unassigned:opacity-100 transition-all rounded-none"
                                                        onClick={() => {
                                                            const newSelection = new Set(selectedListIds);
                                                            groupedLists.unassigned.forEach(l => newSelection.add(l.id));
                                                            setSelectedListIds(newSelection);
                                                        }}
                                                    >
                                                        SELECT ALL
                                                    </Button>
                                                </div>
                                            )}
                                            {groupedLists.unassigned.map((list, idx) => renderListCard(list, idx, groupedLists.unassigned))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                    {/* Main Workspace */}
                    <div className="flex-1 flex flex-col h-full overflow-hidden bg-foreground/[0.01] relative rounded-none">
                        {activeTab === 'discovery' ? (
                            <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700">
                                {/* Scraper Header Section */}
                                <div className="p-10 flex justify-between items-center relative overflow-hidden shrink-0">
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-20" />
                                    <div className="relative z-10 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-primary/10 flex items-center justify-center text-primary rounded-none">
                                            <Brain size={24} />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter leading-none">Discovery Engine</h2>
                                            <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.15em] mt-2">
                                                Autonomous lead extraction & AI intent enrichment
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4 relative z-10">
                                        {scrapeStatus !== 'idle' && (
                                            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-none">
                                                <div className="w-1.5 h-1.5 bg-primary animate-pulse rounded-none" />
                                                <span className="text-[9px] font-black uppercase tracking-widest">{scrapeStatus}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 px-4 py-2 bg-foreground/[0.02] text-muted-foreground/40 rounded-none">
                                            <Activity size={12} />
                                            <span className="text-[9px] font-black uppercase tracking-widest">System Online</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-10 pb-10 space-y-8 scrollbar-none">
                                    <div className="bg-card p-8 rounded-none">
                                        <LeadScraperForm onSearch={handleSearch} />
                                    </div>

                                    {/* Main Content Area */}
                                    <div className="pb-10">
                                        <LeadScraperResults
                                            results={searchResults}
                                            scrapeStatus={scrapeStatus}
                                            hasSearched={hasSearched}
                                            logs={logs}
                                            onClearResults={handleClearResults}
                                            onDeleteLead={handleDeleteScrapeLead}
                                            onPause={handlePause}
                                            onResume={handleResume}
                                            onCancel={handleCancel}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'cloud' && selectedList ? (
                            <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700">
                                <div className="p-10 flex justify-between items-center relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-20" />
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-4">
                                            <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter leading-none">{selectedList.name}</h2>
                                            {duplicatesFound && (
                                                <div className="bg-destructive text-primary-foreground text-[10px] font-black px-4 py-1.5 uppercase tracking-widest shadow-lg shadow-destructive/20 animate-pulse rounded-none">
                                                    REDUNDANCY DETECTED
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-4">
                                            <div className="px-3 py-1 bg-foreground/[0.03] rounded-none">
                                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                                    {currentLeads.length} TARGETS REGISTERED
                                                </p>
                                            </div>
                                            <div className="px-3 py-1 bg-foreground/[0.03] rounded-none">
                                                <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                                                    INITIALIZED {new Date(selectedList.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 relative z-10">
                                        {duplicatesFound && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveDuplicates(selectedList.id)}
                                                disabled={isCleaning}
                                                className="bg-foreground/[0.02] border-none text-[10px] font-black uppercase tracking-widest h-11 px-8 rounded-none hover:bg-foreground/[0.05]"
                                            >
                                                {isCleaning ? "OPTIMIZING..." : "OPTIMIZE REGISTRY"}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteList(selectedList.id)}
                                            disabled={isDeleting}
                                            className="text-destructive/40 hover:text-destructive hover:bg-destructive/10 text-[10px] font-black uppercase tracking-widest h-11 px-8 rounded-none transition-all"
                                        >
                                            <Trash2 size={14} className="mr-2" />
                                            {isDeleting ? "PURGING..." : "PURGE REGISTRY"}
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-10 pb-10 scrollbar-none">
                                    <div className="bg-foreground/[0.01] p-2 relative rounded-none">
                                        <LeadTable
                                            leads={currentLeads}
                                            selectedLeads={selectedLeads}
                                            onLeadSelect={setSelectedLeads}
                                            onAddToCampaign={() => setShowCampaignSelect(true)}
                                            isLoading={false}
                                            onDelete={handleDeleteLead}
                                            onRemoveInvalid={handleRemoveInvalidLeads}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : activeTab === 'local' && selectedLocalFilename ? (
                            <LocalArchiveViewer 
                                filename={selectedLocalFilename} 
                                onImport={async () => {
                                    setIsImporting(true);
                                    try {
                                        const { data: { session } } = await supabase.auth.getSession();
                                        await axios.post('/api/import-local-list', {
                                            filename: selectedLocalFilename,
                                            listName: selectedLocalFilename.replace(/_[0-9]+\.json$/, '').replace(/_/g, ' ')
                                        }, {
                                            headers: { Authorization: `Bearer ${session?.access_token}` }
                                        });
                                        toast({ title: "Import Successful", description: "Backup restored to cloud registry." });
                                        await loadData();
                                        setActiveTab('cloud');
                                    } catch (e) {
                                        toast({ title: "Import Failed", description: "Failed to restore backup.", variant: "destructive" });
                                    } finally {
                                        setIsImporting(false);
                                    }
                                }}
                                isImporting={isImporting}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-24 space-y-12 rounded-none">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-none" />
                                    <div className="w-40 h-40 bg-foreground/[0.01] flex items-center justify-center relative backdrop-blur-3xl rounded-none">
                                        <List size={64} className="text-primary/20" />
                                    </div>
                                </div>
                                <div className="space-y-4 max-w-sm relative z-10">
                                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tighter">Command Center Offline</h2>
                                    <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em] leading-relaxed">
                                        Select a target registry from the sidebar to initialize intelligence analysis and propagation sequences.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CampaignSelector
                open={showCampaignSelect}
                onClose={() => setShowCampaignSelect(false)}
                selectedLeads={selectedLeads}
                leads={currentLeads}
                onSuccess={() => {
                    setSelectedLeads(new Set());
                    setShowCampaignSelect(false);
                }}
            />

            <Dialog open={isFolderValidating} onOpenChange={(open) => {
                if (!open && !isFolderValidating) setIsFolderValidating(false);
            }}>
                <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-3xl border-none text-foreground shadow-2xl p-12 overflow-hidden rounded-none">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
                    
                    <DialogHeader className="space-y-4">
                        <div className="w-16 h-16 bg-primary/10 flex items-center justify-center mx-auto mb-4 rounded-none">
                            <ShieldCheck className="w-8 h-8 text-primary" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-center uppercase tracking-tighter">
                            Deep Scan Initialized
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold text-muted-foreground/40 text-center uppercase tracking-[0.2em]">
                            Analyzing integrity of target sector propagation signals.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-12 space-y-12">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Analysis Progress</span>
                                <span className="text-xl font-black text-primary leading-none">
                                    {Math.round((folderValidationStats.current / folderValidationStats.total) * 100) || 0}%
                                </span>
                            </div>
                            <div className="h-2 w-full bg-foreground/[0.02] overflow-hidden rounded-none">
                                <div
                                    className="h-full bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] transition-all duration-1000 rounded-none"
                                    style={{ width: `${Math.round((folderValidationStats.current / folderValidationStats.total) * 100) || 0}%` }}
                                />
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground/20 text-center uppercase tracking-widest">
                                {folderValidationStats.current} / {folderValidationStats.total} SIGNALS ANALYZED
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-8 bg-emerald-500/5 text-center space-y-2 group rounded-none">
                                <span className="block text-4xl font-black text-emerald-500 leading-none">{folderValidationStats.valid}</span>
                                <span className="block text-[9px] font-black text-emerald-500/40 uppercase tracking-widest">VERIFIED</span>
                            </div>
                            <div className="p-8 bg-destructive/5 text-center space-y-2 group rounded-none">
                                <span className="block text-4xl font-black text-destructive leading-none">{folderValidationStats.invalid}</span>
                                <span className="block text-[9px] font-black text-destructive/40 uppercase tracking-widest">PURGED</span>
                            </div>
                        </div>

                        <div className="flex justify-center items-center gap-4 py-4 rounded-none bg-foreground/[0.01]">
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Engine Load: Nominal</span>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </Layout>
    );
};

const LocalArchiveViewer = ({ filename, onImport, isImporting }: { filename: string, onImport: () => void, isImporting: boolean }) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeads = async () => {
            setLoading(true);
            try {
                const res = await axios.get(`/api/local-lists/${filename}`);
                setLeads(res.data.leads || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchLeads();
    }, [filename]);

    const displayName = filename.replace(/_[0-9]+\.json$/, '').replace(/_/g, ' ');

    return (
        <div className="flex-1 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-700">
            <div className="p-10 flex justify-between items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-primary/5 to-transparent pointer-events-none opacity-20" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-4">
                        <h2 className="text-3xl font-black text-foreground uppercase tracking-tighter leading-none">{displayName}</h2>
                        <div className="bg-foreground/[0.03] text-muted-foreground/60 text-[8px] font-black px-3 py-1 uppercase tracking-[0.2em] rounded-none">
                            LOCAL ARCHIVE
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                        <div className="px-3 py-1 bg-foreground/[0.03] rounded-none">
                            <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                {leads.length} OFFLINE RECORDS
                            </p>
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.15em] max-w-md">
                            This list is stored locally as an autonomous backup. Import it into the cloud registry to enable full campaign integration.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                    <Button
                        onClick={onImport}
                        disabled={isImporting}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest h-12 px-10 rounded-none shadow-xl shadow-primary/20"
                    >
                        <Download size={14} className="mr-2" />
                        {isImporting ? "IMPORTING..." : "RESTORE TO CLOUD"}
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-10 pb-10 scrollbar-none">
                <div className="bg-foreground/[0.01] p-2 relative overflow-hidden rounded-none">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-32 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-primary/20" />
                            <p className="text-[10px] font-black text-muted-foreground/10 uppercase tracking-[0.3em]">Accessing Local Storage...</p>
                        </div>
                    ) : (
                        <LeadTable
                            leads={leads}
                            selectedLeads={new Set()}
                            onLeadSelect={() => {}}
                            onAddToCampaign={() => {}}
                            isLoading={false}
                            onDelete={() => {}}
                            onRemoveInvalid={() => {}}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Discover;

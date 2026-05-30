import React, { useState, useEffect, useMemo } from 'react';
import {
  List, Trash, Plus, Check, Calendar, Users,
  Folder, ChevronDown, ChevronRight, FolderPlus, Loader2
} from 'lucide-react';
import {
  fetchLists,
  fetchFolders,
  deleteList,
  addListToCampaign,
  removeListFromCampaign,
} from '@/lib/api/lists';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  campaignId: string;
  onLeadsAdded: () => void;
}

const SavedLists: React.FC<Props> = ({ campaignId, onLeadsAdded }) => {
  const [lists, setLists] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [addedLists, setAddedLists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [listsData, foldersData] = await Promise.all([fetchLists(), fetchFolders()]);
      setLists(listsData);
      setFolders(foldersData);
      // Auto-expand all folders on first load
      setExpandedFolders(new Set(foldersData.map((f: any) => f.id)));
    } catch (error) {
      console.error('Error loading lists:', error);
      toast({
        title: 'Error',
        description: 'Failed to load saved lists',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    try {
      await deleteList(id);
      setLists(prev => prev.filter(l => l.id !== id));
      setAddedLists(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast({ title: 'Success', description: 'List deleted successfully' });
    } catch (error) {
      console.error('Error deleting list:', error);
      toast({ title: 'Error', description: 'Failed to delete list', variant: 'destructive' });
    }
  };

  const handleAddToCampaign = async (listId: string) => {
    if (!campaignId) {
      toast({ title: 'Error', description: 'No campaign selected', variant: 'destructive' });
      return;
    }
    try {
      const addedCount = await addListToCampaign(listId, campaignId);
      toast({ title: 'Success', description: `Added ${addedCount} leads to campaign` });
      setAddedLists(prev => new Set([...prev, listId]));
      onLeadsAdded?.();
    } catch (error) {
      console.error('Error adding list to campaign:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add leads to campaign',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveFromCampaign = async (listId: string) => {
    try {
      await removeListFromCampaign(listId, campaignId);
      toast({ title: 'Success', description: 'Leads removed from campaign' });
      setAddedLists(prev => { const s = new Set(prev); s.delete(listId); return s; });
      onLeadsAdded?.();
    } catch (error) {
      console.error('Error removing list from campaign:', error);
      toast({ title: 'Error', description: 'Failed to remove leads from campaign', variant: 'destructive' });
    }
  };

  // Add all lists in a folder to the campaign
  const handleAddFolder = async (folderId: string, folderName: string) => {
    const folderLists = groupedLists[folderId] || [];
    const unadded = folderLists.filter(l => !addedLists.has(l.id));
    if (unadded.length === 0) {
      toast({ title: 'Already added', description: 'All lists in this folder are already in the campaign' });
      return;
    }

    setLoadingFolders(prev => new Set([...prev, folderId]));
    let totalAdded = 0;
    const newlyAdded: string[] = [];

    try {
      for (const list of unadded) {
        try {
          const count = await addListToCampaign(list.id, campaignId);
          totalAdded += count;
          newlyAdded.push(list.id);
        } catch (e) {
          console.error(`Failed to add list ${list.id}:`, e);
        }
      }
      setAddedLists(prev => new Set([...prev, ...newlyAdded]));
      toast({
        title: 'Folder added',
        description: `Added ${totalAdded} leads from "${folderName}" to campaign`,
      });
      onLeadsAdded?.();
    } finally {
      setLoadingFolders(prev => { const s = new Set(prev); s.delete(folderId); return s; });
    }
  };

  // Remove all lists in a folder from the campaign
  const handleRemoveFolder = async (folderId: string, folderName: string) => {
    const folderLists = groupedLists[folderId] || [];
    const added = folderLists.filter(l => addedLists.has(l.id));
    if (added.length === 0) return;

    setLoadingFolders(prev => new Set([...prev, folderId]));

    try {
      for (const list of added) {
        try {
          await removeListFromCampaign(list.id, campaignId);
        } catch (e) {
          console.error(`Failed to remove list ${list.id}:`, e);
        }
      }
      setAddedLists(prev => {
        const s = new Set(prev);
        added.forEach(l => s.delete(l.id));
        return s;
      });
      toast({
        title: 'Folder removed',
        description: `Removed all leads from "${folderName}" from campaign`,
      });
      onLeadsAdded?.();
    } finally {
      setLoadingFolders(prev => { const s = new Set(prev); s.delete(folderId); return s; });
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Group lists into folders / unassigned
  const { groupedLists, unassigned } = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    const unassigned: any[] = [];
    folders.forEach(f => (grouped[f.id] = []));
    lists.forEach(list => {
      if (list.folder_id && grouped[list.folder_id] !== undefined) {
        grouped[list.folder_id].push(list);
      } else {
        unassigned.push(list);
      }
    });
    return { groupedLists: grouped, unassigned };
  }, [lists, folders]);

  const folderLeadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach(folder => {
      const folderLists = lists.filter(l => l.folder_id === folder.id);
      counts[folder.id] = folderLists.reduce((sum, l) => sum + (l.list_leads?.length || 0), 0);
    });
    return counts;
  }, [lists, folders]);

  const renderListRow = (list: any, indented = false) => {
    const isAdded = addedLists.has(list.id);

    return (
      <tr
        key={list.id}
        className="transition-colors duration-200 hover:bg-muted/50 group"
      >
        <td className={cn('px-6 py-3', indented && 'pl-14')}>
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-none bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
              <List className="w-3.5 h-3.5" />
            </div>
            <span className="font-medium text-foreground text-sm">{list.name}</span>
          </div>
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/50" />
            {list.list_leads?.length || 0}
          </div>
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/50" />
            {list.created_at ? format(new Date(list.created_at), 'MMM d, yyyy') : '-'}
          </div>
        </td>
        <td className="px-6 py-3">
          <div className="flex items-center">
            {list.campaign ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-none border-none border-primary/20">
                {list.campaign.name}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30 px-2 py-0.5 rounded-none border-none border-border/50">
                Independent
              </span>
            )}
          </div>
        </td>
        <td className="px-6 py-3 text-right">
          <div className="flex items-center justify-end space-x-2">
            {isAdded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemoveFromCampaign(list.id)}
                className="h-7 bg-emerald-500/10 text-emerald-600  hover:bg-emerald-500/20 hover:text-emerald-700 hover:border-emerald-300 dark:border-emerald-500/20 text-xs"
              >
                <Check className="w-3 h-3 mr-1" />
                Added
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => handleAddToCampaign(list.id)}
                className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteList(list.id)}
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-none transition-colors opacity-0 group-hover:opacity-100"
            >
              <Trash className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  const renderFolderSection = (folder: any) => {
    const folderLists = groupedLists[folder.id] || [];
    const isExpanded = expandedFolders.has(folder.id);
    const isLoading = loadingFolders.has(folder.id);
    const totalLeads = folderLeadCounts[folder.id] || 0;
    const allAdded = folderLists.length > 0 && folderLists.every(l => addedLists.has(l.id));
    const someAdded = folderLists.some(l => addedLists.has(l.id));

    return (
      <React.Fragment key={folder.id}>
        {/* Folder header row */}
        <tr className="select-none group/folder">
          <td
            colSpan={3}
            className="px-4 py-2.5 bg-muted/30 hover:bg-muted/40 transition-colors cursor-pointer"
            onClick={() => toggleFolder(folder.id)}
          >
            <div className="flex items-center gap-2.5">
              <div className="text-muted-foreground/60 group-hover/folder:text-muted-foreground transition-colors">
                {isExpanded
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />
                }
              </div>
              <div className={cn(
                'p-1.5 rounded-none transition-colors',
                allAdded ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary'
              )}>
                <Folder className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-semibold text-foreground">{folder.name}</span>
              <div className="flex items-center gap-2 ml-1">
                <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-none">
                  {folderLists.length} list{folderLists.length !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-none">
                  {totalLeads} lead{totalLeads !== 1 ? 's' : ''}
                </span>
                {allAdded && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-none">
                    All Added
                  </span>
                )}
              </div>
            </div>
          </td>
          {/* Add/Remove Folder button */}
          <td className="px-4 py-2.5 bg-muted/30 hover:bg-muted/40 transition-colors text-right">
            {isLoading ? (
              <div className="flex items-center justify-end pr-1">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : allAdded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleRemoveFolder(folder.id, folder.name); }}
                className="h-7 bg-emerald-500/10 text-emerald-600  hover:bg-red-500/10 hover:text-red-500 hover:border-red-200 dark:border-emerald-500/20 text-xs transition-colors"
              >
                <Check className="w-3 h-3 mr-1" />
                Remove Folder
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleAddFolder(folder.id, folder.name); }}
                className="h-7 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm text-xs"
              >
                <FolderPlus className="w-3 h-3 mr-1" />
                Add Folder
              </Button>
            )}
          </td>
        </tr>

        {/* Folder list rows */}
        {isExpanded && (
          folderLists.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-6 py-3 text-xs text-muted-foreground/50 italic pl-14">
                No lists in this folder
              </td>
            </tr>
          ) : (
            folderLists.map(list => renderListRow(list, true))
          )
        )}
      </React.Fragment>
    );
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-none overflow-hidden mt-8 p-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-none w-1/4 mx-auto" />
          <div className="space-y-3">
            <div className="h-12 bg-muted rounded-none" />
            <div className="h-12 bg-muted rounded-none" />
            <div className="h-12 bg-muted rounded-none" />
          </div>
        </div>
      </div>
    );
  }

  const hasFolders = folders.length > 0;
  const hasUnassigned = unassigned.length > 0;
  const isEmpty = lists.length === 0;

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-none overflow-hidden mt-8 shadow-sm">
        {/* Header */}
        <div className="p-6 flex justify-between items-center border-b border-border bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-none text-primary">
              <List className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Saved Lists</h3>
          </div>
          <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-none">
            {lists.length} list{lists.length !== 1 ? 's' : ''} available
          </span>
        </div>

        {isEmpty ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-muted/30 rounded-none flex items-center justify-center mx-auto mb-4">
              <List className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h4 className="text-lg font-medium text-foreground mb-1">No saved lists</h4>
            <p className="text-muted-foreground max-w-sm mx-auto">
              You haven't created any saved lists yet. Use the Lead Scraper to find and save leads.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-transparent border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest w-1/3">
                    List Name
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Leads
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Campaign
                  </th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Folder sections first */}
                {hasFolders && folders.map(folder => renderFolderSection(folder))}

                {/* Unassigned lists separator */}
                {hasFolders && hasUnassigned && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 bg-muted/10">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        No Folder
                      </span>
                    </td>
                  </tr>
                )}

                {/* Unassigned lists */}
                {unassigned.map(list => renderListRow(list, false))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedLists;

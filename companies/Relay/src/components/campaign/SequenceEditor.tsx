import { useState, useEffect, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useParams } from 'react-router-dom';
import TemplateList from './sequence/TemplateList';
import TemplateEditor from './sequence/TemplateEditor';
import { EmailTemplate, Campaign, Lead } from '../../types';
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from '@/lib/api/templates';
import { fetchLeads } from '@/lib/api/leads';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { useApp } from '@/context/AppContext';
import { Sparkles, Building2, Mail, Loader2, Users, ChevronRight, Zap, Fingerprint, Activity, Cpu } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';

const SequenceEditor = () => {
  const { id: campaignId } = useParams();
  const { campaigns, updateCampaign, emailAccounts } = useApp();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPersonalizing, setIsPersonalizing] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  // History for undo (up to 5 steps per template)
  const [templateHistory, setTemplateHistory] = useState<Record<string, Omit<EmailTemplate, 'id'>[]>>({});

  // Local state for debounced identity fields
  const [localIdentity, setLocalIdentity] = useState({
    company_name: 'Relay Solutions',
    pitch: 'Automation & Systems',
    contact_number: '+44 7864851184',
    primary_email: 'ethan@relaysolutions.net'
  });

  // Track if initial load has happened to avoid overwriting database on first render
  const isInitialLoad = useRef(true);

  const campaign = campaigns.find(c => c.id === campaignId);

  useEffect(() => {
    if (campaignId) {
      loadTemplates();
      loadLeads();
    }
  }, [campaignId]);

  // Sync local state when campaign loads or changes from elsewhere
  useEffect(() => {
    if (campaign) {
      setLocalIdentity({
        company_name: campaign.company_name || 'Relay Solutions',
        pitch: campaign.pitch || 'Automation & Systems',
        contact_number: campaign.contact_number || '+44 7864851184',
        primary_email: campaign.primary_email || 'ethan@relaysolutions.net'
      });
      // After first load, we allow debounced updates to sync back
      setTimeout(() => { isInitialLoad.current = false; }, 100);
    }
  }, [campaign?.id]); // Only reset on campaign ID change to avoid loop

  const debouncedIdentity = useDebounce(localIdentity, 500);

  // Sync debounced changes back to Supabase
  useEffect(() => {
    if (isInitialLoad.current || !campaignId) return;

    const syncChanges = async () => {
      // Check which fields actually changed compared to the global campaign object
      const updates: Partial<Campaign> = {};
      let hasChanges = false;

      if (debouncedIdentity.company_name !== (campaign?.company_name || '')) {
        updates.company_name = debouncedIdentity.company_name;
        hasChanges = true;
      }
      if (debouncedIdentity.pitch !== (campaign?.pitch || '')) {
        updates.pitch = debouncedIdentity.pitch;
        hasChanges = true;
      }
      if (debouncedIdentity.contact_number !== (campaign?.contact_number || '')) {
        updates.contact_number = debouncedIdentity.contact_number;
        hasChanges = true;
      }
      if (debouncedIdentity.primary_email !== (campaign?.primary_email || '')) {
        updates.primary_email = debouncedIdentity.primary_email;
        hasChanges = true;
      }

      if (hasChanges) {
        // Use a loop to update each changed field through the existing handleCampaignUpdate logic
        // to ensure cache clearing and other side effects still trigger.
        Object.entries(updates).forEach(([field, value]) => {
          handleCampaignUpdate(field as keyof Campaign, value as string);
        });
      }
    };

    syncChanges();
  }, [debouncedIdentity, campaignId]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      const data = await fetchTemplates(campaignId!);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeads = async () => {
    if (!campaignId) return;
    try {
      const data = await fetchLeads(campaignId) as Lead[];
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    }
  };

  const handleCampaignUpdate = async (field: keyof Campaign, value: string) => {
    if (!campaignId) return;
    try {
      await updateCampaign(campaignId, { [field]: value });

      // If company name or pitch changed, clear cached personalized emails so future sends
      // re-personalize with the new identity instead of using stale content
      if (field === 'company_name' || field === 'pitch') {
        const { data: campaignLeads } = await supabase
          .from('campaign_leads')
          .select('lead_id')
          .eq('campaign_id', campaignId);

        if (campaignLeads && campaignLeads.length > 0) {
          const leadIds = campaignLeads.map((cl: any) => cl.lead_id);
          await supabase
            .from('leads')
            .update({ personalized_email: null, personalized_subject: null })
            .in('id', leadIds);

          toast({
            title: `${field === 'company_name' ? 'Identity' : 'Strategy'} updated`,
            description: `Personalization cache cleared — recalibrating with new parameters.`
          });
        }
      }
    } catch (error) {
      toast({
        title: "Protocol Error",
        description: "Failed to update identity parameters",
        variant: "destructive"
      });
    }
  };


  const generateAISequences = async () => {
    if (!campaign) return;

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:3001/api/generate-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaign.name,
          niche: campaign.niche || 'General Business',
          company: campaign.company_name,
          pitch: campaign.pitch || '',
          contactNumber: campaign.contact_number,
          primaryEmail: campaign.primary_email,
          count: 5
        })
      });

      const result = await response.json();

      if (!result.success) {
        console.error('[AI] Generation failed:', result.error);
        throw new Error(result.error);
      }

      console.log('Generated sequences:', result.data);

      const newTemplates = [];
      let validCount = 0;

      // Clear history when generating a completely new sequence
      setTemplateHistory({});

      for (let i = 0; i < result.data.length; i++) {
        const seq = result.data[i];
        if (!seq.subject || !seq.content) {
          console.warn('Skipping invalid sequence:', seq);
          continue;
        }

        const templateName = seq.name || (seq.step ? `Step ${seq.step}` : `Step ${i + 1}`);


        const matchingAccount = emailAccounts.find(acc => acc.email === campaign.primary_email);
        const senderName = matchingAccount?.name || campaign.primary_email?.split('@')[0] || 'Sender';

        let senderFirstName = senderName;
        if (matchingAccount?.name) {
          senderFirstName = matchingAccount.name.split(' ')[0];
        } else {
          senderFirstName = senderName.split(' ')[0];
          senderFirstName = senderFirstName.charAt(0).toUpperCase() + senderFirstName.slice(1);
        }

        const signature = `\n\n{ender}\n<company>\n\n[Sender Name]\n[Email]\n[Phone]`;

        let finalContent = seq.content;
        // The AI sometimes still includes {ender} despite instructions, so we clean it up
        if (finalContent.includes('{ender}')) {
          finalContent = finalContent.substring(0, finalContent.indexOf('{ender}')).trim();
        }
        finalContent += signature;

        const template = await createTemplate(campaignId!, {
          name: templateName,
          subject: seq.subject,
          content: finalContent
        });
        newTemplates.push(template);
        validCount++;
      }

      if (validCount === 0) {
        throw new Error('AI generated sequences but they were invalid or empty. Please try again.');
      }

      setTemplates([...templates, ...newTemplates]);
      toast({
        title: "Propagation Ready",
        description: `Generated ${result.data.length} sequences.`
      });
    } catch (error) {
      toast({
        title: "Engine Failure",
        description: error instanceof Error ? error.message : "AI generation protocol failed",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBulkPersonalize = async () => {
    if (!selectedTemplate || !leads.length || !campaign) {
      toast({
        title: "Incomplete Parameters",
        description: "Select a sequence and ensure lead database is populated.",
        variant: "destructive"
      });
      return;
    }

    setIsPersonalizing(true);
    try {
      const response = await fetch('http://localhost:3001/api/generate-lead-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          templateId: selectedTemplate.id,
          templateSubject: selectedTemplate.subject,
          templateContent: selectedTemplate.content,
          leads: leads.map(l => ({
            id: l.id,
            name: l.name,
            company: l.company,
            summary: l.company_news || '' // Mapping company_news to summary/notes
          })),
          company: campaign.company_name,
          contactNumber: campaign.contact_number,
          primaryEmail: campaign.primary_email
        })
      });

      const result = await response.json();

      if (!result.success) throw new Error(result.error);

      for (const item of result.data) {
        if (item.error) continue;

        await supabase
          .from('leads')
          .update({ personalized_email: item.content })
          .eq('id', item.leadId);
      }

      toast({
        title: "Calibration Complete",
        description: `Personalized ${result.data.filter((r: any) => !r.error).length} target communications.`
      });
      loadLeads(); // Refresh leads to show progress
    } catch (error) {
      toast({
        title: "Calibration Failed",
        description: error instanceof Error ? error.message : "Mass personalization protocol failed",
        variant: "destructive"
      });
    } finally {
      setIsPersonalizing(false);
    }
  };

  const handleRegenerateTemplate = async (template: EmailTemplate, index: number) => {
    if (!campaign) return;

    setIsGenerating(true);
    try {
      const response = await fetch('http://localhost:3001/api/generate-sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: campaign.name,
          niche: campaign.niche || 'General Business',
          company: campaign.company_name,
          pitch: campaign.pitch || '',
          contactNumber: campaign.contact_number,
          primaryEmail: campaign.primary_email,
          isSingle: true,
          targetStep: index + 1
        })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error);

      const seq = result.data[0];
      if (!seq?.content) throw new Error('AI failed to generate content');

      // Add current version to history
      setTemplateHistory(prev => {
        const history = prev[template.id] || [];
        const newHistory = [{ name: template.name, subject: template.subject, content: template.content }, ...history].slice(0, 5);
        return { ...prev, [template.id]: newHistory };
      });

      const updatedTemplate = {
        ...template,
        subject: seq.subject,
        content: seq.content + `\n\n{ender}\n<company>\n\n[Sender Name]\n[Email]\n[Phone]`
      };

      await updateTemplate(campaignId!, updatedTemplate);

      setTemplates(prev => prev.map(t => t.id === template.id ? updatedTemplate : t));
      setSelectedTemplate(updatedTemplate);

      toast({
        title: "Module Regenerated",
        description: `${template.name} has been recalibrated.`
      });
    } catch (error) {
      toast({
        title: "Regeneration Failed",
        description: error instanceof Error ? error.message : "Recalibration protocol failed",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUndoTemplate = async (template: EmailTemplate) => {
    const history = templateHistory[template.id];
    if (!history || history.length === 0) return;

    const [previous, ...remainingHistory] = history;

    try {
      const restoredTemplate: EmailTemplate = {
        id: template.id,
        ...previous
      };

      await updateTemplate(campaignId!, restoredTemplate);

      setTemplates(prev => prev.map(t => t.id === template.id ? restoredTemplate : t));
      setSelectedTemplate(restoredTemplate);
      setTemplateHistory(prev => ({ ...prev, [template.id]: remainingHistory }));

      toast({
        title: "State Restored",
        description: `Previous version of ${template.name} recovered.`
      });
    } catch (error) {
      toast({
        title: "Restore Failed",
        description: "Could not revert to previous state",
        variant: "destructive"
      });
    }
  };

  const createNewTemplate = () => {
    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      name: '',
      subject: '',
      content: '',
    };
    setSelectedTemplate(newTemplate);
  };

  const handleSave = async () => {
    if (!selectedTemplate || !campaignId) return;
    try {
      const existingTemplate = templates.find(t => t.id === selectedTemplate.id);
      if (existingTemplate) {
        // Record history before saving manual changes
        setTemplateHistory(prev => {
          const history = prev[selectedTemplate.id] || [];
          const newHistory = [{
            name: existingTemplate.name,
            subject: existingTemplate.subject,
            content: existingTemplate.content
          }, ...history].slice(0, 5);
          return { ...prev, [selectedTemplate.id]: newHistory };
        });

        await updateTemplate(campaignId, selectedTemplate);
        setTemplates(templates.map(t => t.id === selectedTemplate.id ? selectedTemplate : t));
      } else {
        const newTemplate = await createTemplate(campaignId, selectedTemplate);
        setTemplates([...templates, newTemplate]);
      }
      toast({ title: "Module Locked", description: "Sequence parameters successfully updated." });
    } catch (error) {
      toast({ title: "Write Error", description: "Failed to commit changes to database.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate || !campaignId) return;
    try {
      await deleteTemplate(campaignId, selectedTemplate.id);
      setTemplates(templates.filter(t => t.id !== selectedTemplate.id));
      setSelectedTemplate(null);
      toast({ title: "Module Deleted", description: "Sequence removed from propagation plan." });
    } catch (error) {
      toast({ title: "Override Error", description: "Failed to remove sequence module.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white/[0.01] rounded-none p-8 animate-pulse space-y-6">
        <div className="h-12 bg-white/5 rounded-none w-1/3"></div>
        <div className="h-64 bg-white/5 rounded-none"></div>
      </div>
    );
  }

  const leadsWithPersonalizedEmail = leads.filter(l => !!l.personalized_email).length;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Identity & Generation Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 bg-card rounded-3xl border border-border p-8 space-y-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-xl">
              <Fingerprint className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Identity Matrix</h3>
              <p className="text-xs font-medium text-muted-foreground mt-1">Base parameters for AI calibration</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Company</Label>
              <Input
                value={localIdentity.company_name}
                onChange={(e) => setLocalIdentity(prev => ({ ...prev, company_name: e.target.value }))}
                placeholder="ColdSpark AI"
                className="bg-muted/40 border-border rounded-xl h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-4 font-bold text-sm text-foreground shadow-sm"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Strategy</Label>
              <Input
                value={localIdentity.pitch}
                onChange={(e) => setLocalIdentity(prev => ({ ...prev, pitch: e.target.value }))}
                placeholder="Product/Service Pitch"
                className="bg-muted/40 border-border rounded-xl h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-4 font-bold text-sm text-foreground shadow-sm"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Contact</Label>
              <Input
                value={localIdentity.contact_number}
                onChange={(e) => setLocalIdentity(prev => ({ ...prev, contact_number: e.target.value }))}
                placeholder="+1..."
                className="bg-muted/40 border-border rounded-xl h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-4 font-bold text-sm text-foreground shadow-sm"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">Origin Email</Label>
              <Input
                value={localIdentity.primary_email}
                onChange={(e) => setLocalIdentity(prev => ({ ...prev, primary_email: e.target.value }))}
                placeholder="hello@..."
                className="bg-muted/40 border-border rounded-xl h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all px-4 font-bold text-sm text-foreground shadow-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-primary/5 rounded-3xl border border-primary/10 p-8 flex flex-col justify-center items-center text-center relative overflow-hidden group shadow-sm">
          <div className="absolute -top-4 -right-4 p-1 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
            <Zap className="w-32 h-32 text-primary" />
          </div>
          <div className="relative z-10 w-full space-y-6">
            <div className="bg-primary/10 p-3 rounded-full w-fit mx-auto shadow-[0_0_30px_-5px_hsl(var(--primary)/0.3)]">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">AI Studio</h3>
              <p className="text-xs font-medium text-muted-foreground">Draft propagation sequences</p>
            </div>
            <Button
              onClick={generateAISequences}
              disabled={isGenerating || !campaign?.company_name}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-primary/20"
            >
              {isGenerating ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <ChevronRight className="w-4 h-4 mr-1" />}
              {isGenerating ? 'Writing...' : 'Generate Plan'}
            </Button>
            {!campaign?.company_name && (
              <div className="mt-2 py-1.5 px-4 bg-destructive/10 rounded-full w-fit mx-auto">
                <p className="text-xs text-destructive font-semibold">Identity parameters required</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="bg-card rounded-3xl border border-border shadow-sm flex overflow-hidden min-h-[700px] relative">
        <TemplateList
          templates={templates}
          selectedTemplate={selectedTemplate}
          onSelect={setSelectedTemplate}
          onCreateNew={createNewTemplate}
        />

        <div className="flex-1 flex flex-col bg-background/50">
          {selectedTemplate ? (
            <>
              <div className="px-8 py-6 bg-card border-b border-border flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-5">
                  <div className="bg-primary/10 p-3 rounded-xl shadow-inner">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-base font-bold text-foreground">Calibration Engine</p>
                      <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold">
                        {leadsWithPersonalizedEmail}/{leads.length} Personalized
                      </span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground mt-1">Injecting lead intelligence into sequence</p>
                  </div>
                </div>
                <Button
                  onClick={handleBulkPersonalize}
                  disabled={isPersonalizing || !leads.length}
                  className="bg-card hover:bg-muted border border-border text-foreground font-bold text-sm rounded-xl px-6 py-2.5 h-12 transition-all shadow-sm"
                >
                  {isPersonalizing ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2 text-primary" />}
                  {isPersonalizing ? 'Processing...' : 'Run Personalization'}
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/10">
                <TemplateEditor
                  template={selectedTemplate}
                  onChange={setSelectedTemplate}
                  onSave={handleSave}
                  onDelete={handleDelete}
                  onRegenerate={() => handleRegenerateTemplate(selectedTemplate, templates.findIndex(t => t.id === selectedTemplate.id))}
                  onUndo={() => handleUndoTemplate(selectedTemplate)}
                  canUndo={(templateHistory[selectedTemplate.id]?.length || 0) > 0}
                  isRegenerating={isGenerating}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-8 animate-in fade-in zoom-in duration-700 bg-muted/5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 opacity-40"></div>
                <div className="relative p-8 bg-card border border-border shadow-sm rounded-3xl">
                  <Mail className="w-16 h-16 text-muted-foreground/30" />
                </div>
              </div>
              <div className="space-y-3">
                <p className="font-bold text-2xl text-foreground">Drafting Terminal</p>
                <p className="text-sm max-w-sm mx-auto text-muted-foreground font-medium leading-relaxed">
                  Select a sequence module from the registry or use the AI Studio to generate a propagation plan.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SequenceEditor;

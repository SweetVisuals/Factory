import { useState, useEffect } from 'react';
import { Title } from '../components/ui/title';
import { supabase } from '../lib/supabase';
import { openclawSupabase } from '../lib/openclaw';
import Layout from '../components/layout/Layout';
import PageHeader from '../components/layout/PageHeader';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AlertCircle, Zap, LayoutDashboard, Users, GitMerge, Calendar, Mail, Inbox, BarChart3, Settings2, Target, ChevronDown, ChevronRight, Database, Sparkles, Folder, Activity, MessageSquare, ArrowLeft, Phone } from 'lucide-react';
import CampaignStats from '../components/campaign/CampaignStats';
import CampaignTabs from '../components/campaign/CampaignTabs';
import LeadsTable from '../components/campaign/LeadsTable';
import SequenceEditor from '../components/campaign/SequenceEditor';
import ScheduleEditor from '../components/campaign/schedule/ScheduleEditor';
import SavedLists from '../components/campaign/SavedLists';
import CampaignEmails from '../components/campaign/CampaignEmails';
import CampaignInbox from '../components/campaign/CampaignInbox';
import BackButton from '../components/common/BackButton';
import ClosingTab from '../components/campaign/ClosingTab';
import CampaignScraperTab from '../components/campaign/CampaignScraperTab';
import ColdCallingTab from '../components/campaign/ColdCallingTab';
import OptionsTab from '../components/campaign/OptionsTab';
import ProgressTab from '../components/campaign/ProgressTab';
import { cn } from '../lib/utils';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { LeadDetailModal } from '../components/modals/LeadDetailModal';


interface CampaignDashboardProps {
  onScheduleChange?: () => void;
}

const CampaignDashboard = ({ onScheduleChange }: CampaignDashboardProps) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { campaigns, updateCampaign, deleteCampaign } = useApp();
  const [activeTab, setActiveTab] = useState('analytics');
  const [leadsSubTab, setLeadsSubTab] = useState<'table' | 'scraper' | 'lists'>('table');
  const [refreshLeads, setRefreshLeads] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [hasScheduledEntries, setHasScheduledEntries] = useState(false);
  const [initialSearchTerm, setInitialSearchTerm] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [senderCountdown, setSenderCountdown] = useState(5);
  const campaign = campaigns.find(c => c.id === id);
  const location = useLocation();
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    const state = location.state as any;
    if (state?.focusLeadId) {
      setFocusLeadId(state.focusLeadId);
      setIsLeadModalOpen(true);
      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const updateSenderCountdown = () => {
      const now = new Date();
      const remaining = 5 - (now.getMinutes() % 5);
      setSenderCountdown(remaining);
    };
    
    updateSenderCountdown();
    const interval = setInterval(updateSenderCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      let { tab, leadEmail } = e.detail;
      if (['scraper'].includes(tab)) {
        tab = 'leads';
        setLeadsSubTab('scraper');
      } else if (['progress', 'flow', 'options', 'closing', 'conversations'].includes(tab)) {
        tab = 'analytics';
      } else if (['schedule', 'emails'].includes(tab)) {
        tab = 'sequences';
      }
      setActiveTab(tab);
      if (leadEmail) {
        setInitialSearchTerm(leadEmail);
      }
    };
    window.addEventListener('relay-navigate-tab', handleNavigate);
    return () => window.removeEventListener('relay-navigate-tab', handleNavigate);
  }, []);

  const checkScheduledEntries = async () => {
    if (!campaign) return;

    const { data: schedules, error } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('status', 'scheduled');

    if (!error && schedules && schedules.length > 0) {
      setHasScheduledEntries(true);
      if (campaign.status?.toLowerCase() === 'draft') {
        updateCampaign(campaign.id, { status: 'in_progress' });
      }
    } else {
      setHasScheduledEntries(false);
      if (campaign.status?.toLowerCase() === 'in_progress') {
        updateCampaign(campaign.id, { status: 'Draft' });
      }
    }
  };

  useEffect(() => {
    checkScheduledEntries();
  }, [campaign, isScheduled]);

  useEffect(() => {
    if (onScheduleChange) {
      checkScheduledEntries();
    }
  }, [onScheduleChange]);

  useEffect(() => {
    if (campaign?.status === 'scheduled') {
      updateCampaign(campaign.id, { status: 'in_progress' });
      setIsScheduled(true);
    }
  }, [campaign?.status]);

  if (!campaign) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-card rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-border">
            <AlertCircle className="w-12 h-12 text-muted-foreground/30" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-4">Campaign Not Found</h2>
          <p className="text-sm font-medium text-muted-foreground max-w-[300px] leading-relaxed">
            This campaign does not exist or has been deleted.
          </p>
          <button
            onClick={() => navigate('/campaigns')}
            className="mt-10 px-8 py-3.5 bg-foreground text-background rounded-xl font-bold transition-all shadow-md hover:bg-foreground/90"
          >
            Back to Campaigns
          </button>
        </div>
      </Layout>
    );
  }

  const handleLeadsRefresh = () => {
    setRefreshLeads(prev => !prev);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Stats Row */}
            <CampaignStats campaignId={campaign.id} />

            <div className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden">
              <div className="flex border-b border-border/50">
                <button
                  onClick={() => setLeadsSubTab('table')}
                  className={cn(
                    "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                    leadsSubTab === 'table' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  Conversation Registry
                </button>
                <button
                  onClick={() => setLeadsSubTab('scraper')}
                  className={cn(
                    "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                    leadsSubTab === 'scraper' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  Operations Monitor
                </button>
                <button
                  onClick={() => setLeadsSubTab('lists')}
                  className={cn(
                    "flex-1 px-6 py-4 text-sm font-bold transition-all border-b-2",
                    leadsSubTab === 'lists' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  Settings
                </button>
              </div>

              <div className="p-5 min-h-[450px]">
                {leadsSubTab === 'table' && <ClosingTab campaignId={campaign.id} />}
                {leadsSubTab === 'scraper' && <ProgressTab campaignId={campaign.id} />}
                {leadsSubTab === 'lists' && (
                  <OptionsTab
                    campaignId={campaign.id}
                    campaignName={campaign.name}
                    campaignStatus={campaign.status}
                    onNameChange={(newName) => updateCampaign(campaign.id, { name: newName })}
                    onDelete={() => deleteCampaign(campaign.id)}
                    onResume={async () => {
                      updateCampaign(campaign.id, { status: 'in_progress' });
                      await supabase
                        .from('scheduled_emails')
                        .update({ status: 'scheduled' })
                        .eq('campaign_id', campaign.id)
                        .eq('status', 'paused');
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        );
      case 'leads':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Enhanced Pill Tab Navigation */}
            <div className="relative flex gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-lg w-fit shadow-sm">
              {[
                              { id: 'table', label: 'Prospect Database', icon: Database },
                              { id: 'scraper', label: 'Neural Link Feed', icon: Activity },
                              { id: 'cold_calling', label: 'Cold Calling', icon: Phone }
                            ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setLeadsSubTab(sub.id as any)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-300 z-10",
                    leadsSubTab === sub.id 
                      ? "text-primary bg-primary/10 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  )}
                >
                  <sub.icon size={14} className={leadsSubTab === sub.id ? "text-primary" : "text-muted-foreground"} />
                  {sub.label}
                </button>
              ))}
            </div>

            <div className="animate-in fade-in duration-300">
              {leadsSubTab === 'table' && <LeadsTable campaignId={campaign.id} refreshTrigger={refreshLeads} />}
              {leadsSubTab === 'scraper' && <CampaignScraperTab campaignId={campaign.id} />}
              {leadsSubTab === 'cold_calling' && <ColdCallingTab campaignId={campaign.id} />}
            </div>
          </div>
        );
      case 'sequences':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-in fade-in duration-200">
            <div className="xl:col-span-7 bg-card rounded-2xl p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Sequence Orchestrator</h3>
              <SequenceEditor />
            </div>
            <div className="xl:col-span-5 space-y-4 min-w-0">
              <div className="bg-card rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Sender Channels</h3>
                <CampaignEmails campaignId={campaign.id} />
              </div>
              <div className="bg-card rounded-2xl p-5 shadow-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Execution Calendar</h3>
                <ScheduleEditor
                  campaignId={campaign.id}
                  onScheduleChange={() => checkScheduledEntries()}
                />
              </div>
            </div>
          </div>
        );
      case 'inbox':
        return (
          <div className="bg-card rounded-2xl shadow-sm border border-border h-full overflow-hidden flex flex-col">
             <CampaignInbox campaignId={campaign.id} initialSearch={initialSearchTerm} />
          </div>
        );
      default:
        return <CampaignStats campaignId={campaign.id} />;
    }
  };

  const parseLocationFromName = (fullName: string) => {
    const trimmed = fullName.trim();
    const match = trimmed.match(/\s+([Uu][Ss]|[Uu][Kk])$/) || trimmed.match(/\s+\(([Uu][Ss]|[Uu][Kk])\)$/);
    if (match) {
      const loc = match[1].toUpperCase();
      const nameWithoutLoc = trimmed.replace(match[0], '');
      return { loc, cleanName: nameWithoutLoc };
    }
    return { loc: null, cleanName: fullName };
  };

  const { loc, cleanName } = parseLocationFromName(campaign.name);

  return (
    <Layout fullHeight={activeTab === 'inbox'}>
      <div className={cn(
        "w-full flex flex-col h-full bg-background overflow-y-auto text-foreground animate-in fade-in duration-200",
        activeTab === 'inbox' ? "overflow-hidden" : ""
      )}>
        
        {/* Premium Header Layout */}
        <div className="relative p-5 pb-2 shrink-0 overflow-hidden border-b border-border/40">
          <div className="flex flex-col gap-4 max-w-none w-full relative z-10">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/campaigns')}
                  className="w-9 h-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center hover:bg-muted hover:text-primary hover:border-primary/30 transition-all duration-300 shadow-sm shrink-0"
                  title="Back to Campaigns"
                >
                  <ArrowLeft size={16} className="text-muted-foreground transition-colors" />
                </button>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-white tracking-tight">{cleanName}</h1>
                    {loc && (
                      <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                        {loc}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">{campaign.id.substring(0, 8)}</span>
                    <div className="h-3 w-px bg-border" />
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${hasScheduledEntries ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">
                        {hasScheduledEntries ? 'Running' : campaign.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-card border border-border p-2 px-4 rounded-xl shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Prospects</span>
                    <span className="text-base font-black text-foreground">
                      <AnimatedNumber value={campaign.prospects} />
                    </span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Sent</span>
                    <span className="text-base font-black text-foreground">
                      <AnimatedNumber value={campaign.sent || '0'} />
                    </span>
                  </div>
                  <div className="h-6 w-px bg-border" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Replies</span>
                    <span className="text-base font-black text-primary">
                      <AnimatedNumber value={campaign.replies || '0'} />
                    </span>
                  </div>
                </div>
              </div>
              
            </div>
            
            {/* Elegant Main Tabs */}
            <div className="relative flex gap-1 p-1 bg-white/[0.02] border border-white/5 rounded-xl w-fit shadow-sm backdrop-blur-sm mt-1">
              {[
                { id: 'analytics', label: 'Analytics & Deal Flow', icon: BarChart3 },
                { id: 'leads', label: 'Prospect Database', icon: Users },
                { id: 'sequences', label: 'Sequences & Triggers', icon: GitMerge },
                { id: 'inbox', label: 'Unified Inbox', icon: MessageSquare }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 z-10",
                    activeTab === tab.id 
                      ? "text-primary bg-primary/10 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  )}
                >
                  <tab.icon size={14} className={activeTab === tab.id ? "text-primary" : "text-muted-foreground"} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cn(
          "flex-1 p-5 max-w-none w-full",
          activeTab === 'inbox' ? "overflow-hidden p-0 pt-3 px-5" : "animate-in fade-in duration-200"
        )}>
          {renderTabContent()}
        </div>
      </div>
      <LeadDetailModal
        leadId={focusLeadId}
        open={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
      />
    </Layout>
  );
};

export default CampaignDashboard;

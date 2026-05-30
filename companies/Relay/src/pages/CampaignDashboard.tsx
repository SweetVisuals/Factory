import { useState, useEffect } from 'react';
import { Title } from '../components/ui/title';
import { supabase } from '../lib/supabase';
import { openclawSupabase } from '../lib/openclaw';
import Layout from '../components/layout/Layout';
import PageHeader from '../components/layout/PageHeader';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { AlertCircle, Zap, LayoutDashboard, Users, GitMerge, Calendar, Mail, Inbox, BarChart3, Settings2, Target, ChevronDown, ChevronRight, Database, Sparkles, Folder, Activity, MessageSquare } from 'lucide-react';
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
import OptionsTab from '../components/campaign/OptionsTab';
import ProgressTab from '../components/campaign/ProgressTab';
import { cn } from '../lib/utils';


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
      .eq('campaign_id', campaign.id);

    if (!error && schedules && schedules.length > 0) {
      setHasScheduledEntries(true);
      if (campaign.status === 'Draft') {
        updateCampaign(campaign.id, { status: 'in_progress' });
      }
    } else {
      setHasScheduledEntries(false);
      if (campaign.status === 'in_progress') {
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
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Row */}
            <CampaignStats campaignId={campaign.id} />

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              {/* Left Column: Flow & Telemetry */}
              <div className="xl:col-span-4 bg-card rounded-3xl p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Operations Monitor</h3>
                  <Activity size={16} className="text-muted-foreground" />
                </div>
                <ProgressTab campaignId={campaign.id} />
              </div>

              {/* Right Column: Negotiation Hub */}
              <div className="xl:col-span-8 bg-card rounded-3xl p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Active Deal Flow</h3>
                  <Target size={16} className="text-muted-foreground" />
                </div>
                <ClosingTab campaignId={campaign.id} />
              </div>
            </div>

            {/* Premium Settings Panel */}
            <div className="bg-card rounded-3xl shadow-sm overflow-hidden transition-all duration-300 border border-border/50">
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full flex items-center justify-between px-8 py-6 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-muted">
                    <Settings2 size={18} className="text-foreground" />
                  </div>
                  <span className="text-base font-bold text-foreground">Advanced Campaign Settings</span>
                </div>
                <div className="p-2 bg-muted rounded-full">
                  {showOptions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>
              {showOptions && (
                <div className="p-8 pt-2 border-t border-border/50 animate-in fade-in duration-300 bg-background/50">
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
                </div>
              )}
            </div>
          </div>
        );
      case 'leads':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Enhanced Pill Tab Navigation */}
            <div className="relative flex gap-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-xl w-fit shadow-sm">
              {[
                { id: 'table', label: 'Prospect Database', icon: Database },
                { id: 'scraper', label: 'AI Lead Scraper', icon: Sparkles },
                { id: 'lists', label: 'Saved Sectors', icon: Folder }
              ].map(sub => (
                <button
                  key={sub.id}
                  onClick={() => setLeadsSubTab(sub.id as any)}
                  className={cn(
                    "relative flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 z-10",
                    leadsSubTab === sub.id 
                      ? "text-primary bg-primary/10 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  )}
                >
                  <sub.icon size={16} className={leadsSubTab === sub.id ? "text-primary" : "text-muted-foreground"} />
                  {sub.label}
                </button>
              ))}
            </div>

            <div className="animate-in fade-in duration-300">
              {leadsSubTab === 'table' && <LeadsTable campaignId={campaign.id} refreshTrigger={refreshLeads} />}
              {leadsSubTab === 'scraper' && <CampaignScraperTab campaignId={campaign.id} />}
              {leadsSubTab === 'lists' && <SavedLists campaignId={campaign.id} onLeadsAdded={handleLeadsRefresh} />}
            </div>
          </div>
        );
      case 'sequences':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="xl:col-span-7 bg-card rounded-3xl p-8 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Sequence Orchestrator</h3>
              <SequenceEditor />
            </div>
            <div className="xl:col-span-5 space-y-8 min-w-0">
              <div className="bg-card rounded-3xl p-8 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Sender Channels</h3>
                <CampaignEmails campaignId={campaign.id} />
              </div>
              <div className="bg-card rounded-3xl p-8 shadow-sm">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Execution Calendar</h3>
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
          <div className="bg-card rounded-3xl shadow-sm border border-border h-full overflow-hidden flex flex-col">
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
        "w-full flex flex-col h-full bg-background overflow-y-auto text-foreground",
        activeTab === 'inbox' ? "overflow-hidden" : ""
      )}>
        
        {/* Premium Header Layout */}
        <div className="relative px-10 py-10 shrink-0 border-b border-border bg-card/50 overflow-hidden">
          <div className="flex flex-col gap-8 max-w-[1400px] mx-auto relative z-10">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => navigate('/campaigns')}
                  className="w-12 h-12 rounded-xl bg-muted/50 border border-border flex items-center justify-center hover:bg-muted transition-all duration-300 shadow-sm"
                >
                  <BackButton to="/campaigns" text="" />
                </button>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    <h1 className="text-4xl font-bold tracking-tight text-foreground">{cleanName}</h1>
                    {loc && (
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                        {loc}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">{campaign.id.substring(0, 8)}</span>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${hasScheduledEntries ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
                        {hasScheduledEntries ? 'Running' : campaign.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6 bg-card/40 p-2 rounded-2xl border border-white/5 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-6 px-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prospects</span>
                    <span className="text-lg font-black text-foreground">{campaign.prospects}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sent</span>
                    <span className="text-lg font-black text-foreground">{campaign.sent || '0'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Replies</span>
                    <span className="text-lg font-black text-foreground">{campaign.replies || '0'}</span>
                  </div>
                </div>

                <div className="h-10 w-px bg-border mx-2" />

                <div className="flex items-center gap-3 px-2">
                  <input 
                    type="text"
                    placeholder="AI Directive..."
                    className="bg-transparent border-none outline-none text-sm font-medium text-foreground w-48 placeholder:text-muted-foreground"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                        const msg = (e.target as HTMLInputElement).value;
                        (e.target as HTMLInputElement).value = '';
                        const fullMessage = `[CAMPAIGN: ${campaign.name}] ${msg}`;
                        await openclawSupabase.from('chat_logs').insert([{ agent_name: 'CEO', message: fullMessage }]);
                        await openclawSupabase.from('tasks').insert([{ description: `Directive for ${campaign.name}: ${msg}`, status: 'pending', assigned_to: 'Boss' }]);
                      }
                    }}
                  />
                  <div className="p-2.5 rounded-xl bg-primary text-primary-foreground group relative cursor-help shadow-sm">
                    <Zap size={16} className="animate-pulse" />
                    <div className="absolute top-full right-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border px-4 py-3 rounded-xl z-50 whitespace-nowrap shadow-xl">
                      <span className="text-xs font-bold text-foreground">Next Send Cycle: <span className="text-primary">{senderCountdown} min</span></span>
                    </div>
                  </div>
                </div>
              </div>
              
            </div>
            
            {/* Elegant Main Tabs */}
            <div className="relative flex gap-2 p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl w-fit shadow-sm backdrop-blur-sm mt-4">
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
                    "relative flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 z-10",
                    activeTab === tab.id 
                      ? "text-primary bg-primary/10 shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.05]"
                  )}
                >
                  <tab.icon size={18} className={activeTab === tab.id ? "text-primary" : "text-muted-foreground"} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cn(
          "flex-1 p-10 max-w-[1400px] mx-auto w-full",
          activeTab === 'inbox' ? "overflow-hidden p-0 max-w-none pt-6 px-10" : "animate-in fade-in duration-500"
        )}>
          {renderTabContent()}
        </div>
      </div>
    </Layout>
  );
};

export default CampaignDashboard;

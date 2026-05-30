import { LayoutDashboard, Users, GitMerge, Mail, Inbox, Calendar, BarChart3, Target, Settings2, Sparkles } from 'lucide-react';

interface TabProps {
  active: string;
  onChange: (tab: string) => void;
}

const CampaignTabs = ({ active, onChange }: TabProps) => {
  const tabs = [
    { id: 'analytics', label: 'Overview', icon: BarChart3 },
    { id: 'leads', label: 'Prospects', icon: Users },
    { id: 'sequences', label: 'Sequence', icon: GitMerge },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
  ];

  return (
    <div className="flex items-center gap-1 p-1 w-full bg-foreground/[0.02] rounded-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-none transition-all duration-300 group relative overflow-hidden
              ${isActive
                ? 'bg-foreground text-background shadow-md z-10'
                : 'text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05]'}
            `}
          >
            <Icon size={16} className={`${isActive ? 'text-background animate-pulse' : 'group-hover:scale-110 transition-all duration-300'}`} />
            <span className={`text-[10px] font-black uppercase tracking-[0.15em] leading-none truncate relative z-10 ${isActive ? 'text-background' : 'text-inherit'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default CampaignTabs;


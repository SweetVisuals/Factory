import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronRight } from 'lucide-react';

const UsageItem = ({ 
  title, 
  value, 
  percentage, 
  showUpgrade = false, 
  subtitle = '' 
}: { 
  title: string, 
  value: string, 
  percentage?: number, 
  showUpgrade?: boolean,
  subtitle?: string
}) => {
  let ringColor = 'border-white/10';
  if (percentage !== undefined) {
    if (percentage >= 100) ringColor = 'border-red-500 border-t-transparent';
    else if (percentage >= 80) ringColor = 'border-yellow-400 border-t-transparent';
    else if (percentage > 0) ringColor = 'border-emerald-500 border-t-transparent';
  }

  return (
    <div className="flex items-center justify-between p-6 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02] transition-colors">
      <div className="flex flex-col gap-1 cursor-pointer group">
        <div className="flex items-center text-sm text-white/70 group-hover:text-white transition-colors">
          {title} <ChevronRight className="w-3 h-3 ml-1 opacity-50 group-hover:opacity-100" />
        </div>
        <div className="font-mono text-sm font-medium text-white/90">
          {value}
        </div>
        {subtitle && <div className="text-xs text-white/40">{subtitle}</div>}
      </div>
      
      <div>
        {showUpgrade ? (
          <button 
            onClick={() => window.location.href = '/pricing'}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded transition-colors"
          >
            Upgrade
          </button>
        ) : (
          <div className={`w-6 h-6 rounded-full border-[3px] rotate-45 transition-all duration-500 ${ringColor}`} 
               style={{ 
                 borderColor: percentage !== undefined && percentage > 0 ? undefined : 'rgba(255,255,255,0.05)',
                 borderTopColor: percentage !== undefined && percentage > 0 ? 'transparent' : 'rgba(255,255,255,0.05)'
               }}
          />
        )}
      </div>
    </div>
  );
};

export default function UsageDashboard() {
  const [stats, setStats] = useState({
    prospects: 0,
    emails: 0,
    campaigns: 0,
    aiSearches: 0
  });

  const LIMITS = {
    prospects: 10000,
    emails: 50000,
    campaigns: 5,
    aiSearches: 10000
  };

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const { count: prospectCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
        const { count: emailCount } = await supabase.from('inbox_emails').select('*', { count: 'exact', head: true }).eq('folder', 'sent');
        const { count: campaignCount } = await supabase.from('campaigns').select('*', { count: 'exact', head: true });
        
        setStats({
          prospects: prospectCount || 0,
          emails: emailCount || 0,
          campaigns: campaignCount || 0,
          aiSearches: prospectCount || 0 // Assuming 1 AI search per prospect
        });
      } catch (err) {}
    };
    fetchUsage();
  }, []);

  const getPct = (val: number, max: number) => Math.min(100, Math.round((val / max) * 100));

  return (
    <div className="w-full">
      <div className="bg-[#111111] border border-white/10 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/5">
          {/* Column 1 */}
          <div className="flex flex-col">
            <UsageItem 
              title="Prospects Scraped" 
              value={`${stats.prospects.toLocaleString()} / ${LIMITS.prospects.toLocaleString()} (${getPct(stats.prospects, LIMITS.prospects)}%)`}
              percentage={getPct(stats.prospects, LIMITS.prospects)}
            />
            <UsageItem 
              title="AI Deep Dives" 
              value={`${stats.aiSearches.toLocaleString()} / ${LIMITS.aiSearches.toLocaleString()} (${getPct(stats.aiSearches, LIMITS.aiSearches)}%)`}
              percentage={getPct(stats.aiSearches, LIMITS.aiSearches)}
            />
            <UsageItem 
              title="Realtime Concurrent Scrapes" 
              value={`0 / 8 (0%)`}
              percentage={0}
            />
            <UsageItem 
              title="Database Size" 
              value={`${Math.round((stats.prospects || 0) / 1024)} MB / 5 GB (<1%)`}
              percentage={Math.min(100, Math.round((((stats.prospects || 0) / 1024) / 5120) * 100))}
            />
            <UsageItem 
              title="Priority Support" 
              value="Unavailable in plan"
              showUpgrade={true}
            />
          </div>

          {/* Column 2 */}
          <div className="flex flex-col">
            <UsageItem 
              title="Emails Sent" 
              value={`${stats.emails.toLocaleString()} / ${LIMITS.emails.toLocaleString()} (${getPct(stats.emails, LIMITS.emails)}%)`}
              percentage={getPct(stats.emails, LIMITS.emails)}
            />
            <UsageItem 
              title="Active Campaigns" 
              value={`${stats.campaigns.toLocaleString()} / ${LIMITS.campaigns} (${getPct(stats.campaigns, LIMITS.campaigns)}%)`}
              percentage={getPct(stats.campaigns, LIMITS.campaigns)}
            />
            <UsageItem 
              title="Edge Function Invocations" 
              value={`1,288 / 500,000 (0%)`}
              percentage={0}
            />
            <UsageItem 
              title="Cached Egress" 
              value={`0 / 5 GB`}
              percentage={0}
            />
            <UsageItem 
              title="White-label Dashboard" 
              value="Unavailable in plan"
              showUpgrade={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

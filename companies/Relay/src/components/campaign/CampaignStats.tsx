import { useEffect, useState } from 'react';
import { CampaignStat } from '../../types';
import { supabase } from '../../lib/supabase';
import { Loader2, TrendingUp, Users, Target, MousePointer2, Briefcase, Activity, Zap, Cpu, Send, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CampaignStatsProps {
  campaignId?: string;
}

const CampaignStats = ({ campaignId }: CampaignStatsProps) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CampaignStat[]>([
    { label: 'Total Sent', value: '0' },
    { label: 'Replies', value: '0', percentage: '0%' },
    { label: 'Bounce Rate', value: '0%' },
    { label: 'Opportunities', value: '0' },
    { label: 'Conversions', value: '0' }
  ]);
  const [hasData, setHasData] = useState(false);
  const [limitedAccounts, setLimitedAccounts] = useState<string[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!campaignId) return;

      try {
        setLoading(true);

        const { count: totalLeads, error: countError } = await supabase
          .from('campaign_leads')
          .select('campaign_id', { count: 'exact', head: true })
          .eq('campaign_id', campaignId);

        if (countError) throw countError;

        let opportunities = 0;
        let conversions = 0;

        if (totalLeads && totalLeads > 0) {
          const { count: oppCount } = await supabase
            .from('campaign_leads')
            .select('lead:leads!inner(status)', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .in('lead.status', ['Opportunity', 'Active', 'Interested', 'Meeting Booked']);

          opportunities = oppCount || 0;

          const { count: convCount } = await supabase
            .from('campaign_leads')
            .select('lead:leads!inner(status)', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .in('lead.status', ['Converted', 'Closed', 'Client', 'Deal Won']);

          conversions = convCount || 0;
        }

        // Total emails sent (all time, not just 24h)
        const { data: sentData, error: sentError } = await supabase
          .from('campaign_progress')
          .select('id', { count: 'exact', head: false })
          .eq('campaign_id', campaignId)
          .eq('status', 'sent');

        if (sentError) throw sentError;

        const totalSentCount = sentData?.length || 0;

        // Bounce count
        const { data: bounceData } = await supabase
          .from('campaign_progress')
          .select('id', { count: 'exact', head: false })
          .eq('campaign_id', campaignId)
          .eq('status', 'failed');

        const bounceCount = bounceData?.length || 0;
        const bounceRate = totalSentCount > 0
          ? Math.round((bounceCount / (totalSentCount + bounceCount)) * 100)
          : 0;

        // Replies
        let repliesCount = 0;
        if (campaignId) {
          const { count } = await supabase
            .from('inbox_emails')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .eq('folder', 'inbox');

          repliesCount = count || 0;
        }

        const replyRate = (totalSentCount && totalSentCount > 0)
          ? Math.round((repliesCount / totalSentCount) * 100)
          : 0;

        setStats([
          {
            label: 'Total Sent',
            value: totalSentCount.toLocaleString(),
            percentage: `${totalLeads || 0} Prospects`
          },
          {
            label: 'Replies',
            value: `${repliesCount}`,
            percentage: `${replyRate}% Rate`
          },
          {
            label: 'Bounce Rate',
            value: `${bounceRate}%`,
            percentage: `${bounceCount} Bounced`
          },
          {
            label: 'Opportunities',
            value: opportunities.toString()
          },
          {
            label: 'Conversions',
            value: conversions.toString()
          }
        ]);

        // Fetch account limits
        const { data: accountsRaw } = await supabase
          .from('scheduled_emails')
          .select('schedule_email_accounts(email_accounts(email))')
          .eq('campaign_id', campaignId);

        const emails = new Set<string>();
        accountsRaw?.forEach((schedule: any) => {
          schedule.schedule_email_accounts?.forEach((acc: any) => {
            if (acc.email_accounts?.email) emails.add(acc.email_accounts.email.toLowerCase());
          });
        });

        if (emails.size > 0) {
          const currentHour = new Date();
          currentHour.setMinutes(0, 0, 0);

          const { data: limits } = await supabase
            .from('domain_hourly_stats')
            .select('domain, emails_sent')
            .in('domain', Array.from(emails))
            .eq('hour_bucket', currentHour.toISOString());

          const reached = limits?.filter(l => l.emails_sent >= 50).map(l => l.domain) || [];
          setLimitedAccounts(reached);
        } else {
          setLimitedAccounts([]);
        }

        setHasData(((totalLeads as number) || 0) > 0);

      } catch (error) {
        console.error('Error fetching campaign stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Realtime Subscriptions
    const leadsChannel = supabase
      .channel(`stats-leads-${campaignId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'campaign_leads', 
        filter: `campaign_id=eq.${campaignId}` 
      }, () => fetchStats())
      .subscribe();

    const progressChannel = supabase
      .channel(`stats-progress-${campaignId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'campaign_progress', 
        filter: `campaign_id=eq.${campaignId}` 
      }, () => fetchStats())
      .subscribe();

    const inboxChannel = supabase
      .channel(`stats-inbox-${campaignId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'inbox_emails'
      }, () => fetchStats())
      .subscribe();

    return () => {
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(inboxChannel);
    };
  }, [campaignId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <Activity className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse" />
        </div>
        <p className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">Loading metrics...</p>
      </div>
    );
  }

  const icons = [Send, Users, AlertTriangle, Target, Briefcase];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        {stats.map((stat, index) => {
          const Icon = icons[index];
          return (
            <div 
              key={stat.label} 
              className={cn(
                "p-6 flex flex-col group relative transition-all duration-500 hover:bg-muted/30",
                index < stats.length - 1 && "border-r border-border"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                  {stat.label}
                </span>
                <Icon size={16} className="text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
              </div>
              
              <div className="flex flex-col gap-1">
                <span className="text-3xl font-bold text-foreground leading-none group-hover:scale-[1.02] transition-transform origin-left duration-500">
                  {stat.value}
                </span>
                {stat.percentage && (
                  <span className="text-xs font-medium text-primary/70 mt-1">
                    {stat.percentage}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Account Limits Warning */}
      {limitedAccounts.length > 0 && (
        <div className="flex flex-wrap gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-xl mt-6 shadow-sm">
          {limitedAccounts.map(email => (
            <div key={email} className="group relative flex items-center gap-2 bg-destructive/10 px-3 py-1.5 rounded-lg border border-destructive/20 cursor-help transition-all hover:bg-destructive/20">
              <AlertTriangle size={14} className="text-destructive animate-pulse" />
              <span className="text-xs font-semibold text-destructive truncate max-w-[180px]">
                {email}
              </span>
              
              {/* Hover Card */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap bg-popover border border-border rounded-lg px-3 py-2 shadow-xl">
                <span className="text-xs font-medium text-popover-foreground">
                  Daily Limit (50) Reached
                </span>
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[5px] border-transparent border-t-popover" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasData && (
        <div className="bg-card border border-border rounded-3xl p-20 mt-6 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-40" />
          
          <div className="relative">
            <div className="w-20 h-20 bg-muted/40 rounded-full flex items-center justify-center animate-pulse border border-border">
              <Cpu className="text-muted-foreground/40" size={32} />
            </div>
          </div>

          <div className="space-y-2 relative">
            <h3 className="text-xl font-bold text-foreground">Awaiting Campaign Data</h3>
            <p className="text-sm font-medium text-muted-foreground max-w-sm leading-relaxed mx-auto">
              Stats will populate once the campaign starts sending emails.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignStats;

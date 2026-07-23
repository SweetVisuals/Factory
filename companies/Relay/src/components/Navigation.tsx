import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Compass, Target, Inbox, AtSign, UserCircle, MessageSquare, LogOut, Zap, Clock, Activity, Cpu, HardDrive, Bell, BellRing, Settings, Sparkles, Menu, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Logo from './Logo';

const Navigation = ({ onToggleChat, isChatExpanded }: { onToggleChat?: () => void, isChatExpanded?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dbSpace, setDbSpace] = useState<number>(0);
  const [leadsCount, setLeadsCount] = useState<number>(0);

  const isAdmin = user?.email === 'ptnmgmt@gmail.com';
  const MAX_DB_SPACE_MB = isAdmin ? 5120 : 250; // 5GB or 250MB

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const fetchStatus = async () => {
      // Fetch DB space & usage estimation (leads count proxy)
      const { count: currentLeadsCount } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      if (currentLeadsCount !== null) {
        setDbSpace(currentLeadsCount / 1024); // Convert KB to MB
        setLeadsCount(currentLeadsCount);
      }

      // Fetch campaigns needing review or paused
      const { data: campaignAlerts } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at')
        .in('status', ['review', 'paused', 'error', 'stopped'])
        .order('created_at', { ascending: false });
        
      if (campaignAlerts && campaignAlerts.length > 0) {
        const loadedNotifications = campaignAlerts.map(c => {
          const isPaused = c.status === 'paused';
          const isReview = c.status === 'review';
          return {
            id: c.id,
            campaignId: c.id,
            title: (isPaused || isReview) ? 'Action Required' : 'Campaign Alert',
            message: isReview
              ? `Campaign "${c.name}" has over 1000 leads and is ready for review.`
              : isPaused 
              ? `Campaign "${c.name}" schedule is ready for review.` 
              : `Campaign "${c.name}" status changed to ${c.status}`,
            time: new Date(c.created_at || Date.now()).toLocaleTimeString(),
            read: false
          };
        });
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newNotifications = loadedNotifications.filter(n => !existingIds.has(n.id));
          return [...prev, ...newNotifications].slice(0, 10);
        });
      }
    };
    fetchStatus();

    const channel = supabase.channel('factory-status-nav')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_leads' }, async (payload) => {
        // Fetch lead and campaign details
        const { data: leadData } = await supabase.from('leads').select('name, email').eq('id', payload.new.lead_id).maybeSingle();
        const { data: campaignData } = await supabase.from('campaigns').select('name').eq('id', payload.new.campaign_id).maybeSingle();
        
        const leadName = leadData?.name || leadData?.email || 'A lead';
        const campaignName = campaignData?.name || 'a campaign';

        setNotifications(prev => [{
          id: Date.now(),
          campaignId: payload.new.campaign_id,
          title: 'Lead Added to Campaign',
          message: `${leadName} was added to ${campaignName}.`,
          time: new Date().toLocaleTimeString(),
          read: false
        }, ...prev].slice(0, 10));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbox_emails' }, async (payload) => {
        if (payload.new.folder !== 'inbox') return;
        setNotifications(prev => [{
          id: Date.now(),
          title: 'New Reply Received',
          message: `From: ${payload.new.from}\nSubject: ${payload.new.subject}`,
          time: new Date().toLocaleTimeString(),
          read: false
        }, ...prev].slice(0, 10));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns' }, async (payload) => {
        if (payload.new.status === 'paused' || payload.new.status === 'review' || payload.new.status === 'error' || payload.new.status === 'stopped') {
          const isPaused = payload.new.status === 'paused';
          const isReview = payload.new.status === 'review';
          setNotifications(prev => [{
            id: Date.now(),
            campaignId: payload.new.id,
            title: (isPaused || isReview) ? 'Action Required' : 'Campaign Alert',
            message: isReview
              ? `Campaign "${payload.new.name}" has over 1000 leads and is ready for review.`
              : isPaused 
              ? `Campaign "${payload.new.name}" schedule is ready for review.` 
              : `Campaign "${payload.new.name}" status changed to ${payload.new.status}`,
            time: new Date().toLocaleTimeString(),
            read: false
          }, ...prev].slice(0, 10));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationClick = (n: any) => {
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
    if (n.campaignId) {
      navigate(`/campaign/${n.campaignId}?tab=review`);
      setShowNotifications(false);
    }
  };

  const clearNotification = (e: React.MouseEvent, id: any) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Discover', path: '/discover', icon: Compass },
    { name: 'Campaigns', path: '/campaigns', icon: Target },
    { name: 'Inbox', path: '/inbox', icon: Inbox },
    { name: 'Accounts', path: '/email-accounts', icon: AtSign },
    { name: 'Profile', path: '/profile', icon: Settings },
  ];

  return (
    <>
    <header className="sticky top-0 z-[100] w-full bg-[#111111] border-b border-white/5 text-foreground shadow-sm">
      <div className="flex h-[58px] items-center px-4 gap-4 md:gap-6 select-none">
        {/* Brand */}
        <div className="flex items-center gap-3 font-bold cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
          <Logo iconOnly={false} />
        </div>
        
        {/* Main OS Menu */}
        <nav className="hidden xl:flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all",
                isActive(item.path) || location.pathname.startsWith(item.path) && item.path !== '/dashboard' 
                  ? "bg-white/10 text-white shadow-sm" 
                  : "text-foreground/50 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={14} />
              {item.name}
            </button>
          ))}
        </nav>

        {/* System Tray (Right Side) */}
        <div className="flex items-center ml-auto gap-4">
          
          {/* OS System Health Monitor (Combined Metric) */}
          <div 
            onClick={() => navigate('/profile?tab=usage')}
            className="hidden lg:flex items-center gap-3 bg-black/40 px-3.5 py-1.5 rounded-lg border border-white/5 cursor-pointer opacity-80 hover:opacity-100 transition-all hover:bg-white/5 group"
            title="View System Usage Details"
          >
            <Sparkles size={13} className="text-emerald-400/90 shrink-0 group-hover:scale-110 transition-transform" />
            <div className="flex flex-col gap-1 min-w-[120px]">
              <div className="flex justify-between items-center text-[10px] font-bold text-foreground/60 gap-3">
                <span>Usage & Quota</span>
                {(() => {
                  const quotaLimit = isAdmin ? 10000 : 100;
                  const usagePct = Math.min(100, Math.round((leadsCount / quotaLimit) * 100));
                  return (
                    <>
                      <span className="text-white font-mono">
                        {leadsCount.toLocaleString()} / {quotaLimit.toLocaleString()} Leads ({usagePct}%)
                      </span>
                    </>
                  );
                })()}
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                {(() => {
                  const quotaLimit = isAdmin ? 10000 : 100;
                  const usagePct = Math.min(100, Math.max(1, Math.round((leadsCount / quotaLimit) * 100)));
                  return (
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)] transition-all duration-500" 
                      style={{ width: `${usagePct}%` }} 
                    />
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Engine Controls */}
          <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
            <button 
              onClick={() => toggleEngine('active')}
              className={cn("px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5", !isPaused ? "bg-emerald-500/20 text-emerald-400" : "text-foreground/40 hover:text-white")}
            >
              <Zap size={12} className={cn(!isPaused && "fill-emerald-400")} /> Running
            </button>
            <button 
              onClick={() => toggleEngine('paused')}
              className={cn("px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5", isPaused ? "bg-red-500/20 text-red-400" : "text-foreground/40 hover:text-white")}
            >
              <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-red-400" : "bg-foreground/40")} /> Paused
            </button>
          </div>

          <div className="h-6 w-px bg-white/10" />

          {/* Notifications Center */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-foreground/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              {unreadCount > 0 ? (
                <>
                  <BellRing size={16} className="text-red-500 animate-pulse" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                </>
              ) : (
                <Bell size={16} />
              )}
            </button>

            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-[#000000] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-[#111111]">
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Notification Center</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300">Mark all read</button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto bg-black">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs font-medium text-foreground/40 italic">
                      No new notifications
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            "p-4 border-b border-white/5 hover:bg-white/5 transition-colors relative group", 
                            n.campaignId && "cursor-pointer",
                            !n.read ? "bg-white/[0.02]" : "opacity-60"
                          )}
                        >
                          <div className="flex justify-between items-start gap-4 mb-1 pr-6">
                            <span className={cn("text-xs text-white", !n.read ? "font-bold" : "font-normal")}>{n.title}</span>
                            <span className="text-[10px] text-foreground/40 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-foreground/60 leading-relaxed pr-6">{n.message}</p>
                          <button
                            onClick={(e) => clearNotification(e, n.id)}
                            className="absolute right-3 top-4 text-foreground/30 hover:text-white transition-colors opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10"
                            title="Clear notification"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={onToggleChat}
            className={cn(
              "p-2 rounded-lg transition-all border",
              isChatExpanded ? "bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_rgba(var(--tw-colors-primary),0.3)]" : "text-foreground/50 border-transparent hover:text-white hover:bg-white/10"
            )}
            title="Terminal"
          >
            <MessageSquare size={16} />
          </button>

          <div className="flex items-center gap-1">
            <button onClick={signOut} className="p-2 text-foreground/50 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>

    {/* Mobile Bottom Tab Bar */}
    <nav className="xl:hidden fixed bottom-0 inset-x-0 bg-[#111111] border-t border-white/5 z-[100] px-2 py-2 pb-safe flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      {navItems.slice(0, 5).map(item => {
        const active = isActive(item.path) || (location.pathname.startsWith(item.path) && item.path !== '/dashboard');
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300 min-w-[60px]",
              active ? "text-primary" : "text-foreground/40 hover:text-white"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              active ? "bg-primary/20" : "bg-transparent"
            )}>
              <item.icon size={18} className={cn(active && "fill-primary/20")} />
            </div>
            <span className="text-[9px] font-bold tracking-wider">{item.name}</span>
          </button>
        );
      })}
    </nav>
    </>
  );
};

export default Navigation;

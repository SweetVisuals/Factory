import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Compass, Target, Inbox, AtSign, UserCircle, MessageSquare, LogOut, Zap, Clock, Activity, Cpu, HardDrive, Bell, BellRing, Settings, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import Logo from './Logo';

const Navigation = ({ onToggleChat, isChatExpanded }: { onToggleChat?: () => void, isChatExpanded?: boolean }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [isPaused, setIsPaused] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase.from('agent_memory').select('value').eq('key_name', 'factory_status').maybeSingle();
      if (data?.value) setIsPaused(data.value.status === 'paused');
    };
    fetchStatus();

    const channel = supabase.channel('factory-status-nav')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_memory', filter: 'key_name=eq.factory_status' }, (payload) => {
        setIsPaused((payload.new as any).value.status === 'paused');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_leads' }, async (payload) => {
        // Fetch lead and campaign details
        const { data: leadData } = await supabase.from('leads').select('name, email').eq('id', payload.new.lead_id).maybeSingle();
        const { data: campaignData } = await supabase.from('campaigns').select('name').eq('id', payload.new.campaign_id).maybeSingle();
        
        const leadName = leadData?.name || leadData?.email || 'A lead';
        const campaignName = campaignData?.name || 'a campaign';

        setNotifications(prev => [{
          id: Date.now(),
          title: 'Lead Added to Campaign',
          message: `${leadName} was added to ${campaignName}.`,
          time: new Date().toLocaleTimeString(),
          read: false
        }, ...prev].slice(0, 10));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleEngine = async (status: 'active' | 'paused') => {
    const { error } = await supabase.from('agent_memory').upsert({ key_name: 'factory_status', value: { status } }, { onConflict: 'key_name' });
    if (!error) setIsPaused(status === 'paused');
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
    <header className="sticky top-0 z-[100] w-full bg-[#111111] border-b border-white/5 text-foreground shadow-sm">
      <div className="flex h-12 items-center px-4 gap-6 select-none">
        {/* Brand */}
        <div className="flex items-center gap-3 font-bold cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/dashboard')}>
          <Logo iconOnly={false} />
        </div>
        
        {/* Main OS Menu */}
        <nav className="hidden md:flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
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
          
          {/* OS System Health Monitors & AI Balance */}
          <div className="hidden lg:flex items-center gap-4 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 w-24 group cursor-pointer opacity-80 hover:opacity-100 transition-opacity">
              <Sparkles size={12} className="text-purple-400/80 shrink-0" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-foreground/50">
                  <span>Balance</span>
                  <span className="text-white/90 font-mono">$42.5</span>
                </div>
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500/50 to-purple-400 w-[45%] shadow-[0_0_2px_rgba(168,85,247,0.5)]" />
                </div>
              </div>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2 w-24">
              <Cpu size={12} className="text-foreground/50 shrink-0" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-foreground/50">
                  <span>API Limit</span>
                  <span>45%</span>
                </div>
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[45%]" />
                </div>
              </div>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-2 w-24">
              <HardDrive size={12} className="text-foreground/50 shrink-0" />
              <div className="flex-1 flex flex-col gap-1">
                <div className="flex justify-between text-[9px] font-bold text-foreground/50">
                  <span>DB Space</span>
                  <span>12%</span>
                </div>
                <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[12%]" />
                </div>
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
                  <BellRing size={16} className="text-emerald-400 animate-pulse" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
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
                        <div key={n.id} className={cn("p-4 border-b border-white/5 hover:bg-white/5 transition-colors", !n.read ? "bg-white/[0.02]" : "opacity-70")}>
                          <div className="flex justify-between items-start gap-4 mb-1">
                            <span className="text-xs font-bold text-white">{n.title}</span>
                            <span className="text-[10px] text-foreground/40 shrink-0">{n.time}</span>
                          </div>
                          <p className="text-[11px] text-foreground/60 leading-relaxed">{n.message}</p>
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
            <button onClick={() => signOut()} className="p-2 text-foreground/50 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Log Out">
              <LogOut size={16} />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navigation;

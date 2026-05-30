import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitOpenAgentModal } from '../utils/events';

interface AgentSpriteProps {
  name: string;
  src: string;
  zIndex: number;
  room?: string;
}

const AgentSprite: React.FC<AgentSpriteProps & { isIsolated?: boolean; deskSrc?: string }> = ({ name, src, zIndex, room = 'hq', isIsolated = false, deskSrc }) => {
  const [agentStatus, setAgentStatus] = useState<'in_progress' | 'error' | 'waiting' | 'idle'>('idle');
  const [currentTask, setCurrentTask] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [lastTransmission, setLastTransmission] = useState<string | null>(null);
  const [showProgressToast, setShowProgressToast] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const chatTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkActiveTasks();
    fetchLastTransmission();

    const channelName = `public:tasks:${name}:${room}`;
    const tasksSubscription = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `assigned_to=eq.${name}` }, () => {
        checkActiveTasks();
      })
      .subscribe();

    // Subscribe to chat logs for this agent to show "transmissions"
    const chatChannelName = `public:chat_logs:${name}:${room}`;
    const chatSubscription = supabase
      .channel(chatChannelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_logs', 
        filter: `agent_name=eq.${name}` 
      }, (payload) => {
        handleNewTransmission(payload.new.message);
      })
      .subscribe();

    // Also keep the Boss/CEO special logic
    let bossSubscription: any = null;
    if (name === 'Boss') {
      bossSubscription = supabase
        .channel('public:chat_logs:boss_ceo')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_logs', filter: 'agent_name=eq.CEO' }, (payload) => {
          handleNewTransmission(`CEO: ${payload.new.message}`);
          checkActiveTasks();
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(chatSubscription);
      if (bossSubscription) supabase.removeChannel(bossSubscription);
      if (chatTimerRef.current) clearTimeout(chatTimerRef.current);
    };
  }, [name, room]);

  const fetchLastTransmission = async () => {
    const { data } = await supabase
      .from('chat_logs')
      .select('message, created_at')
      .eq('agent_name', name)
      .order('created_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const msg = data[0];
      const created = new Date(msg.created_at).getTime();
      const now = new Date().getTime();
      
      // If it's less than 60 seconds old, show it
      if (now - created < 60000) {
        handleNewTransmission(msg.message);
      } else {
        setLastTransmission(msg.message.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim());
      }
    }
  };

  const handleNewTransmission = (message: string) => {
    // Clean up thoughts and markdown
    const cleanMsg = message.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    if (!cleanMsg) return; // Don't show empty bubbles if it's just a thought

    setLastTransmission(cleanMsg);
    setShowChat(true);

    // Clear existing timer if any
    if (chatTimerRef.current) {
      clearTimeout(chatTimerRef.current);
    }

    // Disappear after 60 seconds
    chatTimerRef.current = setTimeout(() => {
      setShowChat(false);
      chatTimerRef.current = null;
    }, 60000);
  };

  const checkActiveTasks = async () => {
    const { data } = await supabase
      .from('tasks')
      .select('status, description, progress')
      .eq('assigned_to', name)
      .neq('status', 'completed')
      .order('created_at', { ascending: false });
    
    if (!data || data.length === 0) {
      setAgentStatus('idle');
      setCurrentTask(null);
      setProgress(0);
      return;
    }

    // Prioritize in_progress task for the summary
    const activeTask = data.find(t => t.status === 'in_progress') || data[0];
    setCurrentTask(activeTask.description || null);
    
    const newProgress = activeTask.progress || 0;
    if (newProgress > progress && agentStatus === 'in_progress') {
      setShowProgressToast(true);
      setTimeout(() => setShowProgressToast(false), 2000);
    }
    setProgress(newProgress);

    const statuses = data.map(t => t.status);
    
    if (statuses.includes('error')) {
      setAgentStatus('error');
    } else if (statuses.includes('in_progress')) {
      setAgentStatus('in_progress');
    } else if (statuses.includes('waiting') || statuses.includes('waiting_for_reply')) {
      setAgentStatus('waiting');
    } else if (statuses.includes('pending')) {
      setAgentStatus('waiting');
    } else {
      setAgentStatus('idle');
    }
  };

  const getStatusColor = () => {
    switch (agentStatus) {
      case 'error': return '#ef4444'; // Red
      case 'in_progress': return '#10b981'; // Green
      case 'waiting': return '#eab308'; // Yellow
      case 'idle': return '#6b7280'; // Grey
      default: return '#6b7280';
    }
  };

  const getAgentPosition = (agentName: string, roomName: string) => {
    switch (agentName) {
      case 'Boss': return { top: 'calc(30% - 123px)', left: 'calc(50% + 560px)', dotOffset: { top: -50, left: 0 } };
      case 'Manager': return { top: 'calc(30% + 26px)', left: 'calc(50% + 315px)', dotOffset: { top: -50, left: 0 } };
      case 'Product Specialist': return { top: 'calc(30% + 509px)', left: 'calc(50% + 86px)', dotOffset: { top: -50, left: 0 } };
      case 'Market Researcher': 
        return roomName === 'relay' 
          ? { top: 'calc(30% + 247px)', left: 'calc(50% - 430px)', dotOffset: { top: -50, left: 10 } } 
          : { top: 'calc(30% + 34px)', left: 'calc(50% - 5px)', dotOffset: { top: -50, left: 10 } };
      case 'Design Team': return { top: 'calc(30% + 304px)', left: 'calc(50% - 400px)', dotOffset: { top: -50, left: 0 } };
      case 'Specialist': return { top: 'calc(30% + 194px)', left: 'calc(50% - 140px)', dotOffset: { top: -50, left: 0 } };
      case 'Emailer': return { top: 'calc(30% + 225px)', left: 'calc(50% + 460px)', dotOffset: { top: -50, left: 0 } }; 
      case 'Scraper': return { top: 'calc(30% + 27px)', left: 'calc(50% + 45px)', dotOffset: { top: -45, left: -20 } }; 
      case 'Validator': return { top: 'calc(30% + 480px)', left: 'calc(50% + 35px)', dotOffset: { top: -50, left: 0 } }; 
      case 'Sales Strategist': return { top: 'calc(30% + 470px)', left: 'calc(50% - 340px)', dotOffset: { top: -50, left: 0 } };
      case 'Scheduler Manager': return { top: 'calc(30% - 150px)', left: 'calc(50% - 200px)', dotOffset: { top: -50, left: 0 } };
      case 'Pinterest Curator': return { top: 'calc(30% + 150px)', left: 'calc(50% - 400px)', dotOffset: { top: -50, left: 0 } };
      case 'Content Creator': return { top: 'calc(30% + 350px)', left: 'calc(50% + 100px)', dotOffset: { top: -50, left: 0 } };
      case 'Account Manager': return { top: 'calc(30% + 150px)', left: 'calc(50% + 300px)', dotOffset: { top: -50, left: 0 } };
      default: return { top: 'calc(30% - 20px)', left: '50%', dotOffset: { top: -50, left: 0 } };
    }
  };

  const pos = getAgentPosition(name, room);

  const formatTaskSummary = (task: string, maxLength: number = 35) => {
    if (!task) return 'Working...';
    
    // Extract summary if it exists
    const summaryMatch = task.match(/\[SUMMARY:\s*(.*?)\]/s);
    let text = summaryMatch ? summaryMatch[1].trim() : task;
    
    // Clean up markdown/extra noise
    text = text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/DELEGATE:.*\|/g, '')
      .replace(/\n/g, ' ')
      .trim();

    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
  };

  const spriteStyle: React.CSSProperties = isIsolated ? {
    position: 'absolute',
    top: pos.top,
    left: pos.left,
    transform: 'translate(-50%, -50%)',
    width: '256px',
    height: '256px',
    objectFit: 'contain',
    pointerEvents: 'none',
    zIndex: 2,
    filter: isHovered || agentStatus === 'in_progress' ? `drop-shadow(0 0 10px ${getStatusColor()}) brightness(1.1)` : 'none',
    transition: 'filter 0.3s ease-in-out',
    display: src ? 'block' : 'none'
  } : {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    zIndex: 2,
    filter: isHovered || agentStatus === 'in_progress' ? `drop-shadow(0 0 10px ${getStatusColor()}) brightness(1.1)` : 'none',
    transition: 'filter 0.3s ease-in-out',
    display: src ? 'block' : 'none'
  };

  return (
    <div 
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%', 
        zIndex,
        pointerEvents: 'none'
      }}
    >
      {/* Optional Desk Layer */}
      {isIsolated && deskSrc && (
        <img 
          src={deskSrc} 
          alt={`${name} Desk`}
          className="pixel-art"
          style={{
            position: 'absolute',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -50%)',
            width: '256px',
            height: '256px',
            objectFit: 'contain',
            zIndex: 1,
            pointerEvents: 'none'
          }}
        />
      )}

      <img 
        src={src} 
        alt={name}
        className="pixel-art"
        style={spriteStyle}
      />


      {/* Hitbox for Hover/Click */}
      <div 
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -50%)',
          width: '128px',
          height: '128px',
          pointerEvents: 'auto',
          cursor: 'pointer',
          zIndex: 5
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => emitOpenAgentModal(name)}
      >
        {/* Chat Bubble / Transmission */}
        {(showChat && lastTransmission) && (
          <div style={{
            position: 'absolute',
            bottom: '140px', // Positioned above the dot and tag
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            padding: '10px 15px',
            fontSize: '1.2rem',
            fontFamily: "'VT323', monospace",
            width: '200px',
            pointerEvents: 'none',
            zIndex: 40,
            animation: 'fadeInUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            borderRadius: '2px',
            lineHeight: '1.2',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>
              TRANSMISSION
            </div>
            {formatTaskSummary(lastTransmission, 120)}
            {/* Pointer */}
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid rgba(30, 41, 59, 0.95)'
            }} />
          </div>
        )}

        {/* 16-Bit Progress Bar (Pulsing when active) */}
        {agentStatus === 'in_progress' && (
          <div style={{
            position: 'absolute',
            top: '-80px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '18px',
            backgroundColor: 'rgba(0,0,0,0.9)',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)',
            padding: '2px',
            zIndex: 20,
            display: 'flex',
            gap: '2px',
            animation: progress > 0 ? 'pulse-progress 2s infinite' : 'none'
          }}>
            {Array.from({ length: 10 }).map((_, i) => {
              const isFilled = (progress / 10) > i;
              return (
                <div key={i} style={{
                  flex: 1,
                  backgroundColor: isFilled ? '#10b981' : 'transparent',
                  transition: 'background-color 0.4s steps(4)',
                  opacity: isFilled ? 1 : 0.2
                }} />
              );
            })}
          </div>
        )}

        {/* Progress Toast (Pop-up from the progress bar) */}
        {showProgressToast && (
          <div style={{
            position: 'absolute',
            top: '-115px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#000',
            padding: '4px 12px',
            fontFamily: "'VT323', monospace",
            fontSize: '1.4rem',
            fontWeight: 'bold',
            boxShadow: '2px 2px 0 #000',
            zIndex: 30,
            animation: 'fadeInUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            {progress}% COMPLETE!
          </div>
        )}

        {/* Tag (Status/Name) */}
        {(isHovered || (agentStatus === 'in_progress' && !showChat)) && (
          <div style={{
            position: 'absolute',
            top: '-40px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            color: agentStatus === 'in_progress' ? '#10b981' : '#fff',
            padding: '6px 12px',
            fontSize: '1rem',
            fontFamily: "'VT323', monospace",
            whiteSpace: 'nowrap',
            boxShadow: `inset 1px 1px 0 rgba(255,255,255,0.1), inset -1px -1px 0 rgba(0,0,0,0.5), 0 4px 20px rgba(0,0,0,0.6)`,
            pointerEvents: 'none',
            zIndex: 20,
            animation: 'fadeInUp 0.3s ease-out',
            borderRadius: '2px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {['in_progress', 'waiting', 'waiting_for_reply', 'pending'].includes(agentStatus) && currentTask 
              ? formatTaskSummary(currentTask)
              : (name === 'Boss' ? 'Boss / CEO' : name)}
          </div>
        )}
      </div>

      {/* Status Dot Indicator */}
      <div style={{
        position: 'absolute',
        top: `calc(${pos.top} + ${pos.dotOffset.top}px)`,
        left: `calc(${pos.left} + ${pos.dotOffset.left}px)`,
        transform: 'translate(-50%, -50%)',
        width: '15px',
        height: '15px',
        backgroundColor: getStatusColor(),
        borderRadius: '50%',
        boxShadow: `0 0 10px ${getStatusColor()}`,
        zIndex: 10,
        animation: agentStatus === 'idle' ? 'none' : 'pulse 1.5s infinite',
        pointerEvents: 'none'
      }} />
    </div>
  );
};

export default AgentSprite;

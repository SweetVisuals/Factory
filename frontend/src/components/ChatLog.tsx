import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

interface ChatLogEntry {
  id: string;
  agent_name: string;
  message: string;
  created_at: string;
}

interface ChatLogProps {
  fullScreen?: boolean;
}

const ChatLog: React.FC<ChatLogProps> = ({ fullScreen = false }) => {
  const [logs, setLogs] = useState<ChatLogEntry[]>([]);
  const [isExpanded, setIsExpanded] = useState(true); // Default expanded if fullScreen or standard
  const [chatWidth, setChatWidth] = useState(320); // Default thinner width
  const [isResizing, setIsResizing] = useState(false);
  const endOfLogRef = useRef<HTMLDivElement>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCollapseTimer = () => {
    if (fullScreen) return; // Never collapse if fullScreen
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
    }
    collapseTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 20000);
  };

  useEffect(() => {
    if (fullScreen) {
      setIsExpanded(true);
    }
  }, [fullScreen]);

  useEffect(() => {
    fetchLogs();

    const subscription = supabase
      .channel('public:chat_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_logs' }, payload => {
        setLogs(prev => [...prev, payload.new as ChatLogEntry]);
        setIsExpanded(true);
        resetCollapseTimer();
      })
      .subscribe();

    const handleOpenChat = () => {
      setIsExpanded(true);
      resetCollapseTimer();
    };
    window.addEventListener('open-chat', handleOpenChat);

    return () => {
      supabase.removeChannel(subscription);
      window.removeEventListener('open-chat', handleOpenChat);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  // Resize handler
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const rightEdge = window.innerWidth - 20; // 20px right margin
      const newWidth = rightEdge - e.clientX;
      if (newWidth >= 220 && newWidth <= 800) {
        setChatWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => setIsResizing(false);
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isExpanded && endOfLogRef.current) {
      endOfLogRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isExpanded]);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('chat_logs')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) setLogs(data);
  };

  const handleClearLogs = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .not('id', 'is', null);
    if (error) {
      console.error('Error clearing logs:', error);
    } else {
      setLogs([]);
    }
  };

  const getAgentColor = (name: string) => {
    switch (name.toUpperCase()) {
      case 'BOSS': return '#ef4444'; // Red
      case 'MANAGER': return '#eab308'; // Yellow
      case 'SYSTEM': return '#10b981'; // Green
      case 'MARKET RESEARCHER': return '#a855f7'; // Purple
      case 'PRODUCT SPECIALIST': return '#3b82f6'; // Blue
      case 'DESIGN TEAM': return '#ec4899'; // Pink
      case 'SPECIALIST': return '#f97316'; // Orange
      default: return '#eab308';
    }
  };

  const renderMessage = (log: ChatLogEntry) => {
    const { message, agent_name: agentName, created_at: createdAt } = log;
    let response = message;
    let thought = "";

    // Extract thoughts
    const thoughtMatch = response.match(/<thought>([\s\S]*?)<\/thought>/);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
    }
    response = response.replace(/<thought>[\s\S]*?<\/thought>/g, '').trim();
    
    // Ignore heartbeat and system discovery noise
    if (response.trim().startsWith("You are the Boss. The factory is idle.") || 
        response.includes("System Discovery")) {
      return null;
    }

    const isEmail = agentName.toUpperCase() === 'EMAILER' || agentName.toUpperCase() === 'CEO' || response.includes('Subject:') || response.includes('**Subject:**');

    let subject = "";
    let to = "Boss";

    if (isEmail) {
      // Extract Subject carefully to avoid cutting off body text
      const subjectMatch = response.match(/^\s*(?:\*\*)?Subject:(?:\*\*)?\s*([^\n]+)/mi);
      if (subjectMatch) {
        subject = subjectMatch[1].replace(/\*\*/g, '').trim();
        response = response.replace(subjectMatch[0], '').trim();
      }

      // Extract To
      const toMatch = response.match(/^\s*(?:\*\*)?To:(?:\*\*)?\s*([^\n]+)/mi);
      if (toMatch) {
        to = toMatch[1].replace(/\*\*/g, '').trim();
        response = response.replace(toMatch[0], '').trim();
      }
    }

    // Convert single newlines to double newlines to emulate paragraphs, if they aren't already double
    response = response.replace(/([^\n])\n([^\n])/g, '$1\n\n$2');

    // Remove markdown garbage
    response = response.replace(/\*\*/g, '');
    response = response.replace(/[#>`-]/g, '');
    response = response.trim();

    // Special handling for scraper results in chat
    if (response.toLowerCase().includes('discovered:')) {
      response = response.toUpperCase();
    }

    if (!response && !subject) return null;

    if (isEmail) {
      return (
        <div key={log.id} style={{
          marginBottom: '2rem',
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          fontFamily: 'Inter, system-ui, sans-serif' // Real email font
        }}>
          {/* Header */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <div style={{ 
                  width: '32px', height: '32px', 
                  borderRadius: '50%', 
                  background: getAgentColor(agentName), 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 'bold', color: '#0f172a',
                  fontSize: '0.9rem'
                }}>
                  {agentName.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem' }}>{agentName} <span style={{ color: '#64748b', fontWeight: 400, fontSize: '0.85rem' }}>&lt;{agentName.toLowerCase().replace(' ', '_')}@openclaw.com&gt;</span></span>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>To: {to}</span>
                </div>
              </div>
              {subject && (
                <div style={{ marginTop: '0.8rem', color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700 }}>
                  {subject}
                </div>
              )}
            </div>
          </div>
          
          {/* Body */}
          <div style={{
            padding: '1.5rem',
            color: '#cbd5e1',
            fontSize: '0.95rem',
            lineHeight: '1.6',
          }}>
            {thought && (
              <div style={{ 
                marginBottom: '1.5rem', 
                padding: '0.8rem 1rem', 
                background: 'rgba(59, 130, 246, 0.1)', 
                color: '#60a5fa', 
                borderLeft: '3px solid #3b82f6',
                fontFamily: 'VT323, monospace',
                fontSize: '1.1rem'
              }}>
                <strong>[THOUGHT PROCESS]:</strong> {thought}
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {response}
            </div>
          </div>
        </div>
      );
    }

    // Default System/Standard log
    return (
      <div key={log.id} style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.5rem',
        marginBottom: '1rem',
        padding: '1rem',
        background: 'rgba(0,0,0,0.4)',
        borderRadius: '8px',
        fontFamily: 'VT323, monospace',
        borderLeft: `3px solid ${getAgentColor(agentName)}`
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          [{new Date(createdAt).toLocaleTimeString()}] {agentName.toUpperCase()}_UNIT
        </div>
        {thought && (
          <div style={{ color: '#3b82f6', marginBottom: '0.5rem', opacity: 0.8, fontSize: '1rem' }}>
            &gt; {thought}
          </div>
        )}
        <div style={{ color: '#f8fafc', fontSize: '1.2rem', lineHeight: '1.4', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem', wordBreak: 'break-word' }}>
          {response}
        </div>
      </div>
    );
  };

  const handleToggle = () => {
    if (fullScreen) return; // Prevent collapse in fullScreen
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      resetCollapseTimer();
    } else {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    }
  };

  const containerStyle: React.CSSProperties = fullScreen
    ? {
        width: '100%',
        height: '100%',
        minHeight: '60vh',
        background: '#0f172a', /* Sleek CRM Slate 900 */
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }
    : {
        position: 'absolute',
        bottom: '220px',
        right: '20px',
        width: isExpanded ? `${chatWidth}px` : '220px',
        maxHeight: isExpanded ? '600px' : '50px',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        transition: isResizing ? 'none' : 'all 0.2s ease',
        zIndex: 100,
        boxShadow: '10px 10px 20px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      };

  return (
    <div className={fullScreen ? "chat-log-fullscreen" : "chat-log"} style={containerStyle}>
      {/* Resizer Handle (Left Edge) */}
      {!fullScreen && isExpanded && (
        <div 
          onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '10px',
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 110,
            background: isResizing ? '#3b82f6' : 'transparent',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => { if (!isResizing) e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
          onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = 'transparent' }}
        />
      )}

      {/* Header */}
      <div 
        style={{
          background: fullScreen ? '#1e293b' : '#000', /* Sleek header */
          color: '#fff',
          padding: fullScreen ? '1rem 1.5rem' : '0.5rem 1rem',
          fontWeight: 'bold',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: fullScreen ? 'default' : 'pointer',
          borderBottom: isExpanded ? (fullScreen ? '1px solid rgba(255,255,255,0.05)' : '4px solid #fff') : 'none',
          fontFamily: fullScreen ? "'Inter', sans-serif" : "'VT323', monospace",
          fontSize: fullScreen ? '1.1rem' : '1.5rem',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
        onClick={handleToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: fullScreen ? 'none' : '2px 2px 0px #064e3b' }} />
          <span>{fullScreen ? 'Agent Communications Log' : 'AI COMM LINK'}</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {isExpanded && (
            <button 
              onClick={handleClearLogs}
              style={{
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                padding: '0.2rem 0.8rem',
                cursor: 'pointer',
                fontSize: fullScreen ? '0.9rem' : '1.2rem',
                fontWeight: 'bold',
                fontFamily: fullScreen ? "'Inter', sans-serif" : "'VT323', monospace",
                borderRadius: fullScreen ? '6px' : '0px',
                boxShadow: fullScreen ? 'none' : '2px 2px 0px #7f1d1d',
                transition: 'all 0.1s'
              }}
              onMouseEnter={(e) => {
                if (!fullScreen) {
                  e.currentTarget.style.transform = 'translate(-2px, -2px)';
                  e.currentTarget.style.boxShadow = '4px 4px 0px #7f1d1d';
                }
              }}
              onMouseLeave={(e) => {
                if (!fullScreen) {
                  e.currentTarget.style.transform = 'translate(0px, 0px)';
                  e.currentTarget.style.boxShadow = '2px 2px 0px #7f1d1d';
                }
              }}
            >
              CLEAR
            </button>
          )}
          {!fullScreen && <span style={{ fontSize: '1.2rem' }}>{isExpanded ? '▼' : '▲'}</span>}
        </div>
      </div>

      {/* Chat Area */}
      {isExpanded && (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.2rem',
          background: fullScreen ? '#0f172a' : '#111'
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#64748b', textAlign: 'center', fontFamily: fullScreen ? "'Inter', sans-serif" : "'VT323', monospace", fontSize: '1.2rem', padding: '2rem 0' }}>
              NO LOGS FOUND. FACTORY IS IDLE.
            </div>
          ) : (
            logs.map(log => renderMessage(log))
          )}
          <div ref={endOfLogRef} />
        </div>
      )}
    </div>
  );
};

export default ChatLog;

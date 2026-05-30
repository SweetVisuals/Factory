import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const AgentModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'thoughts'>('overview');

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      setAgentName(customEvent.detail.agentName);
      setIsOpen(true);
      fetchTasks(customEvent.detail.agentName);
      fetchLogs(customEvent.detail.agentName);
      setActiveTab('overview');
    };

    window.addEventListener('open-agent-modal', handleOpen);
    return () => window.removeEventListener('open-agent-modal', handleOpen);
  }, []);

  const fetchTasks = async (name: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', name)
      .order('created_at', { ascending: false });

    if (data) {
      setPendingTasks(data.filter(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'waiting'));
      setCompletedTasks(data.filter(t => t.status === 'completed'));
    }
  };

  const fetchLogs = async (name: string) => {
    const { data } = await supabase
      .from('chat_logs')
      .select('*')
      .eq('agent_name', name)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (data) setAgentLogs(data);
  };

  const calculateFeeling = () => {
    const total = pendingTasks.length + completedTasks.length;
    if (total === 0) return { text: 'DORMANT. Awaiting initial directives.', color: '#64748b' };
    if (pendingTasks.length > 5) return { text: 'OVERWHELMED. System load critically high.', color: '#ef4444' };
    if (pendingTasks.length > 2) return { text: 'FOCUSED. Processing concurrent operations.', color: '#eab308' };
    if (pendingTasks.length > 0) return { text: 'ACTIVE. Executing current task.', color: '#3b82f6' };
    return { text: 'ACCOMPLISHED. Ready for next assignment.', color: '#10b981' };
  };

  const parseMessage = (msg: string) => {
    let thought = '';
    let response = msg;
    const thoughtMatch = msg.match(/<thought>([\s\S]*?)<\/thought>/);
    if (thoughtMatch) {
      thought = thoughtMatch[1].trim();
      response = msg.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
    }
    return { thought, response };
  };

  if (!isOpen) return null;

  const feeling = calculateFeeling();

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.9)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      fontFamily: 'VT323, monospace'
    }}>
      <div style={{
        width: '95%',
        maxWidth: '1000px',
        maxHeight: '85vh',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 1), rgba(30, 41, 59, 1))',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'inset 4px 4px 0px rgba(255,255,255,0.05), inset -4px -4px 0px rgba(0,0,0,0.5), 0 40px 80px rgba(0,0,0,0.8)',
        border: 'none',
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Accent Glow Line */}
        <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '2px', 
          background: 'linear-gradient(90deg, transparent, var(--accent-color), transparent)',
          zIndex: 10
        }} />

        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(59, 130, 246, 0.1)', 
          padding: '1.5rem 2rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <h2 style={{ 
            margin: 0, 
            fontSize: '2.5rem', 
            textTransform: 'uppercase', 
            fontWeight: 'bold',
            color: 'var(--accent-color)',
            letterSpacing: '2px',
            textShadow: '2px 2px 0 rgba(0,0,0,0.5)'
          }}>
            {agentName} // DIAGNOSTICS
          </h2>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{ 
              background: 'none', 
              color: '#64748b', 
              fontSize: '2.5rem', 
              border: 'none', 
              cursor: 'pointer', 
              fontFamily: 'VT323, monospace',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
          >
            [X]
          </button>
        </div>

        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', overflowY: 'auto', scrollbarWidth: 'none' }}>
          
          {/* Agent Feeling / Status */}
          <div style={{ 
            background: 'rgba(0,0,0,0.4)', 
            padding: '2rem',
            boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.5)',
            borderRadius: '4px'
          }}>
            <h3 style={{ 
              color: feeling.color, 
              margin: '0 0 1rem 0', 
              fontSize: '2rem', 
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              // COGNITIVE_STATE
            </h3>
            <p style={{ margin: 0, fontSize: '1.6rem', color: 'white', lineHeight: '1.2' }}>
              {feeling.text}
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '3rem', color: '#64748b', fontSize: '1.3rem', fontFamily: 'VT323' }}>
              <span style={{ background: 'rgba(0,0,0,0.5)', padding: '0.2rem 0.8rem', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)' }}>
                ACTIVE_QUEUE: {pendingTasks.length}
              </span>
              <span style={{ background: 'rgba(0,0,0,0.5)', padding: '0.2rem 0.8rem', boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)' }}>
                LIFETIME_YIELD: {completedTasks.length}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {['overview', 'tasks', 'thoughts'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                style={{
                  flex: 1,
                  padding: '1.2rem',
                  backgroundColor: activeTab === tab ? 'var(--accent-color)' : 'rgba(15, 23, 42, 0.5)',
                  color: activeTab === tab ? '#000' : '#64748b',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '1.8rem',
                  textTransform: 'uppercase',
                  transition: 'all 0.1s ease',
                  boxShadow: activeTab === tab ? '4px 4px 0 #fff' : 'inset 2px 2px 0 rgba(255,255,255,0.05)',
                  transform: activeTab === tab ? 'translate(-2px, -2px)' : 'none',
                  fontFamily: 'VT323, monospace'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ 
            minHeight: '400px', 
            background: 'rgba(0,0,0,0.3)', 
            padding: '2rem',
            boxShadow: 'inset 4px 4px 0 rgba(0,0,0,0.5)',
            borderRadius: '4px'
          }}>
            
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div>
                  <h4 style={{ color: 'var(--accent-color)', fontSize: '1.6rem', margin: '0 0 0.8rem 0', letterSpacing: '1px' }}>CURRENT_OBJECTIVE</h4>
                  <p style={{ fontSize: '1.4rem', margin: 0, color: '#f8fafc', lineHeight: '1.4' }}>
                    {pendingTasks.length > 0 ? pendingTasks[0].description : 'STANDING_BY_FOR_INPUT'}
                  </p>
                </div>
                <div>
                  <h4 style={{ color: 'var(--accent-color)', fontSize: '1.6rem', margin: '0 0 0.8rem 0', letterSpacing: '1px' }}>LAST_TRANSMISSION</h4>
                  <div style={{ 
                    background: 'rgba(0,0,0,0.5)', 
                    padding: '1.5rem', 
                    fontSize: '1.3rem',
                    color: '#94a3b8',
                    lineHeight: '1.5',
                    boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)',
                    borderLeft: '4px solid var(--accent-color)'
                  }}>
                    {agentLogs.length > 0 ? parseMessage(agentLogs[0].message).response.substring(0, 300) + '...' : 'NO_RECENT_LOG_DATA'}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <h4 style={{ color: '#eab308', fontSize: '1.6rem', margin: 0, letterSpacing: '1px' }}>PENDING_QUEUE</h4>
                {pendingTasks.length === 0 ? <p style={{ margin: 0, opacity: 0.5, fontSize: '1.2rem' }}>NO_ACTIVE_TASKS.</p> : 
                  pendingTasks.map(t => (
                    <div key={t.id} style={{ 
                      background: 'rgba(0,0,0,0.4)', 
                      padding: '1.2rem', 
                      fontSize: '1.3rem',
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center',
                      boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.3)'
                    }}>
                      <div style={{ width: '8px', height: '8px', backgroundColor: '#eab308', boxShadow: '0 0 10px #eab308' }} />
                      <span style={{ color: '#cbd5e1' }}>{t.description}</span>
                    </div>
                  ))
                }
                
                <h4 style={{ color: '#10b981', fontSize: '1.6rem', margin: '2rem 0 0 0', letterSpacing: '1px' }}>SUCCESS_ARCHIVE</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {completedTasks.slice(0, 8).map(t => (
                    <div key={t.id} style={{ 
                      background: 'rgba(16, 185, 129, 0.05)', 
                      padding: '1rem', 
                      fontSize: '1.2rem', 
                      opacity: 0.8,
                      display: 'flex',
                      gap: '1rem',
                      alignItems: 'center'
                    }}>
                      <span style={{ color: '#10b981' }}>[COMPLETED]</span>
                      <span style={{ color: '#94a3b8' }}>{t.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'thoughts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {agentLogs.length === 0 ? <p style={{ margin: 0, opacity: 0.5, fontSize: '1.2rem' }}>NO_COGNITIVE_TRACES_FOUND.</p> :
                  agentLogs.map(log => {
                    const { thought, response } = parseMessage(log.message);
                    return (
                      <div key={log.id} style={{ 
                        background: 'rgba(0,0,0,0.4)', 
                        padding: '2rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '1.5rem',
                        boxShadow: 'inset 3px 3px 0 rgba(0,0,0,0.5)',
                        borderLeft: '4px solid #64748b'
                      }}>
                        {thought && (
                          <div>
                            <div style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '0.8rem', textTransform: 'uppercase' }}>// INTERNAL_MONOLOGUE</div>
                            <div style={{ 
                              color: 'var(--accent-color)', 
                              fontSize: '1.3rem', 
                              fontStyle: 'italic', 
                              padding: '1.2rem', 
                              background: 'rgba(59, 130, 246, 0.05)',
                              lineHeight: '1.4'
                            }}>
                              {thought}
                            </div>
                          </div>
                        )}
                        {response && (
                          <div>
                            <div style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '0.8rem', textTransform: 'uppercase' }}>// EXTERNAL_OUTPUT</div>
                            <div style={{ color: '#f8fafc', fontSize: '1.3rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                              {response}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                }
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  );
};

export default AgentModal;

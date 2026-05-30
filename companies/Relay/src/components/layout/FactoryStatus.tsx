import React, { useState, useEffect } from 'react';
import { openclawSupabase } from '../../lib/openclaw';

const FactoryStatus: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch of last system status from logs
    const fetchStatus = async () => {
      const { data } = await openclawSupabase
        .from('chat_logs')
        .select('message, created_at')
        .eq('agent_name', 'SYSTEM')
        .order('created_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const lastMsg = data[0].message;
        if (lastMsg.includes('FACTORY PAUSED')) {
          setIsPaused(true);
          const timeMatch = lastMsg.match(/AT (.*)\./);
          if (timeMatch) setPausedTime(timeMatch[1]);
        }
      }
    };

    fetchStatus();

    // Listen for status changes
    const subscription = openclawSupabase
      .channel('system_status_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_logs', filter: 'agent_name=eq.SYSTEM' }, (payload: any) => {
        const msg = payload.new.message;
        if (msg.includes('FACTORY PAUSED')) {
          setIsPaused(true);
          const timeMatch = msg.match(/AT (.*)\./);
          if (timeMatch) setPausedTime(timeMatch[1]);
        } else if (msg.includes('FACTORY RESUMED')) {
          setIsPaused(false);
          setPausedTime(null);
        }
      })
      .subscribe();

    return () => {
      openclawSupabase.removeChannel(subscription);
    };
  }, []);

  const togglePause = async () => {
    const newPausedState = !isPaused;
    
    if (newPausedState) {
      const time = new Date().toLocaleTimeString();
      
      await openclawSupabase.from('chat_logs').insert([{
        agent_name: 'SYSTEM',
        message: `FACTORY PAUSED AT ${time}. ALL TASKS HALTED.`
      }]);
      
      await openclawSupabase.from('tasks').insert([{
        description: 'SYSTEM COMMAND: PAUSE ALL FACTORY OPERATIONS IMMEDIATELY',
        status: 'pending',
        assigned_to: 'Boss'
      }]);
    } else {
      await openclawSupabase.from('chat_logs').insert([{
        agent_name: 'SYSTEM',
        message: 'FACTORY RESUMED. NORMAL OPERATIONS COMMENCING.'
      }]);
      
      await openclawSupabase.from('tasks').insert([{
        description: 'SYSTEM COMMAND: RESUME ALL FACTORY OPERATIONS',
        status: 'pending',
        assigned_to: 'Boss'
      }]);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: '2rem',
      right: '2rem',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(12px)',
      padding: '1.2rem',
      boxShadow: isPaused ? '0 0 20px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(16, 185, 129, 0.2)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.6rem',
      zIndex: 1000,
      minWidth: '140px',
      borderRadius: '1rem',
      transition: 'all 0.3s ease'
    }}>
      <button 
        onClick={togglePause}
        style={{
          background: 'none',
          border: 'none',
          color: isPaused ? '#ef4444' : '#10b981',
          fontSize: '3rem',
          cursor: 'pointer',
          lineHeight: 1,
          padding: 0,
          textShadow: isPaused ? '0 0 15px rgba(239, 68, 68, 0.6)' : '0 0 15px rgba(16, 185, 129, 0.6)',
          transition: 'all 0.2s ease',
          transform: isPaused ? 'scale(1.1)' : 'scale(1)',
          fontFamily: "'VT323', monospace",
        }}
      >
        {isPaused ? '▶' : '⏸'}
      </button>
      
      <div style={{
        fontFamily: "'VT323', monospace",
        color: isPaused ? '#fca5a5' : '#6ee7b7',
        fontSize: '1.4rem',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '2px',
        fontWeight: 'bold'
      }}>
        {isPaused ? 'PAUSED' : 'ONLINE'}
      </div>
      
      {isPaused && pausedTime && (
        <div style={{
          fontFamily: "'VT323', monospace",
          color: '#ef4444',
          fontSize: '1rem',
          opacity: 0.8,
          letterSpacing: '1px'
        }}>
          {pausedTime}
        </div>
      )}
    </div>
  );
};

export default FactoryStatus;


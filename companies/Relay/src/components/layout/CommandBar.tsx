import React, { useState } from 'react';
import { openclawSupabase } from '../../lib/openclaw';

const CommandBar: React.FC = () => {
  const [command, setCommand] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsSubmitting(true);

    // 1. Insert task into HQ database
    const { error: taskError } = await openclawSupabase
      .from('tasks')
      .insert([
        { 
          description: command, 
          status: 'pending',
          assigned_to: 'Boss' 
        }
      ]);

    // 2. Insert chat log from CEO
    const { error: logError } = await openclawSupabase
      .from('chat_logs')
      .insert([
        { 
          agent_name: 'CEO', 
          message: command 
        }
      ]);

    if (taskError || logError) {
      console.error('Error sending command:', taskError || logError);
    } else {
      setCommand('');
    }
    setIsSubmitting(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '3rem',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '1000px',
      maxWidth: '95%',
      backgroundColor: 'rgba(5, 5, 8, 0.4)',
      backdropFilter: 'blur(32px)',
      padding: '0.5rem',
      display: 'flex',
      gap: '0.5rem',
      zIndex: 1000,
      border: 'none',
      borderRadius: '1.5rem',
      boxShadow: '0 20px 80px rgba(0,0,0,0.6)'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: '1.2rem 2.5rem',
        alignItems: 'center',
        gap: '1.5rem',
        borderRadius: '1rem'
      }}>
        <div style={{
          width: '8px',
          height: '14px',
          backgroundColor: '#3b82f6',
          boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)',
          animation: 'pulse 1s infinite'
        }} />
        <input 
          type="text" 
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
          placeholder="ENTER OPERATIONAL COMMAND..."
          style={{
            flex: 1,
            backgroundColor: 'transparent',
            color: '#3b82f6',
            fontSize: '1.4rem',
            textTransform: 'uppercase',
            border: 'none',
            outline: 'none',
            fontFamily: "'VT323', monospace",
            letterSpacing: '3px'
          }}
          disabled={isSubmitting}
        />
      </div>
      <button 
        onClick={handleExecute}
        disabled={isSubmitting}
        style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '0 3.5rem',
          fontSize: '1.2rem',
          opacity: isSubmitting ? 0.5 : 1,
          cursor: 'pointer',
          border: 'none',
          borderRadius: '1rem',
          fontFamily: "'VT323', monospace",
          fontWeight: 'bold',
          letterSpacing: '2px',
          transition: 'all 0.2s ease',
          textTransform: 'uppercase',
          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.2)'
        }}
      >
        {isSubmitting ? '...' : 'EXECUTE_'}
      </button>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default CommandBar;


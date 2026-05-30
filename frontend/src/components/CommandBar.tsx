import React, { useState } from 'react';
import { supabase } from '../supabase';
import { emitToast, emitOpenChat } from '../utils/events';

const CommandBar: React.FC = () => {
  const [command, setCommand] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleExecute = async () => {
    if (!command.trim()) return;
    setIsSubmitting(true);

    // 1. Insert task
    const { error: taskError } = await supabase
      .from('tasks')
      .insert([
        { 
          description: command, 
          status: 'pending',
          assigned_to: 'Boss' 
        }
      ]);

    // 2. Insert chat log from CEO
    const { error: logError } = await supabase
      .from('chat_logs')
      .insert([
        { 
          agent_name: 'CEO', 
          message: command 
        }
      ]);

    if (taskError || logError) {
      emitToast('Error sending command: ' + (taskError?.message || logError?.message), 'error');
    } else {
      emitToast('Command sent to the Boss!', 'success');
      setCommand('');
      emitOpenChat(); // Automatically open the AI Comm Link
    }
    setIsSubmitting(false);
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '800px',
      backgroundColor: 'var(--panel-bg)',
      padding: '1rem',
      boxShadow: '6px 6px 0px #3b82f6', // Changed to blue to match theme and replace border
      display: 'flex',
      gap: '1rem',
      zIndex: 50
    }}>
      <input 
        type="text" 
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
        placeholder="GIVE AN INSTRUCTION TO THE BOSS..."
        style={{
          flex: 1,
          backgroundColor: '#000',
          color: '#10b981',
          padding: '1rem',
          fontSize: '1.5rem',
          textTransform: 'uppercase',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit'
        }}
        disabled={isSubmitting}
      />
      <button 
        onClick={handleExecute}
        disabled={isSubmitting}
        style={{
          backgroundColor: '#3b82f6',
          color: 'white',
          padding: '0 2rem',
          fontSize: '1.5rem',
          opacity: isSubmitting ? 0.5 : 1,
          cursor: 'pointer',
          border: 'none',
          boxShadow: '4px 4px 0px #000',
          fontFamily: 'inherit',
          fontWeight: 'bold'
        }}
      >
        {isSubmitting ? 'SENDING...' : 'EXECUTE'}
      </button>
    </div>
  );
};

export default CommandBar;

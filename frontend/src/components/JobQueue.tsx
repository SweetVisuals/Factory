import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface Task {
  id: string;
  description: string;
  status: string;
  assigned_to: string;
  created_at: string;
}

const JobQueue: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
    
    const subscription = supabase
      .channel('job_queue_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <div style={{ color: 'white', fontFamily: 'VT323', fontSize: '2rem' }}>INITIALIZING_QUEUE...</div>;
  }

  return (
    <div className="job-queue-container" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      color: 'white',
      overflow: 'hidden'
    }}>
      <h2 className="page-title" style={{ fontSize: '4rem', marginBottom: '1rem', color: 'white', textAlign: 'center', textShadow: '2px 2px 0 var(--accent-color)' }}>JOB_SCHEDULER</h2>
      <p style={{ color: '#64748b', fontSize: '1.2rem', textAlign: 'center', marginBottom: '3rem', fontFamily: 'VT323, monospace', letterSpacing: '4px' }}>
        PENDING_OPERATIONS_QUEUE // ACTIVE_THREADS
      </p>

      <div className="job-queue-grid" style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '1rem',
        gap: '1.5rem',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%',
        scrollbarWidth: 'none'
      }}>
        {tasks.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', marginTop: '10rem', opacity: 0.5 }}>
             <div style={{ fontSize: '2rem', color: '#64748b', fontFamily: 'VT323' }}>QUEUE_EMPTY</div>
             <div style={{ fontSize: '1rem', color: '#475569', fontFamily: 'VT323' }}>ALL_TASKS_PROCESSED_SUCCESSFULLY</div>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} style={{ 
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))',
              backdropFilter: 'blur(32px)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'inset 3px 3px 0 rgba(255,255,255,0.05), inset -3px -3px 0 rgba(0,0,0,0.5), 0 10px 20px rgba(0,0,0,0.4)',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '4px', 
                height: '100%', 
                backgroundColor: task.status === 'in_progress' ? '#eab308' : '#3b82f6',
                boxShadow: `0 0 10px ${task.status === 'in_progress' ? '#eab308' : '#3b82f6'}`
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ 
                  color: '#94a3b8', 
                  fontSize: '1rem', 
                  fontFamily: 'VT323',
                  background: 'rgba(0,0,0,0.4)',
                  padding: '0.2rem 0.6rem',
                  boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.5)'
                }}>
                  ID: {task.id.substring(0, 8).toUpperCase()}
                </span>
                <span style={{ 
                  color: task.status === 'in_progress' ? '#eab308' : '#3b82f6',
                  fontSize: '1rem',
                  fontFamily: 'VT323',
                  textTransform: 'uppercase'
                }}>
                  {task.status}
                </span>
              </div>

              <div style={{ 
                fontSize: '1.4rem', 
                color: '#f8fafc', 
                fontFamily: 'VT323', 
                lineHeight: '1.2',
                flex: 1
              }}>
                {task.description}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '6px', height: '6px', backgroundColor: '#3b82f6' }} />
                  <span style={{ color: '#3b82f6', fontSize: '1.1rem', fontFamily: 'VT323' }}>
                    {task.assigned_to || 'UNASSIGNED'}
                  </span>
                </div>
                <span style={{ color: '#475569', fontSize: '0.9rem', fontFamily: 'VT323' }}>
                  {new Date(task.created_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default JobQueue;

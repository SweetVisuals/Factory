import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { emitToast } from '../utils/events';

interface TimelineStep {
  step_number: number;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
}

const Discover: React.FC = () => {
  const [activeBusiness, setActiveBusiness] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    
    const subscription = supabase
      .channel('public:tasks_and_biz')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: activeBiz } = await supabase.from('businesses').select('*').eq('status', 'active').limit(1).maybeSingle();
      if (activeBiz) {
        setActiveBusiness(activeBiz);
        const { data: tlData } = await supabase.from('tasks').select('description').eq('assigned_to', `__TASKLIST__${activeBiz.id}`).maybeSingle();
        if (tlData && tlData.description) {
          try {
            const parsed = JSON.parse(tlData.description);
            setTimeline(parsed);
          } catch(e) {
            console.error("Failed to parse timeline JSON:", e);
            setTimeline([]);
          }
        } else {
           setTimeline([]);
        }
      } else {
        setActiveBusiness(null);
        setTimeline([]);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm("WIPE ALL GRANULAR AGENT LOGS? This clears the agent logs but keeps the Timeline intact.")) return;
    
    // We wipe tasks except the timeline
    const { error } = await supabase
      .from('tasks')
      .delete()
      .not('assigned_to', 'like', '__TASKLIST__%');

    if (!error) {
      emitToast("Agent logs cleared!", "success");
    } else {
      console.error("Error clearing logs:", error);
      emitToast("Failed to clear logs", "error");
    }
  };

  const resetTimeline = async () => {
    if (!activeBusiness) return;
    if (!window.confirm("RESET TIMELINE? The Boss will generate a new one.")) return;
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('assigned_to', `__TASKLIST__${activeBusiness.id}`);
      
    if (!error) {
      setTimeline([]);
      emitToast("Timeline reset!", "success");
    }
  };

  if (loading) {
    return <div style={{ color: 'white', fontSize: '2rem', padding: '2rem' }}>LOADING TIMELINE...</div>;
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%', 
      backgroundColor: 'var(--primary-color)', 
      color: 'var(--text-color)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ padding: '8rem 2rem 2rem', display: 'flex', flexDirection: 'column', gap: '3rem', maxWidth: '1200px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
             <h2 className="page-title" style={{ fontSize: '4.5rem', marginBottom: '0.5rem', textShadow: 'none' }}>GLOBAL_TIMELINE</h2>
             <div style={{ 
               display: 'flex', 
               alignItems: 'center', 
               gap: '1rem',
               color: 'var(--text-muted)',
               fontFamily: 'VT323, monospace',
               fontSize: '1.2rem',
               letterSpacing: '4px'
             }}>
               {activeBusiness ? `ACTIVE BUSINESS: ${activeBusiness.name.toUpperCase()}` : 'NO ACTIVE BUSINESS'}
             </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={resetTimeline} className="pixel-btn" style={{ fontSize: '1rem', padding: '0.5rem 1rem', background: 'var(--secondary-color)', color: '#eab308', border: 'none', boxShadow: '3px 3px 0px #854d0e', cursor: 'pointer' }}>
              [↻] RESET TIMELINE
            </button>
            <button onClick={clearLogs} className="pixel-btn" style={{ fontSize: '1rem', padding: '0.5rem 1rem', background: 'var(--secondary-color)', color: '#ef4444', border: 'none', boxShadow: '3px 3px 0px #7f1d1d', cursor: 'pointer' }}>
              [×] WIPE AGENT LOGS
            </button>
          </div>
        </div>

        {!activeBusiness ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', fontFamily: 'VT323, monospace', fontSize: '1.5rem' }}>
            Please activate a business in the Profile panel.
          </div>
        ) : timeline.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--accent-color)', fontFamily: 'VT323, monospace', fontSize: '1.5rem', animation: 'pulse 2s infinite' }}>
            AWAITING BOSS DIRECTIVE... (Generating Timeline)
          </div>
        ) : (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative',
            zoom: 0.75
          }}>
            {/* Connecting Line */}
            <div style={{
              position: 'absolute',
              left: '30px',
              top: '40px',
              bottom: '40px',
              width: '4px',
              backgroundColor: 'var(--secondary-color)',
              zIndex: 0
            }} />

            {timeline.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in_progress';
              
              const sColor = isCompleted ? '#10b981' : isInProgress ? '#eab308' : '#334155';
              const bgOpacity = isCompleted ? '0.4' : isInProgress ? '0.8' : '0.2';
              
              return (
                <div key={idx} style={{ 
                  display: 'flex', 
                  gap: '2rem',
                  alignItems: 'center',
                  zIndex: 1
                }}>
                  
                  {/* Step Node */}
                  <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: sColor,
                    boxShadow: isInProgress ? `0 0 20px ${sColor}` : `inset 2px 2px 0 rgba(255,255,255,0.2)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'VT323, monospace',
                    fontSize: '2rem',
                    color: isCompleted ? '#064e3b' : '#fff',
                    flexShrink: 0,
                    transition: 'all 0.3s ease'
                  }}>
                    {isCompleted ? '✓' : step.step_number}
                  </div>
                  
                  {/* Step Card */}
                  <div style={{ 
                    flex: 1,
                    backgroundColor: `rgba(15, 23, 42, ${bgOpacity})`,
                    padding: '1.5rem 2rem',
                    color: isCompleted ? '#94a3b8' : 'var(--text-color)',
                    fontFamily: 'VT323, monospace',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.3s ease',
                    boxShadow: isInProgress ? `4px 4px 0px ${sColor}` : `4px 4px 0px rgba(0,0,0,0.5)`,
                    position: 'relative'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ 
                         color: sColor, 
                         fontSize: '1rem',
                         background: 'rgba(0, 0, 0, 0.4)',
                         padding: '0.2rem 0.6rem',
                         textTransform: 'uppercase',
                         letterSpacing: '1px'
                       }}>
                         [{step.status}]
                       </span>
                    </div>
                    <div style={{ 
                      fontSize: '1.8rem', 
                      lineHeight: '1.3', 
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      color: isCompleted ? '#64748b' : '#f8fafc'
                    }}>
                      {step.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
